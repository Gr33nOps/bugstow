import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-cloudbk-'))
const cloudFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-cloudfolder-')) // e.g. a Google Drive / Mega synced folder
fs.writeFileSync(path.join(cloudFolder, '.bugstow-backup-target'), '')

// A WebDAV server standing in for Nextcloud & co.
const dav = new Map<string, Buffer>()
let davPass = 'app-password'
const server = http.createServer((req, res) => {
  const chunks: Buffer[] = []
  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    if (req.headers.authorization !== 'Basic ' + Buffer.from(`bugstow:${davPass}`).toString('base64')) return res.writeHead(401).end()
    const name = decodeURIComponent(new URL(req.url!, 'http://x').pathname.replace(/^\/backups\/?/, ''))
    if (req.method === 'PUT') {
      dav.set(name, Buffer.concat(chunks))
      return res.writeHead(201).end()
    }
    if (req.method === 'HEAD') {
      const f = dav.get(name)
      return f ? res.writeHead(200, { 'Content-Length': f.length }).end() : res.writeHead(404).end()
    }
    if (req.method === 'DELETE') return res.writeHead(dav.delete(name) ? 204 : 404).end()
    if (req.method === 'PROPFIND') {
      const items = [...dav.keys()].map(k => `<d:response><d:href>/backups/${encodeURIComponent(k)}</d:href></d:response>`).join('')
      return res.writeHead(207).end(`<d:multistatus xmlns:d="DAV:"><d:response><d:href>/backups/</d:href></d:response>${items}</d:multistatus>`)
    }
    res.writeHead(405).end()
  })
})
await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
after(() => server.close())

process.env.BUGSTOW_DATA_DIR = tmp
process.env.BUGSTOW_AUTH_SECRET = 'test-secret-abcdefghijklmnop'
process.env.BUGSTOW_BACKUP_ENCRYPTION_PASSPHRASE = 'correct horse battery staple'
process.env.BUGSTOW_BACKUP_CLOUD_DIR = cloudFolder
process.env.BUGSTOW_BACKUP_WEBDAV_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/backups/`
process.env.BUGSTOW_BACKUP_WEBDAV_USER = 'bugstow'
process.env.BUGSTOW_BACKUP_WEBDAV_PASSWORD = 'app-password'
process.env.BUGSTOW_BACKUP_CLOUD_RETENTION = '2'

const { config } = await import('./config.ts')
const { db, migrateAppSchema } = await import('./db.ts')
const { saveScreenshot } = await import('./storage.ts')
const { runBackup } = await import('./backup.ts')
const { readArchive, getCloudBackupStatus } = await import('./cloudBackup.ts')
const Database = (await import('better-sqlite3')).default

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQGYR54AAAAASUVORK5CYII='
let shotPath = ''

before(() => {
  migrateAppSchema()
  const now = new Date().toISOString()
  db.prepare('insert into teams (id, name, created_by, created_at) values (?,?,?,?)').run('t1', 'Team', 'u1', now)
  db.prepare('insert into issues (id, team_id, title, created_by, created_at, updated_at) values (?,?,?,?,?,?)').run(
    'i1', 't1', 'Payment page crashes', 'u1', now, now
  )
  const shot = saveScreenshot(PNG, 'image/png')
  shotPath = shot.storagePath
  db.prepare('insert into screenshots (id, issue_id, team_id, mime_type, storage_path, created_at) values (?,?,?,?,?,?)').run(
    's1', 'i1', 't1', 'image/png', shot.storagePath, now
  )
})

const archivesIn = (dir: string) => fs.readdirSync(dir).filter(n => n.endsWith('.bugstow-backup')).sort()

test('each backup is sent encrypted to the cloud folder and to WebDAV', async () => {
  const { cloud } = await runBackup()
  assert.equal(cloud.lastError, null)
  assert.equal(cloud.encrypted, true)
  assert.equal(archivesIn(cloudFolder).length, 1)
  assert.equal([...dav.keys()].filter(k => k.endsWith('.bugstow-backup')).length, 1)
  // Nothing readable in the uploaded file.
  const uploaded = [...dav.values()][0].toString('latin1')
  assert.ok(!uploaded.includes('Payment page crashes'))
  assert.ok(!uploaded.includes('SQLite format'))
})

test('an archive from the cloud restores the database and screenshots exactly', async () => {
  const archive = path.join(cloudFolder, archivesIn(cloudFolder)[0])
  const out = path.join(tmp, 'restored')
  const { files, manifest } = await readArchive(archive, config.backupEncryptionPassphrase, out)
  assert.equal(files, 3) // manifest, database, one screenshot
  assert.equal(manifest.screenshots, 1)
  const restored = new Database(path.join(out, 'bugstow.sqlite'), { readonly: true })
  assert.equal(restored.pragma('integrity_check', { simple: true }), 'ok')
  assert.equal((restored.prepare("select title from issues where id = 'i1'").get() as { title: string }).title, 'Payment page crashes')
  restored.close()
  assert.ok(
    fs.readFileSync(path.join(out, 'screenshots', shotPath)).equals(fs.readFileSync(path.join(config.screenshotsDir, shotPath)))
  )
  // The same archive from WebDAV decrypts too.
  const fromDav = path.join(tmp, 'from-dav.bugstow-backup')
  fs.writeFileSync(fromDav, [...dav.entries()].find(([k]) => k.endsWith('.bugstow-backup'))![1])
  assert.equal((await readArchive(fromDav, config.backupEncryptionPassphrase)).files, 3)
})

test('a wrong passphrase, a changed byte or a cut-off file are all refused', async () => {
  const archive = path.join(cloudFolder, archivesIn(cloudFolder)[0])
  await assert.rejects(readArchive(archive, 'not the passphrase'), /Wrong passphrase|damaged/)

  const tampered = path.join(tmp, 'tampered.bugstow-backup')
  const bytes = fs.readFileSync(archive)
  bytes[Math.floor(bytes.length / 2)] ^= 0xff
  fs.writeFileSync(tampered, bytes)
  await assert.rejects(readArchive(tampered, config.backupEncryptionPassphrase, path.join(tmp, 'never')))
  assert.equal(fs.existsSync(path.join(tmp, 'never')), false, 'nothing is left behind from a bad archive')

  const cut = path.join(tmp, 'cut.bugstow-backup')
  fs.writeFileSync(cut, fs.readFileSync(archive).subarray(0, 200))
  await assert.rejects(readArchive(cut, config.backupEncryptionPassphrase))
})

test('cloud retention keeps only the newest archives in both places', async () => {
  await runBackup()
  await runBackup()
  assert.equal(archivesIn(cloudFolder).length, 2)
  assert.equal([...dav.keys()].filter(k => k.endsWith('.bugstow-backup')).length, 2)
})

test('one failing target is reported without stopping the other or the local backup', async () => {
  davPass = 'changed-on-server'
  const before = archivesIn(cloudFolder)
  const { dir, cloud } = await runBackup()
  assert.ok(fs.existsSync(path.join(dir, 'manifest.json')), 'local backup still made')
  assert.match(cloud.lastError || '', /WebDAV: .*refused/)
  assert.notDeepEqual(archivesIn(cloudFolder), before, 'the folder target still received the new archive')
  davPass = 'app-password'
})

test('without an encryption passphrase nothing is uploaded', async () => {
  const saved = config.backupEncryptionPassphrase
  ;(config as { backupEncryptionPassphrase: string }).backupEncryptionPassphrase = ''
  const before = archivesIn(cloudFolder)
  try {
    const { cloud } = await runBackup()
    assert.match(cloud.lastError || '', /ENCRYPTION_PASSPHRASE/)
    assert.deepEqual(archivesIn(cloudFolder), before)
    assert.equal(getCloudBackupStatus().encrypted, false)
  } finally {
    ;(config as { backupEncryptionPassphrase: string }).backupEncryptionPassphrase = saved
  }
})

test('an archive with a path-escaping file name is refused and nothing is written', async () => {
  const { randomBytes, scryptSync, createCipheriv } = await import('node:crypto')
  const { gzipSync } = await import('node:zlib')
  // Hand-build an archive in the documented format with a hostile name.
  const rec = (name: string, data: Buffer) => {
    const n = Buffer.from(name)
    const len = Buffer.alloc(4)
    len.writeUInt32BE(n.length)
    const size = Buffer.alloc(8)
    size.writeBigUInt64BE(BigInt(data.length))
    return Buffer.concat([len, n, size, data])
  }
  for (const hostile of ['../escape.txt', 'screenshots/..']) {
    const body = gzipSync(Buffer.concat([rec('manifest.json', Buffer.from('{}')), rec(hostile, Buffer.from('pwned')), Buffer.alloc(4)]))
    const salt = randomBytes(16)
    const iv = randomBytes(12)
    const key = scryptSync('pass-for-test', salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
    const c = createCipheriv('aes-256-gcm', key, iv)
    const ct = Buffer.concat([c.update(body), c.final()])
    const archive = path.join(tmp, 'hostile.bugstow-backup')
    fs.writeFileSync(archive, Buffer.concat([Buffer.from('BGSTWBK1'), salt, iv, ct, c.getAuthTag()]))
    const out = path.join(tmp, 'hostile-out')
    await assert.rejects(readArchive(archive, 'pass-for-test', out), /unexpected file/)
    assert.equal(fs.existsSync(out), false)
    assert.equal(fs.existsSync(path.join(tmp, 'escape.txt')), false)
  }
})
