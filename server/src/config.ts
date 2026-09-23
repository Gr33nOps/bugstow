import path from 'node:path'
import fs from 'node:fs'

/**
 * Server configuration from environment variables. Data lives under DATA_DIR
 * (a Docker volume in production): the SQLite database and the screenshots
 * directory. Nothing here is sent to any third party.
 */

const DATA_DIR = process.env.BUGSTOW_DATA_DIR || path.resolve(process.cwd(), 'data')
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots')
const BACKUPS_DIR = path.join(DATA_DIR, 'backups')
const CERTS_DIR = path.join(DATA_DIR, 'certs')

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
fs.mkdirSync(BACKUPS_DIR, { recursive: true })
fs.mkdirSync(CERTS_DIR, { recursive: true })

function boolEnv(name: string, dflt: boolean): boolean {
  const v = process.env[name]
  if (v === undefined) return dflt
  return v === 'true' || v === '1'
}

function parseTrustProxy(v: string | undefined): boolean | number {
  if (!v || v === 'false' || v === '0') return false
  if (v === 'true') return 1
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : false
}

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
  backupsDir: BACKUPS_DIR,
  certsDir: CERTS_DIR,
  dbPath: path.join(DATA_DIR, 'bugstow.sqlite'),
  /** Directory of the built frontend (dist) to serve. Empty disables static serving (dev). */
  publicDir: process.env.BUGSTOW_PUBLIC_DIR || '',

  /**
   * Strict offline mode. Disables every feature that would reach the public
   * internet (currently only GitHub import). Default true — this is a
   * self-hosted, LAN-first app. Set BUGSTOW_OFFLINE=false to allow GitHub import.
   */
  offline: boolEnv('BUGSTOW_OFFLINE', true),

  /** Serve over HTTPS with a locally generated self-signed certificate. */
  tls: boolEnv('BUGSTOW_TLS', false),
  tlsCertPath: process.env.BUGSTOW_TLS_CERT || path.join(CERTS_DIR, 'server.crt'),
  tlsKeyPath: process.env.BUGSTOW_TLS_KEY || path.join(CERTS_DIR, 'server.key'),

  /** Automatic local backups. */
  backupEnabled: boolEnv('BUGSTOW_BACKUP_ENABLED', true),
  backupIntervalHours: parseFloat(process.env.BUGSTOW_BACKUP_INTERVAL_HOURS || '24'),
  backupRetention: parseInt(process.env.BUGSTOW_BACKUP_RETENTION || '7', 10),
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
  /**
   * Express "trust proxy" setting. Leave unset (false) when clients connect
   * directly; otherwise rate limiting could be bypassed with a forged
   * X-Forwarded-For header. Set to the number of reverse proxies in front of
   * the server (usually 1) when behind Caddy/nginx.
   */
  trustProxy: parseTrustProxy(process.env.BUGSTOW_TRUST_PROXY),
  isProd: process.env.NODE_ENV === 'production',
}

export const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
