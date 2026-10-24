import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import {
  db,
  getUserByEmail,
  getUserById,
  userCount,
  inviteCutoff,
  isServerAdmin,
  mustChangePassword,
} from './db.ts'
import { config } from './config.ts'
import { exportGithubIssues, type ExportIssue } from './githubExport.ts'
import { parseFixReferences } from './fixReferences.ts'
import { requireAuth, teamRole, asyncRoute } from './middleware.ts'
import { saveScreenshot, resolveScreenshot, deleteScreenshotFile } from './storage.ts'
import { runBackup, listBackups, listExternalBackups, getExternalBackupStatus } from './backup.ts'
import { getCurrentCert } from './tls.ts'
import { resetUserPassword } from './passwords.ts'
import {
  acceptInviteLink,
  createInviteLink,
  deleteInviteLink,
  findUsableInviteLink,
  listOpenInviteLinks,
} from './inviteLinks.ts'

const TYPES = ['bug', 'uiux', 'idea']
const STATUSES = ['open', 'in_progress', 'blocked', 'fixed']
const PRIORITIES = ['critical', 'high', 'medium', 'low']
const SEVERITIES = ['critical', 'major', 'minor']
const DETAIL_KEYS = ['stepsToReproduce', 'expectedBehavior', 'actualBehavior', 'environment', 'browserOs', 'appVersion', 'additionalNotes']
function parseDetails(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const details: Record<string, string> = {}
  for (const [key, field] of Object.entries(value)) {
    if (!DETAIL_KEYS.includes(key) || typeof field !== 'string' || field.length > 4000) return null
    if (field.trim()) details[key] = field.trim()
  }
  return details
}
const GITHUB_ISSUE_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(issues|pull)\/\d+$/
const CUSTOM_TYPE_MAX = 24

function normalizeCustomType(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const clean = value.trim().replace(/\s+/g, ' ')
  if (!clean) return null
  return clean.slice(0, CUSTOM_TYPE_MAX)
}

function now(): string {
  return new Date().toISOString()
}

function qp(req: import('express').Request, key: string): string | undefined {
  const v = req.query[key]
  return typeof v === 'string' ? v : undefined
}

interface IssueRow {
  screenshot_ids: string | null
  [k: string]: unknown
}
function mapIssue(row: IssueRow) {
  const { details_json, fix_references_json, ...rest } = row
  return {
    ...rest,
    details: JSON.parse(String(details_json || '{}')) as Record<string, string>,
    fix_references: JSON.parse(String(fix_references_json || '[]')) as string[],
    screenshot_ids: row.screenshot_ids ? String(row.screenshot_ids).split(',') : [],
  }
}

const ISSUE_SELECT = `
  select i.id, i.team_id, i.project_id, i.title, i.description, i.type, i.custom_type,
         coalesce(i.workflow_status, i.status) as status, i.priority, i.severity, i.details_json, i.fix_references_json,
         i.assignee_id, i.created_by, i.github_url, i.github_number,
         i.created_at, i.updated_at, i.deleted_at,
         p.name as project_name,
         a.name as assignee_name, a.email as assignee_email,
         (select count(*) from screenshots s where s.issue_id = i.id) as screenshot_count,
         (select group_concat(s.id) from screenshots s where s.issue_id = i.id) as screenshot_ids
  from issues i
  left join projects p on p.id = i.project_id
  left join user a on a.id = i.assignee_id
`

export const api = Router()

// ── Health / setup state (public: no auth) ───────────────────────────────────
api.get('/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'bugstow-team',
    setupComplete: userCount() > 0,
    openSignup: config.openSignup,
    offline: config.offline,
    edition: config.desktop ? 'desktop' : 'team',
  })
})

// The server's public HTTPS certificate, so teammates can install and trust it
// (docs/RELEASE_OFFLINE.md §7). Public by nature; contains no private key.
api.get('/tls/certificate', (_req, res) => {
  const cert = getCurrentCert()
  if (!cert) {
    res.status(404).json({ error: 'This server is not using HTTPS.' })
    return
  }
  res.setHeader('Content-Type', 'application/x-x509-ca-cert')
  res.setHeader('Content-Disposition', 'attachment; filename="bugstow-server.crt"')
  res.send(cert.cert)
})

// What an invite link is for, so the join page can say "Join Studio". Public:
// the person opening it has no account yet. Says nothing without a valid token.
api.get('/invite-links/info', (req, res) => {
  const link = findUsableInviteLink(req.query.token)
  if (!link) {
    res.status(404).json({ code: 'INVITE_INVALID', error: 'This invite link has expired or was already used.' })
    return
  }
  const team = db.prepare('select name from teams where id = ?').get(link.team_id) as { name: string } | undefined
  res.json({ teamName: team?.name ?? 'a workspace', invitedBy: getUserById(link.created_by)?.name || null, role: link.role })
})

// Everything below requires a session.
api.use(requireAuth)

// ── Current user ──────────────────────────────────────────────────────────────
api.get('/me', (req, res) => {
  const u = req.user!
  res.json({
    id: u.id,
    email: u.email,
    name: u.name,
    isServerAdmin: isServerAdmin(u.id),
    mustChangePassword: mustChangePassword(u.id),
    // Where people on other networks reach this desktop app (bugstow share),
    // so join links point there instead of at localhost.
    shareUrl: config.shareUrl || null,
  })
})

// After an admin reset, the user must pick a new password (via
// /api/auth/change-password, which clears the flag) before using the app.
api.use((req, res, next) => {
  if (mustChangePassword(req.user!.id)) {
    res.status(403).json({ error: 'Please choose a new password first.', code: 'PASSWORD_CHANGE_REQUIRED' })
    return
  }
  next()
})

// ── Server administration (the first account on the server) ──────────────────
function requireServerAdmin(req: import('express').Request, res: import('express').Response): boolean {
  if (isServerAdmin(req.user!.id)) return true
  res.status(403).json({ error: 'Only the server administrator can do this.' })
  return false
}

api.get(
  '/admin/backups',
  asyncRoute(async (req, res) => {
    if (!requireServerAdmin(req, res)) return
    res.json({
      backups: listBackups(),
      automatic: config.backupEnabled,
      intervalHours: config.backupIntervalHours,
      retention: config.backupRetention,
      external: { ...getExternalBackupStatus(), backups: listExternalBackups() },
    })
  })
)
api.post(
  '/admin/backup',
  asyncRoute(async (req, res) => {
    if (!requireServerAdmin(req, res)) return
    const { manifest, external } = await runBackup()
    res.status(201).json({ ok: true, manifest, external })
  })
)

// Issue a one-time temporary password. The user is signed out everywhere and
// must choose a new password on next sign-in. (No email: works offline.)
api.post(
  '/admin/users/reset-password',
  asyncRoute(async (req, res) => {
    if (!requireServerAdmin(req, res)) return
    const userId = String(req.body?.userId || '')
    if (!userId || !getUserById(userId)) {
      res.status(404).json({ error: 'User not found.' })
      return
    }
    if (userId === req.user!.id) {
      res.status(400).json({ error: 'Use "Change password" to change your own password.' })
      return
    }
    const temporaryPassword = await resetUserPassword(userId)
    res.json({ ok: true, temporaryPassword })
  })
)

// ── Teams ─────────────────────────────────────────────────────────────────────
api.get(
  '/teams',
  asyncRoute(async (req, res) => {
    const teams = db
      .prepare(
        `select t.id, t.name, t.created_at, tm.role,
                (select count(*) from team_members m where m.team_id = t.id) as member_count
         from teams t join team_members tm on tm.team_id = t.id
         where tm.user_id = ? order by t.created_at asc`
      )
      .all(req.user!.id)
    res.json({ teams })
  })
)

api.post(
  '/teams',
  asyncRoute(async (req, res) => {
    const name = String(req.body?.name || '').trim()
    if (!name) {
      res.status(400).json({ error: 'Team name is required.' })
      return
    }
    const id = randomUUID()
    const ts = now()
    const tx = db.transaction(() => {
      db.prepare('insert into teams (id, name, created_by, created_at) values (?, ?, ?, ?)').run(
        id,
        name,
        req.user!.id,
        ts
      )
      db.prepare('insert into team_members (team_id, user_id, role, created_at) values (?, ?, ?, ?)').run(
        id,
        req.user!.id,
        'owner',
        ts
      )
    })
    tx()
    res.status(201).json({ team: { id, name, created_at: ts, role: 'owner', member_count: 1 } })
  })
)

// ── Members ─────────────────────────────────────────────────────────────────────
api.get(
  '/members',
  asyncRoute(async (req, res) => {
    const teamId = qp(req, 'teamId')
    if (!teamId || !teamRole(req.user!.id, teamId)) {
      res.status(403).json({ error: 'Not a member of this team.' })
      return
    }
    const members = db
      .prepare(
        `select tm.user_id, tm.role, u.name, u.email
         from team_members tm left join user u on u.id = tm.user_id
         where tm.team_id = ?
         order by case tm.role when 'owner' then 0 when 'admin' then 1 else 2 end, lower(coalesce(u.name, u.email))`
      )
      .all(teamId)
    const invites = db
      .prepare(
        `select id, email, role, created_at from team_invites
         where team_id = ? and accepted_at is null and created_at > ? order by created_at desc`
      )
      .all(teamId, inviteCutoff())
    res.json({ members, invites })
  })
)

api.post(
  '/members',
  asyncRoute(async (req, res) => {
    const teamId = qp(req, 'teamId')
    const role = teamId ? teamRole(req.user!.id, teamId) : null
    if (!teamId || !role) {
      res.status(403).json({ error: 'Not a member of this team.' })
      return
    }
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can invite members.' })
      return
    }
    const email = String(req.body?.email || '').trim().toLowerCase()
    const inviteRole = req.body?.role === 'admin' ? 'admin' : 'member'
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email is required.' })
      return
    }
    const existing = getUserByEmail(email)
    if (existing) {
      db.prepare(
        'insert or ignore into team_members (team_id, user_id, role, created_at) values (?, ?, ?, ?)'
      ).run(teamId, existing.id, inviteRole, now())
      res.json({ added: true })
      return
    }
    db.transaction(() => {
      // Re-sending replaces stale or duplicate pending invitations atomically.
      db.prepare('delete from team_invites where team_id = ? and lower(email) = ? and accepted_at is null').run(teamId, email)
      db.prepare(
        'insert into team_invites (id, team_id, email, role, token, invited_by, created_at) values (?, ?, ?, ?, ?, ?, ?)'
      ).run(randomUUID(), teamId, email, inviteRole, randomUUID().replace(/-/g, ''), req.user!.id, now())
    })()
    res.status(201).json({ invited: true })
  })
)

api.delete(
  '/members',
  asyncRoute(async (req, res) => {
    const teamId = qp(req, 'teamId')
    const role = teamId ? teamRole(req.user!.id, teamId) : null
    if (!teamId || !role) {
      res.status(403).json({ error: 'Not a member of this team.' })
      return
    }
    const inviteId = qp(req, 'inviteId')
    if (inviteId) {
      if (role !== 'owner' && role !== 'admin') {
        res.status(403).json({ error: 'Only owners and admins can cancel invites.' })
        return
      }
      db.prepare('delete from team_invites where id = ? and team_id = ?').run(inviteId, teamId)
      res.json({ removed: true })
      return
    }
    const targetUserId = qp(req, 'userId')
    if (!targetUserId) {
      res.status(400).json({ error: 'userId or inviteId is required.' })
      return
    }
    if (targetUserId !== req.user!.id && role !== 'owner' && role !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can remove members.' })
      return
    }
    const targetRole = teamRole(targetUserId, teamId)
    if (!targetRole) {
      res.status(404).json({ error: 'Not a member of this team.' })
      return
    }
    // An admin must not be able to remove an owner.
    if (targetRole === 'owner' && targetUserId !== req.user!.id && role !== 'owner') {
      res.status(403).json({ error: 'Only an owner can remove another owner.' })
      return
    }
    const owners = db
      .prepare("select count(*) as n from team_members where team_id = ? and role = 'owner'")
      .get(teamId) as { n: number }
    if (targetRole === 'owner' && owners.n <= 1) {
      res.status(400).json({ error: 'Cannot remove the last owner of a team.' })
      return
    }
    db.prepare('delete from team_members where team_id = ? and user_id = ?').run(teamId, targetUserId)
    res.json({ removed: true })
  })
)

// ── Invite links (no email) ─────────────────────────────────────────────────────
function requireTeamManager(req: import('express').Request, res: import('express').Response): string | null {
  const teamId = qp(req, 'teamId')
  const role = teamId ? teamRole(req.user!.id, teamId) : null
  if (!teamId || !role) {
    res.status(403).json({ error: 'Not a member of this team.' })
    return null
  }
  if (role !== 'owner' && role !== 'admin') {
    res.status(403).json({ error: 'Only owners and admins can invite people.' })
    return null
  }
  return teamId
}

api.get(
  '/invite-links',
  asyncRoute(async (req, res) => {
    const teamId = requireTeamManager(req, res)
    if (!teamId) return
    res.json({ links: listOpenInviteLinks(teamId) })
  })
)

api.post(
  '/invite-links',
  asyncRoute(async (req, res) => {
    const teamId = requireTeamManager(req, res)
    if (!teamId) return
    const { token, link } = createInviteLink(teamId, req.body?.role === 'admin' ? 'admin' : 'member', req.user!.id)
    res.status(201).json({ token, link })
  })
)

api.delete(
  '/invite-links',
  asyncRoute(async (req, res) => {
    const teamId = requireTeamManager(req, res)
    if (!teamId) return
    deleteInviteLink(String(qp(req, 'id') || ''), teamId)
    res.json({ removed: true })
  })
)

// Someone who already has an account opened a link.
api.post(
  '/invite-links/accept',
  asyncRoute(async (req, res) => {
    const joined = acceptInviteLink(req.body?.token, req.user!.id)
    if (!joined) {
      res.status(404).json({ code: 'INVITE_INVALID', error: 'This invite link has expired or was already used.' })
      return
    }
    res.json({ teamId: joined.teamId })
  })
)

// ── Projects ──────────────────────────────────────────────────────────────────
function teamIdForProject(id: string): string | null {
  const row = db.prepare('select team_id from projects where id = ?').get(id) as
    | { team_id: string }
    | undefined
  return row?.team_id ?? null
}

api.get(
  '/projects',
  asyncRoute(async (req, res) => {
    const teamId = qp(req, 'teamId')
    if (!teamId || !teamRole(req.user!.id, teamId)) {
      res.status(403).json({ error: 'Not a member of this team.' })
      return
    }
    const projects = db
      .prepare(
        `select id, team_id, name, description, color, created_at, updated_at
         from projects where team_id = ? order by created_at asc`
      )
      .all(teamId)
    res.json({ projects })
  })
)

api.post(
  '/projects',
  asyncRoute(async (req, res) => {
    const teamId = qp(req, 'teamId')
    if (!teamId || !teamRole(req.user!.id, teamId)) {
      res.status(403).json({ error: 'Not a member of this team.' })
      return
    }
    const name = String(req.body?.name || '').trim()
    if (!name) {
      res.status(400).json({ error: 'Project name is required.' })
      return
    }
    const id = randomUUID()
    const ts = now()
    db.prepare(
      'insert into projects (id, team_id, name, color, description, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, teamId, name, req.body?.color || '#5B50F6', req.body?.description || null, ts, ts)
    const project = db.prepare('select * from projects where id = ?').get(id)
    res.status(201).json({ project })
  })
)

api.delete(
  '/projects',
  asyncRoute(async (req, res) => {
    const id = qp(req, 'id')
    const teamId = id ? teamIdForProject(id) : null
    const role = teamId ? teamRole(req.user!.id, teamId) : null
    if (!id || !teamId || !role) {
      res.status(403).json({ error: 'Not allowed.' })
      return
    }
    if (role !== 'owner' && role !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can delete projects.' })
      return
    }
    db.prepare('delete from projects where id = ?').run(id)
    res.json({ removed: true })
  })
)

// Move a project, with its issues and screenshots, to another workspace (for
// example out of a shared one into one only you are in). Taking a project out
// of a workspace removes it for everyone there, so it needs an owner or admin
// of that workspace; the destination only needs you to be a member.
api.post(
  '/projects/move',
  asyncRoute(async (req, res) => {
    const projectId = String(req.body?.projectId || '')
    const toTeamId = String(req.body?.toTeamId || '')
    const fromTeamId = projectId ? teamIdForProject(projectId) : null
    const fromRole = fromTeamId ? teamRole(req.user!.id, fromTeamId) : null
    if (!fromTeamId || !fromRole) {
      res.status(404).json({ error: 'Project not found.' })
      return
    }
    if (fromRole !== 'owner' && fromRole !== 'admin') {
      res.status(403).json({ error: 'Only owners and admins can move a project out of this workspace.' })
      return
    }
    if (!toTeamId || !teamRole(req.user!.id, toTeamId)) {
      res.status(403).json({ error: 'You are not a member of that workspace.' })
      return
    }
    if (toTeamId === fromTeamId) {
      res.json({ moved: 0 })
      return
    }
    // A GitHub issue exists once per workspace; refuse rather than drop any.
    const clash = db
      .prepare(
        `select count(*) as n from issues a join issues b
           on b.team_id = ? and b.github_url = a.github_url
         where a.project_id = ? and a.github_url is not null`
      )
      .get(toTeamId, projectId) as { n: number }
    if (clash.n > 0) {
      res.status(409).json({
        code: 'GITHUB_DUPLICATE',
        error: `The other workspace already has ${clash.n} of these GitHub issues. Delete them there first, or import the repository there instead.`,
      })
      return
    }
    const moved = db.transaction(() => {
      const ts = now()
      db.prepare('update projects set team_id = ?, updated_at = ? where id = ?').run(toTeamId, ts, projectId)
      db.prepare(
        `update screenshots set team_id = ? where issue_id in (select id from issues where project_id = ?)`
      ).run(toTeamId, projectId)
      // Assignees who aren't in the destination workspace are unassigned.
      db.prepare(
        `update issues set assignee_id = null
         where project_id = ? and assignee_id is not null
           and assignee_id not in (select user_id from team_members where team_id = ?)`
      ).run(projectId, toTeamId)
      return db
        .prepare('update issues set team_id = ?, updated_at = ? where project_id = ?')
        .run(toTeamId, ts, projectId).changes
    })()
    res.json({ moved })
  })
)

// ── Issues ────────────────────────────────────────────────────────────────────
function teamIdForIssue(id: string): string | null {
  const row = db.prepare('select team_id from issues where id = ?').get(id) as
    | { team_id: string }
    | undefined
  return row?.team_id ?? null
}
/** A project/assignee referenced by an issue must belong to the issue's team. */
function projectInTeam(projectId: unknown, teamId: string): boolean {
  if (projectId == null || projectId === '') return true
  return typeof projectId === 'string' && teamIdForProject(projectId) === teamId
}
function assigneeInTeam(assigneeId: unknown, teamId: string): boolean {
  if (assigneeId == null || assigneeId === '') return true
  return typeof assigneeId === 'string' && teamRole(assigneeId, teamId) !== null
}
function selectIssue(id: string) {
  const row = db.prepare(`${ISSUE_SELECT} where i.id = ?`).get(id) as IssueRow | undefined
  return row ? mapIssue(row) : null
}

api.get(
  '/issues',
  asyncRoute(async (req, res) => {
    const teamId = qp(req, 'teamId')
    if (!teamId || !teamRole(req.user!.id, teamId)) {
      res.status(403).json({ error: 'Not a member of this team.' })
      return
    }
    const rows = db
      .prepare(`${ISSUE_SELECT} where i.team_id = ? and i.deleted_at is null order by i.created_at desc`)
      .all(teamId) as IssueRow[]
    res.json({ issues: rows.map(mapIssue) })
  })
)

api.post(
  '/issues',
  asyncRoute(async (req, res) => {
    const teamId = qp(req, 'teamId')
    if (!teamId || !teamRole(req.user!.id, teamId)) {
      res.status(403).json({ error: 'Not a member of this team.' })
      return
    }
    const title = String(req.body?.title || '').trim()
    if (!title) {
      res.status(400).json({ error: 'Title is required.' })
      return
    }
    if (!projectInTeam(req.body?.projectId, teamId) || !assigneeInTeam(req.body?.assigneeId, teamId)) {
      res.status(400).json({ error: 'Project or assignee is not part of this team.' })
      return
    }
    const type = TYPES.includes(req.body?.type) ? req.body.type : 'bug'
    const customType = normalizeCustomType(req.body?.customType)
    const status = STATUSES.includes(req.body?.status) ? req.body.status : 'open'
    if (req.body?.priority !== undefined && !PRIORITIES.includes(req.body.priority) ||
        req.body?.severity != null && !SEVERITIES.includes(req.body.severity)) {
      res.status(400).json({ error: 'Invalid status, priority or severity.' }); return
    }
    const details = parseDetails(req.body?.details)
    if (!details) { res.status(400).json({ error: 'Invalid report details.' }); return }
    const fixReferences = req.body?.fixReferences === undefined ? [] : parseFixReferences(req.body.fixReferences)
    if (!fixReferences) { res.status(400).json({ error: 'Invalid GitHub fix references.' }); return }
    // Issues copied in from Local keep their GitHub link, so a later GitHub
    // import recognises them and copying twice doesn't make a second one.
    const githubUrl =
      typeof req.body?.githubUrl === 'string' && GITHUB_ISSUE_URL.test(req.body.githubUrl) ? req.body.githubUrl : null
    const githubNumber = githubUrl && Number.isInteger(req.body?.githubNumber) ? req.body.githubNumber : null
    if (githubUrl) {
      const existing = db.prepare('select id from issues where team_id = ? and github_url = ?').get(teamId, githubUrl) as
        | { id: string }
        | undefined
      if (existing) {
        res.status(200).json({ issue: selectIssue(existing.id), existing: true })
        return
      }
    }
    const id = randomUUID()
    const ts = now()
    db.prepare(
      `insert into issues (id, team_id, project_id, title, description, type, custom_type, status, workflow_status, priority, severity, details_json, fix_references_json, assignee_id, created_by, github_url, github_number, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      teamId,
      req.body?.projectId || null,
      title,
      req.body?.description || '',
      type,
      customType,
      status === 'fixed' ? 'fixed' : 'open',
      status,
      req.body?.priority || 'medium',
      req.body?.severity || null,
      JSON.stringify(details),
      JSON.stringify(fixReferences),
      req.body?.assigneeId || null,
      req.user!.id,
      githubUrl,
      githubNumber,
      ts,
      ts
    )
    res.status(201).json({ issue: selectIssue(id) })
  })
)

api.patch(
  '/issues',
  asyncRoute(async (req, res) => {
    const id = qp(req, 'id')
    const teamId = id ? teamIdForIssue(id) : null
    if (!id || !teamId || !teamRole(req.user!.id, teamId)) {
      res.status(403).json({ error: 'Not allowed.' })
      return
    }
    const b = req.body || {}
    if (b.status !== undefined && !STATUSES.includes(b.status) ||
        b.priority !== undefined && !PRIORITIES.includes(b.priority) ||
        b.severity !== undefined && b.severity !== null && !SEVERITIES.includes(b.severity)) {
      res.status(400).json({ error: 'Invalid status, priority or severity.' }); return
    }
    const details = b.details === undefined ? undefined : parseDetails(b.details)
    if (details === null) { res.status(400).json({ error: 'Invalid report details.' }); return }
    const fixReferences = b.fixReferences === undefined ? undefined : parseFixReferences(b.fixReferences)
    if (fixReferences === null) { res.status(400).json({ error: 'Invalid GitHub fix references.' }); return }
    const current = db.prepare('select * from issues where id = ? and deleted_at is null').get(id) as Record<string, unknown> | undefined
    if (!current) { res.status(404).json({ error: 'Issue not found.' }); return }
    // Optimistic concurrency: the client says which version it edited. If
    // someone saved in between, refuse instead of silently overwriting.
    if (b.expectedUpdatedAt !== undefined && b.expectedUpdatedAt !== current.updated_at) {
      res.status(409).json({
        error: 'This issue was changed by another teammate. Reload it before saving.',
        code: 'CONFLICT',
        issue: selectIssue(id),
      })
      return
    }
    if (!projectInTeam(b.projectId, teamId) || !assigneeInTeam(b.assigneeId, teamId)) {
      res.status(400).json({ error: 'Project or assignee is not part of this team.' })
      return
    }
    const sets: string[] = []
    const vals: unknown[] = []
    if (typeof b.title === 'string') {
      sets.push('title = ?')
      vals.push(b.title.trim())
    }
    if (typeof b.description === 'string') {
      sets.push('description = ?')
      vals.push(b.description)
    }
    if (TYPES.includes(b.type)) {
      sets.push('type = ?')
      vals.push(b.type)
    }
    if (b.customType === null || typeof b.customType === 'string') {
      sets.push('custom_type = ?')
      vals.push(normalizeCustomType(b.customType))
    }
    if (STATUSES.includes(b.status)) {
      sets.push('status = ?', 'workflow_status = ?')
      vals.push(b.status === 'fixed' ? 'fixed' : 'open', b.status)
    }
    if (b.priority !== undefined) { sets.push('priority = ?'); vals.push(b.priority) }
    if (b.severity !== undefined) { sets.push('severity = ?'); vals.push(b.severity) }
    if (details !== undefined) { sets.push('details_json = ?'); vals.push(JSON.stringify(details)) }
    if (fixReferences !== undefined) { sets.push('fix_references_json = ?'); vals.push(JSON.stringify(fixReferences)) }
    if (b.projectId !== undefined) {
      sets.push('project_id = ?')
      vals.push(b.projectId || null)
    }
    if (b.assigneeId !== undefined) {
      sets.push('assignee_id = ?')
      vals.push(b.assigneeId || null)
    }
    if (typeof b.title === 'string' && !b.title.trim()) {
      res.status(400).json({ error: 'Title is required.' })
      return
    }
    // Every save gets a strictly newer version stamp, even within one millisecond.
    const stamp = new Date(Math.max(Date.now(), Date.parse(String(current.updated_at)) + 1)).toISOString()
    sets.push('updated_at = ?')
    vals.push(stamp)
    // The version check is repeated inside the UPDATE so two saves racing past
    // the check above cannot both win.
    const result = db
      .prepare(`update issues set ${sets.join(', ')} where id = ? and updated_at = ?`)
      .run(...vals, id, current.updated_at)
    if (result.changes === 0) {
      res.status(409).json({
        error: 'This issue was changed by another teammate. Reload it before saving.',
        code: 'CONFLICT',
        issue: selectIssue(id),
      })
      return
    }
    for (const [key, column] of [['status', 'workflow_status'], ['priority', 'priority'], ['assigneeId', 'assignee_id'], ['projectId', 'project_id'], ['title', 'title'], ['description', 'description'], ['type', 'type']] as const) {
      if (b[key] !== undefined && b[key] !== current[column]) {
        db.prepare('insert into issue_events (id, issue_id, team_id, author_id, kind, body, created_at) values (?, ?, ?, ?, ?, ?, ?)')
          .run(randomUUID(), id, teamId, req.user!.id, key === 'assigneeId' ? 'assignment' : key === 'projectId' ? 'project' : key, String(b[key] ?? 'Unassigned').slice(0, 4000), now())
      }
    }
    if (fixReferences !== undefined && JSON.stringify(fixReferences) !== String(current.fix_references_json || '[]')) {
      db.prepare('insert into issue_events (id, issue_id, team_id, author_id, kind, body, created_at) values (?, ?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), id, teamId, req.user!.id, 'fix references', fixReferences.join(', ').slice(0, 4000) || 'Removed', now())
    }
    res.json({ issue: selectIssue(id) })
  })
)

api.delete(
  '/issues',
  asyncRoute(async (req, res) => {
    const id = qp(req, 'id')
    const teamId = id ? teamIdForIssue(id) : null
    if (!id || !teamId || !teamRole(req.user!.id, teamId)) {
      res.status(403).json({ error: 'Not allowed.' })
      return
    }
    db.prepare('update issues set deleted_at = ?, updated_at = ? where id = ? and deleted_at is null').run(now(), now(), id)
    res.json({ removed: true })
  })
)

api.get('/issues/trash', (req, res) => {
  const teamId = qp(req, 'teamId')
  if (!teamId || !teamRole(req.user!.id, teamId)) { res.status(403).json({ error: 'Not a member of this team.' }); return }
  const rows = db.prepare(`${ISSUE_SELECT} where i.team_id = ? and i.deleted_at is not null order by i.deleted_at desc`).all(teamId) as IssueRow[]
  res.json({ issues: rows.map(mapIssue) })
})
api.get('/issues/link', (req, res) => {
  const id = qp(req, 'id'), teamId = id ? teamIdForIssue(id) : null
  if (!teamId || !teamRole(req.user!.id, teamId)) { res.status(403).json({ error: 'Not allowed.' }); return }
  const row = db.prepare(`${ISSUE_SELECT} where i.id = ? and i.deleted_at is null`).get(id) as IssueRow | undefined
  if (!row) { res.status(404).json({ error: 'Issue not found or moved to Trash.' }); return }
  res.json({ issue: mapIssue(row) })
})
api.post('/issues/restore', (req, res) => {
  const id = qp(req, 'id'), teamId = id ? teamIdForIssue(id) : null
  if (!teamId || !teamRole(req.user!.id, teamId)) { res.status(403).json({ error: 'Not allowed.' }); return }
  const changed = db.prepare('update issues set deleted_at = null, updated_at = ? where id = ? and deleted_at is not null').run(now(), id).changes
  if (!changed) { res.status(404).json({ error: 'Issue is not in Trash.' }); return }
  res.json({ issue: selectIssue(id!) })
})
api.delete('/issues/purge', (req, res) => {
  const id = qp(req, 'id'), teamId = id ? teamIdForIssue(id) : null
  if (!teamId || !teamRole(req.user!.id, teamId)) { res.status(403).json({ error: 'Not allowed.' }); return }
  if (req.body?.confirm !== true) { res.status(400).json({ error: 'Confirm permanent deletion.' }); return }
  const trashed = db.prepare('select 1 from issues where id = ? and deleted_at is not null').get(id)
  if (!trashed) { res.status(400).json({ error: 'Move the issue to Trash first.' }); return }
  const shots = db.prepare('select storage_path from screenshots where issue_id = ?').all(id) as Array<{ storage_path: string }>
  db.prepare('delete from issues where id = ?').run(id)
  shots.forEach(shot => deleteScreenshotFile(shot.storage_path))
  res.json({ removed: true })
})
api.get('/issues/activity', (req, res) => {
  const id = qp(req, 'id'), teamId = id ? teamIdForIssue(id) : null
  if (!teamId || !teamRole(req.user!.id, teamId)) { res.status(403).json({ error: 'Not allowed.' }); return }
  const events = db.prepare('select e.id, e.author_id, e.kind, e.body, e.created_at, u.name as author_name from issue_events e left join user u on u.id = e.author_id where e.issue_id = ? order by e.created_at asc, e.rowid asc').all(id)
  res.json({ events })
})
api.post('/issues/comments', (req, res) => {
  const id = qp(req, 'id'), teamId = id ? teamIdForIssue(id) : null
  if (!teamId || !teamRole(req.user!.id, teamId)) { res.status(403).json({ error: 'Not allowed.' }); return }
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
  if (!body || body.length > 4000) { res.status(400).json({ error: 'Enter a comment up to 4,000 characters.' }); return }
  const event = { id: randomUUID(), author_id: req.user!.id, author_name: req.user!.name || null, kind: 'comment', body, created_at: now() }
  db.prepare('insert into issue_events (id, issue_id, team_id, author_id, kind, body, created_at) values (?, ?, ?, ?, ?, ?, ?)').run(event.id, id, teamId, event.author_id, event.kind, body, event.created_at)
  res.status(201).json({ comment: event })
})
api.delete('/issues/comments', (req, res) => {
  const id = qp(req, 'id'), commentId = qp(req, 'commentId'), teamId = id ? teamIdForIssue(id) : null
  if (!teamId || !teamRole(req.user!.id, teamId)) { res.status(403).json({ error: 'Not allowed.' }); return }
  const event = db.prepare('select author_id from issue_events where id = ? and issue_id = ? and kind = ?').get(commentId, id, 'comment') as { author_id: string } | undefined
  if (!event) { res.status(404).json({ error: 'Comment not found.' }); return }
  if (event.author_id !== req.user!.id) { res.status(403).json({ error: 'Only the author can delete this comment.' }); return }
  db.prepare('delete from issue_events where id = ?').run(commentId)
  res.json({ removed: true })
})
api.post('/issues/bulk', (req, res) => {
  const teamId = String(req.body?.teamId || ''), ids = req.body?.ids, changes = req.body?.changes
  if (!teamRole(req.user!.id, teamId)) { res.status(403).json({ error: 'Not a member of this team.' }); return }
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 200 || new Set(ids).size !== ids.length || !ids.every(id => typeof id === 'string')) { res.status(400).json({ error: 'Select 1 to 200 distinct issues.' }); return }
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).length < 1 || Object.keys(changes).length > 4) { res.status(400).json({ error: 'Choose a bulk action.' }); return }
  const entries = Object.entries(changes) as Array<[string, unknown]>
  const valid = entries.every(([key, value]) => key === 'priority' ? typeof value === 'string' && PRIORITIES.includes(value) : key === 'status' ? typeof value === 'string' && STATUSES.includes(value) : key === 'projectId' ? projectInTeam(value, teamId) : key === 'assigneeId' ? assigneeInTeam(value, teamId) : key === 'trash' ? value === true && entries.length === 1 : false)
  if (!valid) { res.status(400).json({ error: 'Invalid bulk action.' }); return }
  const rows = db.prepare(`select id from issues where team_id = ? and deleted_at is null and id in (${ids.map(() => '?').join(',')})`).all(teamId, ...ids)
  if (rows.length !== ids.length) { res.status(400).json({ error: 'An issue is not in this workspace.' }); return }
  const ts = now()
  const tx = db.transaction(() => {
    for (const id of ids) {
      for (const [key, value] of entries) {
        if (key === 'trash') db.prepare('update issues set deleted_at = ?, updated_at = ? where id = ?').run(ts, ts, id)
        else if (key === 'status') db.prepare('update issues set status = ?, workflow_status = ?, updated_at = ? where id = ?').run(value === 'fixed' ? 'fixed' : 'open', value, ts, id)
        else db.prepare(`update issues set ${key === 'projectId' ? 'project_id' : key === 'assigneeId' ? 'assignee_id' : 'priority'} = ?, updated_at = ? where id = ?`).run(value, ts, id)
        db.prepare('insert into issue_events (id, issue_id, team_id, author_id, kind, body, created_at) values (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), id, teamId, req.user!.id, key, String(value), ts)
      }
    }
  })
  tx()
  res.json({ updated: ids.length })
})

// ── Screenshots ─────────────────────────────────────────────────────────────────
api.get(
  '/screenshots',
  asyncRoute(async (req, res) => {
    const id = qp(req, 'id')
    if (!id) {
      res.status(400).json({ error: 'id is required.' })
      return
    }
    const row = db.prepare('select team_id, mime_type, storage_path from screenshots where id = ?').get(id) as
      | { team_id: string; mime_type: string; storage_path: string }
      | undefined
    if (!row) {
      res.status(404).json({ error: 'Not found.' })
      return
    }
    if (!teamRole(req.user!.id, row.team_id)) {
      res.status(403).json({ error: 'Not allowed.' })
      return
    }
    const abs = resolveScreenshot(row.storage_path)
    if (!abs) {
      res.status(404).json({ error: 'File missing.' })
      return
    }
    res.setHeader('Content-Type', row.mime_type)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    fs.createReadStream(abs).pipe(res)
  })
)

api.post(
  '/screenshots',
  asyncRoute(async (req, res) => {
    const issueId = qp(req, 'issueId')
    const teamId = issueId ? teamIdForIssue(issueId) : null
    if (!issueId || !teamId || !teamRole(req.user!.id, teamId)) {
      res.status(403).json({ error: 'Not allowed.' })
      return
    }
    const base64 = String(req.body?.base64 || '')
    if (!base64) {
      res.status(400).json({ error: 'Image data is required.' })
      return
    }
    let stored
    try {
      stored = saveScreenshot(base64, String(req.body?.mimeType || 'image/png'))
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid image.' })
      return
    }
    const id = randomUUID()
    db.prepare(
      'insert into screenshots (id, issue_id, team_id, mime_type, filename, storage_path, created_at) values (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      issueId,
      teamId,
      stored.mimeType,
      String(req.body?.filename || '').slice(0, 200) || null,
      stored.storagePath,
      now()
    )
    res.status(201).json({ id })
  })
)

api.delete(
  '/screenshots',
  asyncRoute(async (req, res) => {
    const id = qp(req, 'id')
    const row = id
      ? (db.prepare('select team_id, storage_path from screenshots where id = ?').get(id) as
          | { team_id: string; storage_path: string }
          | undefined)
      : undefined
    if (!row || !teamRole(req.user!.id, row.team_id)) {
      res.status(403).json({ error: 'Not allowed.' })
      return
    }
    db.prepare('delete from screenshots where id = ?').run(id)
    deleteScreenshotFile(row.storage_path)
    res.json({ removed: true })
  })
)

// ── GitHub import ────────────────────────────────────────────────────────────────
// Same behaviour and error codes as the browser-side import in
// src/services/githubImport.ts, so the dialog works the same everywhere.
interface GhIssue {
  number: number
  title: string
  body: string | null
  state: string
  html_url: string
  labels: Array<{ name?: string } | string>
  pull_request?: unknown
}
function mapType(labels: Array<{ name?: string } | string>): 'bug' | 'uiux' | 'idea' {
  const names = labels.map(l => (typeof l === 'string' ? l : l.name || '').toLowerCase())
  if (names.some(n => /(ui|ux|design|css|layout|visual)/.test(n))) return 'uiux'
  if (names.some(n => /(feature|enhancement|idea|proposal|request)/.test(n))) return 'idea'
  return 'bug'
}
/** What the person should do next, from GitHub's answer. */
function githubErrorCode(status: number, rateRemaining: string | null, hadToken: boolean): string {
  if (status === 403 || status === 429) {
    if (rateRemaining === '0' || status === 429) return hadToken ? 'RATE_LIMITED' : 'NEEDS_TOKEN'
    return hadToken ? 'BAD_TOKEN' : 'NEEDS_TOKEN'
  }
  if (status === 401) return hadToken ? 'BAD_TOKEN' : 'NEEDS_TOKEN'
  if (status === 404) return hadToken ? 'NOT_FOUND' : 'NEEDS_TOKEN'
  return 'NETWORK'
}
const GITHUB_ERROR_TEXT: Record<string, string> = {
  NEEDS_TOKEN: 'GitHub needs a key to show this repository’s issues. It’s probably private.',
  BAD_TOKEN: 'GitHub didn’t accept that key for this repository.',
  NOT_FOUND: 'GitHub couldn’t find this repository with that key.',
  RATE_LIMITED: 'GitHub asked to slow down. Wait a few minutes and try again.',
  NETWORK: 'Couldn’t reach GitHub.',
}
const GITHUB_MAX_PAGES = 10

const exportingIssues = new Set<string>()
api.post('/github-export', asyncRoute(async (req, res) => {
  if (config.offline) { res.status(403).json({ code: 'OFFLINE', error: 'Internet features are turned off on this BugsTow server.' }); return }
  const teamId = String(req.body?.teamId || '')
  if (!teamRole(req.user!.id, teamId)) { res.status(403).json({ error: 'Not a member of this team.' }); return }
  const ids = req.body?.issueIds
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string')) { res.status(400).json({ error: 'Select issues to export.' }); return }
  const uniqueIds = [...new Set<string>(ids)]
  const find = db.prepare('select id, title, description, type, status, github_url as githubUrl from issues where id = ? and team_id = ? and deleted_at is null')
  const issues = uniqueIds.map(id => find.get(id, teamId) as ExportIssue | undefined)
  if (issues.some(i => !i)) { res.status(400).json({ error: 'Some issues are no longer in this workspace. Refresh and try again.' }); return }
  if (uniqueIds.some(id => exportingIssues.has(id))) { res.status(409).json({ error: 'These issues are already being exported. Wait and refresh.' }); return }
  uniqueIds.forEach(id => exportingIssues.add(id))
  try {
    const result = await exportGithubIssues(String(req.body?.repo || ''), String(req.body?.token || ''), issues as ExportIssue[], async (id, url, number) => {
      const saved = db.prepare("update issues set github_url = ?, github_number = ?, updated_at = ? where id = ? and team_id = ? and github_url is null").run(url, number, now(), id, teamId)
      if (saved.changes !== 1) throw new Error('Issue changed during export.')
    })
    res.json(result)
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : 'Export failed.' }) }
  finally { uniqueIds.forEach(id => exportingIssues.delete(id)) }
}))

api.post(
  '/github-import',
  asyncRoute(async (req, res) => {
    if (config.offline) {
      res.status(403).json({
        code: 'OFFLINE',
        error: 'Internet features are turned off on this BugsTow server (BUGSTOW_OFFLINE=false turns them on).',
      })
      return
    }
    const teamId = String(req.body?.teamId || '')
    if (!teamId || !teamRole(req.user!.id, teamId)) {
      res.status(403).json({ error: 'Not a member of this team.' })
      return
    }
    const repo = String(req.body?.repo || '')
      .trim()
      .replace(/^https?:\/\/github\.com\//, '')
      .replace(/\.git$/, '')
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || repo.includes('..')) {
      res.status(400).json({ code: 'INVALID_REPO', error: 'Repo must be in the form "owner/name".' })
      return
    }
    const projectId = req.body?.projectId || null
    if (!projectInTeam(projectId, teamId)) {
      res.status(400).json({ error: 'Project is not part of this team.' })
      return
    }
    const newProjectName = String(req.body?.newProjectName || '').trim().slice(0, 120)

    const token = String(req.body?.token || '').trim()
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'bugstow-import',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const state = req.body?.includeClosed === true ? 'all' : 'open'

    // Read everything from GitHub first, so a failure part-way leaves nothing behind.
    const incoming: GhIssue[] = []
    try {
      for (let page = 1; page <= GITHUB_MAX_PAGES; page++) {
        const url = `https://api.github.com/repos/${repo}/issues?state=${state}&per_page=100&page=${page}`
        const resp = await fetch(url, { headers })
        if (!resp.ok) {
          const code = githubErrorCode(resp.status, resp.headers.get('x-ratelimit-remaining'), Boolean(token))
          res.status(code === 'NETWORK' ? 502 : 400).json({ code, error: GITHUB_ERROR_TEXT[code] })
          return
        }
        const batch = (await resp.json()) as GhIssue[]
        if (!Array.isArray(batch) || batch.length === 0) break
        incoming.push(...batch.filter(gh => !gh.pull_request))
        if (batch.length < 100) break
      }
    } catch (err) {
      console.error('GitHub import failed:', err instanceof Error ? err.message : err)
      res.status(502).json({ code: 'NETWORK', error: GITHUB_ERROR_TEXT.NETWORK })
      return
    }

    // New issues are added; ones imported before only follow GitHub's
    // open/closed state (titles and notes edited here are kept).
    const findExisting = db.prepare('select id, coalesce(workflow_status, status) as status from issues where team_id = ? and github_url = ?')
    const insert = db.prepare(
      `insert into issues (id, team_id, project_id, title, description, type, status, workflow_status, created_by, github_url, github_number, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const setStatus = db.prepare('update issues set status = ?, workflow_status = ?, updated_at = ? where id = ?')
    const result = db.transaction(() => {
      let target = projectId as string | null
      let imported = 0
      let updated = 0
      let unchanged = 0
      const isNew = incoming.filter(gh => !findExisting.get(teamId, gh.html_url))
      if (!target && newProjectName && isNew.length > 0) {
        target = randomUUID()
        const ts = now()
        db.prepare(
          'insert into projects (id, team_id, name, color, description, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)'
        ).run(target, teamId, newProjectName, '#5B50F6', `Imported from github.com/${repo}`, ts, ts)
      }
      // Oldest first, so the newest GitHub issue is at the top.
      for (const gh of [...incoming].reverse()) {
        const status = gh.state === 'closed' ? 'fixed' : 'open'
        const existing = findExisting.get(teamId, gh.html_url) as { id: string; status: string } | undefined
        if (existing) {
          if (existing.status === 'fixed' && status === 'open' || existing.status !== 'fixed' && status === 'fixed') {
            setStatus.run(status, status, now(), existing.id)
            updated++
          } else unchanged++
          continue
        }
        const ts = now()
        insert.run(
          randomUUID(),
          teamId,
          target,
          gh.title || `#${gh.number}`,
          gh.body || '',
          mapType(gh.labels || []),
          status,
          status,
          req.user!.id,
          gh.html_url,
          gh.number,
          ts,
          ts
        )
        imported++
      }
      return { imported, updated, unchanged, projectId: target }
    })()
    res.json(result)
  })
)
