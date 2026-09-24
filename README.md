# bugstow.

> **Spot it. Stow it. Fix it.**
> An issue tracker for bugs, UI problems and ideas you notice while building.
> It runs on your own computer, or on your own server for your team.

BugsTow replaces screenshotting bugs into your DMs or notes: capture an issue,
paste a screenshot, and turn it into a ready-to-paste prompt for your coding
assistant later.

BugsTow does not store your project data on infrastructure operated by the
BugsTow maintainer. There is no hosted BugsTow service: you install it.

## Install

**Windows** (PowerShell):

```powershell
irm https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.ps1 | iex
```

**macOS / Linux**:

```sh
curl -fsSL https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.sh | sh
```

The command installs BugsTow for your user (no administrator rights, nothing to
install first), adds a **BugsTow** shortcut and a `bugstow` command, and opens
http://localhost:5757. After that BugsTow works offline. Run the same command
again to update; `bugstow uninstall` removes it and keeps your data.

**→ Details: [`docs/INSTALL.md`](docs/INSTALL.md)** (where data is kept,
commands, phones on your Wi-Fi, troubleshooting).

---

## Where your issues are kept

On first open, BugsTow asks where to keep your issues:

- **In a folder on this PC** (recommended): saved in BugsTow's data folder
  (`bugstow.sqlite` plus the screenshots) and backed up there automatically while BugsTow runs.
  Clearing the browser doesn't touch them. You create a sign-in once.
- **Only in this browser:** no sign-in; stored in the browser's IndexedDB.
  Clearing the browser's data erases them, so export backups.
- **Synced with my own cloud:** in the browser, plus encrypted sync through
  your own Google Drive, Dropbox, WebDAV server, a folder your cloud app syncs
  (Mega, Terabox, OneDrive…) or a sync file. See
  [`docs/CLOUD_SYNC.md`](docs/CLOUD_SYNC.md).

Everything you can do:

- **Import from GitHub:** click **Import from GitHub** (top of the sidebar, or
  in an empty inbox), paste a repository link, done. Each GitHub issue becomes a
  BugsTow issue linked back to GitHub, in a project named after the repository.
  Public repositories need nothing else; for a private one the dialog walks you
  through making a read-only key. Import again anytime to pick up new issues and
  GitHub's open/closed changes, without duplicates.
- **Screenshots:** paste (`Ctrl/Cmd+V`), drag and drop, or pick a file
  (PNG/JPEG/WebP).
- **Copy as Prompt:** turn an issue into a structured prompt for an AI assistant.
- **Backups:** export a file you can restore later, optionally encrypted with a
  passphrase (AES-256-GCM, PBKDF2 with 100,000 iterations).
- **Offline:** nothing needs the internet after installing. BugsTow only goes
  online when you use GitHub import or turn on cloud sync. See
  [`docs/OFFLINE.md`](docs/OFFLINE.md).

> **Good to know:** browser storage is **not encrypted on disk**, and neither
> is the data folder; only exported files you choose to encrypt are. Anyone who
> can use your computer account can read them.

---

## For a team (self-hosted server)

Run the same app on a computer or server your team controls:

- Node.js + Express, a **SQLite** database and screenshots on the **local
  disk**, packaged with **Docker Compose**.
- Accounts, teams, roles (owner/admin/member), invites, assignment, and optional
  GitHub issue import (a team server's administrator turns it on with
  `BUGSTOW_OFFLINE=false`; the installed app has it on).
- **First-run protection:** creating the first administrator needs a one-time
  setup token printed in the server log.
- **HTTPS on your LAN** with a certificate generated locally (recommended
  whenever other computers connect).
- **Automatic backups**, optionally copied to a second drive, USB disk or NAS,
  or sent encrypted to your own cloud.
- Two people editing the same issue can't silently overwrite each other: the
  later save is refused with a "reload first" message.

The team server is the source of truth; teammates can't reach shared data while
it is off. Team data is readable by whoever controls the server (it is not
end-to-end encrypted, and not encrypted at rest by BugsTow).

**→ Guide: [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md)** ·
**No internet? [`docs/RELEASE_OFFLINE.md`](docs/RELEASE_OFFLINE.md)**

Quick start:

```bash
git clone https://github.com/Gr33nOps/bugstow.git
cd bugstow
cp server/.env.example .env      # set BUGSTOW_AUTH_SECRET; for your LAN also BASE_URL + TLS
docker compose up -d --build
docker compose logs bugstow      # copy the one-time setup token
```

Open the server, choose **My team** and create the administrator with the token.

For just yourself plus a phone on the same Wi-Fi, the installed app is enough:
`bugstow start --lan` (see [`docs/INSTALL.md`](docs/INSTALL.md)).

---

## Moving issues between places

You keep the original; the destination gets a copy:

1. Where the issues are now → **Settings → Export Backup**.
2. Where they should go → **Settings → Import Backup** (browser storage), or
   **user menu → Import personal data** (the PC folder or a team server).

Importing only adds data. It never deletes anything.

---

## Security

BugsTow has had an internal security review and has automated tests for its
access rules, but no independent audit. To report a vulnerability, see
[`SECURITY.md`](SECURITY.md). Please don't post details in a public issue.

---

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, `vite-plugin-pwa`
- **Browser storage:** IndexedDB (`idb`)
- **Crypto (exports, sync):** Web Crypto (PBKDF2-HMAC-SHA256, AES-256-GCM)
- **Server:** Node.js, Express, SQLite (`better-sqlite3`), better-auth
- **Distribution:** one-command installers (`install.ps1`, `install.sh`) with
  a private Node.js runtime; Docker Compose for team servers
- **Tests:** Vitest (frontend), `node:test` (server), two-client acceptance test

---

## Project structure

```
bugstow/
├── src/                       # React app
│   ├── App.tsx                # Browser-storage app
│   ├── RootApp.tsx            # Picks browser storage vs server at runtime
│   ├── components/team/       # Server-backed UI (PC folder / team)
│   ├── sync/                  # Bring-your-own-cloud sync
│   ├── hooks/, lib/, services/
├── server/                    # The BugsTow server (desktop app and team server)
│   └── src/                   # Express app, auth, SQLite, backups, TLS, tests
├── desktop/bugstow.mjs        # The `bugstow` launcher of the installed app
├── install.ps1, install.sh    # One-command installers
├── scripts/                   # app package + offline bundle builders, acceptance test
├── docs/                      # INSTALL, SELF_HOSTING, CLOUD_SYNC, OFFLINE, RELEASE_*
└── Dockerfile, docker-compose.yml, docker-compose.offline.yml
```

---

## Development

```bash
npm ci
npm run dev        # http://localhost:8443 (browser storage)

# Server (separate terminal):
cd server && npm ci
BUGSTOW_AUTH_SECRET=dev-secret-0123456789 npm run dev   # http://localhost:8080
```

In development, Vite proxies `/api` to `http://localhost:8080` (override with
`BUGSTOW_SERVER`).

```bash
npm run typecheck && npm test && npm run build
cd server && npm run typecheck && npm test
node scripts/build-app-package.mjs    # release/bugstow-app-<version>.tar.gz for the installers
```

To try an installer against a local package:
`BUGSTOW_PACKAGE=release/bugstow-app-<version>.tar.gz sh install.sh`.

---

## License

MIT.
