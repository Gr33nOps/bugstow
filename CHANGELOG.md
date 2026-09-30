# Changelog

## 2.7.0

- **Invite links.** People & invitations → Create invite link → Copy. The person opening it
  picks a username and password and joins. No email is needed or sent. Each link works once,
  for one person, for 7 days, and can be cancelled while unused.
- Sign in with a username. Accounts made with an email earlier keep signing in with it.
- Someone reaching your computer from another device goes straight to Team sign-in.
- `bugstow reset-password <username>`.

## 2.6.1

- One **Local | Team** switch at the bottom of the sidebar, in the same place in both modes.

## 2.6.0

- **Two modes: Local and Team.** Local is just you, saved in the browser. Team has a sign-in and
  lets you invite people on your Wi-Fi or through Tailscale.
- **No cloud features.** Cloud sync and cloud backups were removed. On first open, the saved
  sync settings (sign-in tokens and key) are deleted from the browser; issues are kept.
- **Copy Local issues** into a Team workspace in one click, keeping completed issues and
  GitHub links.

## 2.5.1

- `bugstow share`: reach your BugsTow from other networks through Tailscale, using BugsTow's own
  port and never replacing anything else you share.
- Move a project to another workspace, including a new one only you are in.
- `--lan` picks your real network address, not a virtual adapter.

## 2.5.0

- A calmer interface: neutral palette with a teal accent, simpler navigation, search and
  filters above the list, and consistent light and dark themes.

## 2.0 – 2.4

- Installed with one command; runs on your own computer at `localhost:5757`.
- GitHub import that needs no setup for public repositories.
- Self-hosted Team server (Docker) with first-admin setup token, password reset and verified
  daily backups.
- Works fully offline after installation.
