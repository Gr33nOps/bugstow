# BugsTow 2.6.1 — One switch for Local and Team

- **Local | Team switch** at the bottom of the sidebar, in the same place in both modes. The mode
  you're in is highlighted; click the other one to switch. Nothing is moved or deleted when you
  switch. With the sidebar collapsed it's a single button.
- Includes everything from 2.6.0: cloud sync and cloud backups are gone, and there are only two
  modes, Local (just you, in this browser) and Team (invite people on your Wi-Fi or through
  Tailscale). See the [2.6.0 notes](RELEASE_2.6.0.md).

If you still see a **Cloud sync** tab in Settings, you're on 2.5 or older: run the installer
below once.

Validation: 54 frontend tests, 65 server and launcher tests, typechecks, production build. The
switch was checked in a browser in both directions and with the sidebar collapsed.

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
