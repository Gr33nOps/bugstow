import { randomBytes } from 'node:crypto'
import { auth } from './auth.ts'
import { setMustChangePassword } from './db.ts'

/**
 * Password resets without email. BugsTow runs offline, so there is no reset
 * email: instead a server administrator (in the app) or anyone with access to
 * the host (via `npm run reset-password`) issues a one-time temporary password.
 * The user must choose a new password on next sign-in, and all of their
 * existing sessions are signed out immediately.
 */

// Unambiguous characters only (no 0/O, 1/l/I) so it can be read aloud or typed.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generateTempPassword(length = 16): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  // Group for readability: xxxx-xxxx-xxxx-xxxx
  return out.match(/.{1,4}/g)!.join('-')
}

export async function resetUserPassword(userId: string): Promise<string> {
  const ctx = await auth.$context
  const account = await ctx.internalAdapter.findCredentialAccount(userId)
  if (!account) throw new Error('This account has no password to reset.')
  const temporary = generateTempPassword()
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(temporary))
  await ctx.internalAdapter.deleteUserSessions(userId)
  setMustChangePassword(userId, true)
  return temporary
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const ctx = await auth.$context
  const found = await ctx.internalAdapter.findUserByEmail(email.trim().toLowerCase())
  return found?.user.id ?? null
}
