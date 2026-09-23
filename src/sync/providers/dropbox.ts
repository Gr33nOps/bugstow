import { ReconnectNeededError, RemoteChangedError, type SyncProvider, type Bytes } from '../types'

/**
 * Dropbox, using an "App folder" app: BugsTow can only see Dropbox › Apps ›
 * BugsTow, nothing else in your Dropbox. Sign-in uses OAuth with PKCE and a
 * refresh token, so it stays connected until you disconnect.
 */
export interface DropboxConfig {
  clientId: string
  accessToken: string
  refreshToken: string
  expiresAt: number // ms since epoch
}

const API = 'https://api.dropboxapi.com'
const CONTENT = 'https://content.dropboxapi.com'

/** Dropbox-API-Arg must be ASCII; escape anything else. */
const arg = (o: unknown) => JSON.stringify(o).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))

export async function refreshDropboxToken(clientId: string, refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }),
  })
  if (!res.ok) throw new ReconnectNeededError('Dropbox access was revoked or expired. Reconnect Dropbox.')
  const j = (await res.json()) as { access_token: string; expires_in: number }
  return { accessToken: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 }
}

export class DropboxProvider implements SyncProvider {
  id = 'dropbox' as const

  constructor(
    private cfg: DropboxConfig,
    /** Persist refreshed tokens. */
    private onTokens: (t: { accessToken: string; expiresAt: number }) => Promise<void> = async () => {}
  ) {}

  private async token(): Promise<string> {
    if (this.cfg.expiresAt - Date.now() < 60_000) {
      const t = await refreshDropboxToken(this.cfg.clientId, this.cfg.refreshToken)
      this.cfg = { ...this.cfg, ...t }
      await this.onTokens(t)
    }
    return this.cfg.accessToken
  }

  private async call(url: string, init: RequestInit & { headers?: Record<string, string> }, retried = false): Promise<Response> {
    let res: Response
    try {
      res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await this.token()}`, ...init.headers } })
    } catch {
      throw new Error('Could not reach Dropbox. Check that you are online.')
    }
    if (res.status === 401 && !retried) {
      this.cfg.expiresAt = 0 // force a refresh once
      return this.call(url, init, true)
    }
    if (res.status === 401) throw new ReconnectNeededError('Dropbox access was revoked or expired. Reconnect Dropbox.')
    return res
  }

  private static async errorSummary(res: Response): Promise<string> {
    try {
      return ((await res.json()) as { error_summary?: string }).error_summary || ''
    } catch {
      return ''
    }
  }

  async get(name: string) {
    const res = await this.call(`${CONTENT}/2/files/download`, {
      method: 'POST',
      headers: { 'Dropbox-API-Arg': arg({ path: `/${name}` }) },
    })
    if (res.status === 409 && (await DropboxProvider.errorSummary(res)).includes('not_found')) return null
    if (!res.ok) throw new Error(`Reading ${name} from Dropbox failed (${res.status}).`)
    const meta = JSON.parse(res.headers.get('Dropbox-API-Result') || '{}') as { rev?: string }
    return { data: new Uint8Array(await res.arrayBuffer()), rev: meta.rev || '' }
  }

  async put(name: string, data: Bytes, expectRev?: string | null) {
    const mode = expectRev === null ? 'add' : expectRev ? { '.tag': 'update', update: expectRev } : 'overwrite'
    const res = await this.call(`${CONTENT}/2/files/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': arg({ path: `/${name}`, mode, autorename: false, mute: true, strict_conflict: true }),
      },
      body: new Blob([data]),
    })
    if (res.status === 409 && (await DropboxProvider.errorSummary(res)).includes('conflict')) {
      throw new RemoteChangedError()
    }
    if (!res.ok) throw new Error(`Writing ${name} to Dropbox failed (${res.status}).`)
    return ((await res.json()) as { rev: string }).rev
  }

  async remove(name: string) {
    const res = await this.call(`${API}/2/files/delete_v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: `/${name}` }),
    })
    if (!res.ok && !(res.status === 409 && (await DropboxProvider.errorSummary(res)).includes('not_found'))) {
      throw new Error(`Deleting ${name} from Dropbox failed (${res.status}).`)
    }
  }

  async listShots() {
    const names: string[] = []
    let res = await this.call(`${API}/2/files/list_folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/shots', limit: 2000 }),
    })
    if (res.status === 409 && (await DropboxProvider.errorSummary(res)).includes('not_found')) return []
    for (;;) {
      if (!res.ok) throw new Error(`Listing Dropbox files failed (${res.status}).`)
      const page = (await res.json()) as { entries: Array<{ name: string; '.tag': string }>; has_more: boolean; cursor: string }
      for (const e of page.entries) if (e['.tag'] === 'file' && e.name.endsWith('.bin')) names.push(`shots/${e.name}`)
      if (!page.has_more) return names
      res = await this.call(`${API}/2/files/list_folder/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor: page.cursor }),
      })
    }
  }
}
