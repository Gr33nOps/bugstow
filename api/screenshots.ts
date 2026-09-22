import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db'
import { teamRole } from './_lib/auth'
import { withUser, queryParam, readJsonBody } from './_lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withUser(req, res, async user => {
    if (req.method === 'GET') {
      const id = queryParam(req, 'id')
      if (!id) {
        res.status(400).json({ error: 'id is required.' })
        return
      }
      const rows = (await sql`
        select s.team_id, s.mime_type, encode(s.bytes, 'base64') as b64
        from screenshots s where s.id = ${id} limit 1
      `) as Array<{ team_id: string; mime_type: string; b64: string }>
      const row = rows[0]
      if (!row) {
        res.status(404).json({ error: 'Not found.' })
        return
      }
      if (!(await teamRole(user.id, row.team_id))) {
        res.status(403).json({ error: 'Not allowed.' })
        return
      }
      const buf = Buffer.from(row.b64, 'base64')
      res.setHeader('Content-Type', row.mime_type || 'image/png')
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.status(200).send(buf)
      return
    }

    if (req.method === 'POST') {
      const issueId = queryParam(req, 'issueId')
      if (!issueId) {
        res.status(400).json({ error: 'issueId is required.' })
        return
      }
      const issueRows = (await sql`select team_id from issues where id = ${issueId} limit 1`) as Array<{
        team_id: string
      }>
      const teamId = issueRows[0]?.team_id
      if (!teamId || !(await teamRole(user.id, teamId))) {
        res.status(403).json({ error: 'Not allowed.' })
        return
      }
      const b = readJsonBody<{ base64?: string; mimeType?: string; filename?: string }>(req)
      if (!b.base64) {
        res.status(400).json({ error: 'Image data is required.' })
        return
      }
      const rows = (await sql`
        insert into screenshots (issue_id, team_id, mime_type, filename, bytes)
        values (${issueId}, ${teamId}, ${b.mimeType || 'image/png'}, ${b.filename || null},
                decode(${b.base64}, 'base64'))
        returning id
      `) as Array<{ id: string }>
      res.status(201).json({ id: rows[0].id })
      return
    }

    if (req.method === 'DELETE') {
      const id = queryParam(req, 'id')
      if (!id) {
        res.status(400).json({ error: 'id is required.' })
        return
      }
      const rows = (await sql`select team_id from screenshots where id = ${id} limit 1`) as Array<{
        team_id: string
      }>
      const teamId = rows[0]?.team_id
      if (!teamId || !(await teamRole(user.id, teamId))) {
        res.status(403).json({ error: 'Not allowed.' })
        return
      }
      await sql`delete from screenshots where id = ${id}`
      res.status(200).json({ removed: true })
      return
    }

    res.status(405).json({ error: 'Method not allowed.' })
  })
}
