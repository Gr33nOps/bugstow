import path from 'node:path'
import fs from 'node:fs'

/**
 * Server configuration from environment variables. Data lives under DATA_DIR
 * (a Docker volume in production): the SQLite database and the screenshots
 * directory. Nothing here is sent to any third party.
 */

const DATA_DIR = process.env.BUGSTOW_DATA_DIR || path.resolve(process.cwd(), 'data')
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots')

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

function requireSecretInProd(value: string | undefined): string {
  if (value && value.length >= 16) return value
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BUGSTOW_AUTH_SECRET must be set to a strong random value (>= 16 chars) in production. ' +
        'Generate one with: openssl rand -base64 32'
    )
  }
  // Development fallback only.
  return 'dev-insecure-secret-change-me-0123456789'
}

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  dataDir: DATA_DIR,
  screenshotsDir: SCREENSHOTS_DIR,
  dbPath: path.join(DATA_DIR, 'bugstow.sqlite'),
  /** Directory of the built frontend (dist) to serve. Empty disables static serving (dev). */
  publicDir: process.env.BUGSTOW_PUBLIC_DIR || '',
  authSecret: requireSecretInProd(process.env.BUGSTOW_AUTH_SECRET),
  /** Public base URL of this server, used by better-auth for cookies/links. */
  baseURL: process.env.BUGSTOW_BASE_URL || `http://localhost:${process.env.PORT || '8080'}`,
  /**
   * Extra origins allowed to authenticate (besides baseURL). Comma-separated.
   * Teammates usually hit the same origin, so this is rarely needed.
   */
  trustedOrigins: (process.env.BUGSTOW_TRUSTED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  /** Max screenshot upload size in bytes (default 10 MB). */
  maxUploadBytes: parseInt(process.env.BUGSTOW_MAX_UPLOAD_BYTES || String(10 * 1024 * 1024), 10),
  /**
   * When true, anyone can self-register. Default false: after the first admin
   * exists, new members are created by admins / invited by email.
   */
  openSignup: process.env.BUGSTOW_OPEN_SIGNUP === 'true',
  isProd: process.env.NODE_ENV === 'production',
}

export const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
