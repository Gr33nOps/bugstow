# Interface design

BugsTow uses one visual language for its two modes: **Local** (just you, in this browser) and **Team** (a sign-in, shared with people you invite). Always call them Local and Team.

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
| First run | One question, "Just you, or with other people?": Local or Team |
| Settings | General (with the Local/Team switch), Data & backups; reminders open the relevant section |
| Local → Team | "Copy Local issues" for everything, or Projects → ⋯ → "Copy to Team" for one project. Read straight from this browser; keep Local unchanged |
| GitHub | Repository link, destination project, optional closed issues and private-repository token |
| Team | Same navigation style; search, status/type/project filters and people management |
| Invitations | Create invite link → Copy; the invited person picks a username and password. No email anywhere. Say where the link works: this PC, the Wi-Fi (`--lan`) or Tailscale (`bugstow share`) |
| Recovery | Failed team-code downloads show a reload action without clearing saved data |

BugsTow has no cloud features. Never suggest syncing or storing issues online. GitHub import is one-way; editing an imported issue does not update GitHub.
