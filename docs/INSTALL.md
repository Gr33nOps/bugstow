# Install BugsTow on your computer

BugsTow runs on your own computer, like other open-source local web apps. You install it with
one command and open it in your browser at **http://localhost:5757**. Issues and screenshots
are saved in a data folder on your PC, and nothing is sent to a server run by someone else.
BugsTow works offline; it only needs the internet while installing or updating.

## Install

**Windows** (PowerShell):

```powershell
irm https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.ps1 | iex
```

**macOS / Linux** (Terminal):

```sh
curl -fsSL https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.sh | sh
```

The installer doesn't need administrator rights, and you don't need to install anything first.
It:

1. downloads the latest BugsTow release from GitHub and checks its SHA-256 checksum
2. downloads a private copy of Node.js from nodejs.org, checked against the official
   checksums. Only BugsTow uses it; it doesn't change any other Node.js on your PC.
3. installs BugsTow, adds a **BugsTow** shortcut (Start menu and desktop on Windows, the
   applications menu on Linux, `~/Applications` on macOS) and a `bugstow` command
4. starts BugsTow and opens it in your browser.

The first time, BugsTow asks where to keep your issues. Choose **In a folder on this PC** and
create your sign-in. The email is only a sign-in name; nothing is emailed to it.

## Everyday use

Click the **BugsTow** shortcut, or run `bugstow`. It starts BugsTow in the background (if it
isn't running yet) and opens it in your browser. You can also bookmark http://localhost:5757.

| Command | What it does |
|---|---|
| `bugstow` | Start (if needed) and open BugsTow |
| `bugstow stop` | Stop BugsTow |
| `bugstow status` | Is it running? Where is my data? |
| `bugstow data` | Open the data folder |
| `bugstow start --port 5858` | Use another port (remembered) |
| `bugstow start --lan` | Let phones and other computers on your network connect (see below) |
| `bugstow start --local` | This PC only again (the default) |
| `bugstow reset-password you@example.com` | Forgot your password: sets a temporary one |
| `bugstow logs` | Show the log |
| `bugstow uninstall` | Remove BugsTow; your data folder is kept |

BugsTow doesn't start by itself when you turn the computer on. Open it when you need it.

## Where your data is

| System | Data folder |
|---|---|
| Windows | `%LOCALAPPDATA%\BugsTow\data` |
| macOS | `~/Library/Application Support/BugsTow/data` |
| Linux | `~/.local/share/bugstow/data` |

It holds the database (`bugstow.sqlite`), the screenshots and daily backups (`backups/`,
the last 7 are kept). Installing, updating or uninstalling never changes this folder.

To keep a copy somewhere else, copy the data folder while BugsTow is stopped, or use the
backup options in [CLOUD_SYNC.md](CLOUD_SYNC.md) (encrypted archives to a folder your
Google Drive, Dropbox, OneDrive, Mega or Terabox app syncs, or to WebDAV).

The two browser-only choices on the welcome screen ("Only in this browser", "Synced with my
own cloud") keep issues in the browser instead of the data folder. See the README.

## Update

Run the install command again. It stops BugsTow, replaces the app and keeps your data.

## Phones and other computers (`--lan`)

By default only this PC can open BugsTow. `bugstow start --lan` lets devices on the same
network connect over HTTPS, at the address the command prints (for example
`https://192.168.1.20:5757`).

- The certificate is made on your PC, so each browser warns the first time. Check that the
  fingerprint matches the one in the log (`bugstow logs`) before accepting it.
- Windows asks whether Node.js may use the network. Allow it for **private** networks only.
- Everyone signs in with an account on your BugsTow, and all data stays on your PC. Your PC
  must be on for others to use it.
- Only use `--lan` on a network you trust, such as your home Wi-Fi, never on public Wi-Fi.

`bugstow start --local` switches back.

## For a whole team

To run BugsTow on a server for many people, use the Docker setup in
[SELF_HOSTING.md](SELF_HOSTING.md). It's the same app with team settings and backups to a
second disk.

## Uninstall

```sh
bugstow uninstall
```

This removes the app, the private Node.js, the shortcuts and the `bugstow` command. Your data
folder stays; delete it yourself if you want your issues gone.

## Troubleshooting

- **"Port 5757 is used by another program"**: run `bugstow start --port 5858`.
- **It doesn't start**: `bugstow logs` shows why.
- **The `bugstow` command isn't found**: open a new terminal. On Linux/macOS, make sure
  `~/.local/bin` is on your PATH.
- **Forgot your password**: `bugstow reset-password you@example.com` prints a temporary
  password; you choose a new one when you sign in.
