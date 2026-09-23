# BugsTow — Manual Release Checklist

Browser checks that automated tests can't fully cover. Do them in a real browser
before announcing a release. Write PASS or FAIL in each box; nothing here counts
as passed until a person has done it.

**Status for this release: NOT YET PERFORMED.**

Setup: a fresh Team server with HTTPS on (`BUGSTOW_TLS=true`, `BUGSTOW_BASE_URL=https://<IP>:8080`),
a second browser or computer for the teammate, and the public site
(https://bugstow.vercel.app) or `node serve-personal.mjs` for Personal mode.

## Personal mode

| # | Check | Expected | PASS/FAIL |
|---|---|---|---|
| P1 | First visit to the public site | "Welcome to Bugstow" picker; nothing else loads until you choose | |
| P2 | Choose **Just me · Local**, capture an issue with title + description | Appears in the inbox | |
| P3 | Copy an image, focus the capture dialog, press Ctrl/⌘+V | Screenshot preview appears; saved with the issue | |
| P4 | Settings → Export Backup with *Encrypt* ticked and a passphrase | A `.json` file downloads | |
| P5 | Clear data (Settings → danger zone) then Import that file with the passphrase | All issues and screenshots return. Wrong passphrase is refused with a message | |
| P6 | Browser menu → Install app | App opens in its own window | |
| P7 | Turn off Wi-Fi/unplug network, close and reopen the installed app | App opens; issues and screenshots still there; new capture works | |
| P8 | Browser devtools → Network while using P2–P5 | Only the site's own files; no `/api/…`, no other hosts | |

## Team mode

| # | Check | Expected | PASS/FAIL |
|---|---|---|---|
| T1 | Open the server, choose **My team** | "Set up this server" with Setup token field and "Encrypted connection (HTTPS)" | |
| T2 | Create administrator with a wrong token, then the right one | Wrong: clear error. Right: signed in | |
| T3 | Sign out, sign in again | Sign-in form (not the setup form); sign-in works | |
| T4 | Members → invite a teammate's email | Listed as pending invite | |
| T5 | Teammate: "I was invited: create my account" with that email | Signed in, sees the team | |
| T6 | Admin: Members → key icon → Reset password for the teammate | Temporary password shown once, Copy works | |
| T7 | Teammate reloads, signs in with the temporary password | Forced "Choose a new password" screen; nothing else reachable | |
| T8 | Teammate sets a new password | Back in the workspace | |
| T9 | Create a second team from the team menu and switch between the two | Each shows its own projects and issues | |
| T10 | Create a project; create an issue in it | Both visible to the teammate after reload | |
| T11 | Assign the issue to the teammate | Teammate sees the assignment | |
| T12 | Attach a screenshot, open it from the teammate's browser | Image shows | |
| T13 | Admin: user menu → **Backups** → Back up now | Success message; count increases; external copy status shown (or "Not set up") | |
| T14 | Open the same issue in both browsers; change the title in one, then the description in the other without reloading | "This issue was changed by another teammate. Reload it before saving." Reload issue shows the other change | |
| T15 | Open the server over `http://<IP>:8080` with TLS off | Amber "Not encrypted" warning on sign-in and "Not encrypted" chip in the header | |
| T16 | Over HTTPS before trusting the certificate | Browser warning (expected). Download `/api/tls/certificate`, compare fingerprint with the server log | |
| T17 | Trust the certificate, restart the browser, reload | No warning; padlock shown | |
| T18 | Phone-width window (≈375 px) on sign-in, workspace, Members, Backups | Readable, no sideways scrolling, buttons reachable | |

Record who did the checks and when:

- Performed by: ______  Date: ______  Browser(s): ______
