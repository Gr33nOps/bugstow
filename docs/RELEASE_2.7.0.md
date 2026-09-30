# BugsTow 2.7.0 — Invite links, no email

Inviting someone to Team no longer involves email at all.

1. **People & invitations → Create invite link → Copy**, and send it in any chat.
2. They open it and see **Join <workspace>**, pick a **username** and **password**, and they're in.
3. Next time they sign in with that username.

- Each link works **once, for one person, for 7 days**. Unused links are listed in the panel
  and can be cancelled. Only a hash of each link is stored on your PC.
- People still need to reach your BugsTow first: the same Wi-Fi (`bugstow start --lan`) or
  Tailscale (`bugstow share`). The panel says which, and links use your Tailscale address when
  you share.
- Someone opening your BugsTow from another device (Wi-Fi or Tailscale) goes straight to Team
  sign-in, and after joining, the plain address opens the workspace directly.
- Sign-in asks for a **username**. Accounts made with an email before 2.7 still sign in with
  that email.
- `bugstow reset-password <username>` works for usernames.
- The People list puts the owner first and shows usernames, never internal sign-in names.

Validation: 57 frontend tests, 66 server and launcher tests (including the whole invite-link
flow: members can't create links, single use, cancel, username sign-in, joining with an existing
account), typechecks and production build. In a browser: creating a link, opening it in a
separate browser through a simulated Tailscale address, joining, and reopening the plain
address later.

## Install or update

Run the installer again in a new PowerShell window. Your data is kept.

Windows PowerShell:
```powershell
irm https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.ps1 | iex
```

macOS / Linux:
```sh
curl -fsSL https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.sh | sh
```
