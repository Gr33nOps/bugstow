#!/bin/sh
# BugsTow installer for macOS and Linux. Run in a terminal:
#
#   curl -fsSL https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.sh | sh
#
# What it does (no sudo needed):
#   1. Downloads the latest BugsTow release from GitHub and checks its SHA-256.
#   2. Downloads a private copy of Node.js from nodejs.org (checked against the
#      official SHASUMS256.txt) so BugsTow keeps working whatever else is installed.
#   3. Installs into ~/.local/share/bugstow (Linux) or
#      ~/Library/Application Support/BugsTow (macOS). Your data lives in the
#      "data" folder there and is never touched by installs or updates.
#   4. Adds a `bugstow` command (~/.local/bin) and an app launcher entry.
#   5. Starts BugsTow and opens it in your browser (http://localhost:5757).
#
# Run the same command again to update. Remove with: bugstow uninstall
#
# Options (environment variables): BUGSTOW_HOME, BUGSTOW_PACKAGE (local .tar.gz
# or URL instead of the latest release), BUGSTOW_NO_SHORTCUTS=1, BUGSTOW_NO_START=1.
set -eu

REPO="Gr33nOps/bugstow"
NODE_VERSION="22.23.3"

say() { printf '  %s\n' "$*"; }
step() { printf '\n> %s\n' "$*"; }
die() { printf '\n  Error: %s\n\n' "$*" >&2; exit 1; }

case "$(uname -s)" in
  Linux) os=linux; default_home="${XDG_DATA_HOME:-$HOME/.local/share}/bugstow" ;;
  Darwin) os=darwin; default_home="$HOME/Library/Application Support/BugsTow" ;;
  *) die "Unsupported system: $(uname -s). On Windows use install.ps1." ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) die "Unsupported processor: $(uname -m)." ;;
esac

ROOT="${BUGSTOW_HOME:-$default_home}"
APP_DIR="$ROOT/app"
NODE_DIR="$ROOT/node"
BIN_LINK="$HOME/.local/bin/bugstow"

if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL -A bugstow-installer "$1" -o "$2"; }
  fetch_text() { curl -fsSL -A bugstow-installer "$1"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -q -U bugstow-installer -O "$2" "$1"; }
  fetch_text() { wget -q -U bugstow-installer -O - "$1"; }
else
  die "curl or wget is needed."
fi
command -v tar >/dev/null 2>&1 || die "tar is needed."
if command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null 2>&1; then
  sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
  die "sha256sum or shasum is needed."
fi

printf '\nBugsTow installer\n'
tmp="$(mktemp -d 2>/dev/null || mktemp -d -t bugstow)"
trap 'rm -rf "$tmp"' EXIT INT TERM
mkdir -p "$ROOT"

# ── 1. The BugsTow package ──────────────────────────────────────────────────
step "Getting BugsTow"
pkg="$tmp/bugstow-app.tar.gz"
expected=""
if [ -n "${BUGSTOW_PACKAGE:-}" ]; then
  case "$BUGSTOW_PACKAGE" in
    http://* | https://*)
      fetch "$BUGSTOW_PACKAGE" "$pkg"
      if fetch "$BUGSTOW_PACKAGE.sha256" "$pkg.sha256" 2>/dev/null; then expected="$(cut -d' ' -f1 <"$pkg.sha256")"; fi ;;
    *)
      cp "$BUGSTOW_PACKAGE" "$pkg"
      if [ -f "$BUGSTOW_PACKAGE.sha256" ]; then expected="$(cut -d' ' -f1 <"$BUGSTOW_PACKAGE.sha256")"; fi ;;
  esac
  say "Package: $BUGSTOW_PACKAGE"
else
  json="$(fetch_text "https://api.github.com/repos/$REPO/releases/latest")" || die "Could not reach GitHub."
  url="$(printf '%s' "$json" | grep -o '"browser_download_url": *"[^"]*bugstow-app-[^"]*\.tar\.gz"' | head -n 1 | sed 's/.*"\(https[^"]*\)"/\1/')"
  [ -n "$url" ] || die "The latest release has no BugsTow app package."
  say "Version $(printf '%s' "$url" | sed 's/.*bugstow-app-\(.*\)\.tar\.gz/\1/')"
  fetch "$url" "$pkg"
  fetch "$url.sha256" "$pkg.sha256"
  expected="$(cut -d' ' -f1 <"$pkg.sha256")"
fi
if [ -n "$expected" ]; then
  [ "$(sha256 "$pkg")" = "$expected" ] || die "The download is damaged or was changed (SHA-256 mismatch). Nothing was installed."
  say "Checksum OK"
elif [ -z "${BUGSTOW_PACKAGE:-}" ]; then
  die "No checksum available for the download. Nothing was installed."
fi

# ── 2. Stop a running BugsTow (an update replaces its files) ───────────────
if [ -x "$NODE_DIR/bin/node" ] && [ -f "$APP_DIR/bugstow.mjs" ]; then
  "$NODE_DIR/bin/node" "$APP_DIR/bugstow.mjs" stop >/dev/null 2>&1 || true
fi

# ── 3. Private Node.js ──────────────────────────────────────────────────────
if [ ! -x "$NODE_DIR/bin/node" ] || [ "$("$NODE_DIR/bin/node" -v 2>/dev/null)" != "v$NODE_VERSION" ]; then
  step "Getting Node.js $NODE_VERSION (used only by BugsTow)"
  node_name="node-v$NODE_VERSION-$os-$arch"
  fetch "https://nodejs.org/dist/v$NODE_VERSION/$node_name.tar.gz" "$tmp/$node_name.tar.gz"
  fetch "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" "$tmp/SHASUMS256.txt"
  want="$(grep " $node_name.tar.gz\$" "$tmp/SHASUMS256.txt" | cut -d' ' -f1)"
  [ -n "$want" ] && [ "$(sha256 "$tmp/$node_name.tar.gz")" = "$want" ] || die "Node.js download failed its checksum. Nothing was installed."
  tar -xzf "$tmp/$node_name.tar.gz" -C "$tmp"
  rm -rf "$NODE_DIR"
  mv "$tmp/$node_name" "$NODE_DIR"
  say "Checksum OK"
fi

# ── 4. Unpack BugsTow and install its libraries ────────────────────────────
step "Installing"
mkdir -p "$tmp/pkg"
tar -xzf "$pkg" -C "$tmp/pkg"
staged="$(find "$tmp/pkg" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[ -n "$staged" ] && [ -f "$staged/bugstow.mjs" ] || die "The package does not look like BugsTow."
(
  cd "$staged/server"
  PATH="$NODE_DIR/bin:$PATH" "$NODE_DIR/bin/npm" ci --omit=dev --no-audit --no-fund --no-update-notifier --loglevel=error
) || die "Installing BugsTow's libraries failed (see the npm output above)."
rm -rf "$APP_DIR.old"
[ -d "$APP_DIR" ] && mv "$APP_DIR" "$APP_DIR.old"
mv "$staged" "$APP_DIR"
rm -rf "$APP_DIR.old"
say "BugsTow $(cat "$APP_DIR/VERSION") installed in $APP_DIR"

# ── 5. `bugstow` command and launcher entry ────────────────────────────────
mkdir -p "$ROOT/bin" "$(dirname "$BIN_LINK")"
cat >"$ROOT/bin/bugstow" <<EOF
#!/bin/sh
exec "$NODE_DIR/bin/node" "$APP_DIR/bugstow.mjs" "\$@"
EOF
chmod +x "$ROOT/bin/bugstow"
ln -sf "$ROOT/bin/bugstow" "$BIN_LINK"
case ":$PATH:" in
  *":$HOME/.local/bin:"*) say "Added the \"bugstow\" command" ;;
  *) say "Added the \"bugstow\" command in ~/.local/bin (add that folder to your PATH to use it)" ;;
esac

if [ "${BUGSTOW_NO_SHORTCUTS:-}" != "1" ]; then
  if [ "$os" = linux ]; then
    apps="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
    mkdir -p "$apps"
    cat >"$apps/bugstow.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=BugsTow
Comment=Issue tracker running on this computer
Exec="$ROOT/bin/bugstow"
Icon=$APP_DIR/bugstow.png
Terminal=false
Categories=Development;
EOF
    say "Added BugsTow to your applications menu"
  else
    app="$HOME/Applications/BugsTow.app"
    rm -rf "$app"
    mkdir -p "$app/Contents/MacOS"
    cat >"$app/Contents/MacOS/BugsTow" <<EOF
#!/bin/sh
exec "$NODE_DIR/bin/node" "$APP_DIR/bugstow.mjs"
EOF
    chmod +x "$app/Contents/MacOS/BugsTow"
    cat >"$app/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>BugsTow</string>
  <key>CFBundleIdentifier</key><string>app.bugstow.launcher</string>
  <key>CFBundleExecutable</key><string>BugsTow</string>
  <key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>
EOF
    say "Added BugsTow to ~/Applications"
  fi
fi

# ── 6. Start ────────────────────────────────────────────────────────────────
printf '\nDone. Your data folder: %s\n' "$ROOT/data"
if [ "${BUGSTOW_NO_START:-}" != "1" ]; then
  "$NODE_DIR/bin/node" "$APP_DIR/bugstow.mjs" start
else
  say "Start it with: bugstow"
fi
