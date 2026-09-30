# Install BugsTow on your computer

BugsTow runs on your own computer, like other open-source local web apps. You install it with
one command and open it in your browser at **http://localhost:5757**. It has no cloud
features and no hosted service: your issues stay on your computer. Everything works offline
after installation; only installing, updating and GitHub import use the internet.

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

The first time, BugsTow asks: **just you, or with other people?**

- **Local**: just you. Issues are saved in this browser. No account, nothing to set up.
- **Team**: you and people you invite. Issues are saved in BugsTow's data folder on this PC
  and backed up daily. You create a sign-in (the email is only a sign-in name; nothing is
  emailed to it), then invite people on your Wi-Fi or through Tailscale (below).

You can switch any time in **Settings** (Local) or the account menu (Team). Switching doesn't
move anything; in Team, **Copy Local issues** brings your Local issues over.

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
| `bugstow share` | Let people on other networks connect through Tailscale (see below) |
| `bugstow unshare` | Stop sharing through Tailscale |
| `bugstow reset-password you@example.com` | Forgot your password: sets a temporary one |
| `bugstow logs` | Show the log |
| `bugstow uninstall` | Remove BugsTow; your data folder is kept |

BugsTow doesn't start by itself when you turn the computer on. Open it when you need it.

**Bring in your GitHub issues:** click **Import from GitHub** and paste the repository link.
There's nothing to set up first. Private repositories need a read-only key; the dialog shows
how to make one. BugsTow only contacts GitHub at the moment you import. (To forbid it
entirely, put `BUGSTOW_OFFLINE=true` in `bugstow.env` and run `bugstow restart`.)

## Where your data is

Local issues are in the browser you use for BugsTow. Download a backup from **Settings → Data &
backups** now and then. Team data is in this folder:

| System | Data folder |
|---|---|
| Windows | `%LOCALAPPDATA%\BugsTow\data` |
| macOS | `~/Library/Application Support/BugsTow/data` |
| Linux | `~/.local/share/bugstow/data` |

It holds the database (`bugstow.sqlite`), the screenshots and daily backups (`backups/`,
the last 7 are kept). Installing, updating or uninstalling never changes this folder.

### A second copy on another drive

Backups in the data folder don't help if the disk dies. BugsTow can also copy every backup to a
second drive (a USB disk, another internal drive, a NAS). Create an empty file named
`.bugstow-backup-target` in that folder, then create a text file named `bugstow.env` in the
BugsTow folder (the one that contains `data`) and run `bugstow restart`:

```env
BUGSTOW_BACKUP_EXTERNAL_DIR=D:/BugsTow backups
```

`bugstow logs` shows whether backups succeed. Copying the data folder while BugsTow is stopped
also works.

Don't point this at a folder that Google Drive, Dropbox or OneDrive syncs: the copies there are
not encrypted. (BugsTow 2.5 and earlier had cloud backups; they were removed in 2.6, and
`BUGSTOW_BACKUP_CLOUD_DIR` and the WebDAV settings are now ignored.)

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

## People on other networks (`bugstow share`)

A `localhost` address only ever opens on your own PC, and `--lan` only reaches your own
network. For a friend somewhere else, BugsTow uses [Tailscale](https://tailscale.com), a free
private-network app. Your PC and your friend's devices join it; nobody else can reach BugsTow,
and it is not published on the open internet.

1. Install Tailscale on your PC and sign in.
2. Run `bugstow share`. It prints an address like `https://my-pc.tail1234.ts.net:5757` with a
   real certificate (no browser warning). BugsTow keeps listening on this PC only; Tailscale
   forwards to it. It uses BugsTow's own port and refuses if something else already uses that
   port in Tailscale, so it never replaces other things you share.
3. Share your PC with your friend: [Tailscale admin console](https://login.tailscale.com/admin/machines)
   → **Machines** → your PC → **⋯** → **Share**, and send them the share link Tailscale gives you.
4. Your friend installs Tailscale, signs in and accepts the share.
5. Invite them (below). The join link BugsTow shows now uses the Tailscale address.

Your PC must be on and BugsTow running while they use it. `bugstow unshare` stops sharing;
`bugstow start --lan` also turns it off. The first run can ask you to enable HTTPS certificates
in the Tailscale admin console (a one-time click).

## Inviting people

Inviting needs **Team**. Local is only ever you.

BugsTow **doesn't send invitation emails**: it has no email service, on purpose. An invite is a name
on a list, so you send the person the link yourself. Until you do, they see nothing.

1. Make BugsTow reachable for them first: `bugstow share` for people elsewhere, or
   `bugstow start --lan` for people on your network (then open the address it prints, not
   `localhost`).
2. Open **People & invitations**, enter their email and click **Create invitation**. Choose
   Member for everyday work; Admin can also manage people. Existing accounts are added immediately.
3. Copy the join link and send it in your own chat or email. Use **Share link** beside a pending
   invitation to find its link again. The panel warns you when the link would only work on your PC.
4. The link opens account creation with their email already filled in. They choose a password
   and join automatically. Existing users choose **I already have an account** and sign in.

Invitations expire after 7 days. Create the invitation again to renew it or change its role.
You can cancel a pending invitation from the list.

## Keeping some projects to yourself

Either keep them in Local, or keep them in Team in a workspace only you are in.

People you invite see every project in that workspace. To make a Team project private, move it
to a workspace only you are in: in the sidebar, click **⋯** next to the project → **Move to
workspace** → **New workspace, only you** (or an existing one). Its issues and screenshots move
with it. Switch between workspaces at the top left; each shows how many people are in it.

(**Switch to Local** in the account menu opens your separate Local list in this browser. It
doesn't move Team projects.)

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
