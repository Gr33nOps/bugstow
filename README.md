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
  <p><a href="#install">Install</a> · <a href="docs/SELF_HOSTING.md">Team setup</a> · <a href="CONTRIBUTING.md">Contribute</a></p>
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

On first open, choose **Local** (just you, no account) or **Team** (a sign-in, and you can invite people). To update, run the same command again. `bugstow uninstall` removes the app and keeps your data folder.

[Installation guide](docs/INSTALL.md) · [Latest release and downloads](https://github.com/Gr33nOps/bugstow/releases/latest)

## A small tool for everyday issues

- **Capture the details.** Write an issue and paste, drop or upload screenshots.
- **Find the next task.** Search issues, filter by project or type, and mark finished work as completed.
- **Bring in GitHub issues.** Paste a repository URL. Public repositories usually need no token; private ones need a token with access to their issues. Repeat imports update matching issues without duplicates. Import is one-way; BugsTow does not edit GitHub.
- **Work with a team.** Share projects, assign issues and invite people to your own server.
- **Keep a backup.** Download a backup file from Local, or rely on Team's automatic daily backups (plus an optional second drive).
- **Copy a prompt.** Turn an issue's details into a prompt for your coding assistant.

Light and dark themes, keyboard shortcuts, and layouts that work on smaller screens are included.

## Two ways to use it

| | Local | Team |
| --- | --- | --- |
| Who | Just you | You and people you invite |
| Where issues are saved | This browser (IndexedDB) | A database and screenshot folder on the computer running BugsTow, backed up daily |
| Account | None | A sign-in for each person |
| Others join | No | On your Wi-Fi (`bugstow start --lan`) or from anywhere through Tailscale (`bugstow share`) |

Switch any time with the **Local | Team** switch at the bottom of the sidebar. **Copy Local issues** brings your Local work into a Team workspace.

BugsTow has no cloud features: nothing is uploaded to Google Drive, Dropbox or any other online storage, and there is no hosted BugsTow service. Local data and the Team database are **not encrypted at rest by BugsTow**. Clearing browser data removes Local issues, so keep backups, and a copy on another drive if the work matters. The person running a Team computer can access its data.

After installation everything works offline; only GitHub import and updates use the internet. [Network and offline details](docs/OFFLINE.md).

## Invite your team

For people on the same network, start the installed app with:

```sh
bugstow start --lan
```

For people somewhere else, install [Tailscale](https://tailscale.com) (a free private-network app) on your PC and theirs, then run `bugstow share` and share your PC with them in Tailscale. Only people you share with can reach it; it is not put on the open internet. [Step by step](docs/INSTALL.md#people-on-other-networks-bugstow-share).

1. Open **People & invitations** → **Create invite link** → **Copy**, and send it in any chat.
2. They open it, pick a username and password, and they're in. No email needed.
3. Each link works once, for one person, for 7 days.

Invited people see every project in that workspace. To keep a project to yourself, use **⋯ → Move to workspace → New workspace, only you** next to it in the sidebar.

The host must stay running and reachable. LAN mode uses a local HTTPS certificate; follow the [connection and certificate instructions](docs/INSTALL.md#phones-and-other-computers---lan). Unused links can be cancelled in the same panel.

For a dedicated team server, use [Docker Compose and the self-hosting guide](docs/SELF_HOSTING.md). It covers first-admin setup, HTTPS, backups and upgrades. GitHub import is disabled by default on team servers; the administrator can enable it.

## Help and documentation

| I want to… | Start here |
| --- | --- |
| Install, update or troubleshoot | [Install guide](docs/INSTALL.md) |
| Run a team server | [Self-hosting](docs/SELF_HOSTING.md) |
| Use BugsTow without internet access | [Offline guide](docs/OFFLINE.md) |
| Report a bug or suggest an improvement | [Open an issue](https://github.com/Gr33nOps/bugstow/issues/new/choose) |
| Report a security problem privately | [Security policy](SECURITY.md) |

To move Local issues to another device, open **Settings → Data & backups**, download a backup and restore it there. To bring them into Team, use **Copy Local issues** in the Team account menu.

## Development

BugsTow uses React, TypeScript, Vite and Tailwind CSS. The optional Express server stores data in SQLite and screenshots on disk.

```sh
npm ci
npm run dev
```

Open **http://localhost:8443**. For the server, tests and contribution workflow, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Built and maintained by [Gr33nOps](https://github.com/Gr33nOps).
