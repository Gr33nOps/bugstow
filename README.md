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
- **Optional Encrypted Cloud Sync**:
  - Push an AES-256-GCM–encrypted copy of your data to your own Cloudflare R2 bucket and pull it onto any device.
  - Data is encrypted **in the browser** before upload — only ciphertext is stored in the cloud.
  - Large screenshot backups sync via short-lived presigned URLs (browser ↔ R2 directly), so there is no serverless size limit.
  - The app stays fully usable offline; cloud sync is a manual, opt-in action.
- **Local-First Privacy**:
  - Works without an account.
  - No telemetry, no analytics. By default all data stays in your browser; nothing leaves the device unless you explicitly run a cloud backup.
  - System fonts used to eliminate external webfont tracking.

---

## Tech Stack

- **Frontend**: React 19, TypeScript 5.7, Vite 8
- **Styling**: Tailwind CSS v4 with `@tailwindcss/vite`
- **Icons**: Lucide React + custom Bugstow SVG brand assets
- **Database**: Browser IndexedDB with `idb`
- **Cryptography**: Web Crypto API (PBKDF2-HMAC-SHA256, AES-256-GCM)
- **Testing**: Vitest + `fake-indexeddb`
- **Hosting**: Vercel (static Vite build + serverless functions in `/api`)
- **Cloud Sync Storage**: Cloudflare R2 (S3-compatible), accessed via presigned URLs

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

## Deployment (Vercel + Cloudflare R2)

Bugstow ships as a static Vite build plus one serverless function (`/api/backup`) that brokers encrypted backups to a Cloudflare R2 bucket.

### 1. Deploy the app on Vercel

1. Import `Gr33nOps/bugstow` into Vercel (**Add New → Project**).
2. Framework preset **Vite** is auto-detected. Build command `npm run build`, output directory `dist` (see `vercel.json`).
3. Deploy.

### 2. Set up Cloudflare R2 (optional, for cloud sync)

1. In the Cloudflare dashboard, create an **R2 bucket** (e.g. `bugstow`).
2. Create an **R2 API token** (S3-compatible) with read/write on that bucket. Note the **Access Key ID** and **Secret Access Key**.
3. Add a **CORS policy** on the bucket allowing your Vercel origin(s) with methods `GET, PUT, HEAD`.
4. In the Vercel project **Settings → Environment Variables**, add:

   | Variable | Value |
   |---|---|
   | `R2_ACCOUNT_ID` | your Cloudflare account ID |
   | `R2_ACCESS_KEY_ID` | R2 token access key ID |
   | `R2_SECRET_ACCESS_KEY` | R2 token secret |
   | `R2_BUCKET` | `bugstow` |
   | `BUGSTOW_SYNC_KEY` | *(optional)* shared secret to gate the endpoint |

5. Redeploy. The **Settings → Cloud Sync** section appears automatically once the endpoint is configured.

See `.env.example` for the full list. If R2 is not configured, the app runs fully local-first and the Cloud Sync section stays hidden.

> [!NOTE]
> IndexedDB storage is scoped to the web origin (`protocol://domain:port`). Use **Settings → Back up to Cloud** (or **Export Backup**) if you ever migrate between domains.

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
├── api/
│   └── backup.ts             # Vercel serverless function: presigned R2 cloud-sync URLs
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
│   │   ├── cloudSyncService.ts # Encrypted R2 backup/restore via presigned URLs
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
├── vercel.json               # Vercel framework, build & SPA rewrite config
└── .env.example              # R2 cloud-sync environment variables
```

---

## License

MIT License. Built with care for developers who vibe code.
