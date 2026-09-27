import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import http from 'node:http'
import { createHash } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { closeDB, resetDBConnection, getDB } from '../storage/db'
import { IndexedDbIssueRepository } from '../repositories/indexedDbRepositories'
import { syncStore } from '../sync/store'
import { prepareKey, syncOnce } from '../sync/engine'
import { WebDavProvider, normalizeWebDavUrl } from '../sync/providers/webdav'
import { DropboxProvider } from '../sync/providers/dropbox'
import { GoogleDriveProvider } from '../sync/providers/googleDrive'
import { ReconnectNeededError, RemoteChangedError, EMPTY_BASE } from '../sync/types'

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQGYR54AAAAASUVORK5CYII='), c => c.charCodeAt(0))
const enc = (s: string) => new TextEncoder().encode(s)

// ── A small but real WebDAV server (what Nextcloud & co. speak) ──────────────
const files = new Map<string, Buffer>()
const etag = (b: Buffer) => `"${createHash('sha1').update(b).digest('hex')}"`
let server: http.Server
let base = ''
const AUTH = 'Basic ' + Buffer.from('alice:app-password').toString('base64')

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      if (req.headers.authorization !== AUTH) return res.writeHead(401).end()
      const path = decodeURIComponent(new URL(req.url!, 'http://x').pathname).replace(/^\/dav\//, '')
      const cur = files.get(path)
      switch (req.method) {
        case 'GET':
          if (!cur) return res.writeHead(404).end()
          return res.writeHead(200, { ETag: etag(cur) }).end(cur)
        case 'PUT': {
          if (req.headers['if-none-match'] === '*' && cur) return res.writeHead(412).end()
          if (req.headers['if-match'] && (!cur || etag(cur) !== req.headers['if-match'])) return res.writeHead(412).end()
          const body = Buffer.concat(chunks)
          files.set(path, body)
          return res.writeHead(cur ? 204 : 201, { ETag: etag(body) }).end()
        }
        case 'DELETE':
          return res.writeHead(files.delete(path) ? 204 : 404).end()
        case 'MKCOL':
          return res.writeHead(201).end()
        case 'PROPFIND': {
          if (path === '') return res.writeHead(207).end('<d:multistatus xmlns:d="DAV:"/>')
          const items = [...files.keys()].filter(k => k.startsWith(path) && k !== path)
          const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/${path}</d:href></d:response>${items
            .map(k => `<d:response><d:href>/dav/${encodeURIComponent(k).replace(/%2F/g, '/')}</d:href></d:response>`)
            .join('')}</d:multistatus>`
          return res.writeHead(207, { 'Content-Type': 'application/xml' }).end(xml)
        }
        default:
          return res.writeHead(405).end()
      }
    })
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/dav/`
})
afterAll(() => server.close())

const factories = { A: new IDBFactory(), B: new IDBFactory() }
async function onDevice(d: 'A' | 'B') {
  await closeDB()
  await syncStore._close()
  ;(globalThis as { indexedDB: IDBFactory }).indexedDB = factories[d]
  resetDBConnection()
}

describe('WebDAV provider against a real WebDAV server', () => {
  beforeEach(() => files.clear())

  it('only accepts https (or localhost) addresses', () => {
    expect(() => normalizeWebDavUrl('http://192.168.1.5/remote.php/dav')).toThrow(/https/)
    expect(normalizeWebDavUrl('https://cloud.example.com/remote.php/dav/files/alice/BugsTow')).toMatch(/BugsTow\/$/)
  })

  it('reports a wrong app password as "reconnect"', async () => {
    const dav = new WebDavProvider({ url: base, username: 'alice', password: 'wrong' })
    await expect(dav.test()).rejects.toThrow(ReconnectNeededError)
  })

  it('uses ETags to detect a concurrent write', async () => {
    const dav = new WebDavProvider({ url: base, username: 'alice', password: 'app-password' })
    const rev = await dav.put('bugstow-index.json', enc('v1'), null)
    await expect(dav.put('bugstow-index.json', enc('x'), null)).rejects.toThrow(RemoteChangedError)
    await dav.put('bugstow-index.json', enc('v2'), rev)
    await expect(dav.put('bugstow-index.json', enc('v3'), rev)).rejects.toThrow(RemoteChangedError)
  })

  it('syncs two devices end to end, and the server only holds ciphertext', async () => {
    const dav = () => new WebDavProvider({ url: base, username: 'alice', password: 'app-password' })
    factories.A = new IDBFactory()
    factories.B = new IDBFactory()
    const repo = new IndexedDbIssueRepository()

    await onDevice('A')
    await repo.create({ title: 'Checkout button hidden', description: 'Safari only', projectId: null, type: 'uiux', status: 'open' }, new Blob([PNG], { type: 'image/png' }))
    const keyA = await prepareKey(dav(), 'shared passphrase for test')
    const a = await syncOnce(dav(), keyA, EMPTY_BASE)
    expect(a.result.uploaded).toBe(2)
    expect([...files.keys()].some(k => k.startsWith('shots/'))).toBe(true)
    for (const body of files.values()) expect(body.toString('latin1')).not.toContain('Checkout button')

    await onDevice('B')
    const keyB = await prepareKey(dav(), 'shared passphrase for test')
    await syncOnce(dav(), keyB, EMPTY_BASE)
    const [issue] = await (await getDB()).getAll('issues')
    expect(issue.title).toBe('Checkout button hidden')
    const shot = await (await getDB()).get('screenshots', issue.screenshotId!)
    expect(new Uint8Array(await shot!.blob.arrayBuffer())).toEqual(PNG)
  })
})

// ── Dropbox & Google Drive: contract tests against their documented APIs ────
// (A live test needs the OAuth apps; see docs/CLOUD_SYNC.md.)

function fakeFetch(handler: (url: string, init: RequestInit) => Promise<Response> | Response) {
  return vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => handler(String(input), init))
}

describe('Dropbox provider (API contract)', () => {
  const store = new Map<string, { data: Uint8Array; rev: number }>()
  let revs = 0
  const json = (o: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...headers } })

  beforeEach(() => {
    store.clear()
    vi.stubGlobal(
      'fetch',
      fakeFetch(async (url, init) => {
        const h = init.headers as Record<string, string>
        if (url.endsWith('/oauth2/token')) return json({ access_token: 'fresh-token', expires_in: 14400 })
        expect(h.Authorization).toMatch(/^Bearer /)
        if (h.Authorization === 'Bearer revoked') return new Response('', { status: 401 })
        const argHeader = h['Dropbox-API-Arg'] ? JSON.parse(h['Dropbox-API-Arg']) : JSON.parse(String(init.body))
        const path = String(argHeader.path)
        if (url.endsWith('/2/files/download')) {
          const f = store.get(path)
          if (!f) return json({ error_summary: 'path/not_found/..' }, 409)
          return new Response(f.data.slice(), { status: 200, headers: { 'Dropbox-API-Result': JSON.stringify({ rev: String(f.rev) }) } })
        }
        if (url.endsWith('/2/files/upload')) {
          const cur = store.get(path)
          const mode = argHeader.mode
          if (mode === 'add' && cur) return json({ error_summary: 'path/conflict/file/..' }, 409)
          if (typeof mode === 'object' && (!cur || String(cur.rev) !== mode.update)) return json({ error_summary: 'path/conflict/file/..' }, 409)
          const data = new Uint8Array(await (init.body as Blob).arrayBuffer())
          store.set(path, { data, rev: ++revs })
          return json({ rev: String(revs) })
        }
        if (url.endsWith('/2/files/delete_v2')) return store.delete(path) ? json({}) : json({ error_summary: 'path_lookup/not_found/' }, 409)
        if (url.endsWith('/2/files/list_folder')) {
          const entries = [...store.keys()].filter(k => k.startsWith('/shots/')).map(k => ({ '.tag': 'file', name: k.slice(7) }))
          return entries.length ? json({ entries, has_more: false, cursor: 'c' }) : json({ error_summary: 'path/not_found/' }, 409)
        }
        return new Response('unexpected', { status: 500 })
      })
    )
  })

  const cfg = (accessToken = 'token') => ({ clientId: 'app-key', accessToken, refreshToken: 'refresh', expiresAt: Date.now() + 3600_000 })

  it('reads, writes conditionally, lists and deletes in the app folder', async () => {
    const dbx = new DropboxProvider(cfg())
    expect(await dbx.get('bugstow-index.json')).toBeNull()
    const rev = await dbx.put('bugstow-index.json', enc('one'), null)
    await expect(dbx.put('bugstow-index.json', enc('two'), null)).rejects.toThrow(RemoteChangedError)
    await dbx.put('bugstow-index.json', enc('two'), rev)
    await expect(dbx.put('bugstow-index.json', enc('three'), rev)).rejects.toThrow(RemoteChangedError)
    expect(new TextDecoder().decode((await dbx.get('bugstow-index.json'))!.data)).toBe('two')
    await dbx.put('shots/a.bin', enc('img'))
    expect(await dbx.listShots()).toEqual(['shots/a.bin'])
    await dbx.remove('shots/a.bin')
    await dbx.remove('shots/a.bin') // already gone: fine
    expect(await dbx.listShots()).toEqual([])
  })

  it('refreshes an expiring token and saves it', async () => {
    const saved: string[] = []
    const dbx = new DropboxProvider({ ...cfg(), expiresAt: Date.now() + 1000 }, async t => void saved.push(t.accessToken))
    await dbx.get('bugstow-index.json')
    expect(saved).toEqual(['fresh-token'])
  })
})

describe('Google Drive provider (API contract)', () => {
  const store = new Map<string, { id: string; name: string; version: number; data: Uint8Array }>()
  let ids = 0
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } })

  beforeEach(() => {
    store.clear()
    vi.stubGlobal(
      'fetch',
      fakeFetch(async (url, init) => {
        const u = new URL(url)
        const method = init.method || 'GET'
        if (u.pathname === '/drive/v3/files' && method === 'GET') {
          expect(u.searchParams.get('spaces')).toBe('appDataFolder')
          return json({ files: [...store.values()].map(f => ({ id: f.id, name: f.name, version: String(f.version) })) })
        }
        const byId = (id: string) => [...store.values()].find(f => f.id === id)
        const m = u.pathname.match(/\/files\/([^/]+)$/)
        if (u.pathname === '/upload/drive/v3/files' && method === 'POST') {
          const text = await (init.body as Blob).text()
          const meta = JSON.parse(text.match(/\r\n\r\n(\{.*?\})\r\n/)![1])
          expect(meta.parents).toEqual(['appDataFolder'])
          const f = { id: `id${++ids}`, name: meta.name, version: 1, data: enc(text) }
          store.set(f.id, f)
          return json({ id: f.id, name: f.name, version: '1' })
        }
        if (m && u.pathname.startsWith('/upload/') && method === 'PATCH') {
          const f = byId(m[1])!
          f.data = new Uint8Array(await (init.body as Blob).arrayBuffer())
          f.version++
          return json({ id: f.id, name: f.name, version: String(f.version) })
        }
        if (m && method === 'GET') {
          const f = byId(m[1])
          if (!f) return json({}, 404)
          if (u.searchParams.get('alt') === 'media') return new Response(f.data.slice())
          return json({ version: String(f.version) })
        }
        if (m && method === 'DELETE') {
          store.delete(m[1])
          return new Response(null, { status: 204 })
        }
        return new Response('unexpected', { status: 500 })
      })
    )
  })

  it('creates in the hidden app folder, updates by version, detects concurrent writes', async () => {
    const gd = new GoogleDriveProvider({ accessToken: 't', expiresAt: Date.now() + 3600_000 })
    expect(await gd.get('bugstow-index.json')).toBeNull()
    const rev = await gd.put('bugstow-index.json', enc('one'), null)
    const rev2 = await gd.put('bugstow-index.json', enc('two'), rev)
    expect(new TextDecoder().decode((await gd.get('bugstow-index.json'))!.data)).toBe('two')
    await expect(gd.put('bugstow-index.json', enc('stale'), rev)).rejects.toThrow(RemoteChangedError)
    expect(rev2).not.toBe(rev)
    await gd.put('shots/x.bin', enc('img'))
    expect(await gd.listShots()).toEqual(['shots/x.bin'])
    await gd.remove('shots/x.bin')
    expect(await gd.listShots()).toEqual([])
  })

  it('asks to reconnect when Google\'s one-hour token has expired', async () => {
    const gd = new GoogleDriveProvider({ accessToken: 't', expiresAt: Date.now() - 1 })
    await expect(gd.get('bugstow-index.json')).rejects.toThrow(ReconnectNeededError)
  })
})
