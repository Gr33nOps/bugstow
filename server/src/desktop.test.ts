/**
 * Desktop edition (the one-command local install): the page is marked as the
 * desktop app, health reports the edition, and requests addressed to any other
 * host name (DNS rebinding) are refused.
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-desktop-'))
const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-desktop-public-'))
fs.writeFileSync(path.join(publicDir, 'index.html'), '<!doctype html><html><head></head><body></body></html>')
const PORT = 20000 + Math.floor(Math.random() * 20000)
process.env.PORT = String(PORT)
process.env.BUGSTOW_DATA_DIR = tmp
process.env.BUGSTOW_AUTH_SECRET = 'test-secret-abcdefghijklmnop'
process.env.BUGSTOW_BASE_URL = `http://localhost:${PORT}`
process.env.BUGSTOW_PUBLIC_DIR = publicDir
process.env.BUGSTOW_BACKUP_ENABLED = 'false'
process.env.BUGSTOW_DESKTOP = 'true'
// Shared through Tailscale (bugstow share).
process.env.BUGSTOW_SHARE_URL = 'https://my-pc.tail1234.ts.net:5757'
// Left over from 2.5: must not reach the page any more.
process.env.BUGSTOW_GOOGLE_CLIENT_ID = '123-abc.apps.googleusercontent.com'

const { createApp } = await import('./app.ts')
const { config } = await import('./config.ts')
const app = await createApp()
const server = http.createServer(app)
await new Promise<void>(resolve => server.listen(PORT, '127.0.0.1', resolve))
after(() => server.close())

function get(p: string, host: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, headers: { Host: host, ...headers } }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', c => (body += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

test('page and health identify the desktop edition', async () => {
  const page = await get('/', `localhost:${PORT}`)
  assert.equal(page.status, 200)
  assert.match(page.body, /<meta name="bugstow-edition" content="desktop" \/>/)
  assert.match(page.body, /<meta name="bugstow-server" content="team" \/>/)
  const health = await get('/api/health', `127.0.0.1:${PORT}`)
  assert.equal(health.status, 200)
  assert.equal(JSON.parse(health.body).edition, 'desktop')
  // One person's own computer: GitHub import works without any setup.
  assert.equal(JSON.parse(health.body).offline, false)
})

test('requests for other host names are refused (DNS rebinding)', async () => {
  for (const host of [`evil.example:${PORT}`, 'evil.example', `192.168.1.20:${PORT}`]) {
    const res = await get('/api/health', host)
    assert.equal(res.status, 421, host)
  }
  assert.equal((await get('/', `[::1]:${PORT}`)).status, 200)
})

test('the page may reach only itself and api.github.com (GitHub import); no cloud hosts', async () => {
  const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/', headers: { Host: `localhost:${PORT}` } }, resolve).on('error', reject)
  })
  res.resume()
  const csp = String(res.headers['content-security-policy'])
  const connect = csp.split(';').map(d => d.trim()).find(d => d.startsWith('connect-src'))
  assert.equal(connect, "connect-src 'self' https://api.github.com")
})

test('no cloud sign-in IDs are handed to the page', async () => {
  const page = await get('/', `localhost:${PORT}`)
  assert.doesNotMatch(page.body, /bugstow-google-client-id|bugstow-dropbox-app-key|googleusercontent/)
})

test('127.0.0.1 is a trusted origin as well as localhost', () => {
  assert.ok(config.trustedOrigins.includes(`http://127.0.0.1:${PORT}`))
})

function post(p: string, host: string, origin: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: p,
        method: 'POST',
        headers: { Host: host, Origin: origin, 'Content-Type': 'application/json' },
      },
      res => {
        res.resume()
        res.on('end', () => resolve(res.statusCode ?? 0))
      }
    )
    req.on('error', reject)
    req.end('{"name":"x"}')
  })
}

test('shared through Tailscale: its ts.net address is answered and trusted, other names are not', async () => {
  assert.equal(config.shareUrl, 'https://my-pc.tail1234.ts.net:5757')
  assert.equal((await get('/api/health', 'my-pc.tail1234.ts.net:5757')).status, 200)
  assert.equal((await get('/api/health', 'other-pc.tail1234.ts.net')).status, 421)
  // A write from the shared address passes the cross-site check (then needs sign-in: 401)...
  assert.equal(await post('/api/teams', 'my-pc.tail1234.ts.net:5757', 'https://my-pc.tail1234.ts.net:5757'), 401)
  // ...one from any other site is refused before that.
  assert.equal(await post('/api/teams', 'my-pc.tail1234.ts.net', 'https://evil.tail1234.ts.net'), 403)
})
