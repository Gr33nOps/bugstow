# Bugstow — Offline Release Guide

Everything needed to build Bugstow once on an internet-connected machine,
transfer it to offline computers, and run the full Personal and Team workflow on
a private LAN with no internet.

**Editions**

- **Personal** — runs entirely in the browser (IndexedDB). No account, no server.
- **Team** — a self-hosted Node + SQLite server on one computer; teammates connect
  over the LAN. All data stays on that host.

Normal operation of either edition requires **no external connection**. The only
online feature is GitHub import, which is off by default and fails gracefully.

---

## 1. Build the offline bundle (on an internet-connected machine, once)

Requires Node.js and Docker.

```bash
git clone https://github.com/Gr33nOps/bugstow.git
cd bugstow
npm install
node scripts/build-offline-bundle.mjs
```

This produces `./offline-bundle/`:

```
offline-bundle/
├── README.txt              quick start
├── VERSION                 version + build timestamp
├── RELEASE_OFFLINE.md      this guide
├── SHA256SUMS.txt          checksums for every file
├── team/
│   ├── bugstow-image.tar   the full Team server image (server + all deps)
│   ├── docker-compose.offline.yml
│   ├── .env.example
│   ├── acceptance-test.mjs the two-client acceptance test
│   ├── OFFLINE.md, SELF_HOSTING.md
└── personal/
    ├── dist/               the built Personal app
    ├── serve-personal.mjs  zero-dependency static server
    └── README.txt
```

The build is reproducible: re-running it from the same commit produces the same
app assets. (The Docker image layers may differ in timestamp metadata; the app
contents are identical — verify the `dist/` and server source via the checksums.)

---

## 2. Transfer it to the offline computer(s)

Copy the whole `offline-bundle/` folder via USB drive, external disk, or LAN file
copy. Then **verify integrity** on the destination before installing:

```bash
cd offline-bundle
sha256sum -c SHA256SUMS.txt          # Linux
shasum -a 256 -c SHA256SUMS.txt      # macOS
# Windows (PowerShell): Get-FileHash .\team\bugstow-image.tar -Algorithm SHA256
#   and compare against the line in SHA256SUMS.txt
```

Every file must report `OK`. If any fails, re-copy that file.

---

## 3. Install completely offline

Nothing is downloaded during installation.

### Team edition — requires Docker only

```bash
cd offline-bundle/team
cp .env.example ../.env               # then edit ../.env (set BUGSTOW_AUTH_SECRET)
docker load -i bugstow-image.tar      # loads the pre-built image; no pull
docker compose -f docker-compose.offline.yml up -d
```

Set a strong secret in `.env` (generate on any machine that has it):

```bash
openssl rand -base64 32
```

### Personal edition — requires Node.js only

```bash
cd offline-bundle/personal
node serve-personal.mjs               # serves on http://localhost:8000
```

No `npm install`, no internet. (The Team server also serves the Personal app, so
a single Docker install can provide both.)

---

## 4. Start Personal mode

1. `node serve-personal.mjs` (or open the app served by the Team server).
2. Open `http://localhost:8000` — choose **Just me · Local**.
3. In the browser menu choose **Install app** to keep Bugstow available offline
   as an installed app.

Your data lives only in this browser (IndexedDB). Use **Settings → Export Backup**
(AES-256-GCM encrypted) to keep a copy or move to another browser/device.

**Works fully offline:** after the first load, disconnect the network — capture
issues, paste screenshots, organize projects, Copy-as-Prompt, and export backups
all work with no connectivity.

---

## 5. Start Team mode (Computer A / the host)

1. `docker compose -f docker-compose.offline.yml up -d`
2. Open `http://localhost:8080`, choose **My team**.
3. **Register the first account — it becomes the administrator.** Do this
   immediately so nobody else can claim it. After that, registration is closed
   (invite-only) unless you set `BUGSTOW_OPEN_SIGNUP=true`.
4. Create a team, then invite teammates by email from **Members**.

The header shows an **Offline** badge when the server runs in offline mode — this
is normal, not an error.

---

## 6. How LAN clients connect (Computer B, C, …)

1. Find Computer A's LAN IP: `hostname -I` (Linux), `ipconfig getifaddr en0`
   (macOS), or `ipconfig` (Windows) — e.g. `192.168.1.20`.
2. On Computer A set `BUGSTOW_BASE_URL=http://192.168.1.20:8080` in `.env` and
   `docker compose -f docker-compose.offline.yml up -d` again.
3. Allow the port through Computer A's firewall.
4. On Computer B, open `http://192.168.1.20:8080`, choose **My team**, and sign
   in (or register with the email an admin invited).

> `BUGSTOW_BASE_URL` must match the exact address teammates use (scheme + host +
> port), or session cookies won't stick.

---

## 7. Local HTTPS setup (generate, install, and trust the certificate)

Use HTTPS for LAN/remote access — no cloud CA involved.

### Generate (automatic, on the host)

In `.env` on Computer A:

```env
BUGSTOW_TLS=true
BUGSTOW_BASE_URL=https://192.168.1.20:8080
```

`docker compose ... up -d`. On first start the server generates a self-signed
certificate at `/data/certs/server.{crt,key}`, valid for `localhost`,
`127.0.0.1`, and **every LAN IPv4 address of the host**, for 10 years.

### Export the certificate for clients

```bash
# Copy the public certificate out of the container/volume:
docker compose -f docker-compose.offline.yml cp bugstow:/data/certs/server.crt ./bugstow-ca.crt
```

Distribute `bugstow-ca.crt` to teammates over the LAN/USB.

### Install & trust it on client machines

Trusting the certificate removes the browser warning. Do this per client:

- **Windows:** double-click `bugstow-ca.crt` → *Install Certificate* → *Local
  Machine* → *Place all certificates in the following store* → *Trusted Root
  Certification Authorities*. Restart the browser.
- **macOS:** double-click to add to **Keychain Access** (System keychain) →
  find "bugstow.local" → *Get Info* → *Trust* → *Always Trust*.
- **Linux (Debian/Ubuntu):**
  `sudo cp bugstow-ca.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates`
  (Chrome/Firefox may also need it imported in their own settings).
- **iOS:** email/AirDrop the file → install profile in Settings → then
  *General → About → Certificate Trust Settings* → enable full trust.
- **Android:** Settings → Security → *Install a certificate* → *CA certificate*.

Alternatively, teammates can click through the browser's "proceed anyway" warning
each time without installing anything.

### Bring your own certificate

To use a cert from `mkcert` or your own CA instead, set `BUGSTOW_TLS_CERT` and
`BUGSTOW_TLS_KEY` to those file paths.

---

## 8. Backup & restore

Automatic backups are **on by default**: one shortly after startup, then every
`BUGSTOW_BACKUP_INTERVAL_HOURS` (default 24), keeping the last
`BUGSTOW_BACKUP_RETENTION` (default 7). Each backup is a self-contained folder in
`/data/backups/<timestamp>/` with a consistent `bugstow.sqlite` snapshot, a copy
of every screenshot, and a `manifest.json`.

Trigger one on demand (signed-in member): `POST /api/admin/backup`; list with
`GET /api/admin/backups`.

### Restore

```bash
docker compose -f docker-compose.offline.yml down
docker run --rm -v bugstow_bugstow-data:/data alpine sh -c '
  cd /data &&
  cp "backups/<timestamp>/bugstow.sqlite" bugstow.sqlite &&
  rm -rf screenshots && cp -r "backups/<timestamp>/screenshots" screenshots'
docker compose -f docker-compose.offline.yml up -d
```

(The volume name is `<folder>_bugstow-data`; check with `docker volume ls`.)

---

## 9. Upgrades (offline, data preserved)

1. On an online machine, build a new bundle (`node scripts/build-offline-bundle.mjs`).
2. Transfer `team/bugstow-image.tar` + `SHA256SUMS.txt`, verify the checksum.
3. On the host:
   ```bash
   docker load -i bugstow-image.tar
   docker compose -f docker-compose.offline.yml up -d
   ```

The `/data` volume is untouched; schema changes are additive (no destructive
migrations). Personal (PWA) upgrades: replace the served `dist/`; the service
worker updates on next load (hard-refresh to force it). No online update check is
ever performed.

---

## 10. Where everything is stored

| Data | Location |
|---|---|
| **Personal** projects/issues/screenshots/settings | The browser's **IndexedDB** (origin-scoped). Nothing on disk outside the browser. |
| **Team database** (teams, members, projects, issues) | `/data/bugstow.sqlite` (in the `bugstow-data` Docker volume) |
| **Team authentication** (users, sessions, credentials) | Same `/data/bugstow.sqlite` — better-auth tables (`user`, `session`, `account`) |
| **Team screenshots** | `/data/screenshots/` (image files; served only to authenticated members, never as public static files) |
| **HTTPS certificate + key** | `/data/certs/server.crt`, `/data/certs/server.key` |
| **Automatic backups** | `/data/backups/<timestamp>/` |

On the host, the Docker volume `bugstow-data` maps to `/data`. Inspect its real
path with `docker volume inspect bugstow_bugstow-data`.

---

## 11. Runtime network audit — expected external connections

Audited across the whole codebase:

| From | External connection | When |
|---|---|---|
| Personal app (browser) | **none** | ever |
| Team app (browser) | **none** — only its own server (same origin) | ever |
| Team server | `api.github.com` | **only** if you enable GitHub import (`BUGSTOW_OFFLINE=false`) and use it |
| Auth (better-auth) | **none** | ever |
| Update checks | **none** | there is no automatic update check |

**Normal offline operation requires no external connection.** A strict
Content-Security-Policy (`connect-src 'self'`) is served, so the browser is
physically blocked from reaching any external host — verified: an in-app
`fetch('https://example.com')` is refused.

---

## 12. Known limitations

- **GitHub import needs the internet** (by nature). It is off by default; the
  button is hidden and the endpoint returns a clear 403 in offline mode. Enable
  only with connectivity (`BUGSTOW_OFFLINE=false`).
- **Building the bundle needs internet once** (to bake the Node base image + npm
  packages into the saved image). Install and run afterward are fully offline.
- **Self-signed HTTPS shows a first-visit warning** until the certificate is
  trusted on each client (section 7). This is inherent to not using a public CA.
- **Team edition requires the host running.** Teammates cannot reach shared data
  while Computer A's server is off — it is the single source of truth.

---

## 13. Offline acceptance test

### 13a. Automated (run this — it is real)

`scripts/acceptance-test.mjs` drives **two independent clients** (admin + teammate)
against a running Team server — exactly what two computers on a LAN do. Run it
against a **fresh** server:

```bash
# with the Team server running (fresh, no accounts):
node scripts/acceptance-test.mjs --url http://localhost:8080
# TLS: NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/acceptance-test.mjs --url https://192.168.1.20:8080
```

It verifies, and this was **run and passed 25/25** during release prep:

- server health + fresh-setup + offline flag
- account creation and authentication (admin)
- team, project, issue creation; screenshot upload
- invite by email; teammate registration + auto-join
- teammate sees the shared team, issue, and screenshot; downloads the screenshot
- assignment to the teammate; teammate sees it
- teammate edits the issue; admin sees the edit (cross-user propagation)
- permission isolation (a non-member is refused, HTTP 403)
- deletion; teammate no longer sees the deleted issue
- GitHub import refused in offline mode (graceful 403)
- backup creation and listing

Restart persistence was verified separately: after stopping and restarting the
server on the same data, `setupComplete` stays true and the database is intact
(users, teams, projects, and **sessions** all persist — teammates stay signed in).

### 13b. The real two-computer / no-internet test (do this on your hardware)

This is the acceptance test the release targets. Perform it on two physical
machines:

1. **Disable internet on both computers** (unplug Ethernet / turn off Wi-Fi, or
   use an isolated switch/router with no uplink). Keep them on the same LAN.
2. **Computer A (host):**
   - Install the Team edition offline (section 3).
   - Set `BUGSTOW_BASE_URL` to A's LAN IP (section 6); optionally enable TLS
     (section 7).
   - `docker compose -f docker-compose.offline.yml up -d`.
   - Register the admin; create a team, a project, and an issue with a screenshot.
   - Run `node acceptance-test.mjs --url http://<A-ip>:8080` **against a second
     fresh instance** if you want the automated pass, or continue manually.
3. **Computer B (client):**
   - Open `http://<A-ip>:8080` (or `https://…` if TLS), choose **My team**.
   - Register with the invited email; confirm you see the shared project/issue.
   - Get assigned an issue by A; edit it; confirm A sees the change.
   - Upload a screenshot; confirm A sees it.
4. **Restart test:** `docker compose ... restart` (or reboot Computer A). After it
   comes back, confirm B still sees all data and can sign in.
5. **Backup/restore test:** trigger a backup, then follow section 8 to restore and
   confirm data is intact.
6. **Personal test:** on either machine, open Personal mode, create issues, close
   the browser completely, reopen it (still offline) — data persists.

### 13c. Verification status (honest)

| Item | Status |
|---|---|
| Two-client full workflow (auth, teams, projects, issues, screenshots, assignment, edit propagation, permissions, deletion, backup) | **Verified automatically** (`acceptance-test.mjs`, 25/25) |
| Restart persistence of the Team database + sessions | **Verified automatically** (stop/restart on same data) |
| Offline GitHub-import gate, CSP blocking external fetch, HTTPS self-signed LAN cert generation, auto/manual backups on disk | **Verified automatically / manually** during release prep |
| Server-side "no external calls" (code audit) | **Verified** (audit in section 11 + `docs/OFFLINE.md`) |
| Two **physical** computers with internet **hardware-disabled** over a real LAN | **Requires real-device verification** — cannot be done in the build sandbox; follow 13b |
| Personal PWA offline after a full browser restart on a no-internet machine | **Requires real-device verification** — the SW registers on real browsers (and on the HTTPS deploy) but could not be exercised in the sandbox test browser on localhost; IndexedDB persistence is verified by the automated tests |
| Docker/host reboot persistence (vs. process restart) | **Requires real-device verification** — uses the same persistent volume as the verified process restart |
