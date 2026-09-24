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
  const issues = (await A(`/api/issues?teamId=${teamId}`)).data.issues as Array<{ title: string; status: string }>
  assert.equal(issues.find(i => i.title === 'Login fails')?.status, 'fixed')
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
