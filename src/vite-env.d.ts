/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: Google OAuth client ID for Personal cloud sync (not a secret). */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Optional: Dropbox app key for Personal cloud sync (not a secret). */
  readonly VITE_DROPBOX_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
