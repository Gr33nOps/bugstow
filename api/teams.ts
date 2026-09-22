import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db'
import { withUser } from './_lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withUser(req, res, async user => {
    if (req.method === 'GET') {
      const teams = await sql`
        select t.id, t.name, t.created_at, tm.role,
               (select count(*)::int from team_members m where m.team_id = t.id) as member_count
        from teams t
        join team_members tm on tm.team_id = t.id
        where tm.user_id = ${user.id}
        order by t.created_at asc
      `
      res.status(200).json({ teams })
      return
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) {
        res.status(400).json({ error: 'Team name is required.' })
        return
      }
      const created = (await sql`
        insert into teams (name, created_by) values (${name}, ${user.id})
        returning id, name, created_at
      `) as Array<{ id: string; name: string; created_at: string }>
      const team = created[0]
      await sql`
        insert into team_members (team_id, user_id, role)
        values (${team.id}, ${user.id}, 'owner')
      `
      res.status(201).json({ team: { ...team, role: 'owner', member_count: 1 } })
      return
    }

    res.status(405).json({ error: 'Method not allowed.' })
  })
}
