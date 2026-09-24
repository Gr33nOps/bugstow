# BugsTow — Manual Release Checklist

Browser checks that automated tests can't fully cover. Do them in a real browser
before announcing a release. Write PASS or FAIL in each box; nothing here counts
as passed until a person has done it.

**Status for this release: NOT YET PERFORMED.**

Setup: the app installed with the one-command installer (docs/INSTALL.md) on a
Windows PC and, if possible, a Mac or Linux computer; a fresh Team server with
HTTPS on (`BUGSTOW_TLS=true`, `BUGSTOW_BASE_URL=https://<IP>:8080`); and a second
browser or computer for the teammate.

## Installed app

| # | Check | Expected | PASS/FAIL |
|---|---|---|---|
| D1 | Run the install command in a new terminal | Node.js and BugsTow download with "Checksum OK"; the browser opens http://localhost:5757 | |
| D2 | Choose **In a folder on this PC** | The sign-in form opens without asking for a setup token | |
| D3 | Create the sign-in, capture an issue with a screenshot | Saved; `bugstow status` shows the data folder, which contains `bugstow.sqlite` | |
| D4 | Close the browser, run `bugstow stop`, then click the **BugsTow** shortcut | BugsTow starts and opens; you are still signed in; the issue is there | |
| D5 | Restart the computer and click the shortcut | Same as D4 | |
| D6 | Disconnect from the internet and repeat D4 | Works the same | |
| D7 | Run the install command again (update) | Finishes; data and sign-in unchanged | |
| D8 | `bugstow start --lan`, open the printed address on a phone on the same Wi-Fi | Certificate warning once; after accepting, sign in and see the issues | |
| D9 | `bugstow uninstall` | Shortcuts and the command are gone; the data folder is still there | |

## GitHub import

| # | Check | Expected | PASS/FAIL |
|---|---|---|---|
| G1 | Installed app, fresh: click **Import from GitHub** (sidebar or empty inbox), paste a public repo link | Issues arrive in a new project named after the repo; each shows "#N on GitHub" | |
| G2 | Import the same repo again | "Everything … is already here"; no duplicates | |
| G3 | Close an issue on GitHub, import again with "Also bring in closed issues" | That issue moves to Fixed | |
| G4 | Paste a private repo | The dialog shows the key steps; "Create a key on GitHub" opens GitHub's key page with the name, 90-day expiry and Issues: Read-only filled in | |
| G5 | Paste the key and import | Issues arrive; the key isn't shown again after closing the dialog | |
| G6 | Same in "In a folder on this PC" (server) mode, top-bar **Import from GitHub** | Same results | |

## Personal mode

| # | Check | Expected | PASS/FAIL |
|---|---|---|---|
| P1 | First open of the installed app (or `node serve-personal.mjs`) | "Welcome to BugsTow" picker; nothing else loads until you choose | |
| P2 | Choose **Only in this browser** (or **Just me · Local**), capture an issue with title + description | Appears in the inbox | |
| P3 | Copy an image, focus the capture dialog, press Ctrl/⌘+V | Screenshot preview appears; saved with the issue | |
| P4 | Settings → Export Backup with *Encrypt* ticked and a passphrase | A `.json` file downloads | |
| P5 | Clear data (Settings → danger zone) then Import that file with the passphrase | All issues and screenshots return. Wrong passphrase is refused with a message | |
| P6 | Browser menu → Install app | App opens in its own window | |
| P7 | Turn off Wi-Fi/unplug network, close and reopen the installed app | App opens; issues and screenshots still there; new capture works | |
| P8 | Browser devtools → Network while using P2–P5 | Only the site's own files; no `/api/…`, no other hosts | |

## Personal cloud sync (docs/CLOUD_SYNC.md)

Use a laptop **and** a phone. Google Drive and Dropbox need `VITE_GOOGLE_CLIENT_ID` / `VITE_DROPBOX_CLIENT_ID` set when the app package is built. The phone opens the laptop's BugsTow over Wi-Fi (`bugstow start --lan`) or another computer's installed app.

| # | Check | Expected | PASS/FAIL |
|---|---|---|---|
| S1 | Settings → Sync on the laptop | Five options, each explaining what will happen; unavailable ones say why | |
| S2 | Connect Google Drive, create a passphrase | Returns to Settings; "Google Drive · synced just now" | |
| S3 | On the phone: connect the same Google account, enter the same passphrase | The laptop's issues and screenshots appear | |
| S4 | Wrong passphrase on the phone first | "The passphrase does not match…"; nothing changes | |
| S5 | Edit an issue on the phone; wait ~10 s; open the laptop | The edit shows up | |
| S6 | Delete an issue on the laptop; open the phone | Gone on the phone too | |
| S7 | Wait over an hour (Google) and open the app | "Sign in again" message with a Reconnect link; reconnect works | |
| S8 | Repeat S2–S6 with Dropbox | Same results; no hourly reconnect | |
| S9 | Synced folder (desktop Chrome) pointed at a Mega/OneDrive/Dropbox folder | Files appear in that folder; the cloud app uploads them | |
| S10 | Sync file: export on laptop, upload to any cloud, import on phone with the passphrase | Issues appear on the phone; "Download merged file" offered | |
| S11 | Open the cloud (Drive app data / Dropbox Apps/BugsTow / WebDAV folder) | Only `bugstow-index.json` and `shots/*.bin`, unreadable | |
| S12 | Turn off sync on one device | Data stays on that device and in the cloud | |

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
