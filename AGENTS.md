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
- `src/hooks/useCloudData.ts` - Team data via the server API
- `src/services/` - `backupService` (encrypted export/import), `promptService`, `storageService`, `teamApi`, `teamMigration` (personal→team)
- `src/components/cloud/` - `ModePicker`, `CloudAuthGate`, `CloudApp` (team workspace), `SelfHostInfo`
- `server/` - Self-hosted team server (Express, better-auth, SQLite, filesystem screenshots)
  - `server/src/index.ts` - App entry (migrations, auth handler, API, serves the built frontend)
  - `server/src/auth.ts` - better-auth (SQLite, email/password, sign-up gating)
  - `server/src/api.ts` - REST API (teams, members, projects, issues, screenshots, github-import)
  - `server/src/db.ts`, `storage.ts`, `middleware.ts`, `config.ts`
- `Dockerfile`, `docker-compose.yml` - Team edition packaging (persistent `/data` volume)
- `docs/SELF_HOSTING.md` - Team install/backup/upgrade/security guide

## Development

- Personal app: `npm run dev` (http://localhost:8443)
- Team server: `cd server && BUGSTOW_AUTH_SECRET=dev-secret-0123456789 npm run dev` (http://localhost:8080)
  - Vite proxies `/api` → the server in dev.
- Build frontend: `npm run build` · Frontend tests: `npm test` · Typecheck: `npm run typecheck`
- Server: `cd server && npm test && npm run typecheck`
- Public site deploys as static `dist`. Team edition deploys via Docker Compose.

## Constraints

- Do not reintroduce cloud dependencies (Neon, Cloudflare R2, Vercel functions).
- Personal data stays in the browser; team data stays on the self-hosted server.
- Migrations must remain additive/non-destructive.
