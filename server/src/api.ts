import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { db, getUserByEmail, userCount } from './db.ts'
import { config } from './config.ts'
import { requireAuth, teamRole, asyncRoute } from './middleware.ts'
import { saveScreenshot, resolveScreenshot, deleteScreenshotFile } from './storage.ts'
import { runBackup, listBackups } from './backup.ts'

const TYPES = ['bug', 'uiux', 'idea']
const STATUSES = ['open', 'fixed']

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
  return {
    ...row,
    screenshot_ids: row.screenshot_ids ? String(row.screenshot_ids).split(',') : [],
  }
}

const ISSUE_SELECT = `
  select i.id, i.team_id, i.project_id, i.title, i.description, i.type, i.status,
         i.assignee_id, i.created_by, i.github_url, i.github_number,
         i.created_at, i.updated_at,
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
  })
})

// Everything below requires a session.
api.use(requireAuth)

// ── Backups (any signed-in member; the data is local and shared) ──────────────
api.get(
  '/admin/backups',
  asyncRoute(async (_req, res) => {
    res.json({ backups: listBackups() })
  })
)
api.post(
  '/admin/backup',
  asyncRoute(async (_req, res) => {
    const { manifest } = await runBackup()
    res.status(201).json({ ok: true, manifest })
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
         where tm.team_id = ? order by tm.role, u.email`
      )
      .all(teamId)
    const invites = db
      .prepare(
        `select id, email, role, created_at from team_invites
         where team_id = ? and accepted_at is null order by created_at desc`
      )
      .all(teamId)
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
    db.prepare(
      'insert into team_invites (id, team_id, email, role, token, invited_by, created_at) values (?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), teamId, email, inviteRole, randomUUID().replace(/-/g, ''), req.user!.id, now())
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
    if (!id || !teamId || !teamRole(req.user!.id, teamId)) {
      res.status(403).json({ error: 'Not allowed.' })
      return
    }
    db.prepare('delete from projects where id = ?').run(id)
    res.json({ removed: true })
  })
)

// ── Issues ────────────────────────────────────────────────────────────────────
function teamIdForIssue(id: string): string | null {
  const row = db.prepare('select team_id from issues where id = ?').get(id) as
    | { team_id: string }
    | undefined
  return row?.team_id ?? null
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
      .prepare(`${ISSUE_SELECT} where i.team_id = ? order by i.created_at desc`)
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
    const type = TYPES.includes(req.body?.type) ? req.body.type : 'bug'
    const id = randomUUID()
    const ts = now()
    db.prepare(
      `insert into issues (id, team_id, project_id, title, description, type, status, assignee_id, created_by, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`
    ).run(
      id,
      teamId,
      req.body?.projectId || null,
      title,
      req.body?.description || '',
      type,
      req.body?.assigneeId || null,
      req.user!.id,
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
    if (STATUSES.includes(b.status)) {
      sets.push('status = ?')
      vals.push(b.status)
    }
    if (b.projectId !== undefined) {
      sets.push('project_id = ?')
      vals.push(b.projectId || null)
    }
    if (b.assigneeId !== undefined) {
      sets.push('assignee_id = ?')
      vals.push(b.assigneeId || null)
    }
    sets.push('updated_at = ?')
    vals.push(now())
    db.prepare(`update issues set ${sets.join(', ')} where id = ?`).run(...vals, id)
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
    const shots = db.prepare('select storage_path from screenshots where issue_id = ?').all(id) as Array<{
      storage_path: string
    }>
    db.prepare('delete from issues where id = ?').run(id)
    shots.forEach(s => deleteScreenshotFile(s.storage_path))
    res.json({ removed: true })
  })
)

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
    ).run(id, issueId, teamId, stored.mimeType, req.body?.filename || null, stored.storagePath, now())
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

api.post(
  '/github-import',
  asyncRoute(async (req, res) => {
    if (config.offline) {
      res.status(403).json({
        error: 'GitHub import is disabled in offline mode. Set BUGSTOW_OFFLINE=false to enable it.',
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
    if (!/^[^/]+\/[^/]+$/.test(repo)) {
      res.status(400).json({ error: 'Repo must be in the form "owner/name".' })
      return
    }
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'bugstow-import',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    const token = String(req.body?.token || '').trim()
    if (token) headers.Authorization = `Bearer ${token}`
    const state = req.body?.includeClosed === false ? 'open' : 'all'
    const projectId = req.body?.projectId || null

    const insert = db.prepare(
      `insert or ignore into issues (id, team_id, project_id, title, description, type, status, created_by, github_url, github_number, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    let imported = 0
    let skipped = 0
    try {
      for (let page = 1; page <= 5; page++) {
        const url = `https://api.github.com/repos/${repo}/issues?state=${state}&per_page=100&page=${page}`
        const resp = await fetch(url, { headers })
        if (resp.status === 401 || resp.status === 403) {
          res.status(400).json({ error: 'GitHub rejected the request. Check the token and its access.' })
          return
        }
        if (resp.status === 404) {
          res.status(404).json({ error: 'Repository not found (or no access).' })
          return
        }
        if (!resp.ok) {
          res.status(502).json({ error: `GitHub error (${resp.status}).` })
          return
        }
        const batch = (await resp.json()) as GhIssue[]
        if (!Array.isArray(batch) || batch.length === 0) break
        const ts = now()
        for (const gh of batch) {
          if (gh.pull_request) continue
          const result = insert.run(
            randomUUID(),
            teamId,
            projectId,
            gh.title || `#${gh.number}`,
            gh.body || '',
            mapType(gh.labels || []),
            gh.state === 'closed' ? 'fixed' : 'open',
            req.user!.id,
            gh.html_url,
            gh.number,
            ts,
            ts
          )
          if (result.changes > 0) imported++
          else skipped++
        }
        if (batch.length < 100) break
      }
    } catch (err) {
      console.error('GitHub import failed:', err)
      res.status(502).json({ error: 'Could not reach GitHub.' })
      return
    }
    res.json({ imported, skipped })
  })
)
