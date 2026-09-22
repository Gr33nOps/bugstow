import type { Request, Response, NextFunction } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.ts'
import { db } from './db.ts'

export interface AuthedUser {
  id: string
  email: string | null
  name: string | null
}

// Augment Express Request with the authenticated user.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser
    }
  }
}

export async function getSessionUser(req: Request): Promise<AuthedUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  if (!session?.user) return null
  return { id: session.user.id, email: session.user.email ?? null, name: session.user.name ?? null }
}

/** Express middleware: 401 unless a valid session is present. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getSessionUser(req)
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' })
      return
    }
    req.user = user
    next()
  } catch (err) {
    console.error('Auth check failed:', err)
    res.status(500).json({ error: 'Authentication error.' })
  }
}

export type TeamRole = 'owner' | 'admin' | 'member'

export function teamRole(userId: string, teamId: string): TeamRole | null {
  const row = db
    .prepare('select role from team_members where team_id = ? and user_id = ?')
    .get(teamId, userId) as { role: TeamRole } | undefined
  return row?.role ?? null
}

/** Wrap an async route so thrown errors become a 500 JSON response. */
export function asyncRoute(
  fn: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response) => void {
  return (req, res) => {
    fn(req, res).catch(err => {
      console.error('Route error:', err)
      if (!res.headersSent) res.status(500).json({ error: 'Request failed.' })
    })
  }
}
