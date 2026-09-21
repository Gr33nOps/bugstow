# bugstow.

> **Spot it. Stow it. Fix it.**  
> A personal issue inbox designed for people who vibe code.

Bugstow replaces the messy workflow of taking screenshots and sending them to your own Instagram/WhatsApp DMs or notes app. It is a lightweight, local-first personal inbox for capturing bugs, UI inconsistencies, ideas, and feedback discovered while building and testing software.

---

## The Workflow

**Capture now. Fix later.**

1. **Notice an issue** while developing or testing.
2. **Take a screenshot** (`Cmd+Shift+4`, `Win+Shift+S`, or snipping tool).
3. **Open Bugstow** and press `Ctrl+V` / `Cmd+V` (or click `Capture Issue` / `⌘ K`).
4. **Add a quick note** and select project/type.
5. **Save and keep working.**
6. **Return later**, click **Copy as Prompt**, and feed the structured prompt directly into your coding LLM to fix it.

---

## Key Features

- **Effortless Screenshot Capture**:
  - Global clipboard paste (`Cmd+V` / `Ctrl+V`) instantly opens the issue composer with your screenshot attached.
  - Drag-and-drop or file upload (PNG, JPEG, WebP up to 10 MB).
  - Screenshots are stored as binary `Blob`s in browser IndexedDB — never base64 in `localStorage`.
- **Copy as Prompt (Vibe Coding)**:
  - Generates tailored, LLM-ready prompts for Bugs, UI/UX issues, and Ideas.
  - Automatically structures context, problem definition, and verification instructions for AI coding assistants.
- **Projects Management**:
  - Organize issues by project with custom color swatches.
  - **Safe Project Deletion**: Deleting a project preserves all its issues and moves them into the `Unassigned` category (`projectId: null`).
- **Data & Storage Controls**:
  - **Encrypted Backup Export**: AES-256-GCM authenticated encryption using PBKDF2 (100,000 iterations of SHA-256 with 128-bit random salt).
  - **Atomic Backup Restoration**: Validates schema and restores all projects, issues, and screenshots inside an atomic transaction.
  - **Storage Estimation**: Live storage quota reporting using `navigator.storage.estimate()`.
  - **Persistent Storage**: Browser persistence request via `navigator.storage.persist()`.
  - **Clear All Data**: Safe wipe with double-confirmation prompt.
- **100% Local-First Privacy**:
  - Works without an account.
  - Zero external network requests, zero telemetry, zero analytics, zero cloud databases.
  - System fonts used to eliminate external webfont tracking.

---

## Tech Stack

- **Frontend**: React 19, TypeScript 5.7, Vite 8
- **Styling**: Tailwind CSS v4 with `@tailwindcss/vite`
- **Icons**: Lucide React + custom Bugstow SVG brand assets
- **Database**: Browser IndexedDB with `idb`
- **Cryptography**: Web Crypto API (PBKDF2-HMAC-SHA256, AES-256-GCM)
- **Testing**: Vitest + `fake-indexeddb`
- **Hosting / Deployment**: Cloudflare Workers (Static Assets) / Cloudflare Pages

---

## Getting Started Locally

### Prerequisites
- Node.js 18+ (tested on Node v22.15.0)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/Gr33nOps/bugstow.git
cd bugstow

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at `http://localhost:8443` (or the URL displayed in your terminal).

### Running Tests

```bash
# Run automated Vitest test suite
npm test
```

### Production Build

```bash
# Build optimized static bundle to ./dist
npm run build
```

---

## Cloudflare Deployment

Bugstow is packaged as a pure static application with zero backend runtime dependencies.

### Deploy with Cloudflare Workers (Static Assets)

The repository includes `wrangler.jsonc`:

```bash
npm run build
npx wrangler deploy
```

### Deploy with Cloudflare Pages

1. Go to **Cloudflare Dashboard > Workers & Pages > Create Application > Pages**.
2. Connect this repository (`Gr33nOps/bugstow`).
3. Set build configuration:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Deploy site.

> [!NOTE]
> IndexedDB storage is scoped to the web origin (`protocol://domain:port`). Use **Settings > Export Backup** if you ever migrate between domains.

---

## Screenshots

| Inbox & Split View | Capture Modal |
|---|---|
| ![Bugstow Inbox](docs/screenshots/bugstow_02_inbox.png) | ![Bugstow Capture](docs/screenshots/bugstow_03_new_issue.png) |

| Issue Details & Prompt Copy | Mobile Inbox |
|---|---|
| ![Bugstow Issue Details](docs/screenshots/bugstow_04_issue_details.png) | ![Bugstow Mobile](docs/screenshots/bugstow_07_mobile_inbox.png) |

---

## Architecture & Project Structure

Bugstow follows a clean, modular structure using the **Repository Pattern** to decouple the UI from storage:

```
bugstow/
├── docs/
│   └── screenshots/          # Application & design reference screenshots
├── public/
│   └── favicon.svg           # Brand SVG favicon
├── src/
│   ├── components/
│   │   ├── common/           # Custom logo, badges, modals, toasts
│   │   ├── features/
│   │   │   ├── capture/      # NewIssueModal (clipboard paste, drag-drop)
│   │   │   ├── inbox/        # ListView, IssueRow, EmptyState
│   │   │   ├── issues/       # IssueDetail (split-view & mobile full view)
│   │   │   ├── projects/     # ProjectsView, ProjectModal
│   │   │   └── settings/     # SettingsView, backup export/import, quota
│   │   └── layout/           # Desktop Sidebar, MobileHeader, MobileBottomNav
│   ├── hooks/
│   │   ├── useBugstowData.ts # Central reactive hook with object URL lifecycle
│   │   └── useStorageEstimate.ts
│   ├── repositories/
│   │   ├── interfaces.ts     # IIssueRepository, IProjectRepository, IScreenshotRepository
│   │   └── indexedDbRepositories.ts # Atomic transactions with idb
│   ├── services/
│   │   ├── backupService.ts  # Web Crypto PBKDF2 + AES-256-GCM export/import
│   │   ├── promptService.ts  # Vibe coding prompt generation
│   │   └── storageService.ts # Storage estimate and persistence API
│   ├── storage/
│   │   └── db.ts             # IndexedDB schema versioning and stores
│   ├── types/
│   │   └── index.ts          # Core data models
│   ├── App.tsx               # Main application container
│   ├── index.css             # Tailwind CSS v4 entrypoint
│   └── main.tsx              # React DOM entrypoint
├── index.html                # Clean HTML shell
├── package.json              # Project scripts & dependencies
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite + Tailwind v4 + path alias configuration
└── wrangler.jsonc            # Cloudflare Workers / Pages static assets config
```

---

## License

MIT License. Built with care for developers who vibe code.
