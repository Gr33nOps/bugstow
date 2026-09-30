# BugsTow 2.5.1 — Invite people anywhere, keep projects private

Invitations from the desktop app used a `localhost` link, which only opens on the owner's own
PC, so invited people saw nothing. This release fixes the whole path.

- **`bugstow share`** lets people on other networks reach your BugsTow through
  [Tailscale](https://tailscale.com), a free private-network app. It uses `tailscale serve` on
  BugsTow's own port (for example `https://my-pc.tail1234.ts.net:5757`) with a real certificate.
  Only people you share your PC with in Tailscale can reach it. It is not put on the open internet
  (no Funnel), and it refuses a port that something else already uses in Tailscale.
  `bugstow unshare` turns it off.
- **People & invitations** says where the join link works. It uses the shared address when
  there is one, warns when a link would only open on your PC, and lists the exact steps. It no
  longer shows a half-empty `#join=` link.
- **Keep projects to yourself:** **⋯** next to a project → **Move to workspace** → **New
  workspace, only you** (or another workspace). Issues and screenshots move with it. The
  workspace switcher shows who is in each workspace.
- `bugstow start --lan` now picks your real network address, not a WSL, Hyper-V or VPN adapter.
- The account-menu item "Switch to local" is now **Browser-only mode**, with an explanation.

Validation: 73 frontend tests, 69 server and launcher tests, typechecks, production build and
45 two-client acceptance checks. Sharing was tested end to end with a stand-in for the Tailscale
command: sign-up through the shared address, other addresses refused, unshare, and an existing
Funnel left untouched. The desktop UI was checked in the local and shared states.

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

Inviting someone elsewhere: install Tailscale, run `bugstow share`, share your PC with them in
the Tailscale admin console, then send the join link from **People & invitations**.
Step by step: [docs/INSTALL.md](INSTALL.md#people-on-other-networks-bugstow-share).
