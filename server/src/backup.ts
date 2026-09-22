import fs from 'node:fs'
import path from 'node:path'
import { db } from './db.ts'
import { config } from './config.ts'

/**
 * Automatic local backups. Each backup is a self-contained folder under
 * /data/backups/<timestamp>/ containing a consistent copy of the SQLite
 * database and all screenshot files, plus a manifest. Everything stays on the
 * host — no network, no external services.
 *
 * Restore is a documented, verifiable procedure (see docs/OFFLINE.md): stop the
 * server, copy the backup's bugstow.sqlite and screenshots/ back into /data,
 * and start again.
 */

export interface BackupManifest {
  createdAt: string
  database: string
  databaseBytes: number
  screenshots: number
  screenshotBytes: number
}

function tsName(): string {
  // Filesystem-safe ISO timestamp: 2026-09-22T10-30-00-000Z
  return new Date().toISOString().replace(/[:.]/g, '-')
}

export async function runBackup(): Promise<{ dir: string; manifest: BackupManifest }> {
  const name = tsName()
  const dir = path.join(config.backupsDir, name)
  const shotsDir = path.join(dir, 'screenshots')
  fs.mkdirSync(shotsDir, { recursive: true })

  // Consistent DB snapshot (better-sqlite3 online backup API).
  const dbDest = path.join(dir, 'bugstow.sqlite')
  await db.backup(dbDest)

  // Copy screenshots (hard-link when possible to avoid duplicating bytes;
  // screenshots are immutable, so links are safe. Fall back to a real copy).
  let screenshots = 0
  let screenshotBytes = 0
  if (fs.existsSync(config.screenshotsDir)) {
    for (const file of fs.readdirSync(config.screenshotsDir)) {
      const src = path.join(config.screenshotsDir, file)
      const dest = path.join(shotsDir, file)
      const stat = fs.statSync(src)
      if (!stat.isFile()) continue
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
    createdAt: new Date().toISOString(),
    database: 'bugstow.sqlite',
    databaseBytes: fs.existsSync(dbDest) ? fs.statSync(dbDest).size : 0,
    screenshots,
    screenshotBytes,
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  rotate()
  return { dir, manifest }
}

function rotate(): void {
  const entries = listBackups()
  const excess = entries.length - config.backupRetention
  for (let i = 0; i < excess; i++) {
    fs.rmSync(path.join(config.backupsDir, entries[i]), { recursive: true, force: true })
  }
}

/** Backup folder names, oldest first. */
export function listBackups(): string[] {
  if (!fs.existsSync(config.backupsDir)) return []
  return fs
    .readdirSync(config.backupsDir)
    .filter(n => fs.existsSync(path.join(config.backupsDir, n, 'manifest.json')))
    .sort()
}

let timer: NodeJS.Timeout | null = null

export function startBackupScheduler(): void {
  if (!config.backupEnabled) return
  const intervalMs = Math.max(0.25, config.backupIntervalHours) * 60 * 60 * 1000
  // Take one shortly after startup so a fresh install has a baseline backup,
  // then on the configured interval.
  setTimeout(() => {
    runBackup().catch(err => console.error('Backup failed:', err))
  }, 60 * 1000)
  timer = setInterval(() => {
    runBackup().catch(err => console.error('Backup failed:', err))
  }, intervalMs)
  timer.unref?.()
}
