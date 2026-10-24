# Install BugsTow on your computer

BugsTow runs on your own computer, like other open-source local web apps. You install it with
one command and open it in your browser at **http://localhost:5757**. It has no cloud
features and no hosted service: your issues stay on your computer. Everything works offline
after installation; only installing, updating and GitHub import/export use the internet.

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

Switch any time with the **Local | Team** switch at the bottom of the sidebar (in Team on a phone,
use the account menu). Switching doesn't move anything; in Team, **Copy Local issues** brings all
your Local issues over. To copy one project, open **Projects** in Local, choose its **⋯** menu, then
choose **Copy to Team**. The Local copy stays in place.

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
| `bugstow connect URL` | Make the BugsTow shortcut open a shared Team workspace every time |
| `bugstow disconnect` | Return the shortcut to BugsTow on this computer |
| `bugstow unshare` | Stop sharing through Tailscale |
| `bugstow reset-password <username>` | Forgot a password: sets a temporary one (an email works for older accounts) |
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
5. Invite them (below). Invite links now use the Tailscale address.

Your PC must be on and BugsTow running while they use it. `bugstow unshare` stops sharing;
`bugstow start --lan` also turns it off. The first run can ask you to enable HTTPS certificates
in the Tailscale admin console (a one-time click).

## Inviting people

Inviting needs **Team**. Local is only ever you.

No email is needed or sent. You send an invite link yourself, in any chat.

1. Make BugsTow reachable for them first: `bugstow share` for people elsewhere, or
   `bugstow start --lan` for people on your network (then open the address it prints, not
   `localhost`). The panel warns you when a link would only work on your PC.
2. Open **People & invitations** → **Create invite link** (as a member, or as an admin who can
   invite others too) → **Copy**, and send the link.
3. They open it and see **Join <workspace>**. They pick a **username** and **password** and
   they're in. On an installed desktop copy, they run the setup command shown in Team once:
   `bugstow connect https://your-shared-address:5757`. After that, the normal BugsTow shortcut
   opens this workspace every time. `bugstow disconnect` returns the shortcut to their own PC.

Each link works **once, for one person, for 7 days**. Make one link per person. Unused links are
listed in the panel, and you can cancel one there. Someone who already has an account chooses
**I already have an account** on the link's page and signs in; the workspace is added to it.

Forgot a password? On this PC, `bugstow reset-password <username>` sets a temporary one.

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
- **Forgot a password**: `bugstow reset-password <username>` (or the email of an older account) prints a temporary
  password; you choose a new one when you sign in.


## Reopen your team's workspace automatically

On each teammate's computer, open their installed BugsTow and expand **Connect to your team** at the top. Paste the shared HTTPS address (or the invite link), then choose **Save and open Team**. The installed shortcut and the local browser address now open the shared workspace. Sign in there using the account from the invitation; creating another workspace on your own computer does not connect it to the team.

The app remembers only the server address, not the invite token. The team host must be running and reachable through your LAN or Tailscale. Existing Local data stays on each computer. To disconnect, run `bugstow disconnect`, or open your local address with `?local=1` (for example `http://localhost:5757/?local=1`) and expand **Connect to your team** to disconnect. You can also use `bugstow connect https://your-team-address:5757` once from a terminal.

## Organize, discuss, and recover issues

Use the issue list to filter by status, priority, severity, type, project, dates, and (in Team) assignee. Sort in either direction. Select issue checkboxes, or **Select all filtered**, to change several statuses, priorities, projects, or Team assignees at once. Moving several issues to Trash asks for confirmation.

Deleting an issue moves it to **Trash**. Use **Undo** immediately or open Trash later to restore it with its screenshots. **Delete permanently** asks for confirmation and cannot be undone; keep a backup before clearing Trash. Deleting a Team project leaves its issues in the workspace without a project and requires an owner or admin.

In Team, open an issue to add comments and see its activity. **Copy link** shares the exact issue with someone who already belongs to that workspace. They must sign in; the link does not grant access by itself. A deleted issue link reports that the issue is unavailable.

Choose **Board view** for Open, In Progress, Blocked, and Fixed columns. Drag a card between columns, or use its status menu with a keyboard. The list remains the default. While creating an issue, BugsTow suggests similar titles from the issues already in that mode. It never merges issues automatically.

Open **Prompt template** in an issue to choose a task-specific prompt or save your own template in this browser. **Copy with prompt** remains a one-click action. **Fix references** lets you store GitHub repository, pull request, and commit URLs without changing anything on GitHub.

For a human-readable copy, choose **Download CSV** or **Download Markdown** in Local's **Settings → Data & backups**, or **Download issues** in Team's top bar. These files include issue text and links but not screenshots and cannot restore a workspace; use a backup for recovery.

The optional [BugsTow Capture extension](../extension/README.md) prepares an issue draft from a page you choose, including selected text and an optional screenshot. You review the draft in BugsTow before saving it.

## Export issues to GitHub

Choose **Export to GitHub** in Local's sidebar (on mobile, open the navigation menu) or Team's top bar. Select all issues or one project, enter the destination repository, and use a fine-grained personal access token restricted to that repository with **Issues: Read and write**. Review the count and destination before choosing **Export**.

Export sends titles, descriptions, types and status to GitHub. Screenshots stay in BugsTow. Completed issues are closed after creation; issues already linked to GitHub are skipped. Each new link is saved immediately so later exports skip it. The token is used only for this operation and is never saved. Team export runs through your server and respects `BUGSTOW_OFFLINE`.

Keep the dialog open until it finishes. If GitHub refuses an issue, export stops and reports partial progress. After a network interruption, check GitHub before retrying: GitHub may have created the last issue even if its response was lost. If closing an issue fails, the result includes its URL so you can close it manually.
