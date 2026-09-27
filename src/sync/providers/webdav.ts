import { ReconnectNeededError, RemoteChangedError, type SyncProvider, type Bytes } from '../types'

/**
 * WebDAV: a server you run, such as Nextcloud, ownCloud or a Synology NAS.
 * (Hosted WebDAV services usually don't allow browser access; see docs.)
 * Files go in the folder URL you enter. Use an app password (not your main
 * password) so it can be revoked on its own.
 *
 * Browsers only allow this if your server permits the BugsTow site (CORS):
 * it must answer OPTIONS, allow the methods GET PUT DELETE PROPFIND MKCOL, the
 * headers Authorization Depth If-Match If-None-Match Content-Type, and expose
 * the ETag header. See docs/CLOUD_SYNC.md.
 */
export interface WebDavConfig {
  url: string
  username: string
  password: string
}

function basicAuth(user: string, pass: string): string {
  const bytes = new TextEncoder().encode(`${user}:${pass}`)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return 'Basic ' + btoa(s)
}

export function normalizeWebDavUrl(url: string): string {
  const u = new URL(url.trim())
  if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
    throw new Error('Use an https:// address. Your password would otherwise travel unencrypted.')
  }
  return u.toString().replace(/\/?$/, '/')
}

export class WebDavProvider implements SyncProvider {
  id = 'webdav' as const
  private base: string
  private auth: string
  private shotsDirReady = false

  constructor(cfg: WebDavConfig) {
    this.base = normalizeWebDavUrl(cfg.url)
    this.auth = basicAuth(cfg.username, cfg.password)
  }

  private async req(method: string, path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
    let res: Response
    try {
      res = await fetch(this.base + path, {
        ...init,
        method,
        headers: { Authorization: this.auth, ...(init.headers || {}) },
        cache: 'no-store',
      })
    } catch {
      throw new Error(
        'Could not reach your WebDAV server. Check the address, that you are online, and that the server allows this site (CORS).'
      )
    }
    if (res.status === 401 || res.status === 403) {
      throw new ReconnectNeededError('Your WebDAV server refused the username or app password.')
    }
    return res
  }

  /** Check the folder exists and the credentials work. */
  async test(): Promise<void> {
    const res = await this.req('PROPFIND', '', { headers: { Depth: '0' } })
    if (res.status === 404) throw new Error('That folder does not exist on the server. Create it first.')
    if (res.status !== 207 && !res.ok) throw new Error(`The WebDAV server answered ${res.status}.`)
  }

  async get(name: string) {
    const res = await this.req('GET', name)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Reading ${name} failed (${res.status}).`)
    return { data: new Uint8Array(await res.arrayBuffer()), rev: res.headers.get('ETag') || '' }
  }

  async put(name: string, data: Bytes, expectRev?: string | null) {
    if (name.startsWith('shots/') && !this.shotsDirReady) {
      const mk = await this.req('MKCOL', 'shots/')
      // 201 created, 405 already exists
      if (!mk.ok && mk.status !== 405) throw new Error(`Creating the shots folder failed (${mk.status}).`)
      this.shotsDirReady = true
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' }
    if (expectRev === null) headers['If-None-Match'] = '*'
    else if (expectRev) headers['If-Match'] = expectRev
    const res = await this.req('PUT', name, { headers, body: new Blob([data]) })
    if (res.status === 412) throw new RemoteChangedError()
    if (!res.ok) throw new Error(`Writing ${name} failed (${res.status}).`)
    return res.headers.get('ETag') || ''
  }

  async remove(name: string) {
    const res = await this.req('DELETE', name)
    if (!res.ok && res.status !== 404) throw new Error(`Deleting ${name} failed (${res.status}).`)
  }

  async listShots() {
    const res = await this.req('PROPFIND', 'shots/', { headers: { Depth: '1' } })
    if (res.status === 404) return []
    if (res.status !== 207) throw new Error(`Listing screenshots failed (${res.status}).`)
    const xml = await res.text()
    const names: string[] = []
    for (const m of xml.matchAll(/<(?:[a-zA-Z0-9]+:)?href>([^<]+)<\/(?:[a-zA-Z0-9]+:)?href>/g)) {
      const file = decodeURIComponent(m[1].trim()).split('/').filter(Boolean).pop() || ''
      if (file.endsWith('.bin')) names.push(`shots/${file}`)
    }
    return names
  }
}
