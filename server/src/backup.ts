import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { db } from './db.ts'
import { config } from './config.ts'
import { sendCloudBackup, getCloudBackupStatus, type CloudBackupStatus } from './cloudBackup.ts'

/**
 * Automatic backups. Each backup is a self-contained folder
 * `<timestamp>/` containing a consistent copy of the SQLite database, every
 * screenshot file, and a manifest. Everything stays on hardware you control —
 * no network, no external services.
 *
 * 1. A local copy is always written to /data/backups (same volume as the live
 *    data: protects against mistakes, not against losing the disk).
 * 2. If BUGSTOW_BACKUP_EXTERNAL_DIR is set, the same backup is also copied to
 *    that folder (another drive, a USB disk, a mounted NAS share). The copy is
 *    written to a temporary folder, verified, then renamed into place, so a
 *    half-written backup never looks complete. If the external location is
 *    unavailable the failure is logged and reported to the admin, and the
 *    server keeps running.
 *
 * 3. If a cloud target is configured, an encrypted archive of the backup is
 *    sent to your own cloud (see cloudBackup.ts).
 *
 * Backups never write to the live database or screenshots folder. Restore is a
 * documented manual procedure (docs/RELEASE_OFFLINE.md §8).
 */

export interface BackupManifest {
  app: 'bugstow'
  createdAt: string
  database: string
  databaseBytes: number
  screenshots: number
  screenshotBytes: number
}

export const EXTERNAL_MARKER = '.bugstow-backup-target'

export interface ExternalBackupStatus {
  configured: boolean
  dir: string | null
  lastSuccessAt: string | null
  lastBackup: string | null
  lastError: string | null
  lastErrorAt: string | null
}

const externalStatus: ExternalBackupStatus = {
  configured: Boolean(config.backupExternalDir),
  dir: config.backupExternalDir || null,
  lastSuccessAt: null,
  lastBackup: null,
  lastError: null,
  lastErrorAt: null,
}

export function getExternalBackupStatus(): ExternalBackupStatus {
  return { ...externalStatus }
}

function tsName(): string {
  // Filesystem-safe ISO timestamp: 2026-09-22T10-30-00-000Z
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/**
 * Check that a backup folder is complete and readable: manifest present, the
 * database opens and passes SQLite's integrity check, and the screenshot count
 * and sizes match the manifest. Throws with a clear message otherwise.
 */
export function verifyBackup(dir: string): BackupManifest {
  const manifestPath = path.join(dir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) throw new Error(`manifest.json missing in ${dir}`)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as BackupManifest

  const dbPath = path.join(dir, manifest.database)
  if (!fs.existsSync(dbPath)) throw new Error(`database file missing in ${dir}`)
  if (fs.statSync(dbPath).size !== manifest.databaseBytes) throw new Error(`database size mismatch in ${dir}`)
  const copy = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const result = copy.pragma('integrity_check', { simple: true })
    if (result !== 'ok') throw new Error(`database integrity check failed in ${dir}: ${String(result)}`)
  } finally {
    copy.close()
  }

  const shotsDir = path.join(dir, 'screenshots')
  const files = fs.existsSync(shotsDir) ? fs.readdirSync(shotsDir) : []
  let bytes = 0
  for (const f of files) bytes += fs.statSync(path.join(shotsDir, f)).size
  if (files.length !== manifest.screenshots || bytes !== manifest.screenshotBytes) {
    throw new Error(
      `screenshots mismatch in ${dir}: expected ${manifest.screenshots} files/${manifest.screenshotBytes} bytes, ` +
        `found ${files.length}/${bytes}`
    )
  }
  return manifest
}

export async function runBackup(): Promise<{
  dir: string
  manifest: BackupManifest
  external: ExternalBackupStatus
  cloud: CloudBackupStatus
}> {
  const name = tsName()
  const dir = path.join(config.backupsDir, name)
  const shotsDir = path.join(dir, 'screenshots')
  fs.mkdirSync(shotsDir, { recursive: true })

  // Consistent DB snapshot (better-sqlite3 online backup API).
  const dbDest = path.join(dir, 'bugstow.sqlite')
  await db.backup(dbDest)
  // Make the copy a plain single-file database (no -wal/-shm side files), so it
  // can be verified read-only and restored by copying one file.
  const snapshot = new Database(dbDest)
  snapshot.pragma('journal_mode = DELETE')
  snapshot.close()

  // Copy screenshots (hard-link when possible to avoid duplicating bytes on the
  // same volume; screenshots are immutable, so links are safe. Fall back to a
  // real copy).
  let screenshots = 0
  let screenshotBytes = 0
  if (fs.existsSync(config.screenshotsDir)) {
    for (const file of fs.readdirSync(config.screenshotsDir)) {
      const src = path.join(config.screenshotsDir, file)
      const stat = fs.statSync(src)
      if (!stat.isFile()) continue
      const dest = path.join(shotsDir, file)
      try {
        fs.linkSync(src, dest)
      } catch {
        fs.copyFileSync(src, dest)
      }
      screenshots++
      screenshotBytes += stat.size
    }
  }

  const manifest: BackupManifest = {
    app: 'bugstow',
    createdAt: new Date().toISOString(),
    database: 'bugstow.sqlite',
    databaseBytes: fs.statSync(dbDest).size,
    screenshots,
    screenshotBytes,
  }
  // Manifest last: a folder without one is incomplete and is never listed.
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  verifyBackup(dir)
  rotate(config.backupsDir, config.backupRetention)

  if (config.backupExternalDir) {
    try {
      copyToExternal(dir, name)
      externalStatus.lastSuccessAt = new Date().toISOString()
      externalStatus.lastBackup = name
      externalStatus.lastError = null
      externalStatus.lastErrorAt = null
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      externalStatus.lastError = message
      externalStatus.lastErrorAt = new Date().toISOString()
      console.error(`\n  EXTERNAL BACKUP FAILED (${config.backupExternalDir}): ${message}`)
      console.error('  The local backup in /data/backups succeeded. BugsTow keeps running.\n')
    }
  }

  const cloud = await sendCloudBackup(dir, name)

  return { dir, manifest, external: getExternalBackupStatus(), cloud: cloud ?? getCloudBackupStatus() }
}

/** Copy a finished local backup to the external location, atomically. */
function copyToExternal(localDir: string, name: string): void {
  const root = config.backupExternalDir
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('folder does not exist. Is the drive or network share mounted?')
  }
  if (!fs.existsSync(path.join(root, EXTERNAL_MARKER))) {
    throw new Error(
      `marker file ${EXTERNAL_MARKER} not found. Create it once in the backup folder on the ` +
        'external drive; this stops BugsTow writing to the wrong disk when the drive is not mounted.'
    )
  }
  const resolvedRoot = path.resolve(root)
  const data = path.resolve(config.dataDir)
  if (resolvedRoot === data || resolvedRoot.startsWith(data + path.sep)) {
    throw new Error('the external backup folder is inside the BugsTow data folder, so it would not survive losing that disk.')
  }

  const tmp = path.join(root, `.incomplete-${name}`)
  const final = path.join(root, name)
  fs.rmSync(tmp, { recursive: true, force: true })
  try {
    // Real copies (never hard links) so the external backup is independent.
    fs.mkdirSync(path.join(tmp, 'screenshots'), { recursive: true })
    fs.copyFileSync(path.join(localDir, 'bugstow.sqlite'), path.join(tmp, 'bugstow.sqlite'))
    const shots = path.join(localDir, 'screenshots')
    for (const f of fs.readdirSync(shots)) {
      fs.copyFileSync(path.join(shots, f), path.join(tmp, 'screenshots', f))
    }
    fs.copyFileSync(path.join(localDir, 'manifest.json'), path.join(tmp, 'manifest.json'))
    verifyBackup(tmp)
    fs.renameSync(tmp, final)
  } catch (err) {
    fs.rmSync(tmp, { recursive: true, force: true })
    throw err
  }
  rotate(root, config.backupExternalRetention)
}

function rotate(root: string, keep: number): void {
  const entries = listBackupsIn(root)
  const excess = entries.length - Math.max(1, keep)
  for (let i = 0; i < excess; i++) {
    fs.rmSync(path.join(root, entries[i]), { recursive: true, force: true })
  }
}

/** Complete backup folder names in `root`, oldest first. */
function listBackupsIn(root: string): string[] {
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root)
    .filter(n => !n.startsWith('.') && fs.existsSync(path.join(root, n, 'manifest.json')))
    .sort()
}

/** Local backup folder names, oldest first. */
export function listBackups(): string[] {
  return listBackupsIn(config.backupsDir)
}

/** External backup folder names, oldest first (empty if not configured/unavailable). */
export function listExternalBackups(): string[] {
  if (!config.backupExternalDir) return []
  try {
    return listBackupsIn(config.backupExternalDir)
  } catch {
    return []
  }
}

let timer: NodeJS.Timeout | null = null

export function startBackupScheduler(): void {
  if (!config.backupEnabled) return
  const intervalMs = Math.max(0.25, config.backupIntervalHours) * 60 * 60 * 1000
  const run = () => runBackup().catch(err => console.error('\n  BACKUP FAILED:', err instanceof Error ? err.message : err, '\n'))
  // Take one shortly after startup so a fresh install has a baseline backup,
  // then on the configured interval.
  setTimeout(run, 60 * 1000).unref?.()
  timer = setInterval(run, intervalMs)
  timer.unref?.()
}
