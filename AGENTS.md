# Bugstow

Spot it. Stow it. Fix it. A personal issue inbox designed for people who vibe code.

## Architecture & Project Structure

- `src/main.tsx` - Application entrypoint; imports `src/index.css` and mounts `src/App.tsx`
- `src/App.tsx` - Primary application container and responsive view controller
- `src/index.css` - Global styling and Tailwind CSS v4 entrypoint
- `src/types/` - Core domain entities (`Issue`, `Project`, `IssueType`, `Backup`)
- `src/storage/db.ts` - IndexedDB database configuration (`idb`)
- `src/repositories/` - Data access layer implementing repository interfaces
- `src/services/` - Business services (`backupService.ts`, `promptService.ts`, `storageService.ts`)
- `src/hooks/` - Reactive hooks (`useBugstowData.ts`, `useStorageEstimate.ts`)
- `src/components/`
  - `common/` - Brand icons, badges, modals, and toasts
  - `features/` - Inbox, Capture, Issue Details, Projects, and Settings
  - `layout/` - Desktop Sidebar and Mobile navigation
- `api/backup.ts` - Vercel serverless function issuing presigned Cloudflare R2 URLs for encrypted cloud sync
- `src/services/cloudSyncService.ts` - Client for encrypted R2 backup/restore
- `docs/screenshots/` - Design and feature visual references
- `vercel.json` - Vercel framework, build, and SPA rewrite configuration

## Development

- Start dev server: `npm run dev`
- Run test suite: `npm test`
- Typecheck: `npm run typecheck`
- Production build: `npm run build`
- Deploy: pushes to `main` auto-deploy on Vercel (project connected to `Gr33nOps/bugstow`)
