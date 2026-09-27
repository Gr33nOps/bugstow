import { openDB, type IDBPDatabase } from 'idb'
import type { ProviderId, SyncBase, SyncResult } from './types'
import { EMPTY_BASE } from './types'

/**
 * Sync settings for this device, in a separate IndexedDB database so the app's
 * own database schema is untouched. Nothing here leaves the device.
 *
 *  - connection: which provider, and what it needs to reach your cloud
 *    (OAuth tokens, WebDAV address + app password, or a folder handle)
 *  - key:        the non-extractable AES key derived from your passphrase
 *  - base:       what this device last agreed with the cloud (for deletions)
 *  - status:     last sync time / last error, for the UI
 */

const DB = 'bugstow_sync'

export interface KeyInfo {
  key: CryptoKey
  salt: string
  iterations: number
}

export interface Connection {
  provider: ProviderId
  connectedAt: string
  /** Provider-specific settings (tokens, URL, folder handle...). */
  config: Record<string, unknown>
}

export interface SyncStatus {
  lastSyncAt: string | null
  lastResult: SyncResult | null
  lastError: string | null
  lastErrorAt: string | null
}

let dbp: Promise<IDBPDatabase> | null = null
function db() {
  dbp ??= openDB(DB, 1, {
    upgrade(d) {
      d.createObjectStore('kv')
    },
  })
  return dbp
}

async function get<T>(key: string): Promise<T | undefined> {
  return (await db()).get('kv', key) as Promise<T | undefined>
}
async function put(key: string, value: unknown): Promise<void> {
  await (await db()).put('kv', value, key)
}
async function del(key: string): Promise<void> {
  await (await db()).delete('kv', key)
}

export const syncStore = {
  getConnection: () => get<Connection>('connection'),
  setConnection: (c: Connection) => put('connection', c),
  /** Update just the provider config (e.g. refreshed OAuth tokens). */
  async updateConfig(patch: Record<string, unknown>) {
    const c = await get<Connection>('connection')
    if (c) await put('connection', { ...c, config: { ...c.config, ...patch } })
  },

  getKey: () => get<KeyInfo>('key'),
  setKey: (k: KeyInfo) => put('key', k),

  async getBase(provider: ProviderId): Promise<SyncBase> {
    return (await get<SyncBase>(`base:${provider}`)) ?? EMPTY_BASE
  },
  setBase: (provider: ProviderId, b: SyncBase) => put(`base:${provider}`, b),
  /** Forget what was last synced (after clearing or restoring local data). */
  async resetBases() {
    for (const p of ['gdrive', 'dropbox', 'webdav', 'folder', 'file'] as ProviderId[]) await del(`base:${p}`)
  },

  async getStatus(): Promise<SyncStatus> {
    return (
      (await get<SyncStatus>('status')) ?? { lastSyncAt: null, lastResult: null, lastError: null, lastErrorAt: null }
    )
  },
  setStatus: (s: SyncStatus) => put('status', s),

  /** Disconnect: forget the connection, key, bases and status. Local data stays. */
  async disconnect() {
    await del('connection')
    await del('key')
    await del('status')
    await this.resetBases()
  },

  /** For tests. */
  async _close() {
    if (dbp) (await dbp).close()
    dbp = null
  },
}
