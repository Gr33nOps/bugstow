import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db'
import { teamRole } from './_lib/auth'
import { withUser, queryParam, readJsonBody } from './_lib/http'

function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withUser(req, res, async user => {
    const teamId = queryParam(req, 'teamId')
    if (!teamId) {
      res.status(400).json({ error: 'teamId is required.' })
      return
    }
    const role = await teamRole(user.id, teamId)
    if (!role) {
      res.status(403).json({ error: 'Not a member of this team.' })
      return
    }

    if (req.method === 'GET') {
      const members = await sql`
        select tm.user_id, tm.role, u.name, u.email
        from team_members tm
        left join neon_auth.users_sync u on u.id = tm.user_id
        where tm.team_id = ${teamId}
        order by tm.role, u.email
      `
      const invites = await sql`
        select id, email, role, created_at
        from team_invites
        where team_id = ${teamId} and accepted_at is null
        order by created_at desc
      `
      res.status(200).json({ members, invites })
      return
    }

    if (req.method === 'POST') {
      if (role !== 'owner' && role !== 'admin') {
        res.status(403).json({ error: 'Only owners and admins can invite members.' })
        return
      }
      const body = readJsonBody<{ email?: string; role?: string }>(req)
      const email = (body.email || '').trim().toLowerCase()
      const inviteRole = body.role === 'admin' ? 'admin' : 'member'
      if (!email || !email.includes('@')) {
        res.status(400).json({ error: 'A valid email is required.' })
        return
      }

      // If the email already belongs to a known account, add them directly.
      const existing = (await sql`
        select id from neon_auth.users_sync
        where lower(email) = ${email} and deleted_at is null
        limit 1
      `) as Array<{ id: string }>

      if (existing[0]) {
        await sql`
          insert into team_members (team_id, user_id, role)
          values (${teamId}, ${existing[0].id}, ${inviteRole})
          on conflict (team_id, user_id) do nothing
        `
        res.status(200).json({ added: true })
        return
      }

      await sql`
        insert into team_invites (team_id, email, role, token, invited_by)
        values (${teamId}, ${email}, ${inviteRole}, ${randomToken()}, ${user.id})
      `
      res.status(201).json({ invited: true })
      return
    }

    if (req.method === 'DELETE') {
      const targetUserId = queryParam(req, 'userId')
      const inviteId = queryParam(req, 'inviteId')

      if (inviteId) {
        if (role !== 'owner' && role !== 'admin') {
          res.status(403).json({ error: 'Only owners and admins can cancel invites.' })
          return
        }
        await sql`delete from team_invites where id = ${inviteId} and team_id = ${teamId}`
        res.status(200).json({ removed: true })
        return
      }

      if (!targetUserId) {
        res.status(400).json({ error: 'userId or inviteId is required.' })
        return
      }
      // Members can remove themselves (leave); owners/admins can remove others.
      if (targetUserId !== user.id && role !== 'owner' && role !== 'admin') {
        res.status(403).json({ error: 'Only owners and admins can remove members.' })
        return
      }
      // Never remove the last owner.
      const owners = (await sql`
        select count(*)::int as n from team_members where team_id = ${teamId} and role = 'owner'
      `) as Array<{ n: number }>
      const targetRole = await teamRole(targetUserId, teamId)
      if (targetRole === 'owner' && owners[0].n <= 1) {
        res.status(400).json({ error: 'Cannot remove the last owner of a team.' })
        return
      }
      await sql`delete from team_members where team_id = ${teamId} and user_id = ${targetUserId}`
      res.status(200).json({ removed: true })
      return
    }

    res.status(405).json({ error: 'Method not allowed.' })
  })
}
