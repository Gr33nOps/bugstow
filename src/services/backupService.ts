import { getDB } from '../storage/db'
import type { BackupData, EncryptedBackupPayload, ExportPayload, Project, Issue, Screenshot, ApplicationSettings } from '../types'
export type { BackupData, EncryptedBackupPayload, ExportPayload }
import { IndexedDbSettingsRepository } from '../repositories/indexedDbRepositories'
import { APP_VERSION } from '../version'

const PBKDF2_ITERATIONS = 100_000

// ── Binary & Base64 Helpers ──────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    } else {
      // Fallback for non-browser / test environments
      blob.arrayBuffer().then(buf => {
        const base64 = arrayBufferToBase64(buf)
        resolve(`data:${blob.type || 'application/octet-stream'};base64,${base64}`)
      }).catch(reject)
    }
  })
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!match) {
    throw new Error('Invalid data URL format')
  }
  const mimeType = match[1]
  const base64 = match[2]
  const buffer = base64ToArrayBuffer(base64)
  return new Blob([buffer], { type: mimeType })
}

// ── Web Crypto API PBKDF2 + AES-GCM ──────────────────────────────────────

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptBackup(data: BackupData, passphrase: string): Promise<EncryptedBackupPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)

  const jsonString = JSON.stringify(data)
  const enc = new TextEncoder()
  const plaintext = enc.encode(jsonString)

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    plaintext
  )

  return {
    version: 1,
    isEncrypted: true,
    algorithm: 'AES-GCM',
    iterations: PBKDF2_ITERATIONS,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
  }
}

export async function decryptBackup(payload: EncryptedBackupPayload, passphrase: string): Promise<BackupData> {
  try {
    const salt = new Uint8Array(base64ToArrayBuffer(payload.salt))
    const iv = new Uint8Array(base64ToArrayBuffer(payload.iv))
    const ciphertext = base64ToArrayBuffer(payload.ciphertext)

    const key = await deriveKey(passphrase, salt)

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    )

    const dec = new TextDecoder()
    const jsonString = dec.decode(decryptedBuffer)
    return JSON.parse(jsonString) as BackupData
  } catch (err) {
    throw new Error('Incorrect passphrase or corrupted backup file.')
  }
}

// ── Export Service ───────────────────────────────────────────────────────

export async function createBackupData(): Promise<BackupData> {
  const db = await getDB()
  const projects = await db.getAll('projects')
  const issues = await db.getAll('issues')
  const screenshots = await db.getAll('screenshots')
  const settingsRepo = new IndexedDbSettingsRepository()
  const settings = await settingsRepo.get()

  // Convert screenshot Blobs to base64 Data URLs
  const serializedScreenshots = await Promise.all(
    screenshots.map(async s => {
      const dataUrl = await blobToDataUrl(s.blob)
      return {
        id: s.id,
        mimeType: s.mimeType,
        filename: s.filename,
        createdAt: s.createdAt,
        dataUrl,
      }
    })
  )

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    settings,
    projects,
    issues,
    screenshots: serializedScreenshots,
  }
}

export async function exportBackupFile(passphrase?: string): Promise<{ filename: string; blob: Blob }> {
  const backupData = await createBackupData()
  const timestamp = new Date().toISOString().split('T')[0]

  let content: string
  let filename: string

  if (passphrase && passphrase.trim()) {
    const encrypted = await encryptBackup(backupData, passphrase.trim())
    content = JSON.stringify(encrypted, null, 2)
    filename = `bugstow-backup-${timestamp}.enc.json`
  } else {
    content = JSON.stringify(backupData, null, 2)
    filename = `bugstow-backup-${timestamp}.json`
  }

  // Update lastBackupExportAt setting
  const settingsRepo = new IndexedDbSettingsRepository()
  await settingsRepo.update({ lastBackupExportAt: new Date().toISOString() })

  const blob = new Blob([content], { type: 'application/json' })
  return { filename, blob }
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Validation & Restoration ─────────────────────────────────────────────

export interface BackupValidationResult {
  isValid: boolean
  isEncrypted: boolean
  error?: string
  data?: BackupData
  summary?: {
    projectsCount: number
    issuesCount: number
    screenshotsCount: number
    createdAt: string
  }
}

export function validateBackupStructure(parsed: unknown): BackupValidationResult {
  if (!parsed || typeof parsed !== 'object') {
    return { isValid: false, isEncrypted: false, error: 'Backup file is not a valid JSON object.' }
  }

  const obj = parsed as Record<string, unknown>

  // Check if encrypted
  if (obj.isEncrypted === true) {
    if (
      obj.version !== 1 ||
      obj.algorithm !== 'AES-GCM' ||
      typeof obj.salt !== 'string' ||
      typeof obj.iv !== 'string' ||
      typeof obj.ciphertext !== 'string'
    ) {
      return { isValid: false, isEncrypted: true, error: 'Malformed encrypted backup envelope.' }
    }
    return { isValid: true, isEncrypted: true }
  }

  // Check unencrypted schema
  if (obj.version !== 1) {
    return { isValid: false, isEncrypted: false, error: `Unsupported backup version: ${obj.version}` }
  }

  if (!Array.isArray(obj.projects) || !Array.isArray(obj.issues) || !Array.isArray(obj.screenshots)) {
    return { isValid: false, isEncrypted: false, error: 'Backup is missing required collections (projects, issues, screenshots).' }
  }

  // Validate items
  for (const p of obj.projects as Array<Record<string, unknown>>) {
    if (!p.id || !p.name || typeof p.name !== 'string') {
      return { isValid: false, isEncrypted: false, error: 'One or more projects are malformed.' }
    }
  }

  for (const i of obj.issues as Array<Record<string, unknown>>) {
    if (!i.id || !i.title || !i.type || !i.status) {
      return { isValid: false, isEncrypted: false, error: 'One or more issues are malformed.' }
    }
  }

  for (const s of obj.screenshots as Array<Record<string, unknown>>) {
    if (!s.id || !s.dataUrl || typeof s.dataUrl !== 'string') {
      return { isValid: false, isEncrypted: false, error: 'One or more screenshots are malformed.' }
    }
  }

  const backupData = obj as unknown as BackupData

  return {
    isValid: true,
    isEncrypted: false,
    data: backupData,
    summary: {
      projectsCount: backupData.projects.length,
      issuesCount: backupData.issues.length,
      screenshotsCount: backupData.screenshots.length,
      createdAt: backupData.createdAt,
    }
  }
}

export async function restoreBackupData(backupData: BackupData): Promise<void> {
  const db = await getDB()

  // Convert screenshot data URLs back to Blobs before the transaction
  const screenshotsToRestore: Screenshot[] = backupData.screenshots.map(s => ({
    id: s.id,
    blob: dataUrlToBlob(s.dataUrl),
    mimeType: s.mimeType,
    filename: s.filename,
    createdAt: s.createdAt,
  }))

  // Atomic IndexedDB transaction across all 4 stores
  const tx = db.transaction(['projects', 'issues', 'screenshots', 'settings'], 'readwrite')

  try {
    const projectStore = tx.objectStore('projects')
    const issueStore = tx.objectStore('issues')
    const screenshotStore = tx.objectStore('screenshots')
    const settingsStore = tx.objectStore('settings')

    // Clear existing data
    await projectStore.clear()
    await issueStore.clear()
    await screenshotStore.clear()

    // Populate projects
    for (const project of backupData.projects) {
      await projectStore.put(project)
    }

    // Populate issues
    for (const issue of backupData.issues) {
      await issueStore.put(issue)
    }

    // Populate screenshots
    for (const screenshot of screenshotsToRestore) {
      await screenshotStore.put(screenshot)
    }

    // Populate settings
    if (backupData.settings) {
      await settingsStore.put({ id: 'app_settings', ...backupData.settings })
    }

    await tx.done
  } catch (err) {
    tx.abort()
    throw new Error(`Restoration failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}
