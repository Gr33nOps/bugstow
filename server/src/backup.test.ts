import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-backup-'))
// A separate folder standing in for a USB disk / NAS share.
const external = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-external-'))
process.env.BUGSTOW_DATA_DIR = tmp
process.env.BUGSTOW_AUTH_SECRET = 'test-secret-abcdefghijklmnop'
process.env.BUGSTOW_BACKUP_EXTERNAL_DIR = external
process.env.BUGSTOW_BACKUP_EXTERNAL_RETENTION = '2'

const { config } = await import('./config.ts')
const { db, migrateAppSchema } = await import('./db.ts')
const { saveScreenshot } = await import('./storage.ts')
const { runBackup, listBackups, listExternalBackups, verifyBackup, getExternalBackupStatus, EXTERNAL_MARKER } =
  await import('./backup.ts')
const Database = (await import('better-sqlite3')).default

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQGYR54AAAAASUVORK5CYII='

migrateAppSchema()
const now = new Date().toISOString()
db.prepare('insert into teams (id, name, created_by, created_at) values (?,?,?,?)').run('t1', 'Team', 'u1', now)
db.prepare('insert into issues (id, team_id, title, created_by, created_at, updated_at) values (?,?,?,?,?,?)').run(
  'i1', 't1', 'An issue', 'u1', now, now
)
const shot = saveScreenshot(PNG, 'image/png')
db.prepare(
  'insert into screenshots (id, issue_id, team_id, mime_type, storage_path, created_at) values (?,?,?,?,?,?)'
).run('s1', 'i1', 't1', 'image/png', shot.storagePath, now)

test('offline mode is on by default (no external calls)', () => {
  assert.equal(config.offline, true)
})

test('an unavailable external location is reported but the local backup still succeeds', async () => {
  // No marker file yet: treated like an unmounted drive.
  const { dir } = await runBackup()
  assert.ok(fs.existsSync(path.join(dir, 'manifest.json')), 'local backup written')
  const status = getExternalBackupStatus()
  assert.match(status.lastError || '', /marker file/)
  assert.equal(listExternalBackups().length, 0, 'nothing written to the unmarked folder')
})

test('a missing external folder is reported, not created', async () => {
  const saved = config.backupExternalDir
  ;(config as { backupExternalDir: string }).backupExternalDir = path.join(external, 'not-mounted')
  try {
    await runBackup()
    assert.match(getExternalBackupStatus().lastError || '', /does not exist/)
    assert.equal(fs.existsSync(path.join(external, 'not-mounted')), false)
  } finally {
    ;(config as { backupExternalDir: string }).backupExternalDir = saved
  }
})

test('backups are verified and copied to the external location', async () => {
  fs.writeFileSync(path.join(external, EXTERNAL_MARKER), '')
  const { dir, manifest, external: status } = await runBackup()

  assert.equal(manifest.screenshots, 1)
  assert.ok(fs.existsSync(path.join(dir, 'screenshots', shot.storagePath)), 'screenshot in local backup')
  assert.equal(status.lastError, null)
  assert.ok(status.lastBackup)

  const extDir = path.join(external, status.lastBackup!)
  const extManifest = verifyBackup(extDir)
  assert.equal(extManifest.screenshots, 1)
  assert.ok(!fs.readdirSync(external).some(n => n.startsWith('.incomplete-')), 'no temp folder left')
  assert.ok(!fs.existsSync(path.join(extDir, 'bugstow.sqlite-wal')), 'single-file database')
  // Independent copy, not a hard link to the live screenshot.
  assert.equal(fs.statSync(path.join(extDir, 'screenshots', shot.storagePath)).nlink, 1)
})

test('restoring from the external backup recovers the database and screenshots', () => {
  const status = getExternalBackupStatus()
  const extDir = path.join(external, status.lastBackup!)

  // Documented procedure: copy bugstow.sqlite and screenshots/ into an empty data folder.
  const restoreData = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-restore-'))
  fs.copyFileSync(path.join(extDir, 'bugstow.sqlite'), path.join(restoreData, 'bugstow.sqlite'))
  fs.cpSync(path.join(extDir, 'screenshots'), path.join(restoreData, 'screenshots'), { recursive: true })

  const restored = new Database(path.join(restoreData, 'bugstow.sqlite'), { readonly: true })
  const issue = restored.prepare('select title from issues where id = ?').get('i1') as { title: string }
  const row = restored.prepare('select storage_path from screenshots where id = ?').get('s1') as { storage_path: string }
  restored.close()
  assert.equal(issue.title, 'An issue')
  const original = fs.readFileSync(path.join(config.screenshotsDir, shot.storagePath))
  const recovered = fs.readFileSync(path.join(restoreData, 'screenshots', row.storage_path))
  assert.ok(original.equals(recovered), 'screenshot bytes identical')
})

test('external retention keeps the newest backups only', async () => {
  await runBackup()
  await runBackup()
  assert.equal(listExternalBackups().length, 2)
  assert.ok(listBackups().length >= 1)
})

test('verification catches an incomplete backup', () => {
  const status = getExternalBackupStatus()
  const copy = path.join(os.tmpdir(), `bugstow-tamper-${Date.now()}`)
  fs.cpSync(path.join(external, status.lastBackup!), copy, { recursive: true })
  fs.rmSync(path.join(copy, 'screenshots', shot.storagePath))
  assert.throws(() => verifyBackup(copy), /screenshots mismatch/)
})
