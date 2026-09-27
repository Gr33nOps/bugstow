<div align="center">
  <img src="public/favicon.svg" width="56" height="56" alt="BugsTow" />
  <h1>BugsTow</h1>
  <p>Spot it. Stow it. Fix it.</p>
  <p>An issue tracker for your computer or your team's server.</p>
  <p>
    <a href="https://github.com/Gr33nOps/bugstow/releases/latest"><img src="https://img.shields.io/github/v/release/Gr33nOps/bugstow?style=flat&color=0f766e" alt="Latest release" /></a>
    <a href="https://github.com/Gr33nOps/bugstow/actions/workflows/ci.yml"><img src="https://github.com/Gr33nOps/bugstow/actions/workflows/ci.yml/badge.svg" alt="Build and tests" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-475569" alt="MIT license" /></a>
  </p>
  <p><a href="#install">Install</a> · <a href="docs/SELF_HOSTING.md">Team setup</a> · <a href="docs/CLOUD_SYNC.md">Cloud sync</a> · <a href="CONTRIBUTING.md">Contribute</a></p>
</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/workspace-dark.jpg" />
  <img src="docs/screenshots/workspace.jpg" alt="BugsTow workspace with sample issues, project filters and search" />
</picture>

Keep bugs, design feedback and ideas in one place. Add a description, attach screenshots, and organize the work by project. Import issues from GitHub when you need them.

BugsTow is free and open source. It runs locally and opens in your browser. There is no hosted BugsTow service or required subscription.

## Install

**Windows** — paste this into PowerShell:

```powershell
irm https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.ps1 | iex
```

**macOS or Linux** — paste this into Terminal:

```sh
curl -fsSL https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.sh | sh
```

The installer downloads the app and its own Node.js runtime, checks their checksums, adds a shortcut, and opens **http://localhost:5757**. No administrator account is needed. Internet access is required for installation and updates.

On first open, choose **Save on this computer** and create your sign-in. To update, run the same command again. `bugstow uninstall` removes the app and keeps your data folder.

[Installation guide](docs/INSTALL.md) · [Latest release and downloads](https://github.com/Gr33nOps/bugstow/releases/latest)

## A small tool for everyday issues

- **Capture the details.** Write an issue and paste, drop or upload screenshots.
- **Find the next task.** Search issues, filter by project or type, and mark finished work as completed.
- **Bring in GitHub issues.** Paste a repository URL. Public repositories usually need no token; private ones need a token with access to their issues. Repeat imports update matching issues without duplicates. Import is one-way; BugsTow does not edit GitHub.
- **Work with a team.** Share projects, assign issues and invite people to your own server.
- **Keep a backup.** Export browser data or use automatic server backups. Optional cloud sync encrypts data before upload to your own storage.
- **Copy a prompt.** Turn an issue's details into a prompt for your coding assistant.

Light and dark themes, keyboard shortcuts, and layouts that work on smaller screens are included.

## Choose where your data lives

| Option | Storage | Good for |
| --- | --- | --- |
| **Save on this computer** | A local database and screenshot folder, with automatic backups | Everyday use on your computer |
| **Only in this browser** | This browser's IndexedDB; no account needed | A quick personal workspace |
| **Your own cloud** | Browser storage plus encrypted sync to storage you connect | Personal work across devices |
| **Team server** | A database and screenshots on a server you control | Shared projects and invitations |

Cloud options include Google Drive, Dropbox, WebDAV, a synced folder, and a portable sync file. Provider setup and browser support vary; see the [cloud sync guide](docs/CLOUD_SYNC.md).

Local databases and browser storage are **not encrypted at rest by BugsTow**. Clearing browser data removes a browser-only workspace. Keep backups, and store a copy on another drive if the work matters. The person operating a team server can access its data.

BugsTow does not store your issues on maintainer-operated infrastructure. Normal local work works offline after installation; GitHub import, cloud sync and updates need their respective services. [Network and offline details](docs/OFFLINE.md).

## Invite your team

For people on the same network, start the installed app with:

```sh
bugstow start --lan
```

1. Open **People & invitations** and add your teammate's email.
2. Copy the join link and send it through your usual chat or email. BugsTow does not send invitation emails.
3. Your teammate opens the link and creates an account using that email, or signs in if they already have one.

The host must stay running and reachable. LAN mode uses a local HTTPS certificate; follow the [connection and certificate instructions](docs/INSTALL.md#phones-and-other-computers---lan). Invitations expire after seven days and can be renewed.

For a dedicated team server, use [Docker Compose and the self-hosting guide](docs/SELF_HOSTING.md). It covers first-admin setup, HTTPS, backups and upgrades. GitHub import is disabled by default on team servers; the administrator can enable it.

## Help and documentation

| I want to… | Start here |
| --- | --- |
| Install, update or troubleshoot | [Install guide](docs/INSTALL.md) |
| Run a team server | [Self-hosting](docs/SELF_HOSTING.md) |
| Sync personal issues or back up to my cloud | [Cloud sync](docs/CLOUD_SYNC.md) |
| Use BugsTow without internet access | [Offline guide](docs/OFFLINE.md) |
| Report a bug or suggest an improvement | [Open an issue](https://github.com/Gr33nOps/bugstow/issues/new/choose) |
| Report a security problem privately | [Security policy](SECURITY.md) |

To move browser data, open **Settings → Data & backups** and export a backup. Restore it in another browser workspace, or choose **Import personal data** from a server workspace's user menu.

## Development

BugsTow uses React, TypeScript, Vite and Tailwind CSS. The optional Express server stores data in SQLite and screenshots on disk.

```sh
npm ci
npm run dev
```

Open **http://localhost:8443**. For the server, tests and contribution workflow, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Built and maintained by [Gr33nOps](https://github.com/Gr33nOps).
