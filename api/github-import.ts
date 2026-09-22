import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sql } from './_lib/db.js'
import { teamRole } from './_lib/auth.js'
import { withUser, readJsonBody } from './_lib/http.js'

interface GhLabel {
  name?: string
}
interface GhIssue {
  number: number
  title: string
  body: string | null
  state: string
  html_url: string
  labels: Array<GhLabel | string>
  pull_request?: unknown
}

/** Map GitHub labels to a Bugstow issue type. */
function mapType(labels: Array<GhLabel | string>): 'bug' | 'uiux' | 'idea' {
  const names = labels.map(l => (typeof l === 'string' ? l : l.name || '').toLowerCase())
  if (names.some(n => /(ui|ux|design|css|layout|visual)/.test(n))) return 'uiux'
  if (names.some(n => /(feature|enhancement|idea|proposal|request)/.test(n))) return 'idea'
  return 'bug'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await withUser(req, res, async user => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed.' })
      return
    }
    const b = readJsonBody<{
      teamId?: string
      projectId?: string | null
      repo?: string
      token?: string
      includeClosed?: boolean
    }>(req)

    const teamId = b.teamId
    if (!teamId || !(await teamRole(user.id, teamId))) {
      res.status(403).json({ error: 'Not a member of this team.' })
      return
    }
    const repo = (b.repo || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '')
    if (!/^[^/]+\/[^/]+$/.test(repo)) {
      res.status(400).json({ error: 'Repo must be in the form "owner/name".' })
      return
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'bugstow-import',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (b.token && b.token.trim()) headers.Authorization = `Bearer ${b.token.trim()}`

    const state = b.includeClosed === false ? 'open' : 'all'
    let imported = 0
    let skipped = 0

    try {
      // Paginate up to 5 pages (500 issues) to stay within the function timeout.
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

        for (const gh of batch) {
          if (gh.pull_request) continue // skip PRs
          const type = mapType(gh.labels || [])
          const status = gh.state === 'closed' ? 'fixed' : 'open'
          const inserted = (await sql`
            insert into issues (team_id, project_id, title, description, type, status, created_by,
                                github_url, github_number)
            values (${teamId}, ${b.projectId || null}, ${gh.title || `#${gh.number}`},
                    ${gh.body || ''}, ${type}, ${status}, ${user.id}, ${gh.html_url}, ${gh.number})
            on conflict (team_id, github_number) where github_number is not null do nothing
            returning id
          `) as unknown[]
          if (inserted.length > 0) imported++
          else skipped++
        }
        if (batch.length < 100) break
      }
    } catch (err) {
      console.error('GitHub import failed:', err)
      res.status(502).json({ error: 'Could not reach GitHub.' })
      return
    }

    res.status(200).json({ imported, skipped })
  })
}
