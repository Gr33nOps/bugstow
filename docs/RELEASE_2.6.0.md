# BugsTow 2.6.0 — Local or Team, and no cloud

BugsTow now has two ways to use it, and nothing goes to the cloud.

- **Local**: just you. Issues are saved in this browser. No account.
- **Team**: you and people you invite. Issues are saved in BugsTow's folder on the computer
  running it, backed up daily. People join on your Wi-Fi (`bugstow start --lan`) or from
  anywhere through Tailscale (`bugstow share`).

## What changed

- **All cloud features are removed.** There is no more cloud sync to Google Drive, Dropbox,
  WebDAV, a synced folder or a sync file, and no cloud backups for Team. BugsTow no longer asks
  for Google or Dropbox sign-in, and the installed app's pages may now contact only BugsTow
  itself and `api.github.com` (for a GitHub import you start).
- **A simpler first screen**: "Just you, or with other people?" with two choices, Local and
  Team.
- **Settings** has two tabs, General and Data & backups. General says which mode you're in and
  has **Switch to Team**.
- **Copy Local issues** brings your Local work into Team in one click, reading it straight from
  the browser (or from a backup file from another device). Completed issues stay completed,
  GitHub links are kept, projects with the same name are reused, and a GitHub issue that is
  already in the workspace isn't copied twice. A new, empty workspace offers it right away.
- **Inviting** shows the two ways people can reach you (same Wi-Fi, or Tailscale), as equal
  choices.
- The account menu item is now **Switch to Local**, and the sign-in page offers **Use Local
  instead**.

## If you used cloud sync or cloud backups

- **Your issues are not lost.** Local issues were always stored in the browser; sync only kept a
  copy in your cloud. They are all still there after updating.
- On first open, 2.6 deletes the sync settings it kept in the browser, including the saved
  Google/Dropbox sign-in and encryption key.
- The encrypted copy stays in your cloud until you delete it. Google Drive: drive.google.com →
  Settings → Manage apps → BugsTow → Options → Delete hidden app data. Dropbox: the
  Apps/BugsTow folder.
- Team: `BUGSTOW_BACKUP_CLOUD_DIR`, the `BUGSTOW_BACKUP_WEBDAV_*` settings and
  `BUGSTOW_BACKUP_ENCRYPTION_PASSPHRASE` are now ignored, and the server says so when it starts.
  Daily backups in the data folder continue. For a copy on separate hardware, use
  `BUGSTOW_BACKUP_EXTERNAL_DIR` (see docs/INSTALL.md).

Validation: 54 frontend tests, 65 server and launcher tests, typechecks, production build and
45 two-client acceptance checks. The first screen, Settings, the switch to Team, Copy Local
issues (checking that completed issues stay completed and projects are kept) and the invite
panel were checked in a browser, including a phone-width window and dark mode.

## Install or update

Run the installer again. Your data is kept.

Windows PowerShell:
```powershell
irm https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.ps1 | iex
```

macOS / Linux:
```sh
curl -fsSL https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.sh | sh
```
