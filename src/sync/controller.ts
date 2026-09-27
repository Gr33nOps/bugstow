import { prepareKey, syncOnce } from './engine'
import { INDEX_FILE, readEnvelope } from './crypto'
import { syncStore, type Connection, type KeyInfo, type SyncStatus } from './store'
import { ReconnectNeededError, type ProviderId, type SyncProvider, type SyncResult } from './types'
import { WebDavProvider, type WebDavConfig } from './providers/webdav'
import { DropboxProvider, type DropboxConfig } from './providers/dropbox'
import { GoogleDriveProvider, type GoogleDriveConfig } from './providers/googleDrive'
import { FolderProvider, type FsDirHandle } from './providers/folder'
import { MemoryProvider } from './providers/memory'

/**
 * Glue between the UI and the sync engine: builds the provider for the saved
 * connection, runs one sync at a time, and records status. Also used by the
 * app to sync automatically after changes.
 */

export function providerFor(c: Connection): SyncProvider {
  switch (c.provider) {
    case 'webdav':
      return new WebDavProvider(c.config as unknown as WebDavConfig)
    case 'dropbox':
      return new DropboxProvider(c.config as unknown as DropboxConfig, t => syncStore.updateConfig(t))
    case 'gdrive':
      return new GoogleDriveProvider(c.config as unknown as GoogleDriveConfig)
    case 'folder':
      return new FolderProvider(c.config.handle as FsDirHandle)
    case 'file':
      return new MemoryProvider('file')
  }
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  gdrive: 'Google Drive',
  dropbox: 'Dropbox',
  webdav: 'WebDAV',
  folder: 'Synced folder',
  file: 'Sync file',
}

type Listener = (s: SyncStatus & { running: boolean }) => void
const listeners = new Set<Listener>()
let running = false

async function publish() {
  const s = await syncStore.getStatus()
  listeners.forEach(l => l({ ...s, running }))
}

export function onSyncStatus(l: Listener): () => void {
  listeners.add(l)
  publish()
  return () => listeners.delete(l)
}

/**
 * Save a new connection and the key for its data, after checking the
 * passphrase against any BugsTow data already in that cloud.
 * Returns whether the cloud already had data.
 */
export async function connect(c: Connection, passphrase: string, interactive = true): Promise<{ existing: boolean }> {
  const provider = providerFor(c)
  if (provider instanceof FolderProvider) await provider.ensureAccess(interactive)
  const key = await prepareKey(provider, passphrase)
  await syncStore.disconnect() // forget any previous connection and its sync state
  await syncStore.setConnection(c)
  await syncStore.setKey({ key: key.key, salt: key.salt, iterations: key.iterations })
  return { existing: key.existing }
}

/** Does this cloud already hold BugsTow sync data (so the passphrase must match)? */
export async function probeExisting(c: Omit<Connection, 'connectedAt'>): Promise<boolean> {
  const provider = providerFor({ ...c, connectedAt: '' })
  if (provider instanceof FolderProvider) await provider.ensureAccess(true)
  return (await provider.get(INDEX_FILE)) !== null
}

/** Check a WebDAV address and login before saving them. */
export async function testWebDav(cfg: WebDavConfig): Promise<void> {
  await new WebDavProvider(cfg).test()
}

export async function disconnect(): Promise<void> {
  await syncStore.disconnect()
  await publish()
}

export type RunOutcome =
  | { ok: true; result: SyncResult }
  | { ok: false; error: string; reconnect: boolean; aborted?: boolean }

/**
 * Run one sync with the saved connection. `interactive` means the user clicked
 * (browsers only re-grant folder access on a click).
 */
export async function runSync(opts: {
  interactive?: boolean
  confirmLargeDelete?: (i: { here: number; inCloud: number; total: number }) => Promise<boolean>
} = {}): Promise<RunOutcome | null> {
  if (running) return null
  const c = await syncStore.getConnection()
  const key = await syncStore.getKey()
  if (!c || !key || c.provider === 'file') return null
  running = true
  await publish()
  try {
    const provider = providerFor(c)
    if (provider instanceof FolderProvider) await provider.ensureAccess(!!opts.interactive)
    const base = await syncStore.getBase(c.provider)
    const { result, base: next } = await syncOnce(provider, key, base, { confirmLargeDelete: opts.confirmLargeDelete })
    await syncStore.setBase(c.provider, next)
    await syncStore.setStatus({ lastSyncAt: result.at, lastResult: result, lastError: null, lastErrorAt: null })
    return { ok: true, result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed.'
    const aborted = err instanceof Error && err.name === 'SyncAbortedError'
    const prev = await syncStore.getStatus()
    if (!aborted) await syncStore.setStatus({ ...prev, lastError: message, lastErrorAt: new Date().toISOString() })
    return { ok: false, error: message, reconnect: err instanceof ReconnectNeededError, aborted }
  } finally {
    running = false
    await publish()
  }
}

// ── "Sync file": one encrypted file for any cloud or phone ───────────────────

/** A passphrase is needed (first use on this device, or a file from another sync set). */
export class PassphraseNeededError extends Error {
  name = 'PassphraseNeededError'
  constructor() {
    super('Enter the sync passphrase.')
  }
}

/** Is a sync-file key already saved on this device? */
export async function hasFileKey(): Promise<boolean> {
  const c = await syncStore.getConnection()
  return c?.provider === 'file' && !!(await syncStore.getKey())
}

async function useFileKey(key: KeyInfo) {
  await syncStore.disconnect()
  await syncStore.setConnection({ provider: 'file', connectedAt: new Date().toISOString(), config: {} })
  await syncStore.setKey(key)
}

/** Create a sync file with everything on this device. */
export async function exportSyncFile(passphrase?: string): Promise<Blob> {
  const mem = new MemoryProvider('file')
  let key = (await hasFileKey()) ? await syncStore.getKey() : undefined
  if (!key) {
    if (!passphrase) throw new PassphraseNeededError()
    const k = await prepareKey(mem, passphrase)
    key = { key: k.key, salt: k.salt, iterations: k.iterations }
    await useFileKey(key)
  }
  // Empty base: a full snapshot, nothing is treated as deleted.
  await syncOnce(mem, key, { projects: {}, issues: {}, shots: [] })
  return mem.toBundle()
}

/**
 * Merge a sync file into this device. Deletions recorded since this device
 * last used a sync file are applied too. Returns a file with the merged result
 * to put back in your cloud.
 */
export async function importSyncFile(
  file: Blob,
  passphrase?: string,
  confirmLargeDelete?: (i: { here: number; inCloud: number; total: number }) => Promise<boolean>
): Promise<{ result: SyncResult; merged: Blob }> {
  const mem = await MemoryProvider.fromBundle(file)
  const index = await mem.get(INDEX_FILE)
  if (!index) throw new Error('This sync file is empty.')
  const salt = readEnvelope(index.data).kdf.salt

  let key = (await hasFileKey()) ? await syncStore.getKey() : undefined
  if (!key || key.salt !== salt) {
    if (!passphrase) throw new PassphraseNeededError()
    const k = await prepareKey(mem, passphrase) // throws WrongPassphraseError on mismatch
    key = { key: k.key, salt: k.salt, iterations: k.iterations }
    await useFileKey(key)
  }
  const base = await syncStore.getBase('file')
  const { result, base: next } = await syncOnce(mem, key, base, { confirmLargeDelete })
  await syncStore.setBase('file', next)
  await syncStore.setStatus({ lastSyncAt: result.at, lastResult: result, lastError: null, lastErrorAt: null })
  await publish()
  return { result, merged: mem.toBundle() }
}
