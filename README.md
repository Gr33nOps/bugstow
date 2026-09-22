# bugstow.

> **Spot it. Stow it. Fix it.**
> A privacy-first issue tracker. Use it privately in your browser, or self-host it for your team.

Bugstow replaces the messy workflow of screenshotting bugs into your own DMs or
notes. It captures bugs, UI issues, ideas, and feedback while you build — and it
never stores your data on infrastructure you don't control.

There are two ways to use it:

- **Personal mode** — open the website and everything stays in *your* browser. No
  account, no server, works offline.
- **Team mode** — a teammate self-hosts Bugstow on their own machine; the team
  connects to it and shares projects and issues. The data lives on *their*
  machine.

No user or team data is stored on the maintainer's infrastructure.

---

## Personal mode (browser-only)

Open the public site and start immediately:

- **No account, no setup, no backend.** Everything is stored locally in your
  browser (IndexedDB): projects, issues, screenshots, and settings.
- **Works offline** after first load — the app shell is cached by a service
  worker. Your data is always local, so there is nothing to sync.
- **Screenshot capture:** clipboard paste (`Cmd/Ctrl+V`), drag-and-drop, or file
  upload (PNG/JPEG/WebP).
- **Copy as Prompt:** turn an issue into a structured, LLM-ready prompt.
- **Encrypted backups:** export an AES-256-GCM–encrypted backup (PBKDF2, 100k
  iterations) and restore it later. This is how you move between browsers or
  devices, or seed a team.
- **Storage controls:** see how much space you're using and request persistent
  storage where the browser supports it.

> **Where your data lives:** browser storage is convenient but not permanent.
> Clearing site data, switching browsers, or losing the device can lose your
> issues. Export a backup regularly. Browser storage is *not* automatically
> encrypted at rest — only the export files are encrypted (with your passphrase).

Nothing you capture in personal mode is sent to any server.

---

## Team mode (self-hosted)

Run Bugstow on a computer or server you own so your team can collaborate:

- Node.js + Express, **SQLite** database, screenshots on the **local filesystem**.
- Accounts, teams, roles (owner/admin/member), project & issue sharing, issue
  assignment, invite-by-email, and GitHub issue import.
- Shipped as **Docker Compose** with a persistent volume. No cloud provider
  required.

The team server is the source of truth; teammates cannot reach shared data while
it is offline.

**→ Full guide: [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md)**

Quick start:

```bash
git clone https://github.com/Gr33nOps/bugstow.git
cd bugstow
cp server/.env.example .env      # set BUGSTOW_AUTH_SECRET
docker compose up -d --build     # http://localhost:8080
```

The first person to register on a fresh server becomes the administrator.

---

## Moving from personal to team

You keep your local data; the team gets a copy:

1. Personal mode → **Settings → Export Backup**.
2. Team mode → **user menu → Import personal data** → pick the file → confirm.

The import is additive and never deletes your local browser data.

---

## Deploying the public website (static)

The public site is a **static build with no backend** — host it anywhere that
serves static files (Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3, nginx…).

```bash
npm install
npm run build      # outputs ./dist
```

Serve `./dist`. A config for Vercel is included ([`vercel.json`](vercel.json)) with
an SPA rewrite. The static site has **no database and no API**; it detects at
runtime whether it is being served by a team server (via `/api/health`) and, if
not, offers personal mode plus self-hosting instructions.

> One frontend build works in both places: the same `dist` is served by the
> public static host (personal mode) and by the self-hosted team server (team
> mode). Team mode is enabled only when a team server is present.

---

## Data ownership & privacy

- **You own personal data** — it lives in your browser only. Export encrypted
  backups to keep control of it.
- **Teams own team data** — it lives in the SQLite database and screenshots
  folder on the host they run. Team data is readable by the team server (it is
  not end-to-end encrypted).
- **No telemetry, analytics, or third-party services** receive your content in
  either mode.
- Migrations are additive and non-destructive; existing data is preserved across
  upgrades.

---

## Tech stack

- **Frontend:** React 19, TypeScript 5.7, Vite 8, Tailwind CSS v4, `vite-plugin-pwa`
- **Personal storage:** IndexedDB (`idb`)
- **Crypto:** Web Crypto (PBKDF2-HMAC-SHA256, AES-256-GCM)
- **Team server:** Node.js, Express, SQLite (`better-sqlite3`), better-auth
- **Deployment:** static host (public site) + Docker Compose (team server)
- **Testing:** Vitest (frontend), `node:test` (server)

---

## Project structure

```
bugstow/
├── src/                       # React app (personal + team frontend)
│   ├── App.tsx                # Personal (local-first) app
│   ├── RootApp.tsx            # Chooses personal vs team at runtime
│   ├── components/cloud/      # Team UI: ModePicker, auth, workspace, self-host info
│   ├── hooks/                 # useBugstowData (IndexedDB), useCloudData (team API)
│   ├── lib/                   # authClient (better-auth), teamServer detection
│   ├── services/              # backup, prompt, storage, teamApi, teamMigration
│   └── ...
├── server/                    # Self-hosted team server
│   ├── src/                   # Express app, better-auth, SQLite, API routes
│   ├── src/storage.test.ts    # Server tests (node:test)
│   └── .env.example
├── docs/SELF_HOSTING.md       # Team install / backup / upgrade / security guide
├── Dockerfile                 # Multi-stage: build frontend + run server
├── docker-compose.yml         # Team edition, persistent volume
└── vercel.json                # Static public-site config
```

---

## Development

```bash
npm install
npm run dev        # personal app at http://localhost:8443

# Team server (separate terminal):
cd server && npm install
BUGSTOW_AUTH_SECRET=dev-secret-0123456789 npm run dev   # http://localhost:8080
```

In dev, the Vite server proxies `/api` to `http://localhost:8080` (override with
`BUGSTOW_SERVER`), so the team UI can be exercised against the local server.

```bash
npm run build      # production frontend build
npm test           # frontend tests
cd server && npm test && npm run typecheck
```

---

## License

MIT.
