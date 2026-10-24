/**
 * HTTP-level tests: the real Express app (auth, API, security middleware) on a
 * local port, driven like a browser would. Covers the rules that only exist in
 * the HTTP layer: setup token, CSRF origin check, optimistic concurrency, team
 * role rules, upload validation, CSP and sign-in throttling.
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-http-'))
const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-public-'))
fs.writeFileSync(
  path.join(publicDir, 'index.html'),
  '<!doctype html><html><head><script>document.documentElement.dataset.t = "1"</script></head><body></body></html>'
)
const PORT = 20000 + Math.floor(Math.random() * 20000)
const BASE = `http://127.0.0.1:${PORT}`
process.env.BUGSTOW_DATA_DIR = tmp
process.env.BUGSTOW_AUTH_SECRET = 'test-secret-abcdefghijklmnop'
process.env.BUGSTOW_BASE_URL = BASE
process.env.BUGSTOW_PUBLIC_DIR = publicDir
process.env.BUGSTOW_BACKUP_ENABLED = 'false'

const { createApp } = await import('./app.ts')
const { ensureSetupToken, SETUP_TOKEN_HEADER } = await import('./setup.ts')
const app = await createApp()
const server = http.createServer(app)
await new Promise<void>(resolve => server.listen(PORT, '127.0.0.1', resolve))
assert.equal((server.address() as AddressInfo).port, PORT)
after(() => server.close())

const pw = () => randomBytes(12).toString('base64url')
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQGYR54AAAAASUVORK5CYII='

type Res = { status: number; data: any; headers: Headers } // eslint-disable-line @typescript-eslint/no-explicit-any
function client(defaultOrigin: string | null = BASE) {
  const jar: Record<string, string> = {}
  return async (p: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<Res> => {
    const headers: Record<string, string> = { ...(defaultOrigin ? { Origin: defaultOrigin } : {}), ...(opts.headers || {}) }
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
    if (cookie) headers.Cookie = cookie
    let body: string | undefined
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.body)
    }
    const res = await fetch(BASE + p, { method: opts.method || 'GET', headers, body, redirect: 'manual' })
    for (const sc of res.headers.getSetCookie()) {
      const pair = sc.split(';')[0]
      const i = pair.indexOf('=')
      if (i > 0) jar[pair.slice(0, i)] = pair.slice(i + 1)
    }
    const text = await res.text()
    let data: unknown = text
    try {
      data = JSON.parse(text)
    } catch {
      // not JSON
    }
    return { status: res.status, data, headers: res.headers }
  }
}

const A = client() // owner / server admin
const B = client() // teammate (team admin)
const C = client() // teammate (member)
const adminEmail = 'owner@lan.test'
const bobEmail = 'bob@lan.test'
const carolEmail = 'carol@lan.test'
let teamId = ''
let issueId = ''
let ownerId = ''
let carolId = ''

test('health never exposes the setup token', async () => {
  const token = ensureSetupToken()!
  const h = await A('/api/health')
  assert.equal(h.status, 200)
  assert.equal(h.data.setupComplete, false)
  assert.ok(!JSON.stringify(h.data).includes(token))
  const page = await A('/')
  assert.ok(!String(page.data).includes(token), 'not in the served page either')
})

test('creating the first administrator requires the setup token', async () => {
  const body = { email: adminEmail, password: pw(), name: 'Owner' }
  const none = await A('/api/auth/sign-up/email', { method: 'POST', body })
  assert.equal(none.status, 403)
  const wrong = await A('/api/auth/sign-up/email', { method: 'POST', body, headers: { [SETUP_TOKEN_HEADER]: 'NOPE' } })
  assert.equal(wrong.status, 403)
  const ok = await A('/api/auth/sign-up/email', {
    method: 'POST',
    body,
    headers: { [SETUP_TOKEN_HEADER]: ensureSetupToken()! },
  })
  assert.equal(ok.status, 200)
  ownerId = ok.data.user.id
  // Session cookie can't be read by page scripts or sent on cross-site requests.
  const session = ok.headers.getSetCookie().find(c => /session_token=/.test(c)) || ''
  assert.match(session, /HttpOnly/i)
  assert.match(session, /SameSite=Lax/i)
  assert.equal(ensureSetupToken(), null, 'token is gone after setup')
  assert.equal((await A('/api/health')).data.setupComplete, true)
})

test('cross-site writes are refused (CSRF origin check)', async () => {
  const evil = await A('/api/teams', { method: 'POST', body: { name: 'x' }, headers: { Origin: 'http://evil.example' } })
  assert.equal(evil.status, 403)
  const sameHostOtherPort = await A('/api/teams', {
    method: 'POST',
    body: { name: 'x' },
    headers: { Origin: `http://127.0.0.1:${PORT + 1}` },
  })
  assert.equal(sameHostOtherPort.status, 403)
  const own = await A('/api/teams', { method: 'POST', body: { name: 'LAN Team' } })
  assert.equal(own.status, 201)
  teamId = own.data.team.id
})

test('teammates join by invite', async () => {
  await A(`/api/members?teamId=${teamId}`, { method: 'POST', body: { email: bobEmail, role: 'admin' } })
  await A(`/api/members?teamId=${teamId}`, { method: 'POST', body: { email: carolEmail, role: 'member' } })
  assert.equal((await B('/api/auth/sign-up/email', { method: 'POST', body: { email: bobEmail, password: pw(), name: 'Bob' } })).status, 200)
  const c = await C('/api/auth/sign-up/email', { method: 'POST', body: { email: carolEmail, password: pw(), name: 'Carol' } })
  assert.equal(c.status, 200)
  carolId = c.data.user.id
})

test('a member cannot delete a project', async () => {
  const project = (await A(`/api/projects?teamId=${teamId}`, { method: 'POST', body: { name: 'Keep this project' } })).data.project
  assert.equal((await C(`/api/projects?id=${project.id}`, { method: 'DELETE' })).status, 403)
  assert.ok((await A(`/api/projects?teamId=${teamId}`)).data.projects.some((item: { id: string }) => item.id === project.id))
})

test('a team admin cannot remove the owner but can remove members', async () => {
  const kickOwner = await B(`/api/members?teamId=${teamId}&userId=${ownerId}`, { method: 'DELETE' })
  assert.equal(kickOwner.status, 403)
  const kickCarol = await B(`/api/members?teamId=${teamId}&userId=${carolId}`, { method: 'DELETE' })
  assert.equal(kickCarol.status, 200)
  const carolNow = await C(`/api/issues?teamId=${teamId}`)
  assert.equal(carolNow.status, 403, 'a removed member loses access immediately')
  const ghost = await A(`/api/members?teamId=${teamId}&userId=${carolId}`, { method: 'DELETE' })
  assert.equal(ghost.status, 404)
})

test('concurrent edits: a stale save gets 409 instead of overwriting', async () => {
  const created = await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Navbar overlaps' } })
  issueId = created.data.issue.id
  const v1 = created.data.issue.updated_at

  // Both teammates opened version v1. Bob saves first.
  const bobSave = await B(`/api/issues?id=${issueId}`, {
    method: 'PATCH',
    body: { description: 'Bob’s notes', expectedUpdatedAt: v1 },
  })
  assert.equal(bobSave.status, 200)
  const v2 = bobSave.data.issue.updated_at
  assert.notEqual(v2, v1)

  // The owner still has v1: refused, and told what the issue looks like now.
  const stale = await A(`/api/issues?id=${issueId}`, {
    method: 'PATCH',
    body: { description: 'Owner’s notes', expectedUpdatedAt: v1 },
  })
  assert.equal(stale.status, 409)
  assert.equal(stale.data.code, 'CONFLICT')
  assert.match(stale.data.error, /changed by another teammate/)
  assert.equal(stale.data.issue.description, 'Bob’s notes')

  // After reloading (v2) the save goes through.
  const retry = await A(`/api/issues?id=${issueId}`, {
    method: 'PATCH',
    body: { description: 'Owner’s notes', expectedUpdatedAt: v2 },
  })
  assert.equal(retry.status, 200)
  assert.equal(retry.data.issue.description, 'Owner’s notes')
})

test('every save gets a new version, even two in the same millisecond', async () => {
  const [one, two] = await Promise.all([
    A(`/api/issues?id=${issueId}`, { method: 'PATCH', body: { status: 'fixed' } }),
    B(`/api/issues?id=${issueId}`, { method: 'PATCH', body: { status: 'open' } }),
  ])
  assert.ok([one.status, two.status].every(s => s === 200))
  assert.notEqual(one.data.issue.updated_at, two.data.issue.updated_at)
})

test('an empty title is rejected on edit', async () => {
  const res = await A(`/api/issues?id=${issueId}`, { method: 'PATCH', body: { title: '   ' } })
  assert.equal(res.status, 400)
})

test('a custom issue badge is stored, returned, and can be cleared', async () => {
  const created = await A(`/api/issues?teamId=${teamId}`, {
    method: 'POST',
    body: { title: 'Slow report', type: 'idea', customType: 'Performance' },
  })
  assert.equal(created.status, 201)
  assert.equal(created.data.issue.custom_type, 'Performance')

  const updated = await A(`/api/issues?id=${created.data.issue.id}`, {
    method: 'PATCH',
    body: { customType: null },
  })
  assert.equal(updated.status, 200)
  assert.equal(updated.data.issue.custom_type, null)
})

test('uploads must really be images', async () => {
  const html = Buffer.from('<html><script>alert(1)</script></html>').toString('base64')
  const fake = await A(`/api/screenshots?issueId=${issueId}`, { method: 'POST', body: { base64: html, mimeType: 'image/png' } })
  assert.equal(fake.status, 400)
  const svg = await A(`/api/screenshots?issueId=${issueId}`, { method: 'POST', body: { base64: PNG, mimeType: 'image/svg+xml' } })
  assert.equal(svg.status, 400)
  const real = await A(`/api/screenshots?issueId=${issueId}`, {
    method: 'POST',
    body: { base64: PNG, mimeType: 'image/png', filename: 'x'.repeat(5000) },
  })
  assert.equal(real.status, 201)
  const img = await A(`/api/screenshots?id=${real.data.id}`)
  assert.equal(img.headers.get('content-type'), 'image/png')
  assert.equal(img.headers.get('x-content-type-options'), 'nosniff')
})

test('the served page has a strict CSP without inline-script allowances', async () => {
  const page = await A('/')
  const csp = page.headers.get('content-security-policy') || ''
  const scriptSrc = csp.split(';').find(d => d.trim().startsWith('script-src')) || ''
  assert.ok(!scriptSrc.includes('unsafe-inline'), scriptSrc)
  assert.match(scriptSrc, /'sha256-[A-Za-z0-9+/=]+'/)
  assert.match(csp, /connect-src 'self'(;|$)/) // team server: own origin only
  assert.match(String(page.data), /<meta name="bugstow-server" content="team" \/>/)
})

test('the certificate download is 404 when HTTPS is off', async () => {
  assert.equal((await A('/api/tls/certificate')).status, 404)
})

test('reinviting an email refreshes one invitation and uses the latest role', async () => {
  const email = 'repeat@lan.test'
  const url = `/api/members?teamId=${teamId}`
  assert.equal((await A(url, { method: 'POST', body: { email, role: 'admin' } })).status, 201)
  assert.equal((await A(url, { method: 'POST', body: { email: ' REPEAT@lan.test ', role: 'member' } })).status, 201)
  const pending = (await A(url)).data.invites.filter((i: any) => i.email === email)
  assert.equal(pending.length, 1)
  assert.equal(pending[0].role, 'member')
  const invited = client()
  const signup = await invited('/api/auth/sign-up/email', { method: 'POST', body: { email, password: pw(), name: 'Repeat' } })
  assert.equal(signup.status, 200)
  const members = (await A(url)).data.members
  assert.equal(members.find((m: any) => m.email === email).role, 'member')
})

test('invite links: no email, single use, and a username-only account signs in', async () => {
  const D = client() // someone new, opening the link
  const E = client() // someone else who got hold of the same link
  const guest = client(null)
  // Members can't make links; owners/admins can.
  assert.equal((await C(`/api/invite-links?teamId=${teamId}`, { method: 'POST', body: {} })).status, 403)
  const made = await A(`/api/invite-links?teamId=${teamId}`, { method: 'POST', body: { role: 'member' } })
  assert.equal(made.status, 201)
  const token = made.data.token as string
  assert.equal((await A(`/api/invite-links?teamId=${teamId}`)).data.links.length, 1)

  // The join page can say what it's for, without an account.
  const info = await guest(`/api/invite-links/info?token=${token}`)
  assert.equal(info.status, 200)
  assert.equal(info.data.teamName, 'LAN Team')
  assert.equal((await guest('/api/invite-links/info?token=not-a-real-token-at-all-xx')).status, 404)

  // Without the link, sign-up stays closed; with a wrong link it's refused.
  const login = 'dana@bugstow.invalid' // what the app sends for username "dana"
  const body = { email: login, password: pw(), name: 'dana' }
  assert.equal((await D('/api/auth/sign-up/email', { method: 'POST', body })).status, 403)
  assert.equal(
    (await D('/api/auth/sign-up/email', { method: 'POST', body, headers: { 'x-bugstow-invite': 'x'.repeat(32) } })).status,
    403
  )
  const joined = await D('/api/auth/sign-up/email', { method: 'POST', body, headers: { 'x-bugstow-invite': token } })
  assert.equal(joined.status, 200)
  const teams = (await D('/api/teams')).data.teams as Array<{ id: string; role: string }>
  assert.deepEqual(teams.map(t => [t.id, t.role]), [[teamId, 'member']])

  // Used up: nobody else gets in with it, and it's gone from the list.
  const again = await E('/api/auth/sign-up/email', {
    method: 'POST',
    body: { email: 'eve@bugstow.invalid', password: pw(), name: 'eve' },
    headers: { 'x-bugstow-invite': token },
  })
  assert.equal(again.status, 403)
  assert.equal((await guest(`/api/invite-links/info?token=${token}`)).status, 404)
  assert.equal((await A(`/api/invite-links?teamId=${teamId}`)).data.links.length, 0)

  // Signs in later with the same username-based login.
  const F = client()
  const signIn = await F('/api/auth/sign-in/email', { method: 'POST', body: { email: login, password: body.password } })
  assert.equal(signIn.status, 200)

  // An existing account opening a new link joins that team.
  const other = await A('/api/teams', { method: 'POST', body: { name: 'Second' } })
  const link2 = (await A(`/api/invite-links?teamId=${other.data.team.id}`, { method: 'POST', body: { role: 'admin' } })).data.token
  assert.equal((await D('/api/invite-links/accept', { method: 'POST', body: { token: link2 } })).status, 200)
  assert.equal((await D('/api/invite-links/accept', { method: 'POST', body: { token: link2 } })).status, 404)
  const roles = ((await D('/api/teams')).data.teams as Array<{ id: string; role: string }>).find(t => t.id === other.data.team.id)
  assert.equal(roles?.role, 'admin')

  // A link can be cancelled before it's used.
  const link3 = await A(`/api/invite-links?teamId=${teamId}`, { method: 'POST', body: {} })
  await A(`/api/invite-links?teamId=${teamId}&id=${link3.data.link.id}`, { method: 'DELETE' })
  assert.equal((await guest(`/api/invite-links/info?token=${link3.data.token}`)).status, 404)
})


test('repeated failed sign-ins are throttled', async () => {
  const guesser = client()
  let throttled = false
  for (let i = 0; i < 12 && !throttled; i++) {
    const r = await guesser('/api/auth/sign-in/email', { method: 'POST', body: { email: adminEmail, password: pw() } })
    if (r.status === 429) throttled = true
  }
  assert.ok(throttled, 'password guessing hits the limit')
})

// ── GitHub import, against a stand-in for api.github.com ────────────────────
type FakeIssue = { number: number; title: string; state: 'open' | 'closed'; pull_request?: object; labels?: object[] }
const fakeRepos: Record<string, { private?: boolean; issues: FakeIssue[] }> = {
  'acme/web': {
    issues: [
      { number: 2, title: 'Checkout overlaps footer', state: 'open', labels: [{ name: 'design' }] },
      { number: 1, title: 'Login fails', state: 'open' },
      { number: 3, title: 'A pull request', state: 'open', pull_request: {} },
    ],
  },
  'acme/api': { issues: [{ number: 1, title: 'Timeout on /orders', state: 'open' }] },
  'acme/secret': { private: true, issues: [{ number: 7, title: 'Private bug', state: 'open' }] },
}
const realFetch = globalThis.fetch
function withFakeGithub() {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    if (url.hostname !== 'api.github.com') return realFetch(input, init)
    const auth = new Headers(init?.headers).get('authorization')
    const m = /^\/repos\/([^/]+\/[^/]+)\/issues$/.exec(url.pathname)
    const repo = m ? fakeRepos[m[1]] : undefined
    if (auth && auth !== 'Bearer good-key') return new Response('{}', { status: 401 })
    if (!repo || (repo.private && !auth)) return new Response('{}', { status: 404 })
    const state = url.searchParams.get('state')
    const list = repo.issues
      .filter(i => state === 'all' || i.state === 'open')
      .map(i => ({ ...i, body: '', html_url: `https://github.com/${m![1]}/issues/${i.number}` }))
    return Response.json(url.searchParams.get('page') === '1' ? list : [])
  }) as typeof fetch
}
const imp = (body: Record<string, unknown>) => A('/api/github-import', { method: 'POST', body: { teamId, ...body } })

test('GitHub import: a team server with internet features off says so', async () => {
  const { config } = await import('./config.ts')
  assert.equal(config.offline, true, 'team servers default to offline')
  const r = await imp({ repo: 'acme/web' })
  assert.equal(r.status, 403)
  assert.equal(r.data.code, 'OFFLINE')
  config.offline = false
  withFakeGithub()
})

test('GitHub import: a public repository imports into a new project, pull requests left out', async () => {
  const r = await imp({ repo: 'https://github.com/acme/web', newProjectName: 'web' })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.equal(r.data.imported, 2)
  assert.ok(r.data.projectId)
  const projects = (await A(`/api/projects?teamId=${teamId}`)).data.projects as Array<{ id: string; name: string }>
  assert.ok(projects.some(p => p.id === r.data.projectId && p.name === 'web'))
  const issues = (await A(`/api/issues?teamId=${teamId}`)).data.issues as Array<{ title: string; type: string; github_url: string }>
  assert.equal(issues.find(i => i.title === 'Checkout overlaps footer')?.type, 'uiux', 'labels pick the type')
  assert.ok(!issues.some(i => i.title === 'A pull request'))
})

test('GitHub import: importing again adds nothing new and follows GitHub open/closed', async () => {
  const again = await imp({ repo: 'acme/web' })
  assert.deepEqual([again.data.imported, again.data.updated, again.data.unchanged], [0, 0, 2])
  fakeRepos['acme/web'].issues[1].state = 'closed'
  const closed = await imp({ repo: 'acme/web', includeClosed: true })
  assert.deepEqual([closed.data.imported, closed.data.updated], [0, 1])
  const issues = (await A(`/api/issues?teamId=${teamId}`)).data.issues as Array<{ id: string; title: string; status: string }>
  assert.equal(issues.find(i => i.title === 'Login fails')?.status, 'fixed')
  const localWork = issues.find(i => i.title === 'Checkout overlaps footer')!
  assert.equal((await A(`/api/issues?id=${localWork.id}`, { method: 'PATCH', body: { status: 'in_progress' } })).status, 200)
  assert.equal((await imp({ repo: 'acme/web' })).data.updated, 0, 'open GitHub issue keeps local progress')
  assert.equal((await A(`/api/issues?teamId=${teamId}`)).data.issues.find((i: { id: string }) => i.id === localWork.id).status, 'in_progress')
  fakeRepos['acme/web'].issues[1].state = 'open'
  assert.equal((await imp({ repo: 'acme/web' })).data.updated, 1, 'reopened GitHub issue becomes Open')
  assert.equal((await A(`/api/issues?teamId=${teamId}`)).data.issues.find((i: { title: string }) => i.title === 'Login fails').status, 'open')
})

test('GitHub import: another repository with the same issue numbers is not skipped', async () => {
  const r = await imp({ repo: 'acme/api' })
  assert.equal(r.data.imported, 1, 'acme/api #1 is a different issue from acme/web #1')
})

test('GitHub import: a private repository asks for a key, and a failed import leaves no project', async () => {
  const before = (await A(`/api/projects?teamId=${teamId}`)).data.projects.length
  const noKey = await imp({ repo: 'acme/secret', newProjectName: 'secret' })
  assert.equal(noKey.status, 400)
  assert.equal(noKey.data.code, 'NEEDS_TOKEN')
  const badKey = await imp({ repo: 'acme/secret', token: 'wrong' })
  assert.equal(badKey.data.code, 'BAD_TOKEN')
  assert.equal((await A(`/api/projects?teamId=${teamId}`)).data.projects.length, before)
  const ok = await imp({ repo: 'acme/secret', token: 'good-key', newProjectName: 'secret' })
  assert.equal(ok.data.imported, 1)
  globalThis.fetch = realFetch
})

// ── Moving a project to another workspace ───────────────────────────────────
test('moving a project: only owners/admins, into a workspace you are in; issues follow, outside assignees are cleared', async () => {
  const priv = await A('/api/teams', { method: 'POST', body: { name: 'Private' } })
  assert.equal(priv.status, 201)
  const privId = priv.data.team.id as string
  const projects = (await A(`/api/projects?teamId=${teamId}`)).data.projects as Array<{ id: string; name: string }>
  const web = projects.find(p => p.name === 'web')!
  const bobId = (await B('/api/me')).data.id as string

  // Assign one of its issues to Bob, who is not in the private workspace.
  const webIssues = ((await A(`/api/issues?teamId=${teamId}`)).data.issues as Array<{ id: string; project_id: string }>).filter(
    i => i.project_id === web.id
  )
  assert.ok(webIssues.length > 0)
  const assign = await A(`/api/issues?id=${webIssues[0].id}`, { method: 'PATCH', body: { assigneeId: bobId } })
  assert.equal(assign.status, 200)

  // Bob is an admin of the team but not a member of "Private".
  const bobMove = await B('/api/projects/move', { method: 'POST', body: { projectId: web.id, toTeamId: privId } })
  assert.equal(bobMove.status, 403)
  // Carol was removed from the team.
  const carolMove = await C('/api/projects/move', { method: 'POST', body: { projectId: web.id, toTeamId: privId } })
  assert.equal(carolMove.status, 404)

  const move = await A('/api/projects/move', { method: 'POST', body: { projectId: web.id, toTeamId: privId } })
  assert.equal(move.status, 200, JSON.stringify(move.data))
  assert.equal(move.data.moved, webIssues.length)

  const teamNow = (await A(`/api/issues?teamId=${teamId}`)).data.issues as Array<{ project_id: string }>
  assert.ok(!teamNow.some(i => i.project_id === web.id), 'gone from the shared workspace')
  const privIssues = (await A(`/api/issues?teamId=${privId}`)).data.issues as Array<{ id: string; assignee_id: string | null }>
  assert.equal(privIssues.length, webIssues.length)
  assert.equal(privIssues.find(i => i.id === webIssues[0].id)?.assignee_id, null, 'Bob is not in Private')
  // Bob can no longer see them.
  assert.equal((await B(`/api/issues?teamId=${privId}`)).status, 403)
  const privProjects = (await A(`/api/projects?teamId=${privId}`)).data.projects as Array<{ id: string }>
  assert.ok(privProjects.some(p => p.id === web.id))
})

test('moving a project refuses to create a second copy of a GitHub issue', async () => {
  withFakeGithub()
  // Import acme/web into the shared workspace again: its issues now live in Private.
  const again = await imp({ repo: 'acme/web', includeClosed: true, newProjectName: 'web-again' })
  assert.equal(again.status, 200, JSON.stringify(again.data))
  const priv = ((await A('/api/teams')).data.teams as Array<{ id: string; name: string }>).find(t => t.name === 'Private')!
  const web = ((await A(`/api/projects?teamId=${priv.id}`)).data.projects as Array<{ id: string; name: string }>).find(
    p => p.name === 'web'
  )!
  const back = await A('/api/projects/move', { method: 'POST', body: { projectId: web.id, toTeamId: teamId } })
  assert.equal(back.status, 409)
  assert.equal(back.data.code, 'GITHUB_DUPLICATE')
  globalThis.fetch = realFetch
})

test('copying Local issues in keeps completed status and GitHub links, and never copies a GitHub issue twice', async () => {
  const url = 'https://github.com/acme/web/issues/77'
  const first = await A(`/api/issues?teamId=${teamId}`, {
    method: 'POST',
    body: { title: 'Copied from Local', status: 'fixed', githubUrl: url, githubNumber: 77 },
  })
  assert.equal(first.status, 201)
  assert.equal(first.data.issue.status, 'fixed')
  assert.equal(first.data.issue.github_url, url)
  assert.equal(first.data.issue.github_number, 77)

  const again = await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Copied again', githubUrl: url } })
  assert.equal(again.status, 200)
  assert.equal(again.data.existing, true)
  assert.equal(again.data.issue.id, first.data.issue.id)

  // Not a GitHub issue address: ignored, and an unknown status means open.
  const odd = await A(`/api/issues?teamId=${teamId}`, {
    method: 'POST',
    body: { title: 'Odd fields', status: 'deleted', githubUrl: 'javascript:alert(1)' },
  })
  assert.equal(odd.status, 201)
  assert.equal(odd.data.issue.status, 'open')
  assert.equal(odd.data.issue.github_url, null)
})


test('GitHub export enforces membership and offline mode, saves links and skips repeat exports', async () => {
  const { config } = await import('./config.ts')
  const created = await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Export me', description: 'Details', status: 'fixed' } })
  const id = created.data.issue.id
  const body = { teamId, repo: 'acme/export', token: 'write-key', issueIds: [id] }
  config.offline = true
  assert.equal((await A('/api/github-export', { method: 'POST', body })).status, 403)
  config.offline = false
  assert.equal((await C('/api/github-export', { method: 'POST', body })).status, 403)
  assert.equal((await A('/api/github-export', { method: 'POST', body: { ...body, issueIds: ['missing'] } })).status, 400)
  const trashed = (await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Do not export from Trash' } })).data.issue.id
  await A(`/api/issues?id=${trashed}`, { method: 'DELETE' })
  assert.equal((await A('/api/github-export', { method: 'POST', body: { ...body, issueIds: [trashed] } })).status, 400)
  let creates = 0
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (!String(input).startsWith('https://api.github.com/')) return realFetch(input, init)
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer write-key')
    if (init?.method === 'POST') creates++
    return new Response(JSON.stringify({ number: 23, html_url: 'https://github.com/acme/export/issues/23' }), { status: 201 })
  }) as typeof fetch
  try {
    const first = await A('/api/github-export', { method: 'POST', body })
    assert.equal(first.status, 200)
    assert.equal(first.data.exported, 1)
    const again = await A('/api/github-export', { method: 'POST', body })
    assert.equal(again.data.skipped, 1)
    assert.equal(creates, 1)
    const issues = (await A(`/api/issues?teamId=${teamId}`)).data.issues
    assert.equal(issues.find((i: any) => i.id === id).github_url, 'https://github.com/acme/export/issues/23')
  } finally { globalThis.fetch = realFetch }
})

test('issue report metadata survives Team create, edit, and read; old defaults are Medium', async () => {
  const plain = await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Plain report' } })
  assert.equal(plain.status, 201)
  assert.equal(plain.data.issue.priority, 'medium')
  const created = await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: {
    title: 'Bug report', status: 'in_progress', priority: 'high', severity: 'major',
    details: { stepsToReproduce: 'Open settings', actualBehavior: 'Crash' },
  } })
  assert.equal(created.status, 201, JSON.stringify(created.data))
  assert.equal(created.data.issue.status, 'in_progress')
  const updated = await A(`/api/issues?id=${created.data.issue.id}`, { method: 'PATCH', body: { status: 'blocked', priority: 'critical', expectedUpdatedAt: created.data.issue.updated_at } })
  assert.equal(updated.status, 200, JSON.stringify(updated.data))
  const loaded = (await A(`/api/issues?teamId=${teamId}`)).data.issues.find((i: any) => i.id === created.data.issue.id)
  assert.equal(loaded.status, 'blocked')
  assert.equal(loaded.priority, 'critical')
  assert.equal(loaded.details.stepsToReproduce, 'Open settings')
  const rejected = await A(`/api/issues?id=${created.data.issue.id}`, { method: 'PATCH', body: { priority: 'impossible' } })
  assert.equal(rejected.status, 400)
})

test('Trash keeps screenshots and metadata until an explicit permanent delete', async () => {
  const made = await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Recover me', priority: 'high' } })
  const id = made.data.issue.id
  assert.equal((await A(`/api/issues?id=${id}`, { method: 'DELETE' })).status, 200)
  assert.ok(!(await A(`/api/issues?teamId=${teamId}`)).data.issues.some((i: { id: string }) => i.id === id))
  const trash = await A(`/api/issues/trash?teamId=${teamId}`)
  assert.equal(trash.data.issues.find((i: { id: string }) => i.id === id).priority, 'high')
  assert.equal((await A(`/api/issues/restore?id=${id}`, { method: 'POST' })).status, 200)
  assert.ok((await A(`/api/issues?teamId=${teamId}`)).data.issues.some((i: { id: string }) => i.id === id))
  await A(`/api/issues?id=${id}`, { method: 'DELETE' })
  assert.equal((await A(`/api/issues/purge?id=${id}`, { method: 'DELETE', body: { confirm: true } })).status, 200)
  assert.ok(!(await A(`/api/issues/trash?teamId=${teamId}`)).data.issues.some((i: { id: string }) => i.id === id))
})

test('Team comments and activity are visible only to workspace members', async () => {
  const made = await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Discuss me' } })
  const id = made.data.issue.id
  const posted = await A(`/api/issues/comments?id=${id}`, { method: 'POST', body: { body: 'Investigating now' } })
  assert.equal(posted.status, 201)
  await A(`/api/issues?id=${id}`, { method: 'PATCH', body: { status: 'blocked', priority: 'high' } })
  const timeline = await A(`/api/issues/activity?id=${id}`)
  assert.ok(timeline.data.events.some((event: { body: string }) => event.body === 'Investigating now'))
  assert.ok(timeline.data.events.some((event: { kind: string }) => event.kind === 'status'))
  assert.equal((await C(`/api/issues/activity?id=${id}`)).status, 403)
  assert.equal((await C(`/api/issues/comments?id=${id}`, { method: 'POST', body: { body: 'No access' } })).status, 403)
  assert.equal((await B(`/api/issues/comments?id=${id}&commentId=${posted.data.comment.id}`, { method: 'DELETE' })).status, 403)
})

test('bulk changes are atomic and reject issues outside the workspace', async () => {
  const a = (await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Bulk A' } })).data.issue.id
  const b = (await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Bulk B' } })).data.issue.id
  assert.equal((await A('/api/issues/bulk', { method: 'POST', body: { teamId, ids: [a, b], changes: { priority: 'critical', status: 'in_progress' } } })).status, 200)
  const list = (await A(`/api/issues?teamId=${teamId}`)).data.issues
  assert.ok(list.filter((i: { id: string; priority: string; status: string }) => [a, b].includes(i.id)).every((i: { priority: string; status: string }) => i.priority === 'critical' && i.status === 'in_progress'))
  assert.equal((await A('/api/issues/bulk', { method: 'POST', body: { teamId, ids: [a, 'not-in-team'], changes: { status: 'fixed' } } })).status, 400)
  assert.equal((await A('/api/issues/bulk', { method: 'POST', body: { teamId, ids: [a], changes: { projectId: false } } })).status, 400)
  assert.equal((await A(`/api/issues?teamId=${teamId}`)).data.issues.find((i: { id: string }) => i.id === a).status, 'in_progress')
})

test('an exact Team issue link requires membership and hides trashed issues', async () => {
  const id = (await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Link target' } })).data.issue.id
  assert.equal((await A(`/api/issues/link?id=${id}`)).data.issue.id, id)
  assert.equal((await C(`/api/issues/link?id=${id}`)).status, 403)
  await A(`/api/issues?id=${id}`, { method: 'DELETE' })
  assert.equal((await A(`/api/issues/link?id=${id}`)).status, 404)
})

test('GitHub fix references are validated and saved with Team issues', async () => {
  const made = await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Linked fix' } })
  const id = made.data.issue.id
  const link = 'https://github.com/acme/app/pull/12'
  const saved = await A(`/api/issues?id=${id}`, { method: 'PATCH', body: { fixReferences: [link] } })
  assert.equal(saved.status, 200)
  assert.deepEqual(saved.data.issue.fix_references, [link])
  const rejected = await A(`/api/issues?id=${id}`, { method: 'PATCH', body: { fixReferences: ['https://github.com.evil.test/acme/app'] } })
  assert.equal(rejected.status, 400)
  assert.equal((await A(`/api/issues?id=${id}`, { method: 'PATCH', body: { fixReferences: ['https://github.com/../app'] } })).status, 400)
  assert.deepEqual((await A(`/api/issues/link?id=${id}`)).data.issue.fix_references, [link])
})

test('deleting a Team project leaves its issues recoverable as unassigned', async () => {
  const project = (await A(`/api/projects?teamId=${teamId}`, { method: 'POST', body: { name: 'Temporary project' } })).data.project
  const issue = (await A(`/api/issues?teamId=${teamId}`, { method: 'POST', body: { title: 'Keep me', projectId: project.id } })).data.issue
  assert.equal((await A(`/api/projects?id=${project.id}`, { method: 'DELETE' })).status, 200)
  const stored = (await A(`/api/issues?teamId=${teamId}`)).data.issues.find((item: { id: string }) => item.id === issue.id)
  assert.equal(stored.project_id, null)
  assert.equal(stored.title, 'Keep me')
})
