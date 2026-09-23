# Self-hosting Bugstow (Team edition)

Team mode runs on a computer or server **your team controls**. Teammates connect
to it over your network and share projects, issues and screenshots. Shared data
is stored on that machine (a SQLite database and a screenshots folder). No cloud
service is required, and the BugsTow maintainer never receives your data.

The team server is the source of truth. When it is off or unreachable,
teammates cannot access the shared data (their own personal browser data is
separate and unaffected).

- **Backend:** Node.js + Express
- **Database:** SQLite (file-backed)
- **Screenshots:** local filesystem
- **Auth:** email + password, server-side sessions (better-auth)
- **Frontend:** the same Bugstow React app, served from the server's own origin

---

## 1. Requirements

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose (v2).
- That's it. You do **not** need Node, SQLite or any cloud account.
- No internet? Use the offline bundle instead: [`RELEASE_OFFLINE.md`](RELEASE_OFFLINE.md).

---

## 2. Install & run (a few commands)

```bash
git clone https://github.com/Gr33nOps/bugstow.git
cd bugstow

# Create your config
cp server/.env.example .env
# Edit .env: BUGSTOW_AUTH_SECRET (required); for teammates on your network also
# BUGSTOW_BASE_URL=https://<this computer's IP>:8080 and BUGSTOW_TLS=true (§4)

docker compose up -d --build
docker compose logs bugstow      # shows the one-time setup token (§3)
```

Generate a strong secret for `BUGSTOW_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

With the defaults the server starts on **http://localhost:8080** (this computer
only). Check it:

```bash
curl http://localhost:8080/api/health
# {"ok":true,"app":"bugstow-team","setupComplete":false,...}
```

### Configuration (`.env`)

| Variable | Required | Description |
|---|---|---|
| `BUGSTOW_AUTH_SECRET` | **Yes** | Signs session cookies. Keep it private. Generate with `openssl rand -base64 32`. |
| `BUGSTOW_BASE_URL` | Recommended | The address teammates use (e.g. `https://192.168.1.20:8080`). Must match what the browser connects to, or sign-in fails. |
| `PORT` | No | Port inside the container (default `8080`). |
| `BUGSTOW_OPEN_SIGNUP` | No | `true` lets anyone who can reach the server register. Default `false` = invite-only after the first admin. |
| `BUGSTOW_MAX_UPLOAD_BYTES` | No | Max screenshot size in bytes (default `10485760` = 10 MB). |
| `BUGSTOW_TRUSTED_ORIGINS` | No | Extra allowed origins for auth (comma-separated). Rarely needed. |
| `BUGSTOW_OFFLINE` | No | `true` (default) disables the only internet feature (GitHub import). Set `false` to allow it. |
| `BUGSTOW_TLS` | **Recommended for LAN** | `true` serves HTTPS with a certificate BugsTow generates locally. |
| `BUGSTOW_TLS_HOSTS` | No | Extra hostnames/IPs for the generated certificate (comma-separated). The `BUGSTOW_BASE_URL` host is always included. |
| `BUGSTOW_TLS_CERT` / `BUGSTOW_TLS_KEY` | No | Paths to your own cert/key (e.g. from mkcert) instead of the generated one. |
| `BUGSTOW_BACKUP_ENABLED` | No | `true` (default) takes automatic local backups. |
| `BUGSTOW_BACKUP_INTERVAL_HOURS` | No | Hours between automatic backups (default `24`). |
| `BUGSTOW_BACKUP_RETENTION` | No | How many backups to keep (default `7`). |
| `BUGSTOW_BACKUP_EXTERNAL_DIR` | **Recommended** | A second backup folder on separate hardware (USB disk, other drive, NAS mount). See [RELEASE_OFFLINE.md §8](RELEASE_OFFLINE.md#8-backups-and-restore). |
| `BUGSTOW_BACKUP_EXTERNAL_RETENTION` | No | How many external backups to keep (default: same as `BUGSTOW_BACKUP_RETENTION`). |
| `BUGSTOW_BACKUP_ENCRYPTION_PASSPHRASE` | For cloud backups | Encrypts backup archives sent to your cloud. Nothing is uploaded without it. See [CLOUD_SYNC.md](CLOUD_SYNC.md#team-backups-to-your-cloud). |
| `BUGSTOW_BACKUP_CLOUD_DIR` | No | A folder a cloud desktop app syncs (Google Drive, Dropbox, OneDrive, Mega, Terabox…). Encrypted archives go there. |
| `BUGSTOW_BACKUP_WEBDAV_URL` / `_USER` / `_PASSWORD` | No | Upload encrypted archives to a WebDAV folder (Nextcloud, ownCloud, pCloud, Koofr, Synology…). |
| `BUGSTOW_BACKUP_CLOUD_RETENTION` | No | How many cloud archives to keep (default: same as `BUGSTOW_BACKUP_RETENTION`). |
| `BUGSTOW_SETUP_TOKEN` | No | Fixed first-admin setup token (20+ characters) for scripted installs. Normally leave unset: a random one is printed in the log. |
| `BUGSTOW_TRUST_PROXY` | No | Set to `1` only when a reverse proxy (Caddy/nginx) sits in front. Leave unset for direct/LAN access. |

See [`server/.env.example`](../server/.env.example) for the annotated template.

> **Running fully offline** (no internet, LAN-only, HTTPS, automatic backups,
> offline install/update, and an isolated-network test procedure): see
> **[`docs/OFFLINE.md`](OFFLINE.md)**.

---

## 3. Initial administrator setup

A fresh server prints a **one-time setup token** in its log. Only someone who
can read the server's log can create the first account, so nobody else on the
network can claim a newly installed server.

1. `docker compose logs bugstow` and copy the `Setup token`
   (or `docker exec bugstow npm run -s setup-token`).
2. Open the server address in a browser and choose **My team**.
3. Enter the token, your name, email and a password → **Create administrator**.
   The token is deleted at that moment and can't be used again.
4. Create a team, then invite teammates by email from **Members**. After setup,
   registration is closed to everyone who hasn't been invited (unless
   `BUGSTOW_OPEN_SIGNUP=true`).

There is no default password and no hidden admin account. Servers upgraded from
2.0.x already have an administrator and never ask for a token.

The first account is also the **server administrator**: the only one who can
run on-demand backups and reset other people's passwords. Invites expire after
7 days; invite again if someone missed the window.

---

## 4. Local network access (use HTTPS)

| Setup | Address | Encrypted? |
|---|---|---|
| localhost | `http://localhost:8080` | Stays on this computer. Fine for trying it out |
| LAN over HTTP | `http://192.168.1.20:8080` | **No.** Passwords, session cookies and issues cross the network readable by anyone on it |
| LAN over HTTPS | `https://192.168.1.20:8080` | **Yes. Recommended** whenever other computers connect |

Being on a local network does not make HTTP private: anyone on the same Wi-Fi or
switch (including a compromised device) can read unencrypted traffic.

1. Find the host's LAN IP (e.g. `192.168.1.20`):
   - macOS/Linux: `ipconfig getifaddr en0` / `hostname -I`
   - Windows: `ipconfig`
2. In `.env`: `BUGSTOW_TLS=true` and `BUGSTOW_BASE_URL=https://192.168.1.20:8080`,
   then `docker compose up -d` again.
3. Allow the port through the host firewall.
4. Teammates open `https://192.168.1.20:8080` and trust the certificate once:
   step-by-step instructions for each OS, including how to check its
   fingerprint, are in [RELEASE_OFFLINE.md §7](RELEASE_OFFLINE.md#7-trusting-the-https-certificate).

> Cookies are tied to the exact origin. If teammates reach the server at a
> different address than `BUGSTOW_BASE_URL`, sign-in will silently fail. Keep
> them consistent.

---

## 5. Data, persistence & where things live

All data is stored in the Docker named volume `bugstow-data`, mounted at `/data`:

- `/data/bugstow.sqlite` — projects, issues, teams, members, sessions, users
- `/data/screenshots/` — screenshot image files

Data survives `docker compose restart`, `down`, and `up --build`. It is deleted
only if you explicitly remove the volume (`docker compose down -v`).

Screenshot files and the database are **never** served as public static files;
images are streamed only to authenticated team members through the API.

---

## 6. Backup & restore

BugsTow backs up automatically to `/data/backups` and, if you set
`BUGSTOW_BACKUP_EXTERNAL_DIR`, to a second location on separate hardware. That
second copy is what protects you from a dead disk, theft or ransomware. Setup,
examples (USB disk, other drive, NAS) and the restore steps are in
[RELEASE_OFFLINE.md §8](RELEASE_OFFLINE.md#8-backups-and-restore).

You can also back up the whole data volume to a single archive by hand:

```bash
docker run --rm \
  -v bugstow_bugstow-data:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/bugstow-backup-$(date +%F).tgz -C /data .
```

**Restore** into a fresh volume (stop the app first):

```bash
docker compose down
docker volume create bugstow_bugstow-data
docker run --rm \
  -v bugstow_bugstow-data:/data \
  -v "$PWD":/backup \
  alpine sh -c "cd /data && tar xzf /backup/bugstow-backup-YYYY-MM-DD.tgz"
docker compose up -d
```

> The volume name is `<project>_bugstow-data`; with the repo folder named
> `bugstow` it is `bugstow_bugstow-data`. Check with `docker volume ls`.

Keep copies off the host. Backups contain all issues and screenshots, so
store them as carefully as the server itself.

---

## 7. Upgrades & migrations

```bash
git pull
docker compose up -d --build
```

Schema changes are **additive** (`CREATE TABLE IF NOT EXISTS`, new columns) and
better-auth migrations run automatically on start. No destructive migrations are
performed. Still, **back up first** (section 6) before upgrading.

### Migrating personal data into a team

A personal user can move their data into a team without losing their local copy:

1. In personal mode: **Settings → Export Backup** (encrypted recommended).
2. In team mode: **user menu → Import personal data**, pick the backup file,
   enter the passphrase if encrypted, review the counts, and confirm.

This is **additive** — it creates the projects, issues, and screenshots on the
team server and never deletes the personal browser data.

---

## 8. Secure remote access (outside your LAN)

Do **not** expose the server directly to the public internet. Choose one:

- **VPN (recommended):** put the host and teammates on a private network such as
  [Tailscale](https://tailscale.com/) or WireGuard, then use the private IP as
  `BUGSTOW_BASE_URL`. Nothing is exposed publicly.
- **HTTPS reverse proxy:** front the server with Caddy or nginx terminating TLS
  on your domain, forwarding to `bugstow:8080` (then leave `BUGSTOW_TLS` off). Set
  `BUGSTOW_BASE_URL=https://bugstow.example.com` and `BUGSTOW_TRUST_PROXY=1`
  (so rate limiting sees real client IPs). Over HTTPS the server issues
  **secure** cookies automatically.

Additional hardening:

- Keep `BUGSTOW_OPEN_SIGNUP=false` (the default) so only invited people join.
- Use a long random `BUGSTOW_AUTH_SECRET` and keep `.env` out of version control
  (it is already git-ignored).
- Restrict who can reach the port (firewall / VPN ACLs).
- Screenshots may contain private information — treat backups as sensitive.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| **Sign-in appears to do nothing / logs out immediately** | `BUGSTOW_BASE_URL` doesn't match the address in the browser. Set it to the exact origin teammates use and restart. |
| **Port 8080 already in use** | Change the host port in `docker-compose.yml` (`"8081:8080"`) and update `BUGSTOW_BASE_URL`. |
| **Teammates can't connect** | Confirm same network, correct host IP, and host firewall allows the port. |
| **`better-sqlite3` build errors during image build** | The Dockerfile installs build tools; ensure the build isn't running with `--platform` mismatched to your host. |
| **Container won't start, mentions `BUGSTOW_AUTH_SECRET`** | Set a secret of at least 16 characters in `.env` (production requires it). |
| **A teammate forgot their password** | The server administrator opens **Members**, clicks the key icon next to them, and gives them the temporary password shown. They choose a new one after signing in. |
| **Forgot the admin password** | On the host: `docker exec -it bugstow npm run reset-password -- you@example.com`. It prints a temporary password; sign in with it and choose a new one. |
| **Lost the setup token** | `docker exec bugstow npm run -s setup-token` prints it again (only while no administrator exists). |
| **"Not encrypted" warning in the app** | The server is reached over plain HTTP from another computer. Turn on HTTPS (§4). |
| **Browser says the certificate is not valid for this address** | The address isn't in the certificate. Set `BUGSTOW_BASE_URL` to the address teammates use (or add it to `BUGSTOW_TLS_HOSTS`) and restart; a new certificate is generated. |
| **Log shows `EXTERNAL BACKUP FAILED`** | The external backup folder is missing, not mounted, or lacks the `.bugstow-backup-target` marker file. The local backup still worked. See RELEASE_OFFLINE.md §8. |
| **"Too many failed attempts"** | 10 failed sign-ins from one address within 15 minutes. Wait 15 minutes. Behind a reverse proxy, set `BUGSTOW_TRUST_PROXY=1` so each client is counted separately. |
| **Check logs** | `docker compose logs -f bugstow` |
| **Health check** | `curl http://localhost:8080/api/health` |

---

## 10. What the server does *not* do

- No telemetry or analytics. The auth library's optional telemetry is forced off.
- No cloud dependency: it runs entirely on your host. The only internet feature,
  GitHub import, is off unless you set `BUGSTOW_OFFLINE=false`.
- No encryption at rest: the database, screenshots and backups are ordinary
  files. Use disk encryption on the host and backup drives if you need it.
- No live sync: changes appear when the app reloads data. If two people edit the
  same issue, the second save is refused with a "reload first" message instead of
  overwriting.
