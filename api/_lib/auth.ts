import type { VercelRequest } from '@vercel/node'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { sql } from './db.js'

/**
 * Verifies the Neon Managed Better Auth session token that the client obtains
 * via `authClient.token()` and sends as `Authorization: Bearer <jwt>`.
 *
 * The token is validated against Neon's remote JWKS (signature + expiry). The
 * `sub` claim is the user id, which matches `neon_auth.users_sync.id`.
 */

const JWKS_URL = process.env.NEON_AUTH_JWKS_URL || ''

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwks) {
    if (!JWKS_URL) throw new Error('NEON_AUTH_JWKS_URL is not configured')
    jwks = createRemoteJWKSet(new URL(JWKS_URL))
  }
  return jwks
}

export interface AuthUser {
  id: string
  email?: string
  name?: string
}

function bearer(req: VercelRequest): string | null {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice(7).trim()
  return null
}

/** Returns the authenticated user, or null when the token is missing/invalid. */
export async function getUser(req: VercelRequest): Promise<AuthUser | null> {
  const token = bearer(req)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getJwks())
    if (!payload.sub) return null
    return {
      id: String(payload.sub),
      email: typeof payload.email === 'string' ? payload.email : undefined,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    }
  } catch {
    return null
  }
}

export type TeamRole = 'owner' | 'admin' | 'member'

/** Returns the user's role in a team, or null when they are not a member. */
export async function teamRole(userId: string, teamId: string): Promise<TeamRole | null> {
  const rows = (await sql`
    select role from team_members where team_id = ${teamId} and user_id = ${userId} limit 1
  `) as Array<{ role: TeamRole }>
  return rows[0]?.role ?? null
}
