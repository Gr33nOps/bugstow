# Changelog

## 2.9.2

- Local and Team share a segmented List/Board switcher, redesigned priority badges, compact dropdown controls, and a structured filter panel.
- Local board keeps the list's priority, severity, date, project, and type filters and bulk actions. Completed also offers a board.
- Board columns have status markers, counts, empty states, and more readable cards. Local rows keep aligned widths with long titles.
- Team now has a light/dark theme control. Actions, account, and workspace menus dismiss on outside interaction or Escape instead of overlapping.
- Project, backup, help, and confirmation dialogs keep keyboard focus inside and fit small screens; nested dialogs dismiss one at a time.
- Team exposes project creation and refreshes the People list when reopened after someone joins. Project save failures remain visible in the form.
- Added Local and Team screen walkthroughs across light/dark themes and phone/desktop sizes, including invitations, password resets, settings, and setup.


## 2.9.1

- Team actions fit narrow phone screens in an Actions menu, with New issue kept visible.
- Local capture and Team dialogs keep keyboard focus inside, support Escape, and return focus to the opener.
- Bulk selections in Local and Team drop issues hidden by a changed filter, preventing updates to invisible selections.
- Local board view keeps search, project, and type controls available.

## 2.9.0

- Teammates can run `bugstow connect <workspace-url>` once so their installed shortcut reopens the shared Team workspace. `bugstow disconnect` returns the shortcut to this computer.
- Local and Team issues can be exported to GitHub Issues with a user-supplied repository token. Successful exports save the GitHub link on each issue so retries skip it.
- Local and Team issues now support Critical, High, Medium, and Low priority, optional bug severity, and expandable structured report details. Existing issues default to Medium.
- Issue details support Open, In Progress, Blocked, and Fixed. Active lists include In Progress and Blocked; Completed continues to show Fixed. Lists can filter and sort by the new fields.
- Copied AI prompts include priority, status, severity, and entered report details. Re-importing open GitHub issues preserves In Progress and Blocked, while a closed or reopened issue still updates to Fixed or Open.
- Deleting an issue now moves it to Trash with Undo. Restoring keeps its screenshots and details; permanent deletion requires confirmation. Deleting a Team project leaves its issues unassigned, and only workspace owners or admins can do it.
- Team issues now have comments and an activity timeline, plus private direct links that work after sign-in. Local and Team lists support bulk actions, date filters, and ascending or descending sorting.
- Local and Team now offer six on-device prompt templates plus one editable template saved in the browser, duplicate suggestions during issue creation, validated GitHub fix links, and an optional keyboard-accessible Kanban board.
- CSV and Markdown issue downloads are available alongside backups. An optional Chrome/Edge capture extension can hand off the current page, selected text, and an explicitly captured screenshot as a reviewable issue draft.
- Playwright browser tests now cover Local and a fresh self-hosted Team server, including direct links, comments, board status changes, capture drafts, and fix references.

## 2.8.5

- Team issue details now use the same clear, aligned layout as Local, including a safer delete
  confirmation and responsive controls.
- Issues can hold several screenshots. Add or paste multiple images while creating or editing an
  issue; failed uploads no longer remove existing screenshots.

## 2.8.4

- Project action menus now stay fully visible near the edge of a window. The same fix covers
  issue menus and project menus in Team.
- A Local project can be copied by itself with **Projects → ⋯ → Copy to Team**. Its issues and
  screenshots are copied into the chosen Team workspace, while the Local project stays intact.
- Updated local TLS certificate generation to remove a vulnerable cryptography dependency.

## 2.8.3

- Renamed the primary issue action to **Copy with prompt** so its purpose is clear. It still
  includes the screenshot with the prompt when rich clipboard copying is available.

## 2.8.2

- Windows updates now wait for BugsTow to stop and force-close a stuck background server before
  replacing app files. If shutdown still fails, the installer leaves the existing app untouched.

## 2.8.1

- **Fix spelling & grammar** now uses a bundled English dictionary to correct ordinary
  misspellings as well as spacing, capitalization and punctuation. It runs on the device and
  keeps URLs, email addresses, file paths, code and product names unchanged.

## 2.8.0

- **Fix writing** cleans up spelling, grammar, spacing and punctuation in issue titles and
  descriptions while keeping the original meaning. It works locally without sending text away.
- **On-device voice input** adds spoken notes in supported browsers. BugsTow does not use an
  online transcription service.
- Custom issue badges for work that is not a Bug, UI/UX task or Idea.
- **Copy with prompt** places the prompt text and image in one rich clipboard item, so
  compatible apps receive both in a single paste.

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
