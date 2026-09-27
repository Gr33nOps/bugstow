import { ReconnectNeededError, RemoteChangedError, type SyncProvider, type Bytes } from '../types'

/**
 * Google Drive, using the hidden "app data" folder (scope drive.appdata):
 * BugsTow can only see its own files there, never the rest of your Drive, and
 * the files don't clutter your Drive (they count toward your storage).
 *
 * Google gives browser-only apps an access token that lasts about an hour and
 * no refresh token, so after that you tap "Reconnect" (usually one click).
 */
export interface GoogleDriveConfig {
  accessToken: string
  expiresAt: number
}

const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

interface DriveFile {
  id: string
  name: string
  version: string
}

export class GoogleDriveProvider implements SyncProvider {
  id = 'gdrive' as const
  private byName: Map<string, DriveFile> | null = null

  constructor(private cfg: GoogleDriveConfig) {}

  private async call(url: string, init: RequestInit = {}): Promise<Response> {
    if (Date.now() >= this.cfg.expiresAt - 30_000) {
      throw new ReconnectNeededError('Google Drive needs you to sign in again (Google limits browser access to about an hour).')
    }
    let res: Response
    try {
      res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${this.cfg.accessToken}`, ...(init.headers || {}) } })
    } catch {
      throw new Error('Could not reach Google Drive. Check that you are online.')
    }
    if (res.status === 401) throw new ReconnectNeededError('Google Drive needs you to sign in again.')
    return res
  }

  /** All BugsTow files in the app data folder, by name. */
  private async files(fresh = false): Promise<Map<string, DriveFile>> {
    if (this.byName && !fresh) return this.byName
    const map = new Map<string, DriveFile>()
    let pageToken = ''
    do {
      const q = new URLSearchParams({
        spaces: 'appDataFolder',
        fields: 'nextPageToken,files(id,name,version)',
        pageSize: '1000',
        ...(pageToken ? { pageToken } : {}),
      })
      const res = await this.call(`${FILES}?${q}`)
      if (!res.ok) throw new Error(`Listing Google Drive files failed (${res.status}).`)
      const page = (await res.json()) as { files: DriveFile[]; nextPageToken?: string }
      for (const f of page.files) {
        // Drive allows duplicate names; keep the most recently changed one.
        const cur = map.get(f.name)
        if (!cur || Number(f.version) > Number(cur.version)) map.set(f.name, f)
      }
      pageToken = page.nextPageToken || ''
    } while (pageToken)
    this.byName = map
    return map
  }

  private async currentVersion(id: string): Promise<string | null> {
    const res = await this.call(`${FILES}/${id}?fields=version`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Reading Google Drive file info failed (${res.status}).`)
    return ((await res.json()) as { version: string }).version
  }

  async get(name: string) {
    const f = (await this.files(name.endsWith('.json'))).get(name)
    if (!f) return null
    const version = (await this.currentVersion(f.id)) ?? null
    if (version === null) return null
    const res = await this.call(`${FILES}/${f.id}?alt=media`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Reading ${name} from Google Drive failed (${res.status}).`)
    return { data: new Uint8Array(await res.arrayBuffer()), rev: version }
  }

  async put(name: string, data: Bytes, expectRev?: string | null) {
    const existing = (await this.files()).get(name)
    if (existing) {
      if (expectRev === null) throw new RemoteChangedError()
      if (typeof expectRev === 'string' && (await this.currentVersion(existing.id)) !== expectRev) {
        throw new RemoteChangedError()
      }
      const res = await this.call(`${UPLOAD}/${existing.id}?uploadType=media&fields=id,name,version`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: new Blob([data]),
      })
      if (!res.ok) throw new Error(`Writing ${name} to Google Drive failed (${res.status}).`)
      const f = (await res.json()) as DriveFile
      this.byName?.set(name, f)
      return f.version
    }
    if (typeof expectRev === 'string') throw new RemoteChangedError() // it was deleted meanwhile
    const boundary = 'bugstow' + crypto.getRandomValues(new Uint32Array(2)).join('')
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify({ name, parents: ['appDataFolder'] }),
      `\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
      data,
      `\r\n--${boundary}--`,
    ])
    const res = await this.call(`${UPLOAD}?uploadType=multipart&fields=id,name,version`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    })
    if (!res.ok) throw new Error(`Writing ${name} to Google Drive failed (${res.status}).`)
    const f = (await res.json()) as DriveFile
    this.byName?.set(name, f)
    return f.version
  }

  async remove(name: string) {
    const f = (await this.files()).get(name)
    if (!f) return
    const res = await this.call(`${FILES}/${f.id}`, { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new Error(`Deleting ${name} from Google Drive failed (${res.status}).`)
    this.byName?.delete(name)
  }

  async listShots() {
    return [...(await this.files(true)).keys()].filter(n => n.startsWith('shots/'))
  }
}
