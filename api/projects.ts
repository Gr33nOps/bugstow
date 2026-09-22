import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db'
import { teamRole } from './_lib/auth'
import { withUser, queryParam, readJsonBody } from './_lib/http'

async function teamIdForProject(projectId: string): Promise<string | null> {
  const rows = (await sql`select team_id from projects where id = ${projectId} limit 1`) as Array<{
    team_id: string
  }>
  return rows[0]?.team_id ?? null
}

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
      const projects = await sql`
        select id, team_id, name, description, color, created_at, updated_at
        from projects where team_id = ${teamId} order by created_at asc
      `
      res.status(200).json({ projects })
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
      const body = readJsonBody<{ name?: string; color?: string; description?: string }>(req)
      const name = (body.name || '').trim()
      if (!name) {
        res.status(400).json({ error: 'Project name is required.' })
        return
      }
      const rows = (await sql`
        insert into projects (team_id, name, color, description)
        values (${teamId}, ${name}, ${body.color || '#5B50F6'}, ${body.description || null})
        returning id, team_id, name, description, color, created_at, updated_at
      `) as unknown[]
      res.status(201).json({ project: rows[0] })
      return
    }

    if (req.method === 'PATCH') {
      const id = queryParam(req, 'id')
      if (!id) {
        res.status(400).json({ error: 'id is required.' })
        return
      }
      const teamId = await teamIdForProject(id)
      if (!teamId || !(await teamRole(user.id, teamId))) {
        res.status(403).json({ error: 'Not allowed.' })
        return
      }
      const body = readJsonBody<{ name?: string; color?: string; description?: string }>(req)
      const rows = (await sql`
        update projects set
          name = coalesce(${body.name ?? null}, name),
          color = coalesce(${body.color ?? null}, color),
          description = coalesce(${body.description ?? null}, description),
          updated_at = now()
        where id = ${id}
        returning id, team_id, name, description, color, created_at, updated_at
      `) as unknown[]
      res.status(200).json({ project: rows[0] })
      return
    }

    if (req.method === 'DELETE') {
      const id = queryParam(req, 'id')
      if (!id) {
        res.status(400).json({ error: 'id is required.' })
        return
      }
      const teamId = await teamIdForProject(id)
      if (!teamId || !(await teamRole(user.id, teamId))) {
        res.status(403).json({ error: 'Not allowed.' })
        return
      }
      // Issues keep existing; their project_id becomes null (FK on delete set null).
      await sql`delete from projects where id = ${id}`
      res.status(200).json({ removed: true })
      return
    }

    res.status(405).json({ error: 'Method not allowed.' })
  })
}
