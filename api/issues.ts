import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import { teamRole } from './_lib/auth.js'
import { withUser, queryParam, readJsonBody } from './_lib/http.js'

async function teamIdForIssue(issueId: string): Promise<string | null> {
  const rows = (await sql`select team_id from issues where id = ${issueId} limit 1`) as Array<{
    team_id: string
  }>
  return rows[0]?.team_id ?? null
}

/** Select a single issue with the same joined/computed shape as the list query. */
async function selectIssue(id: string): Promise<unknown> {
  const rows = (await sql`
    select i.id, i.team_id, i.project_id, i.title, i.description, i.type, i.status,
           i.assignee_id, i.created_by, i.github_url, i.github_number,
           i.created_at, i.updated_at,
           p.name as project_name,
           a.name as assignee_name, a.email as assignee_email,
           (select count(*)::int from screenshots s where s.issue_id = i.id) as screenshot_count,
           coalesce((select array_agg(s.id::text order by s.created_at)
                     from screenshots s where s.issue_id = i.id), '{}') as screenshot_ids
    from issues i
    left join projects p on p.id = i.project_id
    left join neon_auth.users_sync a on a.id = i.assignee_id
    where i.id = ${id} limit 1
  `) as unknown[]
  return rows[0]
}

const TYPES = ['bug', 'uiux', 'idea']
const STATUSES = ['open', 'fixed']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withUser(req, res, async user => {
    if (req.method === 'GET') {
      const teamId = queryParam(req, 'teamId')
      if (!teamId) {
        res.status(400).json({ error: 'teamId is required.' })
        return
      }
      if (!(await teamRole(user.id, teamId))) {
        res.status(403).json({ error: 'Not a member of this team.' })
        return
      }
      const issues = await sql`
        select i.id, i.team_id, i.project_id, i.title, i.description, i.type, i.status,
               i.assignee_id, i.created_by, i.github_url, i.github_number,
               i.created_at, i.updated_at,
               p.name as project_name,
               a.name as assignee_name, a.email as assignee_email,
               (select count(*)::int from screenshots s where s.issue_id = i.id) as screenshot_count,
               coalesce((select array_agg(s.id::text order by s.created_at)
                         from screenshots s where s.issue_id = i.id), '{}') as screenshot_ids
        from issues i
        left join projects p on p.id = i.project_id
        left join neon_auth.users_sync a on a.id = i.assignee_id
        where i.team_id = ${teamId}
        order by i.created_at desc
      `
      res.status(200).json({ issues })
      return
    }

    if (req.method === 'POST') {
      const teamId = queryParam(req, 'teamId')
      if (!teamId) {
        res.status(400).json({ error: 'teamId is required.' })
        return
      }
      if (!(await teamRole(user.id, teamId))) {
        res.status(403).json({ error: 'Not a member of this team.' })
        return
      }
      const b = readJsonBody<{
        title?: string
        description?: string
        type?: string
        projectId?: string | null
        assigneeId?: string | null
      }>(req)
      const title = (b.title || '').trim()
      if (!title) {
        res.status(400).json({ error: 'Title is required.' })
        return
      }
      const type = TYPES.includes(b.type || '') ? b.type : 'bug'
      const inserted = (await sql`
        insert into issues (team_id, project_id, title, description, type, status, assignee_id, created_by)
        values (${teamId}, ${b.projectId || null}, ${title}, ${b.description || ''}, ${type}, 'open',
                ${b.assigneeId || null}, ${user.id})
        returning id
      `) as Array<{ id: string }>
      res.status(201).json({ issue: await selectIssue(inserted[0].id) })
      return
    }

    if (req.method === 'PATCH') {
      const id = queryParam(req, 'id')
      if (!id) {
        res.status(400).json({ error: 'id is required.' })
        return
      }
      const teamId = await teamIdForIssue(id)
      if (!teamId || !(await teamRole(user.id, teamId))) {
        res.status(403).json({ error: 'Not allowed.' })
        return
      }
      const b = readJsonBody<{
        title?: string
        description?: string
        type?: string
        status?: string
        projectId?: string | null
        assigneeId?: string | null
      }>(req)
      const type = b.type !== undefined && TYPES.includes(b.type) ? b.type : null
      const status = b.status !== undefined && STATUSES.includes(b.status) ? b.status : null
      await sql`
        update issues set
          title = coalesce(${b.title ?? null}, title),
          description = coalesce(${b.description ?? null}, description),
          type = coalesce(${type}, type),
          status = coalesce(${status}, status),
          project_id = case when ${b.projectId !== undefined} then ${b.projectId ?? null} else project_id end,
          assignee_id = case when ${b.assigneeId !== undefined} then ${b.assigneeId ?? null} else assignee_id end,
          updated_at = now()
        where id = ${id}
      `
      res.status(200).json({ issue: await selectIssue(id) })
      return
    }

    if (req.method === 'DELETE') {
      const id = queryParam(req, 'id')
      if (!id) {
        res.status(400).json({ error: 'id is required.' })
        return
      }
      const teamId = await teamIdForIssue(id)
      if (!teamId || !(await teamRole(user.id, teamId))) {
        res.status(403).json({ error: 'Not allowed.' })
        return
      }
      await sql`delete from issues where id = ${id}`
      res.status(200).json({ removed: true })
      return
    }

    res.status(405).json({ error: 'Method not allowed.' })
  })
}
