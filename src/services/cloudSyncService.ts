import type { BackupData, EncryptedBackupPayload, ExportPayload } from '../types'
import { createBackupData, encryptBackup, decryptBackup, validateBackupStructure } from './backupService'

/**
 * Cloud sync service.
 *
 * Bugstow remains local-first: this module simply pushes/pulls a single
 * encrypted backup blob to a Cloudflare R2 bucket, brokered by the
 * `/api/backup` serverless function which returns short-lived presigned URLs.
 * The encrypted blob is transferred browser <-> R2 directly, so it is never
 * capped by the serverless body limit.
 */

const API_BASE = '/api/backup'

export interface CloudBackupMeta {
  exists: boolean
  size?: number | null
  lastModified?: string | null
}

/** Optional shared secret (BUGSTOW_SYNC_KEY on the server). Usually empty. */
function keyParam(): string {
  try {
    const k = localStorage.getItem('bugstow_sync_key')
    return k ? `&key=${encodeURIComponent(k)}` : ''
  } catch {
    return ''
  }
}

export function isCloudSyncAvailable(): boolean {
  // Available whenever the app is served over http(s); the endpoint decides if
  // it is actually configured (returns 503 otherwise).
  return typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)
}

export async function getCloudBackupMeta(): Promise<CloudBackupMeta> {
  const res = await fetch(`${API_BASE}?action=meta${keyParam()}`)
  if (res.status === 503) {
    throw new Error('Cloud sync is not configured on this deployment.')
  }
  if (res.status === 401) {
    throw new Error('Cloud sync key is incorrect.')
  }
  if (!res.ok) {
    throw new Error('Could not reach the cloud sync service.')
  }
  return res.json()
}

async function getPresignedUrl(action: 'upload-url' | 'download-url'): Promise<string> {
  const res = await fetch(`${API_BASE}?action=${action}${keyParam()}`)
  if (res.status === 503) {
    throw new Error('Cloud sync is not configured on this deployment.')
  }
  if (res.status === 401) {
    throw new Error('Cloud sync key is incorrect.')
  }
  if (!res.ok) {
    throw new Error('Could not reach the cloud sync service.')
  }
  const data = (await res.json()) as { url?: string }
  if (!data.url) {
    throw new Error('Cloud sync service returned no URL.')
  }
  return data.url
}

/**
 * Build a backup of all local data, optionally encrypt it, and push it to R2.
 * A passphrase is strongly recommended (and required when the endpoint has no
 * auth) so the stored blob is ciphertext.
 */
export async function backupToCloud(passphrase?: string): Promise<void> {
  const backup = await createBackupData()

  let payload: ExportPayload
  if (passphrase && passphrase.trim()) {
    payload = await encryptBackup(backup, passphrase.trim())
  } else {
    payload = backup
  }

  const body = JSON.stringify(payload)
  const uploadUrl = await getPresignedUrl('upload-url')

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    body,
  })
  if (!putRes.ok) {
    throw new Error(`Upload to cloud storage failed (${putRes.status}).`)
  }
}

/**
 * Pull the encrypted backup blob from R2 and return the decoded BackupData.
 * Returns null when no cloud backup exists yet.
 */
export async function restoreFromCloud(passphrase?: string): Promise<BackupData | null> {
  const downloadUrl = await getPresignedUrl('download-url')

  const res = await fetch(downloadUrl)
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error(`Download from cloud storage failed (${res.status}).`)
  }

  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Cloud backup is corrupted or unreadable.')
  }

  const check = validateBackupStructure(parsed)
  if (!check.isValid) {
    throw new Error(check.error || 'Cloud backup has an invalid structure.')
  }

  if (check.isEncrypted) {
    if (!passphrase) {
      throw new Error('This cloud backup is encrypted. A passphrase is required.')
    }
    const decrypted = await decryptBackup(parsed as EncryptedBackupPayload, passphrase)
    const recheck = validateBackupStructure(decrypted)
    if (!recheck.isValid || !recheck.data) {
      throw new Error(recheck.error || 'Decrypted cloud backup is invalid.')
    }
    return recheck.data
  }

  if (!check.data) {
    throw new Error('Cloud backup has an invalid structure.')
  }
  return check.data
}
