# Running Bugstow fully offline

Bugstow is designed to run entirely on your own machines with **no internet
connection and no external services**. This document covers how to install both
editions offline, exactly where data is stored, which connections are required,
how backups and updates work, how to prove it runs with the internet blocked,
and the remaining limitations.

---

## Network audit — what talks to the outside world

The codebase was audited for every external request:

| Component | External calls | Notes |
|---|---|---|
| Personal frontend (browser) | **None** | No fonts, CDNs, analytics, or telemetry. System fonts only. Data is IndexedDB. |
| Team frontend (browser) | **None** | Talks only to its own server (same origin). |
| Team server | **GitHub import only** (`api.github.com`) | Disabled by default in offline mode. Everything else — auth, DB, screenshots — is local. |
| Authentication | **None** | better-auth runs locally against SQLite; no remote provider, no telemetry. |
| Update checks | **None automatic** | No online version checks. Updates are manual (see below). |

**Strict offline mode is ON by default** (`BUGSTOW_OFFLINE=true`). The only
internet-touching feature, GitHub import, returns a clear error and the button
is hidden in the UI. In addition, the server sends a strict Content-Security-
Policy (`connect-src 'self'`) so the browser is **physically unable** to reach
any external host — verified: `fetch('https://example.com')` is blocked.

Set `BUGSTOW_OFFLINE=false` only if you deliberately want GitHub import.

---

## Where your data is stored

**Personal edition** — everything is in the browser only:

- Projects, issues, screenshots, settings → **IndexedDB** (origin-scoped).
- Nothing is written to disk outside the browser; nothing is uploaded.
- Move/keep data with **Settings → Export Backup** (AES-256-GCM encrypted).

**Team edition** — everything is on the host you run it on, under the data
volume (`/data` in Docker):

- `/data/bugstow.sqlite` — teams, members, projects, issues, users, sessions.
- `/data/screenshots/` — screenshot image files (served only to authenticated members; never static).
- `/data/backups/` — automatic local backups.
- `/data/certs/` — self-signed HTTPS certificate (if TLS enabled).

Team data is readable by the team server. It is **not** end-to-end encrypted.

---

## Offline installation (download once, install with no internet)

On a machine that has internet + Docker, build the bundle once:

```bash
npm install
node scripts/build-offline-bundle.mjs      # → ./offline-bundle/
```

Copy `offline-bundle/` to the offline machine(s). Verify integrity first:

```bash
cd offline-bundle
sha256sum -c SHA256SUMS.txt      # macOS: shasum -a 256 -c SHA256SUMS.txt
```

### Team edition (offline)

Requires Docker only. No image is pulled or built during install.

```bash
cd offline-bundle/team
cp .env.example ../.env          # set BUGSTOW_AUTH_SECRET; edit as needed
docker load -i bugstow-image.tar
docker compose -f docker-compose.offline.yml up -d
```

Open `http://localhost:8080`, register the first account (becomes admin).

### Personal edition (offline)

Requires only Node.js — no `npm install`, no internet.

```bash
cd offline-bundle/personal
node serve-personal.mjs          # http://localhost:8000
```

Open it in a browser and choose **Install app** to keep it available offline as
an installed PWA. (The team server also serves the personal edition, so a single
Docker install can cover both.)

---

## Secure local network access (HTTPS, no cloud)

For LAN or remote (VPN) access, enable HTTPS with a locally generated,
self-signed certificate — no cloud CA involved:

```bash
# in .env
BUGSTOW_TLS=true
BUGSTOW_BASE_URL=https://<host-ip>:8080
```

On first start the server generates `/data/certs/server.{crt,key}`, valid for
`localhost`, `127.0.0.1`, and **every LAN IPv4 address of the host**, for 10
years. Teammates reach it at `https://<host-ip>:8080` and trust the certificate
once (browser will warn on first visit because it is self-signed; you can also
distribute `server.crt` to teammates to import as a trusted root).

To use your own certificate instead (e.g. from `mkcert`), point
`BUGSTOW_TLS_CERT` / `BUGSTOW_TLS_KEY` at your files.

> `BUGSTOW_BASE_URL` must match how the browser reaches the server (scheme +
> host + port) or session cookies will not stick. Over HTTPS, cookies are marked
> Secure automatically.

---

## Automatic local backups & restore

Automatic backups are **on by default** (`BUGSTOW_BACKUP_ENABLED=true`):

- A backup is taken shortly after startup and then every
  `BUGSTOW_BACKUP_INTERVAL_HOURS` (default 24).
- The last `BUGSTOW_BACKUP_RETENTION` (default 7) are kept; older ones are pruned.
- Each backup is a self-contained folder in `/data/backups/<timestamp>/`
  containing a consistent `bugstow.sqlite` snapshot, a copy of every screenshot,
  and a `manifest.json`.
- Trigger one on demand: signed-in members can `POST /api/admin/backup`; list
  them with `GET /api/admin/backups`.

### Restore (tested procedure)

```bash
docker compose down                 # stop the server
# Identify the backup inside the data volume, then restore it:
docker run --rm -v bugstow_bugstow-data:/data alpine sh -c '
  cd /data &&
  cp "backups/<timestamp>/bugstow.sqlite" bugstow.sqlite &&
  rm -rf screenshots && cp -r "backups/<timestamp>/screenshots" screenshots'
docker compose up -d
```

The automated test `server/src/backup.test.ts` proves a backup is a valid,
independent snapshot (it opens the snapshot DB and confirms the rows). You can
also verify by hand: the snapshot `.sqlite` opens in any SQLite client and
contains all data.

---

## Manual, verifiable offline updates (data preserved)

Updates never happen automatically and never require the internet at install
time.

**Team edition:**

1. On an online machine, build a new bundle (`node scripts/build-offline-bundle.mjs`).
2. Copy `team/bugstow-image.tar` (+ `SHA256SUMS.txt`) to the offline host and
   verify the checksum.
3. `docker load -i bugstow-image.tar && docker compose -f docker-compose.offline.yml up -d`.

The `/data` volume is untouched, so all data is preserved. Schema changes are
additive (`CREATE TABLE IF NOT EXISTS`, new columns) — no destructive
migrations. **Back up first** (a backup is taken automatically, but you can force
one with `POST /api/admin/backup`).

**Personal edition (PWA):** replace the served `dist/` with the new build. The
service worker updates on the next load. To force it: hard-refresh
(Ctrl/Cmd+Shift+R). No online update check is ever performed.

---

## Isolated-network test procedure (prove it works with the internet blocked)

**Team edition (Docker, no internet):**

```bash
docker load -i bugstow-image.tar
docker network create --internal bugstow-isolated       # no gateway to the internet
docker run -d --name bugstow --network bugstow-isolated \
  -p 8080:8080 --env-file .env -v bugstow-data:/data bugstow:latest

# Verify it works with zero external access:
curl -s http://localhost:8080/api/health                # {"ok":true,...,"offline":true}
#   register admin, create a team, add issues, upload a screenshot — all succeed.
# Prove GitHub import is refused:
#   POST /api/github-import  →  403 "GitHub import is disabled in offline mode."
```

On the `--internal` network the container has **no route to the internet**, so
any accidental external call would fail; the app operates normally regardless.

**Personal edition:** turn off Wi-Fi / pull the network cable, then open the
installed PWA (or `node serve-personal.mjs` on the LAN). Create issues, paste
screenshots, export a backup — all work with no connectivity. The browser
DevTools **Network** tab shows only same-origin requests (and one `/api/health`
probe that fails harmlessly on the static build).

**What was verified during development** (see the test report in the PR):
- `fetch('https://example.com')` from the app is **blocked** by CSP.
- Server boots with `offline: true`; GitHub import returns 403.
- Auth, teams, projects, issues, screenshots, SQLite persistence across restart,
  automatic + manual backups, and HTTPS with a self-signed LAN cert all work
  with no external calls.

---

## Remaining limitations

- **GitHub import requires the internet** by nature. It is disabled in offline
  mode; enable it only when you have connectivity (`BUGSTOW_OFFLINE=false`).
- **Building the offline bundle needs internet once** (to pull the Node base
  image and npm packages into the saved Docker image). After that, install and
  run are fully offline. This is the "download once" step.
- **Self-signed HTTPS shows a browser warning** on first visit until teammates
  trust the certificate (or you distribute `server.crt`). This is inherent to
  not using a public CA.
- **PWA offline install** was verified on a real HTTPS origin. Service-worker
  registration could not be exercised inside the sandboxed development test
  browser on `localhost`, but the SW assets are served correctly and register in
  standard browsers (Chrome/Firefox/Safari) on `localhost` and HTTPS.
- **Team edition needs the host running.** Teammates cannot reach shared data
  while the host server is off — by design, it is the single source of truth.
