import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-backup-'))
process.env.BUGSTOW_DATA_DIR = tmp
process.env.BUGSTOW_AUTH_SECRET = 'test-secret-abcdefghijklmnop'

const { config } = await import('./config.ts')
const { db, migrateAppSchema } = await import('./db.ts')
const { saveScreenshot } = await import('./storage.ts')
const { runBackup, listBackups } = await import('./backup.ts')
const Database = (await import('better-sqlite3')).default

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQGYR54AAAAASUVORK5CYII='

test('offline mode is on by default (no external calls)', () => {
  assert.equal(config.offline, true)
})

test('runBackup snapshots the database and screenshots, and can be restored', async () => {
  migrateAppSchema()
  const now = new Date().toISOString()
  db.prepare('insert into teams (id, name, created_by, created_at) values (?,?,?,?)').run('t1', 'Team', 'u1', now)
  db.prepare(
    'insert into issues (id, team_id, title, created_by, created_at, updated_at) values (?,?,?,?,?,?)'
  ).run('i1', 't1', 'An issue', 'u1', now, now)
  const shot = saveScreenshot(PNG, 'image/png')
  db.prepare(
    'insert into screenshots (id, issue_id, team_id, mime_type, storage_path, created_at) values (?,?,?,?,?,?)'
  ).run('s1', 'i1', 't1', 'image/png', shot.storagePath, now)

  const { dir, manifest } = await runBackup()

  // Backup artifacts exist.
  assert.ok(fs.existsSync(path.join(dir, 'bugstow.sqlite')), 'db snapshot exists')
  assert.ok(fs.existsSync(path.join(dir, 'manifest.json')), 'manifest exists')
  assert.equal(manifest.screenshots, 1)
  assert.ok(fs.existsSync(path.join(dir, 'screenshots', shot.storagePath)), 'screenshot copied')
  assert.ok(listBackups().length >= 1)

  // Restore verification: the snapshot DB contains the data independently.
  const restored = new Database(path.join(dir, 'bugstow.sqlite'), { readonly: true })
  const issues = restored.prepare('select count(*) as n from issues').get() as { n: number }
  const shots = restored.prepare('select count(*) as n from screenshots').get() as { n: number }
  restored.close()
  assert.equal(issues.n, 1)
  assert.equal(shots.n, 1)
})
