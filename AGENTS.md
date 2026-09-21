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
- `docs/screenshots/` - Design and feature visual references
- `wrangler.jsonc` - Cloudflare Workers / Pages static assets deployment configuration

## Development

- Start dev server: `npm run dev`
- Run test suite: `npm test`
- Production build: `npm run build`
- Deploy to Cloudflare: `npm run deploy`
