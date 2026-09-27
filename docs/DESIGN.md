# Interface design

BugsTow uses one visual language for browser storage, personal cloud sync and self-hosted workspaces.

## Foundations

Tokens live in `src/index.css`: neutral surfaces, a teal accent (`brand`), semantic error/success colors, 8px control corners and 12px panel corners. Use the accent for the primary action, links and selection indicators. Keep project colors independent.

- Page title: 24px, semibold. Body and controls: 14px. Supporting text: 12px or larger.
- One primary action per form. Secondary actions use a border or plain text.
- Visible keyboard focus, readable light/dark states and reduced-motion support.
- Keep navigation predictable: Open issues, Completed, Projects, GitHub import, Settings.
- Search and filters belong above the issue list. Details show the description before screenshots and helper actions.

## Workflows

| Area | Pattern |
| --- | --- |
| New issue | Title first, then optional description, project/type and screenshots |
| Settings | General, Cloud sync, Data & backups; reminders open the relevant section |
| Cloud sync | Choose storage, connect it, then enter an encryption passphrase |
| GitHub | Repository link, destination project, optional closed issues and private-repository token |
| Team | Same navigation style; search, status/type/project filters and people management |
| Invitations | Create an invitation, then share its join link; no automatic email |
| Recovery | Failed team-code downloads show a reload action without clearing saved data |

Do not describe cloud sync as hosted BugsTow storage. Data is kept in the user's chosen storage and encrypted before upload. GitHub import is one-way; editing an imported issue does not update GitHub.
