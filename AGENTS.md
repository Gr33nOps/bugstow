# Bugstow

Spot it. Stow it. Fix it. A privacy-first issue tracker. There is **no hosted site**
(the Vercel deployment was retired in 2.2.0); people install it:

- **Desktop app** — one command (`install.ps1` / `install.sh`) installs a private Node.js
  plus the BugsTow server on the user's PC, bound to 127.0.0.1:5757 (`BUGSTOW_DESKTOP=true`).
  The `bugstow` launcher (`desktop/bugstow.mjs`) starts it in the background and opens the browser.
  Two modes, chosen on first open ("Just you, or with other people?"): **Local** (just you, IndexedDB in
  this browser, no account) and **Team** (sign-in, data folder on this PC, invite people via `--lan` or
  Tailscale `bugstow share`). Always call them Local and Team in UI and docs.
- **Team server** — the same server via Docker Compose for a team.
- **Browser storage mode** — IndexedDB, offline PWA, no backend (also `serve-personal.mjs` in the offline bundle).

No user/team data touches the maintainer's infrastructure.

## Architecture

- `src/App.tsx` - Local app; IndexedDB via `src/storage/db.ts`
- `src/RootApp.tsx` - Runtime router: Local vs Team (detects a BugsTow server via `/api/health`); `ModePicker` is the two-choice first run
- `src/lib/authClient.ts` - better-auth client (same-origin cookies) for team mode
- `src/lib/teamServer.ts` - Detects whether a self-hosted team server is present
- `src/hooks/useBugstowData.ts` - Local data (IndexedDB)
- `src/hooks/useTeamData.ts` - Team data via the server API (optimistic concurrency on issue edits)
- `src/services/` - `backupService` (encrypted export/import), `promptService`, `storageService`, `teamApi`, `teamMigration` (Copy Local issues → Team: reads this browser directly or a backup file; keeps status/GitHub link, reuses projects by name)
- `src/components/team/` - `ModePicker`, `SelfHostInfo` (eager); `TeamRoot` → `TeamAuthGate`, `TeamApp` (lazy-loaded chunk, only fetched when served by the BugsTow server)
- `src/lib/connection.ts` - localhost / LAN HTTP / LAN HTTPS classification for honest warnings
- `src/lib/retiredSync.ts` - Deletes the `bugstow_sync` IndexedDB (OAuth tokens/key) left by the cloud sync removed in 2.6
- `server/` - Self-hosted team server (Express, better-auth, SQLite, filesystem screenshots)
  - `server/src/app.ts` - Builds the Express app (migrations, CSP, CSRF origin check, rate limits, auth, API, frontend)
  - `server/src/index.ts` - Starts HTTP/HTTPS, backups, prints setup token + connection warnings
  - `server/src/setup.ts` - One-time first-admin setup token (`npm run setup-token`)
  - `server/src/auth.ts` - better-auth (SQLite, email/password, sign-up gating)
  - `server/src/api.ts` - REST API (teams, members, projects, issues, screenshots, github-import). `POST /issues` also takes `status` and a validated `githubUrl` (an existing GitHub issue returns 200 `{existing: true}`), used by Copy Local issues
  - `server/src/passwords.ts` - Admin password reset (temporary password, forced change); CLI `npm run reset-password -- <email>`
  - `server/src/backup.ts` - Verified local backups + optional external copy (`BUGSTOW_BACKUP_EXTERNAL_DIR`). Retired cloud settings only produce a startup notice (`config.retiredCloudSettings`)
  - `server/src/tls.ts` - Local self-signed certificate (covers BASE_URL host; regenerates on change/expiry)
  - `server/src/db.ts`, `storage.ts` (upload signature checks), `middleware.ts`, `config.ts`
- `desktop/bugstow.mjs` - Launcher of the installed app (start/stop/status/--lan/share/unshare/reset-password/uninstall; reads optional `<home>/bugstow.env` for BUGSTOW_BACKUP_*)
- `desktop/tailscale.mjs` - `bugstow share`: `tailscale serve --https=<BugsTow port>` → 127.0.0.1 (tailnet only, never Funnel, never 443; refuses a port already served by something else; `BUGSTOW_TAILSCALE_BIN` is the only candidate when set, so tests never reach a real Tailscale). Sets `BUGSTOW_SHARE_URL` (desktop only: trusted origin, Host allowlist, join-link base via `/api/me`)
- `desktop/net.mjs` - Picks the real LAN address for `--lan` (skips WSL/Hyper-V/VPN/Tailscale adapters)
- `server/src/inviteLinks.ts` - Invite links (2.7): single-use, 7 days, only a SHA-256 of the token stored; sign-up with header `x-bugstow-invite` claims the link (auth-options hook) and joins its team. `GET /api/invite-links/info` is public (join page), `POST /api/invite-links/accept` for existing accounts. No email anywhere in the UI
- `src/lib/login.ts` - Username sign-in: a username is stored as `<name>@bugstow.invalid` (reserved TLD, never mailed); `displayLogin` hides the suffix. Pending `#invite=` token kept in sessionStorage until used
- `POST /api/projects/move` - Move a project (issues, screenshots) to another workspace the caller belongs to; owner/admin of the source only; clears assignees who aren't in the destination
- `install.ps1`, `install.sh` - One-command installers (download release package + checksum-verified private Node.js, `npm ci`, shortcuts)
- `scripts/build-app-package.mjs` - Builds `release/bugstow-app-<version>.tar.gz` (+ .sha256), the asset the installers download
- `server/src/desktop.test.ts` - Desktop edition: Host-header allowlist (DNS rebinding), edition marker, CSP
- `Dockerfile`, `docker-compose.yml` - Team edition packaging (persistent `/data` volume)
- `docs/INSTALL.md` - Installing and using the desktop app
- `src/services/githubImport.ts` + `src/components/features/github/GithubImportModal.tsx` - GitHub import, one dialog for every mode. Browser storage fetches api.github.com directly; server mode posts to `/api/github-import` (same error codes: NEEDS_TOKEN, BAD_TOKEN, NOT_FOUND, RATE_LIMITED, OFFLINE, NETWORK). Re-import dedupes by GitHub URL and follows open/closed. Desktop edition has `offline` off by default; team servers on.
- `docs/SELF_HOSTING.md` - Team install/backup/upgrade/security guide
- `docs/RELEASE_OFFLINE.md` - Offline bundle, HTTPS trust, backups/restore, two-computer test (§13b)
- `docs/RELEASE_CHECKLIST.md` - Manual browser checks before a release

## Development

- Local app: `npm run dev` (http://localhost:8443)
- Team server: `cd server && BUGSTOW_AUTH_SECRET=dev-secret-0123456789 npm run dev` (http://localhost:8080)
  - Vite proxies `/api` → the server in dev.
- Build frontend: `npm run build` · Frontend tests: `npm test` · Typecheck: `npm run typecheck`
- Server: `cd server && npm test && npm run typecheck`
- Acceptance: `node scripts/acceptance-test.mjs --url <server> --setup-token <token from log>` against a fresh server
- Releases: attach `bugstow-app-<version>.tar.gz` + `.sha256` (from `scripts/build-app-package.mjs`) to the GitHub release; the installers download the latest release. Team edition deploys via Docker Compose.
- Test an installer locally: `BUGSTOW_PACKAGE=release/bugstow-app-<v>.tar.gz BUGSTOW_HOME=<scratch> BUGSTOW_NO_PATH=1 BUGSTOW_SHORTCUT_DIR=<scratch> BUGSTOW_NO_BROWSER=1`. The detached server inherits the launcher's stdout, so a piped caller waits until `bugstow stop`.

## Constraints

- No cloud features at all (removed in 2.6): no sync, no cloud backups, no OAuth to storage providers, no hosted site, no cloud dependencies (Neon, Cloudflare R2, Vercel functions). The only outside host the app talks to is `api.github.com` for a GitHub import the user starts.
- Two modes only: Local data stays in the browser; Team data stays on the computer running BugsTow.
- The desktop CSP `connect-src` is `'self' https://api.github.com` (just `'self'` with BUGSTOW_OFFLINE=true); keep it that narrow.
- Migrations must remain additive/non-destructive.
- Keep privacy wording within what is proven (see README and SECURITY.md); no "100% private", "zero traffic" or "audited" claims.
- The saved mode value `'cloud'` (pre-2.1) must keep mapping to `'team'`.
