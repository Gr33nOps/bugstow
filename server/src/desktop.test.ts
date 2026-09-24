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
process.env.BUGSTOW_GOOGLE_CLIENT_ID = '123-abc.apps.googleusercontent.com'
process.env.BUGSTOW_DROPBOX_APP_KEY = '"><script>alert(1)</script>'

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

test('the page may reach https: hosts (Personal sync to your own cloud)', async () => {
  const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/', headers: { Host: `localhost:${PORT}` } }, resolve).on('error', reject)
  })
  res.resume()
  const csp = String(res.headers['content-security-policy'])
  assert.match(csp, /connect-src 'self' https:/)
})

test('sync app IDs from the environment reach the page; malformed ones are ignored', async () => {
  const page = await get('/', `localhost:${PORT}`)
  assert.match(page.body, /<meta name="bugstow-google-client-id" content="123-abc\.apps\.googleusercontent\.com" \/>/)
  assert.doesNotMatch(page.body, /bugstow-dropbox-app-key|<script>alert/)
})

test('127.0.0.1 is a trusted origin as well as localhost', () => {
  assert.ok(config.trustedOrigins.includes(`http://127.0.0.1:${PORT}`))
})
