# BugsTow — Offline Release Guide

How to build BugsTow once on a computer with internet, carry it to computers
without internet, and run Personal and Team mode on a private network.

- **Personal mode** runs in the browser. Projects, issues and screenshots are
  stored in that browser (IndexedDB). No account, no server.
- **Team mode** is a server your team runs on one of its own computers
  (Node + SQLite in Docker). Teammates connect to it over your network.

No cloud service is required for normal operation. After installation both
modes can run with no internet at all. The only feature that needs the
internet, GitHub import, is switched off in offline mode (the default).

---

## 1. Build the offline bundle (once, on a computer with internet)

Requires Node.js 22 and Docker.

```bash
git clone https://github.com/Gr33nOps/bugstow.git
cd bugstow
npm ci
node scripts/build-offline-bundle.mjs
```

Or download `bugstow-offline-<version>.zip` from the GitHub release instead.

```
offline-bundle/
├── README.txt              quick start
├── VERSION                 version + build time
├── RELEASE_OFFLINE.md      this guide
├── RELEASE_CHECKLIST.md    manual browser checks before a release
├── LICENSE
├── SHA256SUMS.txt          checksum of every file
├── team/
│   ├── bugstow-image.tar   the Team server image (server + all dependencies)
│   ├── docker-compose.offline.yml
│   ├── .env.example
│   ├── acceptance-test.mjs automated two-client test
│   └── OFFLINE.md, SELF_HOSTING.md
└── personal/
    ├── dist/               the built app
    ├── serve-personal.mjs  static web server with no dependencies
    └── README.txt
```

The builder stops if the version in `package.json`, `server/package.json`,
`src/version.ts` and the built image do not all match.

---

## 2. Copy it to the offline computer and check it

Copy the folder (or the zip) by USB stick, external disk or a local file share.
Then check nothing was damaged:

```bash
cd offline-bundle
sha256sum -c SHA256SUMS.txt          # Linux
shasum -a 256 -c SHA256SUMS.txt      # macOS
```

Windows (PowerShell), for the big file:
`Get-FileHash .\team\bugstow-image.tar -Algorithm SHA256`, then compare it with
the `team/bugstow-image.tar` line in `SHA256SUMS.txt`.

Every line must say `OK`. If one fails, copy that file again.

---

## 3. Install without internet

Nothing is downloaded. `docker-compose.offline.yml` has `pull_policy: never`, so
Docker refuses to fetch an image even if one is missing.

### Team (needs Docker)

```bash
cd offline-bundle/team
cp .env.example .env                  # must sit next to docker-compose.offline.yml
docker load -i bugstow-image.tar      # loads bugstow:latest and bugstow:<version>
```

Edit `.env` (see §6 for which address to use):

```env
BUGSTOW_AUTH_SECRET=<32+ random characters, e.g. from: openssl rand -base64 32>
BUGSTOW_BASE_URL=https://192.168.1.20:8080
BUGSTOW_TLS=true
```

Start it:

```bash
docker compose -f docker-compose.offline.yml up -d
```

### Personal (needs Node.js)

```bash
cd offline-bundle/personal
node serve-personal.mjs               # http://localhost:8000
```

The Team server also serves the Personal app, so one Docker install can provide
both.

---

## 4. Personal mode

1. Open the app and choose **Just me · Local**.
2. In the browser menu choose **Install app** to keep BugsTow available offline.
3. Export a backup from **Settings → Export Backup** regularly. Tick
   *Encrypt backup* to protect the file with a passphrase (AES-256-GCM).

Browser storage itself is **not encrypted on disk**, and it disappears if the
browser's site data is cleared. Keep exported backups.

---

## 5. First-time Team setup (the administrator)

A new server has no accounts. To stop someone else on the network from claiming
it first, creating the administrator needs a **one-time setup token** that only
appears in the server's log:

```bash
docker compose -f docker-compose.offline.yml logs bugstow
```

Look for `Setup token: XXXXXX-XXXXXX-XXXXXX-XXXXXX`. If the log scrolled away:

```bash
docker exec bugstow npm run -s setup-token
```

1. Open the server address in a browser and choose **My team**.
2. Enter the setup token, your name, email and a password → **Create administrator**.
3. The token stops working immediately. From now on only invited people can
   register (unless you set `BUGSTOW_OPEN_SIGNUP=true`).
4. Create a team, then invite teammates by email from **Members**. An invite is
   simply permission to register with that email; it expires after 7 days.

Restarting the server before setup shows the same token again. Servers that
already have an administrator never get a token.

---

## 6. How teammates connect: localhost, LAN HTTP, LAN HTTPS

| Setup | Address | Encrypted? | Use it for |
|---|---|---|---|
| **localhost** | `http://localhost:8080` | n/a (never leaves the computer) | Trying BugsTow on one computer |
| **LAN over HTTP** | `http://192.168.1.20:8080` | **No** | Not recommended. Passwords, session cookies and issues cross the network readable by anyone on it |
| **LAN over HTTPS** | `https://192.168.1.20:8080` | Yes | **Recommended** whenever other computers connect |

A local network is not automatically private: shared Wi-Fi, guest devices and
compromised machines can read plain HTTP. The server log and the sign-in page
both warn when LAN HTTP is used.

To set up LAN HTTPS on the server computer (Computer A):

1. Find its LAN address: `hostname -I` (Linux), `ipconfig getifaddr en0`
   (macOS), `ipconfig` (Windows). Example: `192.168.1.20`.
2. In `.env`: `BUGSTOW_TLS=true` and `BUGSTOW_BASE_URL=https://192.168.1.20:8080`.
3. `docker compose -f docker-compose.offline.yml up -d`
4. Allow port 8080 through Computer A's firewall.
5. Teammates open `https://192.168.1.20:8080` and trust the certificate (§7).

`BUGSTOW_BASE_URL` must be exactly the address teammates type (scheme, host,
port), or sign-in will not stick. If the address changes, update it and restart.

---

## 7. Trusting the HTTPS certificate

BugsTow creates its own certificate. No outside certificate authority is
involved, so each browser warns until you tell it to trust this certificate.
**Do not turn off browser security or certificate checks to avoid the warning.**

The certificate covers `localhost`, `127.0.0.1`, the host in `BUGSTOW_BASE_URL`,
anything in `BUGSTOW_TLS_HOSTS`, and (outside Docker) the host's LAN addresses.
It is valid for 825 days and is replaced automatically when it is about to
expire or when `BUGSTOW_BASE_URL` changes. Teammates then trust the new one.

### Step 1: note the fingerprint on the server

The server log prints `Certificate SHA-256 fingerprint: AB:CD:…`. Write it down
or keep the log open.

### Step 2: get the certificate onto each computer

Either download it from the server,
`https://192.168.1.20:8080/api/tls/certificate` (accept the one-time warning to
download it), or copy it from the server computer:

```bash
docker compose -f docker-compose.offline.yml cp bugstow:/data/certs/server.crt ./bugstow-server.crt
```

Before trusting it, open the file and compare its SHA-256 fingerprint with the
one from the server log. If they differ, do not trust it.

### Step 3: trust it

- **Windows:** double-click `bugstow-server.crt` → *Install Certificate* →
  *Local Machine* → *Place all certificates in the following store* → *Trusted
  Root Certification Authorities* → Finish. Restart the browser.
- **macOS:** double-click to add it to Keychain Access (System keychain) → open
  "BugsTow team server" → *Trust* → *When using this certificate: Always Trust*.
- **Linux (Debian/Ubuntu):**
  `sudo cp bugstow-server.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates`.
  Firefox keeps its own list: *Settings → Privacy & Security → Certificates →
  View Certificates → Authorities → Import*.
- **iPhone/iPad:** AirDrop or email the file → install the profile in Settings
  → *General → About → Certificate Trust Settings* → turn on full trust.
- **Android:** *Settings → Security → Encryption & credentials → Install a
  certificate → CA certificate*. Some Android browsers ignore user-installed
  certificates; if so, use a laptop or `mkcert` (below).

### Your own certificate instead

If you already have a certificate (for example from `mkcert` or your company's
certificate authority), put the files in the data volume and set
`BUGSTOW_TLS_CERT` and `BUGSTOW_TLS_KEY` to their paths. BugsTow never replaces
a certificate you supplied.

---

## 8. Backups and restore

### Automatic backups (on by default)

One backup shortly after start, then every `BUGSTOW_BACKUP_INTERVAL_HOURS`
(default 24), keeping the newest `BUGSTOW_BACKUP_RETENTION` (default 7). Each
backup is a folder in `/data/backups/<time>/` with:

- `bugstow.sqlite`: a consistent copy of the database (single file)
- `screenshots/`: every screenshot
- `manifest.json`: what the backup contains

After writing, BugsTow checks every backup: the database passes SQLite's
integrity check and the screenshot count and sizes match the manifest.

The server administrator sees the status in the app (**user menu → Backups**)
and can press **Back up now**.

### Keep a copy on separate hardware (strongly recommended)

`/data/backups` sits on the same disk as the live data. It protects against
mistakes, not against drive failure, a lost Docker volume, theft, file-system
damage, ransomware or losing the whole computer. Add a second location on
**different hardware**:

1. Pick a folder on another drive, a USB disk, or a mounted network share (NAS).
2. Create an empty marker file in it, once. BugsTow refuses to write without
   it, so an unplugged drive can never make it fill the wrong disk:
   ```bash
   touch /mnt/usb-backup/bugstow/.bugstow-backup-target          # Linux/macOS
   ```
   ```powershell
   New-Item E:\bugstow-backups\.bugstow-backup-target -ItemType File   # Windows
   ```
3. Mount that folder into the container. In `docker-compose.offline.yml`,
   uncomment and edit the line under `volumes:`:
   ```yaml
   - /mnt/usb-backup/bugstow:/backup-external
   ```
4. In `.env`: `BUGSTOW_BACKUP_EXTERNAL_DIR=/backup-external`
   (optional: `BUGSTOW_BACKUP_EXTERNAL_RETENTION=14`).
5. `docker compose -f docker-compose.offline.yml up -d`, then press **Back up
   now** and check that the Backups screen shows the external copy.

Examples for the left-hand side of step 3:

| Where | Linux / macOS | Windows (Docker Desktop) |
|---|---|---|
| Another internal drive | `/mnt/data2/bugstow-backups` | `D:/bugstow-backups` |
| USB / external disk | `/media/you/BACKUP/bugstow` (Linux), `/Volumes/BACKUP/bugstow` (macOS) | `E:/bugstow-backups` |
| NAS / network folder | mount it first (e.g. `sudo mount -t cifs //nas/backups /mnt/nas -o ...`), then `/mnt/nas/bugstow` | map the share to a drive letter first, e.g. `Z:/bugstow` |

How the external copy works: the backup is copied into a temporary folder,
checked, then renamed into place, so a half-written copy never looks complete.
It never touches the live database. If the location is missing or unmounted,
the log shows `EXTERNAL BACKUP FAILED …`, the Backups screen shows the error,
the local backup still succeeds and BugsTow keeps running.

### Restore

Restore from either location. Stop the server first.

```bash
docker compose -f docker-compose.offline.yml down
# Pick a backup folder, e.g. from the external drive:
B=/mnt/usb-backup/bugstow/2026-09-23T10-30-00-000Z
docker run --rm -v bugstow_bugstow-data:/data -v "$B":/restore:ro bugstow:latest sh -c '
  cd /data &&
  mkdir -p before-restore && mv bugstow.sqlite* screenshots before-restore/ 2>/dev/null;
  cp /restore/bugstow.sqlite bugstow.sqlite &&
  cp -r /restore/screenshots screenshots'
docker compose -f docker-compose.offline.yml up -d
```

(The current data is moved to `/data/before-restore/` rather than deleted.
Remove it once you are happy. The volume name is `<folder>_bugstow-data`; check
it with `docker volume ls`.)

### Forgotten passwords (no email needed)

- **A teammate forgot theirs:** the server administrator opens **Members** →
  key icon → **Reset password** and hands over the one-time temporary password.
  The teammate is signed out everywhere and must choose a new password before
  seeing any data.
- **The administrator forgot theirs:** on the server computer,
  `docker exec -it bugstow npm run reset-password -- admin@example.com`
- **Change your own:** user menu → **Change password** (signs out your other devices).

---

## 9. Upgrades (offline, data kept)

1. Back up (§8) and copy the backup off the computer.
2. Build or download the new bundle, copy it over, check `SHA256SUMS.txt`.
3. On the server computer:
   ```bash
   docker load -i bugstow-image.tar
   docker compose -f docker-compose.offline.yml up -d
   ```

The data volume is not touched. Database changes are additive only (new tables
or columns, nothing removed). Upgrading from 2.0.x: existing administrators keep
working, no setup token is needed, and a certificate generated by 2.0.x is
replaced once if it does not cover `BUGSTOW_BASE_URL` (teammates trust the new
one). Personal mode: serve the new `dist/`; the installed app updates on next
load. BugsTow never checks online for updates.

---

## 10. Where data is stored

| Data | Location |
|---|---|
| Personal projects, issues, screenshots, settings | The browser's IndexedDB for that site. Not encrypted on disk. |
| Team teams, members, projects, issues | `/data/bugstow.sqlite` in the `bugstow-data` Docker volume. Not encrypted on disk; readable by whoever controls the server. |
| Team accounts and sessions | Same file (better-auth tables `user`, `session`, `account`). Passwords are stored as salted hashes. |
| Team screenshots | `/data/screenshots/`, sent only to signed-in members of the owning team |
| HTTPS certificate + private key | `/data/certs/` |
| Backups | `/data/backups/` and, if configured, `BUGSTOW_BACKUP_EXTERNAL_DIR` |

`docker volume inspect bugstow_bugstow-data` shows where the volume lives on
disk. Protect the server computer and backup drives as you would any file
server: anyone with access to them can read the team's data.

---

## 11. Network connections (audited)

A search of all shipped code (frontend, server, scripts) for `fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, external URLs,
fonts, CDNs, analytics and telemetry, plus the dependencies' network code,
found these intentional connections:

| From | Connects to | When |
|---|---|---|
| Personal app | the site it was loaded from, for its own files | loading the app (then cached for offline use) |
| Personal app | **no API, no other host** unless you turn on sync | Checked in a browser: with sync off, only the page, its script, stylesheet and `registerSW.js` are requested |
| Personal app, sync on | the cloud you connected: Google Drive (`www.googleapis.com`), Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`) or your WebDAV server. Only encrypted files are sent | only after you connect one in Settings → Sync |
| Team app | only its own team server | always |
| Team server | `api.github.com` | only when GitHub import is enabled (`BUGSTOW_OFFLINE=false`) **and** someone runs an import |
| Team server | your WebDAV server (encrypted backup archives) | only if `BUGSTOW_BACKUP_WEBDAV_URL` is set; a LAN WebDAV server keeps this offline |
| better-auth | nothing | its optional telemetry is off by default and has no built-in endpoint; BugsTow also removes the environment switch that could enable it |
| Update checks, fonts, CDNs, analytics | none | never |

Links a person clicks (the GitHub repository, an imported issue's GitHub page)
open in the browser like any link. They are not requests the app makes.

Browsers enforce part of this too. The Team server sends a
Content-Security-Policy with `connect-src 'self'`: pages it serves cannot
connect anywhere else. The public site allows `'self' https:`, because
Personal sync has to reach the cloud or WebDAV server you pick; there, the
code (not the browser) is what limits connections to the one you connected.
On both, scripts are limited to the app's own files plus one fixed inline
theme script (by hash).

**The public website** (the static host serving Personal mode, currently
Vercel) receives normal web-request information when someone loads the page,
such as IP address, browser type and access logs. It never receives projects,
issues or screenshots: Personal mode keeps them in the browser and has no API.

---

## 12. Known limitations

- **GitHub import needs the internet** and is off in offline mode.
- **Building the bundle needs the internet once** (Docker base image, npm
  packages). Installing and running afterwards does not.
- **Self-signed HTTPS** shows a warning until each device trusts the certificate
  (§7). Some Android browsers ignore user-installed certificates.
- **The Team server must be running** for teammates to see shared data.
- **No email.** Invites and password resets are handed over by a person.
- **No live updates.** Changes from teammates appear when the app reloads data.
  If two people edit the same issue, the second save is refused with a message
  instead of silently overwriting (reload, then save again).
- **Data at rest is not encrypted by BugsTow** (browser storage, the SQLite file,
  screenshots, backups). Use disk encryption on the server and backup drives if
  that matters to you. Encrypted exports exist for Personal mode.

---

## 13. Release testing

### 13a. Automated (run on every release)

`scripts/acceptance-test.mjs` drives **two independent clients** (administrator
and teammate) against a fresh Team server, the same way two computers on a LAN
do. It needs the setup token:

```bash
node scripts/acceptance-test.mjs --url http://localhost:8080 --setup-token <token from the log>
```

It checks: the server can't be claimed without the setup token; admin creation
with the token; team, project and issue creation; screenshot upload; invite and
teammate sign-up; the teammate sees the team, issue and screenshot; assignment;
edits visible to the other user; a stale edit is refused (409) instead of
overwriting; writes from another website are refused; a non-member is refused;
deletion; GitHub import refused in offline mode; backups; only the server
administrator can back up or reset passwords; cross-team project/assignee IDs
are rejected; the full password-reset flow.

### 13b. Real two-computer offline test

> **REQUIRES REAL HARDWARE — NOT YET VERIFIED.**
> Change this line to "Verified on <date> by <name>" only after every box below is PASS.

You need: two computers (A = server, B = teammate), one network switch or router
**with no internet connection**, the offline bundle on a USB stick, Docker on A,
a browser on both.

Write PASS or FAIL in each box. Stop at the first FAIL and note what you saw.

**Preparation (both computers)**

| # | Do this | Expected | PASS/FAIL |
|---|---|---|---|
| 1 | Unplug the internet: remove the router's internet cable or use a switch with no uplink. Keep A and B on the same switch/router. | Both computers show "no internet" | |
| 2 | On A and B open `https://example.com` in the browser | It does **not** load | |

**Install on Computer A**

| # | Do this | Expected | PASS/FAIL |
|---|---|---|---|
| 3 | Copy the bundle from USB to A. In `offline-bundle` run `sha256sum -c SHA256SUMS.txt` (or the PowerShell check in §2) | Every line `OK` | |
| 4 | `cd team`, `cp .env.example .env`. Set `BUGSTOW_AUTH_SECRET` (32+ random characters), `BUGSTOW_BASE_URL=https://<A's IP>:8080`, `BUGSTOW_TLS=true` | File saved | |
| 5 | `docker load -i bugstow-image.tar` | `Loaded image: bugstow:latest` | |
| 6 | `docker compose -f docker-compose.offline.yml up -d` | Starts; no download attempted | |
| 7 | `docker compose -f docker-compose.offline.yml logs bugstow` | Shows `HTTPS: on`, the certificate fingerprint and a `Setup token:` | |

**First administrator (on A)**

| # | Do this | Expected | PASS/FAIL |
|---|---|---|---|
| 8 | On A open `https://<A's IP>:8080`. Accept the warning **only this once** | BugsTow welcome page | |
| 9 | Choose **My team**. Fill name/email/password but a **wrong** setup token → Create administrator | Refused: "setup token is missing or wrong" | |
| 10 | Enter the **correct** token → Create administrator | You are signed in | |
| 11 | Sign out. Choose My team → "I was invited…" and try to register a new email | Refused: sign-up is closed | |

**Certificate trust (on B)**

| # | Do this | Expected | PASS/FAIL |
|---|---|---|---|
| 12 | On B download `https://<A's IP>:8080/api/tls/certificate` | `bugstow-server.crt` saved | |
| 13 | Compare its SHA-256 fingerprint with the one in A's log (§7 step 1) | Identical | |
| 14 | Trust it (§7 step 3), restart the browser, open `https://<A's IP>:8080` | **No** warning; sign-in page shows "Encrypted connection (HTTPS)" | |

**Team workflow**

| # | Do this | Expected | PASS/FAIL |
|---|---|---|---|
| 15 | On A sign in as admin, create team "Test", open **Members**, invite B's email | Invite listed | |
| 16 | On B choose My team → "I was invited…", register with that email | B is signed in and sees team "Test" | |
| 17 | On B sign out, then sign in again | Works | |
| 18 | On A create project "Website" | Appears on A | |
| 19 | On A create an issue in "Website" and paste a screenshot | Issue shows the screenshot | |
| 20 | On B reload | B sees the issue and can open the screenshot | |
| 21 | On A assign the issue to B | B sees itself as assignee after reload | |
| 22 | On B change the description and click outside the box | Saved; A sees it after reload | |
| 23 | **Conflict:** open the issue on A and B. On B change the title and click away. On A (without reloading) change the description and click away | A shows "This issue was changed by another teammate. Reload it before saving." **Reload issue** shows B's title | |
| 24 | On A create a second issue, then delete it | Gone on A and on B after reload | |
| 25 | On A: user menu → **Backups** → **Back up now** | "Backup saved…"; list count goes up | |
| 26 | On A: Members → key icon next to B → Reset password. Note the temporary password | Temporary password shown once | |
| 27 | On B reload | B is signed out | |
| 28 | On B sign in with the temporary password | Forced "Choose a new password" screen; nothing else accessible | |
| 29 | Set a new password | B sees the team again | |

**Restarts and persistence**

| # | Do this | Expected | PASS/FAIL |
|---|---|---|---|
| 30 | On A: `docker compose -f docker-compose.offline.yml restart` | B reloads and still sees everything (may need to sign in) | |
| 31 | Restart **both** computers. On A: `docker compose -f docker-compose.offline.yml up -d` if it did not start by itself | B signs in and sees the team, issues, screenshot, assignment | |
| 32 | Check the log again: no `Setup token` (setup is done) | Shows `Setup: complete` | |

**Restore**

| # | Do this | Expected | PASS/FAIL |
|---|---|---|---|
| 33 | On A create an issue "after backup". Then restore the backup from step 25 (§8 Restore) | Server starts again | |
| 34 | On B reload | Issue "after backup" is gone; everything from before step 25 is present, with screenshot | |

**Personal mode, offline**

| # | Do this | Expected | PASS/FAIL |
|---|---|---|---|
| 35 | On B: user menu → **Switch to local** (or **Use Personal mode** on the sign-in page). Create an issue with a pasted screenshot | Saved | |
| 36 | Close the browser completely, reopen the same address | Issue and screenshot still there | |

**No internet dependency**

| # | Do this | Expected | PASS/FAIL |
|---|---|---|---|
| 37 | Throughout steps 3–36, did anything wait for, ask for, or fail because of the internet? | No | |

When every row is PASS, replace the warning at the top of 13b with the date and
your name.

### 13c. Verification status (honest)

What was verified for this release on the build machine (Windows 10, Docker
Desktop). The build machine itself had internet access throughout.

| Item | Status |
|---|---|
| Server unit + HTTP tests, frontend tests, typechecks, production build | **Verified automatically** (also in CI on every pull request) |
| Two-client acceptance test against a fresh server | **Verified automatically**: locally, in CI, and inside the Docker image |
| Offline bundle: all checksums valid; image loaded from the bundle's tar after deleting local images; installed with `docker-compose.offline.yml` (`pull_policy: never`) | **Verified** |
| HTTPS in Docker: certificate covers the LAN IP from `BUGSTOW_BASE_URL`; download from `/api/tls/certificate` matches the logged fingerprint; strict TLS refused before trusting, accepted after; acceptance test passed over HTTPS with certificate checking on | **Verified** |
| External backup to a mounted folder (automatic and on demand), then restore from it with the §8 commands: later changes gone, issue and screenshot back byte-identical | **Verified** in the container |
| Team server on a Docker network with no internet route (internet confirmed unreachable from both containers): acceptance test passed | **Verified** |
| Personal build: no API/auth/external requests; Team code not downloaded | **Verified in a browser** on a local static server |
| Setup-token screen, LAN-HTTP warning, phone-width layout | **Seen in a browser** (no passwords were entered by the tooling) |
| Password screens, conflict message, Backups screen, certificate trust in real browsers, PWA install/offline reopen | **Manual**: see `RELEASE_CHECKLIST.md` |
| Two physical computers with the internet physically disconnected | **REQUIRES REAL HARDWARE — NOT YET VERIFIED** (13b) |
