# BugsTow 2.5.0 — A simpler workspace

A complete interface refresh for browser storage, personal cloud sync and self-hosted teams.

- A quieter neutral palette with a teal accent, consistent controls, clearer typography and light/dark themes.
- Simpler navigation: Open issues, Completed, Projects, GitHub import and Settings.
- Search and filters together above the issue list. Team workspaces now support text search and project filtering too.
- Issue creation starts with a title and description; screenshots are optional. Details put the description first.
- Settings organized into General, Cloud sync and Data & backups. Sync alerts and backup reminders open the relevant section.
- Shorter cloud-provider explanations and a clear setup sequence. Existing encryption and storage behavior is preserved.
- Cleaner GitHub import with repository, destination and optional private-repository access. Imports remain one-way and deduplicated.
- Updated team navigation, mobile invitation forms and compact pending invitations.
- A recovery screen for failed team-code downloads after an update or connection problem.

Validation: 73 frontend tests, 58 server tests, typechecks, production build and 45 two-client acceptance checks. Browser checks covered issue creation, team search, GitHub import, settings, invitations, and mobile/light/dark layouts. External cloud accounts were not connected during verification.

## Install or update

Run the installer again. Your saved data folder is kept.

Windows PowerShell:
```powershell
irm https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.ps1 | iex
```

macOS / Linux:
```sh
curl -fsSL https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.sh | sh
```

For teammates on the same network, run `bugstow start --lan`, open the printed address and choose **People & invitations**.
