# Bugstow

Spot it. Stow it. Fix it. A privacy-first issue tracker with two editions:

- **Personal mode** — browser-only, IndexedDB, offline PWA, no backend.
- **Team mode** — self-hosted Node + Express + SQLite server the team runs itself.

No user/team data touches the maintainer's infrastructure.

## Architecture

- `src/App.tsx` - Personal (local-first) app; IndexedDB via `src/storage/db.ts`
- `src/RootApp.tsx` - Runtime router: personal vs team (detects a team server via `/api/health`)
- `src/lib/authClient.ts` - better-auth client (same-origin cookies) for team mode
- `src/lib/teamServer.ts` - Detects whether a self-hosted team server is present
- `src/hooks/useBugstowData.ts` - Personal data (IndexedDB)
- `src/hooks/useTeamData.ts` - Team data via the server API (optimistic concurrency on issue edits)
- `src/services/` - `backupService` (encrypted export/import), `promptService`, `storageService`, `teamApi`, `teamMigration` (personal→team)
- `src/components/team/` - `ModePicker`, `SelfHostInfo` (eager); `TeamRoot` → `TeamAuthGate`, `TeamApp` (lazy-loaded chunk, never fetched by the public Personal site)
- `src/lib/connection.ts` - localhost / LAN HTTP / LAN HTTPS classification for honest warnings
- `src/sync/` - Personal cloud sync (bring your own cloud, end-to-end encrypted): `crypto` (PBKDF2 + AES-GCM), `merge` (3-way, edit beats delete), `engine` (one sync round), `store` (separate `bugstow_sync` IndexedDB), `controller`, `oauth` (Google implicit / Dropbox PKCE redirects), `providers/` (googleDrive, dropbox, webdav, folder, memory = sync file)
- `src/hooks/useCloudSync.ts`, `src/components/features/settings/CloudSyncPanel.tsx` - automatic sync + Settings → Sync UI
- `server/src/cloudBackup.ts` - Encrypted backup archives to a cloud-synced folder and/or WebDAV; `npm run decrypt-backup`
- `server/` - Self-hosted team server (Express, better-auth, SQLite, filesystem screenshots)
  - `server/src/app.ts` - Builds the Express app (migrations, CSP, CSRF origin check, rate limits, auth, API, frontend)
  - `server/src/index.ts` - Starts HTTP/HTTPS, backups, prints setup token + connection warnings
  - `server/src/setup.ts` - One-time first-admin setup token (`npm run setup-token`)
  - `server/src/auth.ts` - better-auth (SQLite, email/password, sign-up gating)
  - `server/src/api.ts` - REST API (teams, members, projects, issues, screenshots, github-import)
  - `server/src/passwords.ts` - Admin password reset (temporary password, forced change); CLI `npm run reset-password -- <email>`
  - `server/src/backup.ts` - Verified local backups + optional external copy (`BUGSTOW_BACKUP_EXTERNAL_DIR`)
  - `server/src/tls.ts` - Local self-signed certificate (covers BASE_URL host; regenerates on change/expiry)
  - `server/src/db.ts`, `storage.ts` (upload signature checks), `middleware.ts`, `config.ts`
- `Dockerfile`, `docker-compose.yml` - Team edition packaging (persistent `/data` volume)
- `docs/SELF_HOSTING.md` - Team install/backup/upgrade/security guide
- `docs/RELEASE_OFFLINE.md` - Offline bundle, HTTPS trust, backups/restore, two-computer test (§13b)
- `docs/RELEASE_CHECKLIST.md` - Manual browser checks before a release
- `docs/CLOUD_SYNC.md` - Personal sync + Team cloud backups, provider setup (Google/Dropbox app registration, WebDAV CORS)

## Development

- Personal app: `npm run dev` (http://localhost:8443)
- Team server: `cd server && BUGSTOW_AUTH_SECRET=dev-secret-0123456789 npm run dev` (http://localhost:8080)
  - Vite proxies `/api` → the server in dev.
- Build frontend: `npm run build` · Frontend tests: `npm test` · Typecheck: `npm run typecheck`
- Server: `cd server && npm test && npm run typecheck`
- Acceptance: `node scripts/acceptance-test.mjs --url <server> --setup-token <token from log>` against a fresh server
- Public site deploys as static `dist`. Team edition deploys via Docker Compose.

## Constraints

- Do not reintroduce cloud dependencies (Neon, Cloudflare R2, Vercel functions).
- The only cloud use allowed is the user's **own** storage, opt-in, and end-to-end encrypted before upload (Personal sync, Team cloud backups). Never plaintext, never maintainer infrastructure.
- Personal data stays in the browser; team data stays on the self-hosted server.
- Migrations must remain additive/non-destructive.
- Keep privacy wording within what is proven (see README and SECURITY.md); no "100% private", "zero traffic" or "audited" claims.
- The saved mode value `'cloud'` (pre-2.1) must keep mapping to `'team'`.
