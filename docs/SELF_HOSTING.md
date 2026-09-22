# Self-hosting Bugstow (Team edition)

Team mode runs on a computer or server **you** own. Your teammates connect to it
over your network and share projects, issues, and screenshots. All data lives on
your machine — a SQLite database and a screenshots folder — never on anyone
else's infrastructure.

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
- That's it. You do **not** need Node, SQLite, Neon, Cloudflare, or Vercel.

---

## 2. Install & run (a few commands)

```bash
git clone https://github.com/Gr33nOps/bugstow.git
cd bugstow

# Create your config and set a secret
cp server/.env.example .env
# Edit .env and set BUGSTOW_AUTH_SECRET (see below)

docker compose up -d --build
```

Generate a strong secret for `BUGSTOW_AUTH_SECRET`:

```bash
openssl rand -base64 32
```

The server starts on **http://localhost:8080**. Check it:

```bash
curl http://localhost:8080/api/health
# {"ok":true,"app":"bugstow-team","setupComplete":false,...}
```

### Configuration (`.env`)

| Variable | Required | Description |
|---|---|---|
| `BUGSTOW_AUTH_SECRET` | **Yes** | Signs session cookies. Keep it private. Generate with `openssl rand -base64 32`. |
| `BUGSTOW_BASE_URL` | Recommended | The URL teammates use to reach the server (e.g. `http://192.168.1.20:8080`). Must match how the browser connects, or sign-in fails. |
| `PORT` | No | Port inside the container (default `8080`). |
| `BUGSTOW_OPEN_SIGNUP` | No | `true` lets anyone who can reach the server register. Default `false` = invite-only after the first admin. |
| `BUGSTOW_MAX_UPLOAD_BYTES` | No | Max screenshot size in bytes (default `10485760` = 10 MB). |
| `BUGSTOW_TRUSTED_ORIGINS` | No | Extra allowed origins for auth (comma-separated). Rarely needed. |

See [`server/.env.example`](../server/.env.example) for the annotated template.

---

## 3. Initial administrator setup

1. Open the server URL in a browser.
2. Choose **My team**.
3. The first account you create becomes the **administrator**. After that,
   registration is closed unless you invite people (or set `BUGSTOW_OPEN_SIGNUP=true`).
4. Create a team, then invite teammates by email from **Members**.

There is no default password and no secret admin account — the admin is simply
the first person to register on a fresh server. Do this yourself immediately
after install so nobody else can claim it.

---

## 4. Local network access

By default the server is reachable at `http://<host-ip>:8080` on your LAN.

1. Find the host's LAN IP (e.g. `192.168.1.20`):
   - macOS/Linux: `ipconfig getifaddr en0` / `hostname -I`
   - Windows: `ipconfig`
2. Set `BUGSTOW_BASE_URL=http://192.168.1.20:8080` in `.env` and
   `docker compose up -d` again.
3. Share `http://192.168.1.20:8080` with teammates on the same network.
4. Allow the port through the host firewall if needed.

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

**Back up** the whole data volume (database + screenshots) to a file:

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

Run backups on a schedule (cron) and keep copies off the host.

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
  on your domain, forwarding to `bugstow:8080`. Set
  `BUGSTOW_BASE_URL=https://bugstow.example.com`. Over HTTPS the server issues
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
| **Forgot the admin password** | There is no email reset in this version. Restore from a backup, or (last resort) create a new admin: `docker compose down`, remove the `user`/`session` rows via `sqlite3 /data/bugstow.sqlite`, restart, and register again. Back up first. |
| **Check logs** | `docker compose logs -f bugstow` |
| **Health check** | `curl http://localhost:8080/api/health` |

---

## 10. What the server does *not* do

- No telemetry, analytics, or third-party services receive your content.
- No external cloud dependency — it runs fully on your host.
- No peer-to-peer or offline sync in this version: updates propagate through the
  server and the app refreshes on navigation/actions (simple API + polling).
