import { randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { db, userCount } from './db.ts'
import { config } from './config.ts'

/**
 * One-time setup token for creating the first administrator.
 *
 * Without it, whoever reaches a freshly installed server first (anyone on the
 * LAN) could register and become the administrator. The token is generated on
 * first start, printed only in the host's server log, and required to create
 * the first account. It is deleted as soon as that account exists, so it can
 * never be used again. Installations that already have accounts never get one.
 *
 * The token is kept in the database so a restart before setup reprints the same
 * token instead of creating a new one.
 */

export const SETUP_TOKEN_HEADER = 'x-bugstow-setup-token'
const KEY = 'setup_token'

function newToken(): string {
  // 20 random bytes → 32 base32-ish characters, grouped for reading from a log.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(24)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out.match(/.{1,6}/g)!.join('-')
}

/**
 * Returns the active setup token, creating it if the server has no accounts
 * yet. Returns null once setup is complete.
 */
export function ensureSetupToken(): string | null {
  if (userCount() > 0) {
    clearSetupToken()
    return null
  }
  if (config.setupTokenOverride) {
    if (config.setupTokenOverride.length < 20) {
      throw new Error('BUGSTOW_SETUP_TOKEN must be at least 20 characters. Leave it unset to generate one.')
    }
    return config.setupTokenOverride
  }
  const row = db.prepare('select value from server_settings where key = ?').get(KEY) as { value: string } | undefined
  if (row) return row.value
  const token = newToken()
  db.prepare('insert into server_settings (key, value) values (?, ?)').run(KEY, token)
  return token
}

/** Constant-time check of a presented token against the active one. */
export function verifySetupToken(presented: string | null | undefined): boolean {
  if (!presented) return false
  const active = config.setupTokenOverride ||
    (db.prepare('select value from server_settings where key = ?').get(KEY) as { value: string } | undefined)?.value
  if (!active) return false
  // Compare digests so different lengths don't leak through timing.
  const a = createHash('sha256').update(presented.trim().toUpperCase()).digest()
  const b = createHash('sha256').update(active.toUpperCase()).digest()
  return timingSafeEqual(a, b)
}

export function clearSetupToken(): void {
  db.prepare('delete from server_settings where key = ?').run(KEY)
}
