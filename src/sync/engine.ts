import { getDB } from '../storage/db'
import type { Issue, Project, Screenshot } from '../types'
import {
  INDEX_FILE,
  shotFileName,
  encryptFile,
  decryptFile,
  sealIndex,
  readEnvelope,
  openIndex,
  deriveKey,
  newSalt,
  KDF_ITERATIONS,
} from './crypto'
import { mergeRecords } from './merge'
import type { KeyInfo } from './store'
import {
  RemoteChangedError,
  type RemoteIndex,
  type ShotMeta,
  type SyncBase,
  type SyncProvider,
  type SyncResult,
} from './types'

/**
 * One sync round between this device's IndexedDB and the user's cloud.
 *
 *  1. read + decrypt the cloud index (if any)
 *  2. three-way merge projects and issues (see merge.ts)
 *  3. upload new screenshots, then write the index (conditionally, so a
 *     concurrent writer is detected and we merge again)
 *  4. download screenshots, apply changes to IndexedDB
 *  5. remove screenshot files nobody references any more
 */

export class SyncAbortedError extends Error {
  name = 'SyncAbortedError'
}

export interface SyncOptions {
  /**
   * Called before a sync that would delete a large part of the data (e.g. all
   * issues were cleared on one device). Return false to stop.
   */
  confirmLargeDelete?: (info: { here: number; inCloud: number; total: number }) => Promise<boolean>
}

/**
 * Get the encryption key for this cloud. If the cloud already has BugsTow data,
 * the passphrase must match it; otherwise a new salt is created.
 */
export async function prepareKey(provider: SyncProvider, passphrase: string): Promise<KeyInfo & { existing: boolean }> {
  const file = await provider.get(INDEX_FILE)
  if (file) {
    const env = readEnvelope(file.data)
    const key = await deriveKey(passphrase, env.kdf.salt, env.kdf.iterations)
    await openIndex<RemoteIndex>(key, env) // throws WrongPassphraseError if it doesn't match
    return { key, salt: env.kdf.salt, iterations: env.kdf.iterations, existing: true }
  }
  const salt = newSalt()
  return { key: await deriveKey(passphrase, salt), salt, iterations: KDF_ITERATIONS, existing: false }
}

async function readLocal() {
  const db = await getDB()
  const [projects, issues, shots] = await Promise.all([db.getAll('projects'), db.getAll('issues'), db.getAll('screenshots')])
  return { projects, issues, shots: new Map(shots.map(s => [s.id, s])) }
}

function referencedShots(issues: Issue[]): Set<string> {
  const ids = new Set<string>()
  for (const i of issues) {
    if (i.screenshotId) ids.add(i.screenshotId)
    for (const s of i.screenshotIds || []) ids.add(s)
  }
  return ids
}

export async function syncOnce(
  provider: SyncProvider,
  keyInfo: KeyInfo,
  base: SyncBase,
  opts: SyncOptions = {}
): Promise<{ result: SyncResult; base: SyncBase }> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await attemptSync(provider, keyInfo, base, opts)
    } catch (err) {
      if (err instanceof RemoteChangedError && attempt < 4) continue // someone wrote meanwhile: merge again
      throw err
    }
  }
  throw new RemoteChangedError()
}

async function attemptSync(
  provider: SyncProvider,
  keyInfo: KeyInfo,
  base: SyncBase,
  opts: SyncOptions
): Promise<{ result: SyncResult; base: SyncBase }> {
  // 1. Cloud state.
  const indexFile = await provider.get(INDEX_FILE)
  let remote: RemoteIndex = { v: 1, writtenAt: '', projects: [], issues: [], shots: [] }
  let rev: string | null = null
  if (indexFile) {
    const env = readEnvelope(indexFile.data)
    if (env.kdf.salt !== keyInfo.salt) {
      throw new Error(
        'The BugsTow data in your cloud was set up with a different passphrase. Disconnect and connect again to use it.'
      )
    }
    remote = await openIndex<RemoteIndex>(keyInfo.key, env)
    rev = indexFile.rev
  }

  // 2. Merge.
  const local = await readLocal()
  const mp = mergeRecords<Project>(local.projects, remote.projects, base.projects)
  const mi = mergeRecords<Issue>(local.issues, remote.issues, base.issues)

  // Issues pointing at a project that no longer exists become Unassigned
  // (same as deleting a project on one device).
  const projectIds = new Set(mp.final.map(p => p.id))
  const now = new Date().toISOString()
  for (let k = 0; k < mi.final.length; k++) {
    const issue = mi.final[k]
    if (issue.projectId && !projectIds.has(issue.projectId)) {
      const fixed = { ...issue, projectId: null, updatedAt: now }
      mi.final[k] = fixed
      mi.putHere = mi.putHere.filter(x => x.id !== fixed.id).concat(fixed)
      mi.cloudChanged = true
    }
  }

  // Guard against mass deletion (e.g. "clear all data" on one device).
  const deletingHere = mp.deletedHere + mi.deletedHere
  const deletingInCloud = mp.deletedInCloud + mi.deletedInCloud
  const total = Math.max(local.projects.length + local.issues.length, remote.projects.length + remote.issues.length)
  const large = (n: number) => n >= 10 && n > total * 0.5
  if ((large(deletingHere) || large(deletingInCloud)) && opts.confirmLargeDelete) {
    const ok = await opts.confirmLargeDelete({ here: deletingHere, inCloud: deletingInCloud, total })
    if (!ok) throw new SyncAbortedError('Sync stopped. Nothing was deleted.')
  }

  // 3. Screenshots: they follow the issues that reference them.
  const wanted = referencedShots(mi.final)
  const remoteFiles = new Set(
    (await provider.listShots()).map(n => n.replace(/^shots\//, '').replace(/\.bin$/, ''))
  )
  const remoteMeta = new Map(remote.shots.map(s => [s.id, s]))
  const finalShots: ShotMeta[] = []
  const toUpload: Screenshot[] = []
  const toDownload: ShotMeta[] = []
  let pending = 0
  for (const id of wanted) {
    const mine = local.shots.get(id)
    const inCloud = remoteFiles.has(id)
    if (mine) {
      finalShots.push({ id, mimeType: mine.mimeType, filename: mine.filename, createdAt: mine.createdAt })
      if (!inCloud) toUpload.push(mine)
    } else if (remoteMeta.has(id)) {
      finalShots.push(remoteMeta.get(id)!)
      if (inCloud) toDownload.push(remoteMeta.get(id)!)
      else pending++ // listed but not uploaded yet by the other device
    } else {
      pending++
    }
  }

  for (const s of toUpload) {
    const bytes = new Uint8Array(await s.blob.arrayBuffer())
    await provider.put(shotFileName(s.id), await encryptFile(keyInfo.key, shotFileName(s.id), bytes))
  }

  const shotsChanged =
    finalShots.length !== remote.shots.length || finalShots.some(s => !remoteMeta.has(s.id))
  if (!indexFile || mp.cloudChanged || mi.cloudChanged || shotsChanged) {
    const index: RemoteIndex = { v: 1, writtenAt: now, projects: mp.final, issues: mi.final, shots: finalShots }
    const sealed = await sealIndex(keyInfo.key, keyInfo.salt, keyInfo.iterations, index)
    await provider.put(INDEX_FILE, sealed, rev) // throws RemoteChangedError → merge again
  }

  // 4. Downloads, then apply everything to IndexedDB in one transaction.
  const downloaded: Screenshot[] = []
  for (const meta of toDownload) {
    const file = await provider.get(shotFileName(meta.id))
    if (!file) {
      pending++
      continue
    }
    const plain = await decryptFile(keyInfo.key, shotFileName(meta.id), file.data)
    downloaded.push({
      id: meta.id,
      mimeType: meta.mimeType,
      filename: meta.filename,
      createdAt: meta.createdAt,
      blob: new Blob([plain], { type: meta.mimeType }),
    })
  }

  const readAt = new Map([...local.projects, ...local.issues].map(r => [r.id, r.updatedAt]))
  const db = await getDB()
  const tx = db.transaction(['projects', 'issues', 'screenshots'], 'readwrite')
  // Only touch a record if it hasn't been edited on this device since we read
  // it; otherwise leave it for the next sync.
  const untouched = async (store: 'projects' | 'issues', id: string) => {
    const cur = await tx.objectStore(store).get(id)
    return (cur?.updatedAt ?? undefined) === readAt.get(id)
  }
  for (const p of mp.putHere) if (await untouched('projects', p.id)) await tx.objectStore('projects').put(p)
  for (const id of mp.deleteHere) if (await untouched('projects', id)) await tx.objectStore('projects').delete(id)
  for (const i of mi.putHere) if (await untouched('issues', i.id)) await tx.objectStore('issues').put(i)
  for (const id of mi.deleteHere) if (await untouched('issues', id)) await tx.objectStore('issues').delete(id)
  for (const s of downloaded) await tx.objectStore('screenshots').put(s)
  // Screenshots this device had synced before and that no issue uses any more.
  const baseShots = new Set(base.shots)
  let shotsDeletedHere = 0
  for (const id of local.shots.keys()) {
    if (!wanted.has(id) && baseShots.has(id)) {
      await tx.objectStore('screenshots').delete(id)
      shotsDeletedHere++
    }
  }
  await tx.done

  // 5. Remove cloud screenshot files that are known (to us or the index) and
  // no longer referenced. Files unknown to both may belong to another device
  // that is mid-sync, so they are left alone.
  for (const id of remoteFiles) {
    if (!wanted.has(id) && (baseShots.has(id) || remoteMeta.has(id))) {
      await provider.remove(shotFileName(id))
    }
  }

  const newBase: SyncBase = {
    projects: Object.fromEntries(mp.final.map(p => [p.id, p.updatedAt])),
    issues: Object.fromEntries(mi.final.map(i => [i.id, i.updatedAt])),
    shots: finalShots.map(s => s.id),
  }
  return {
    base: newBase,
    result: {
      uploaded: mp.uploaded + mi.uploaded + toUpload.length,
      downloaded: mp.downloaded + mi.downloaded + downloaded.length,
      deletedHere: mp.deletedHere + mi.deletedHere + shotsDeletedHere,
      deletedInCloud: mp.deletedInCloud + mi.deletedInCloud,
      editsKeptOverDeletes: mp.editsKeptOverDeletes + mi.editsKeptOverDeletes,
      shotsPending: pending,
      at: new Date().toISOString(),
    },
  }
}
