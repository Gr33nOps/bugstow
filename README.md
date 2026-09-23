# bugstow.

> **Spot it. Stow it. Fix it.**
> An issue tracker for bugs, UI problems and ideas you notice while building.
> Use it on your own in the browser, or run it on your own server for your team.

BugsTow replaces screenshotting bugs into your DMs or notes: capture an issue,
paste a screenshot, and turn it into a ready-to-paste prompt for your coding
assistant later.

BugsTow does not store your project data on infrastructure operated by the
BugsTow maintainer. No cloud service is required for normal operation.

- **Personal mode:** your projects, issues and screenshots stay in your
  browser. BugsTow does not require an account or backend for Personal mode.
- **Team mode:** your team runs its own BugsTow server. Shared project data is
  stored on infrastructure your team controls.
- **Your own cloud (optional):** sync Personal mode between your phone and
  computers, or send Team backups, through cloud storage you choose (Google
  Drive, Dropbox, WebDAV, or any cloud via a synced folder or file).
  Everything is encrypted with your passphrase before it leaves your device.
  See [`docs/CLOUD_SYNC.md`](docs/CLOUD_SYNC.md).
- **Offline:** BugsTow can operate entirely offline after installation.
  Optional internet-dependent features such as GitHub import and cloud sync
  are off unless you turn them on. See [`docs/OFFLINE.md`](docs/OFFLINE.md).

---

## Personal mode (in your browser)

Open https://bugstow.vercel.app, or serve the built app yourself:

- **No account, no backend.** Projects, issues, screenshots and settings are
  stored in your browser's IndexedDB.
- **Works offline** after the first visit (installable app).
- **Screenshots:** paste (`Cmd/Ctrl+V`), drag and drop, or pick a file
  (PNG/JPEG/WebP).
- **Copy as Prompt:** turn an issue into a structured prompt for an AI assistant.
- **Backups:** export a file you can restore later, optionally encrypted with a
  passphrase (AES-256-GCM, PBKDF2 with 100,000 iterations). Also how you move
  data to another browser or into a team.
- **Sync across devices (optional):** Settings → Sync connects your own Google
  Drive, Dropbox, WebDAV server, a folder your cloud app syncs (Mega, Terabox,
  OneDrive…), or a portable sync file. End-to-end encrypted with your
  passphrase; your cloud only stores unreadable files.

> **Good to know:** browser storage is not permanent. Clearing site data,
> switching browsers or losing the device loses it, so export backups. Browser
> storage is **not encrypted on disk**; only exported files you choose to encrypt
> are.
>
> The public website is a static host (currently Vercel). Like any website, it
> receives normal request information when the page loads (such as your IP
> address and browser type, kept in its access logs). It never receives your
> projects, issues or screenshots: Personal mode has no API. If you turn on
> sync, your browser talks directly to the cloud you chose, sending only
> encrypted files.

---

## Team mode (self-hosted)

Run BugsTow on a computer or server your team controls:

- Node.js + Express, a **SQLite** database and screenshots on the **local
  disk**, packaged with **Docker Compose**.
- Accounts, teams, roles (owner/admin/member), invites, assignment, and optional
  GitHub issue import (off in offline mode).
- **First-run protection:** creating the first administrator needs a one-time
  setup token printed in the server log.
- **HTTPS on your LAN** with a certificate generated locally (recommended
  whenever other computers connect).
- **Automatic backups**, optionally copied to a second drive, USB disk or NAS.
- Two people editing the same issue can't silently overwrite each other: the
  later save is refused with a "reload first" message.

The team server is the source of truth; teammates can't reach shared data while
it is off. Team data is readable by whoever controls the server (it is not
end-to-end encrypted, and not encrypted at rest by BugsTow).

**→ Guide: [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md)** ·
**No internet? [`docs/RELEASE_OFFLINE.md`](docs/RELEASE_OFFLINE.md)**

Quick start:

```bash
git clone https://github.com/Gr33nOps/bugstow.git
cd bugstow
cp server/.env.example .env      # set BUGSTOW_AUTH_SECRET; for your LAN also BASE_URL + TLS
docker compose up -d --build
docker compose logs bugstow      # copy the one-time setup token
```

Open the server, choose **My team** and create the administrator with the token.

---

## Moving from Personal to Team

You keep your local data; the team gets a copy:

1. Personal mode → **Settings → Export Backup**.
2. Team mode → **user menu → Import personal data** → pick the file → confirm.

The import only adds data. It never deletes anything in your browser.

---

## Deploying the public website (static)

The public site is a static build with no backend. Host it anywhere that serves
static files.

```bash
npm ci
npm run build      # outputs ./dist
```

[`vercel.json`](vercel.json) adds an SPA rewrite and security headers (a
Content-Security-Policy that only allows scripts from the site itself, and
connections to the site or to HTTPS hosts, which cloud sync needs). The same
`dist` works on a team server: it only looks for a team server when the page
was served by one, so the public site makes no API requests.

To offer Google Drive and Dropbox sync, set `VITE_GOOGLE_CLIENT_ID` and
`VITE_DROPBOX_CLIENT_ID` at build time (setup steps in
[`docs/CLOUD_SYNC.md`](docs/CLOUD_SYNC.md)). Without them those two options
show "not set up"; the others work regardless.

---

## Security

BugsTow has had an internal security review and has automated tests for its
access rules, but no independent audit. To report a vulnerability, see
[`SECURITY.md`](SECURITY.md). Please don't post details in a public issue.

---

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, `vite-plugin-pwa`
- **Personal storage:** IndexedDB (`idb`)
- **Crypto (exports):** Web Crypto (PBKDF2-HMAC-SHA256, AES-256-GCM)
- **Team server:** Node.js, Express, SQLite (`better-sqlite3`), better-auth
- **Deployment:** static host (public site) + Docker Compose (team server)
- **Tests:** Vitest (frontend), `node:test` (server), two-client acceptance test

---

## Project structure

```
bugstow/
├── src/                       # React app (Personal + Team frontend)
│   ├── App.tsx                # Personal app
│   ├── RootApp.tsx            # Chooses Personal vs Team at runtime
│   ├── components/team/       # Team UI (loaded only from a team server)
│   ├── hooks/                 # useBugstowData (IndexedDB), useTeamData (team API)
│   ├── lib/                   # authClient, teamServer detection, connection
│   └── services/              # backup, prompt, storage, teamApi, teamMigration
├── server/                    # Self-hosted team server
│   └── src/                   # Express app, auth, SQLite, backups, TLS, tests
├── scripts/                   # acceptance test, offline bundle builder, static server
├── docs/                      # SELF_HOSTING, OFFLINE, RELEASE_OFFLINE, RELEASE_CHECKLIST
├── Dockerfile, docker-compose.yml, docker-compose.offline.yml
└── vercel.json                # Static public-site config
```

---

## Development

```bash
npm ci
npm run dev        # http://localhost:8443

# Team server (separate terminal):
cd server && npm ci
BUGSTOW_AUTH_SECRET=dev-secret-0123456789 npm run dev   # http://localhost:8080
```

In development, Vite proxies `/api` to `http://localhost:8080` (override with
`BUGSTOW_SERVER`).

```bash
npm run typecheck && npm test && npm run build
cd server && npm run typecheck && npm test
```

---

## License

MIT.
