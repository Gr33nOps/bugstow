import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { db, inviteCutoff } from './db.ts'

/**
 * Invite links: an owner or admin copies a link and sends it however they
 * like; whoever opens it picks a username and password and joins the team.
 * No email is involved.
 *
 * - Single use: once someone has joined with a link, it stops working.
 * - Expires after 7 days (same as email invitations).
 * - Only a SHA-256 hash of the token is stored, so the database (or a backup
 *   of it) can't be used to recreate a working link.
 *
 * Reaching the server at all still needs its network (Wi-Fi with --lan, or
 * Tailscale with `bugstow share`); the link is the second lock.
 */

/** Header that carries the invite token on the sign-up request. */
export const INVITE_LINK_HEADER = 'x-bugstow-invite'

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const now = () => new Date().toISOString()
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,100}$/

export interface InviteLinkRow {
  id: string
  team_id: string
  role: 'admin' | 'member'
  created_by: string
  created_at: string
}

export function createInviteLink(teamId: string, role: 'admin' | 'member', createdBy: string) {
  const token = randomBytes(24).toString('base64url')
  const id = randomUUID()
  const createdAt = now()
  db.prepare(
    'insert into invite_links (id, team_id, role, token_hash, created_by, created_at) values (?, ?, ?, ?, ?, ?)'
  ).run(id, teamId, role, hash(token), createdBy, createdAt)
  return { token, link: { id, role, created_at: createdAt } }
}

/** A link that still works: unused, unclaimed and not expired. */
export function findUsableInviteLink(token: unknown): InviteLinkRow | undefined {
  if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) return undefined
  return db
    .prepare(
      `select id, team_id, role, created_by, created_at from invite_links
       where token_hash = ? and used_by is null and claimed_login is null and created_at > ?`
    )
    .get(hash(token), inviteCutoff()) as InviteLinkRow | undefined
}

/**
 * Reserve a link for the account being created (called before the account is
 * written). Atomic, so two people racing on the same link can't both get in.
 */
export function claimInviteLink(token: unknown, login: string): boolean {
  const link = findUsableInviteLink(token)
  if (!link) return false
  const r = db
    .prepare('update invite_links set claimed_login = ? where id = ? and used_by is null and claimed_login is null')
    .run(login.toLowerCase(), link.id)
  return r.changes === 1
}

/** After the account exists: add it to the link's team and use the link up. */
export function completeClaimedInviteLink(userId: string, login: string): void {
  const link = db
    .prepare('select id, team_id, role from invite_links where claimed_login = ? and used_by is null')
    .get(login.toLowerCase()) as { id: string; team_id: string; role: string } | undefined
  if (!link) return
  const ts = now()
  db.transaction(() => {
    db.prepare(
      'insert or ignore into team_members (team_id, user_id, role, created_at) values (?, ?, ?, ?)'
    ).run(link.team_id, userId, link.role, ts)
    db.prepare('update invite_links set used_by = ?, used_at = ? where id = ?').run(userId, ts, link.id)
  })()
}

/** Someone who already has an account opens a link: join its team. */
export function acceptInviteLink(token: unknown, userId: string): { teamId: string } | null {
  const link = findUsableInviteLink(token)
  if (!link) return null
  const ts = now()
  const ok = db.transaction(() => {
    const r = db
      .prepare(
        'update invite_links set used_by = ?, used_at = ? where id = ? and used_by is null and claimed_login is null'
      )
      .run(userId, ts, link.id)
    if (r.changes !== 1) return false
    db.prepare(
      'insert or ignore into team_members (team_id, user_id, role, created_at) values (?, ?, ?, ?)'
    ).run(link.team_id, userId, link.role, ts)
    return true
  })()
  return ok ? { teamId: link.team_id } : null
}

/** Links not used yet, for People & invitations. */
export function listOpenInviteLinks(teamId: string) {
  return db
    .prepare(
      `select id, role, created_at from invite_links
       where team_id = ? and used_by is null and claimed_login is null and created_at > ?
       order by created_at desc`
    )
    .all(teamId, inviteCutoff()) as Array<{ id: string; role: string; created_at: string }>
}

export function deleteInviteLink(id: string, teamId: string): void {
  db.prepare('delete from invite_links where id = ? and team_id = ? and used_by is null').run(id, teamId)
}
