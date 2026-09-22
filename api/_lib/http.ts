import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUser, type AuthUser } from './auth.js'
import { isDbConfigured } from './db.js'

export function json(res: VercelResponse, status: number, data: unknown) {
  res.status(status).json(data)
}

/**
 * Guards a handler: ensures the DB is configured and the request carries a
 * valid Neon Auth token, then invokes `fn` with the authenticated user.
 */
export async function withUser(
  req: VercelRequest,
  res: VercelResponse,
  fn: (user: AuthUser) => Promise<void>
): Promise<void> {
  if (!isDbConfigured()) {
    json(res, 503, { error: 'Cloud mode is not configured on this deployment.' })
    return
  }
  const user = await getUser(req)
  if (!user) {
    json(res, 401, { error: 'Authentication required.' })
    return
  }
  try {
    await fn(user)
  } catch (err) {
    console.error('API error:', err)
    json(res, 500, { error: 'Request failed.' })
  }
}

export function readJsonBody<T = Record<string, unknown>>(req: VercelRequest): T {
  if (req.body == null) return {} as T
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T
    } catch {
      return {} as T
    }
  }
  return req.body as T
}

export function queryParam(req: VercelRequest, key: string): string | undefined {
  const v = req.query[key]
  return Array.isArray(v) ? v[0] : v
}
