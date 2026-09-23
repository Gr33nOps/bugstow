import fs from 'node:fs'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGzip, createGunzip } from 'node:zlib'
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto'
import { config } from './config.ts'

/**
 * Encrypted backup archives for cloud storage.
 *
 * A finished local backup folder (bugstow.sqlite, screenshots/, manifest.json)
 * is streamed into ONE file:
 *
 *   "BGSTWBK1" | salt (16) | iv (12) | AES-256-GCM( gzip( records ) ) | tag (16)
 *   record = u32 nameLength | name | u64 size | bytes     (nameLength 0 = end)
 *
 * The key comes from BUGSTOW_BACKUP_ENCRYPTION_PASSPHRASE via scrypt. Without
 * that passphrase nothing is uploaded: cloud copies are always encrypted.
 * Every archive is decrypted once and checked before it is sent anywhere.
 *
 * Targets (any combination):
 *  - BUGSTOW_BACKUP_CLOUD_DIR: a folder a cloud desktop app syncs (Google
 *    Drive, Dropbox, OneDrive, Mega, Terabox, iCloud...). Needs the
 *    .bugstow-backup-target marker, like the external backup folder.
 *  - BUGSTOW_BACKUP_WEBDAV_URL (+ _USER, _PASSWORD): Nextcloud, ownCloud,
 *    pCloud, Koofr, Synology... Uploaded with PUT and checked by size.
 *
 * Restore: `npm run decrypt-backup -- <archive> <output folder>` gives back a
 * normal backup folder, then follow the usual restore steps.
 */

const MAGIC = Buffer.from('BGSTWBK1')
const HEADER = MAGIC.length + 16 + 12
const TAG = 16
export const ARCHIVE_EXT = '.bugstow-backup'

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
}

function u32(n: number) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n)
  return b
}
function u64(n: number) {
  const b = Buffer.alloc(8)
  b.writeBigUInt64BE(BigInt(n))
  return b
}

/** Files of a backup folder, manifest first. */
function backupEntries(dir: string): Array<{ name: string; abs: string; size: number }> {
  const list = [
    { name: 'manifest.json', abs: path.join(dir, 'manifest.json') },
    { name: 'bugstow.sqlite', abs: path.join(dir, 'bugstow.sqlite') },
    ...fs
      .readdirSync(path.join(dir, 'screenshots'))
      .map(f => ({ name: `screenshots/${f}`, abs: path.join(dir, 'screenshots', f) })),
  ]
  return list.map(e => ({ ...e, size: fs.statSync(e.abs).size }))
}

async function* records(dir: string): AsyncGenerator<Buffer> {
  for (const e of backupEntries(dir)) {
    const name = Buffer.from(e.name, 'utf8')
    yield Buffer.concat([u32(name.length), name, u64(e.size)])
    for await (const chunk of fs.createReadStream(e.abs)) yield chunk as Buffer
  }
  yield u32(0)
}

/** Encrypt a local backup folder into one archive file. */
export async function createArchive(backupDir: string, outFile: string, passphrase: string): Promise<void> {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv)
  fs.writeFileSync(outFile, Buffer.concat([MAGIC, salt, iv]))
  await pipeline(Readable.from(records(backupDir)), createGzip(), cipher, fs.createWriteStream(outFile, { flags: 'a' }))
  fs.appendFileSync(outFile, cipher.getAuthTag())
}

/** Parses the record stream; calls onFile for each file's bytes. */
class RecordParser extends Writable {
  private buf = Buffer.alloc(0)
  private state: 'len' | 'name' | 'size' | 'data' | 'done' = 'len'
  private nameLen = 0
  private name = ''
  private remaining = 0
  constructor(
    private onStart: (name: string, size: number) => void,
    private onData: (chunk: Buffer) => void,
    private onEnd: () => void
  ) {
    super()
  }
  _write(chunk: Buffer, _enc: BufferEncoding, cb: (e?: Error | null) => void) {
    try {
      this.buf = Buffer.concat([this.buf, chunk])
      for (;;) {
        if (this.state === 'len') {
          if (this.buf.length < 4) break
          this.nameLen = this.buf.readUInt32BE(0)
          this.buf = this.buf.subarray(4)
          if (this.nameLen === 0) this.state = 'done'
          else if (this.nameLen > 1024) throw new Error('Archive is damaged (bad file name length).')
          else this.state = 'name'
        } else if (this.state === 'name') {
          if (this.buf.length < this.nameLen) break
          this.name = this.buf.subarray(0, this.nameLen).toString('utf8')
          this.buf = this.buf.subarray(this.nameLen)
          this.state = 'size'
        } else if (this.state === 'size') {
          if (this.buf.length < 8) break
          this.remaining = Number(this.buf.readBigUInt64BE(0))
          this.buf = this.buf.subarray(8)
          this.onStart(this.name, this.remaining)
          this.state = 'data'
          if (this.remaining === 0) {
            this.onEnd()
            this.state = 'len'
          }
        } else if (this.state === 'data') {
          if (this.buf.length === 0) break
          const take = this.buf.subarray(0, this.remaining)
          this.onData(take)
          this.remaining -= take.length
          this.buf = this.buf.subarray(take.length)
          if (this.remaining === 0) {
            this.onEnd()
            this.state = 'len'
          }
        } else {
          if (this.buf.length) throw new Error('Archive is damaged (data after the end).')
          break
        }
      }
      cb()
    } catch (e) {
      cb(e as Error)
    }
  }
  _final(cb: (e?: Error | null) => void) {
    cb(this.state === 'done' ? null : new Error('Archive is incomplete.'))
  }
}

const SAFE_NAME = /^(manifest\.json|bugstow\.sqlite|screenshots\/[A-Za-z0-9._-]+)$/

/**
 * Decrypt and read an archive. Writes files to `outDir` if given (into a
 * temporary folder that is renamed only if the whole archive checks out).
 * Throws if the passphrase is wrong or anything was changed.
 */
export async function readArchive(
  file: string,
  passphrase: string,
  outDir?: string
): Promise<{ files: number; bytes: number; manifest: Record<string, unknown> }> {
  const stat = fs.statSync(file)
  if (stat.size < HEADER + TAG) throw new Error('Not a BugsTow backup archive.')
  const fd = fs.openSync(file, 'r')
  const head = Buffer.alloc(HEADER)
  const tag = Buffer.alloc(TAG)
  fs.readSync(fd, head, 0, HEADER, 0)
  fs.readSync(fd, tag, 0, TAG, stat.size - TAG)
  fs.closeSync(fd)
  if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not a BugsTow backup archive.')
  const salt = head.subarray(MAGIC.length, MAGIC.length + 16)
  const iv = head.subarray(MAGIC.length + 16, HEADER)
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv)
  decipher.setAuthTag(tag)

  const tmp = outDir ? `${outDir}.incomplete` : null
  if (tmp) {
    fs.rmSync(tmp, { recursive: true, force: true })
    fs.mkdirSync(path.join(tmp, 'screenshots'), { recursive: true })
  }
  let files = 0
  let bytes = 0
  let current: { name: string; fd: number | null; chunks: Buffer[] } | null = null
  let manifestText = ''
  const parser = new RecordParser(
    (name, size) => {
      if (!SAFE_NAME.test(name) || name.split('/').some(part => /^\.+$/.test(part))) {
        throw new Error(`Archive contains an unexpected file: ${name}`)
      }
      current = { name, fd: tmp ? fs.openSync(path.join(tmp, name), 'w') : null, chunks: [] }
      files++
      bytes += size
    },
    chunk => {
      if (!current) return
      if (current.fd !== null) fs.writeSync(current.fd, chunk)
      if (current.name === 'manifest.json') current.chunks.push(Buffer.from(chunk))
    },
    () => {
      if (!current) return
      if (current.fd !== null) fs.closeSync(current.fd)
      if (current.name === 'manifest.json') manifestText = Buffer.concat(current.chunks).toString('utf8')
      current = null
    }
  )
  try {
    await pipeline(
      fs.createReadStream(file, { start: HEADER, end: stat.size - TAG - 1 }),
      decipher,
      createGunzip(),
      parser
    )
  } catch (e) {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true })
    const msg = e instanceof Error ? e.message : String(e)
    if (/unable to authenticate|auth/i.test(msg) || /incorrect header check|invalid/i.test(msg)) {
      throw new Error('Wrong passphrase, or the archive was damaged or changed.')
    }
    throw e
  }
  const manifest = JSON.parse(manifestText || '{}') as Record<string, unknown>
  if (tmp && outDir) {
    fs.rmSync(outDir, { recursive: true, force: true })
    fs.renameSync(tmp, outDir)
  }
  return { files, bytes, manifest }
}

// ── Targets ──────────────────────────────────────────────────────────────────

export interface CloudBackupStatus {
  configured: boolean
  targets: string[]
  encrypted: boolean
  lastSuccessAt: string | null
  lastArchive: string | null
  lastError: string | null
  lastErrorAt: string | null
}

const status: CloudBackupStatus = {
  configured: false,
  targets: [],
  encrypted: false,
  lastSuccessAt: null,
  lastArchive: null,
  lastError: null,
  lastErrorAt: null,
}

function targets(): string[] {
  const t: string[] = []
  if (config.backupCloudDir) t.push(`folder ${config.backupCloudDir}`)
  if (config.backupWebdavUrl) t.push(`WebDAV ${new URL(config.backupWebdavUrl).host}`)
  return t
}

export function getCloudBackupStatus(): CloudBackupStatus {
  const t = targets()
  return { ...status, configured: t.length > 0, targets: t, encrypted: !!config.backupEncryptionPassphrase }
}

function webdavBase(): string {
  return config.backupWebdavUrl.replace(/\/?$/, '/')
}
function webdavAuth(): Record<string, string> {
  return {
    Authorization: 'Basic ' + Buffer.from(`${config.backupWebdavUser}:${config.backupWebdavPassword}`).toString('base64'),
  }
}

async function sendToWebDav(archive: string, name: string): Promise<void> {
  const size = fs.statSync(archive).size
  let res: Response
  try {
    res = await fetch(webdavBase() + encodeURIComponent(name), {
      method: 'PUT',
      headers: { ...webdavAuth(), 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) },
      body: Readable.toWeb(fs.createReadStream(archive)) as ReadableStream,
      duplex: 'half',
    } as RequestInit)
  } catch (e) {
    throw new Error(`could not reach the WebDAV server (${e instanceof Error ? e.message : e})`)
  }
  if (res.status === 401 || res.status === 403) throw new Error('the WebDAV server refused the username or password')
  if (!res.ok) throw new Error(`the WebDAV upload failed (${res.status})`)
  // Check the stored size.
  const head = await fetch(webdavBase() + encodeURIComponent(name), { method: 'HEAD', headers: webdavAuth() })
  const stored = Number(head.headers.get('content-length'))
  if (head.ok && Number.isFinite(stored) && stored > 0 && stored !== size) {
    throw new Error(`the WebDAV server stored ${stored} bytes instead of ${size}`)
  }
  await rotateWebDav()
}

async function rotateWebDav(): Promise<void> {
  const res = await fetch(webdavBase(), { method: 'PROPFIND', headers: { ...webdavAuth(), Depth: '1' } })
  if (res.status !== 207) return
  const xml = await res.text()
  const names = [...xml.matchAll(/<(?:[a-zA-Z0-9]+:)?href>([^<]+)<\/(?:[a-zA-Z0-9]+:)?href>/g)]
    .map(m => decodeURIComponent(m[1]).split('/').filter(Boolean).pop() || '')
    .filter(n => n.startsWith('bugstow-backup-') && n.endsWith(ARCHIVE_EXT))
    .sort((a, b) => a.localeCompare(b))
  const excess = names.length - Math.max(1, config.backupCloudRetention)
  for (let i = 0; i < excess; i++) {
    await fetch(webdavBase() + encodeURIComponent(names[i]), { method: 'DELETE', headers: webdavAuth() })
  }
}

function sendToFolder(archive: string, name: string): void {
  const root = config.backupCloudDir
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('the cloud folder does not exist. Is the cloud app installed and the folder mounted?')
  }
  if (!fs.existsSync(path.join(root, '.bugstow-backup-target'))) {
    throw new Error('the cloud folder has no .bugstow-backup-target marker file (create it once)')
  }
  const tmp = path.join(root, `.incomplete-${name}`)
  fs.copyFileSync(archive, tmp)
  if (fs.statSync(tmp).size !== fs.statSync(archive).size) {
    fs.rmSync(tmp, { force: true })
    throw new Error('the copy in the cloud folder has the wrong size')
  }
  fs.renameSync(tmp, path.join(root, name))
  const all = fs
    .readdirSync(root)
    .filter(n => n.startsWith('bugstow-backup-') && n.endsWith(ARCHIVE_EXT))
    .sort((a, b) => a.localeCompare(b))
  for (let i = 0; i < all.length - Math.max(1, config.backupCloudRetention); i++) fs.rmSync(path.join(root, all[i]), { force: true })
}

/**
 * Encrypt a finished local backup and send it to the configured cloud
 * targets. Failures are recorded and logged; they never stop the server.
 */
export async function sendCloudBackup(localBackupDir: string, backupName: string): Promise<CloudBackupStatus> {
  if (!targets().length) return getCloudBackupStatus()
  const fail = (message: string) => {
    status.lastError = message
    status.lastErrorAt = new Date().toISOString()
    console.error(`\n  CLOUD BACKUP FAILED: ${message}`)
    console.error('  The local backup in /data/backups succeeded. BugsTow keeps running.\n')
    return getCloudBackupStatus()
  }
  const passphrase = config.backupEncryptionPassphrase
  if (!passphrase) return fail('BUGSTOW_BACKUP_ENCRYPTION_PASSPHRASE is not set. Cloud backups are only sent encrypted.')

  const name = `bugstow-backup-${backupName}${ARCHIVE_EXT}`
  const staging = path.join(config.backupsDir, '.cloud-staging')
  fs.mkdirSync(staging, { recursive: true })
  const archive = path.join(staging, name)
  try {
    await createArchive(localBackupDir, archive, passphrase)
    await readArchive(archive, passphrase) // decrypt once to prove it's complete and correct
    const errors: string[] = []
    if (config.backupCloudDir) {
      try {
        sendToFolder(archive, name)
      } catch (e) {
        errors.push(`folder: ${e instanceof Error ? e.message : e}`)
      }
    }
    if (config.backupWebdavUrl) {
      try {
        await sendToWebDav(archive, name)
      } catch (e) {
        errors.push(`WebDAV: ${e instanceof Error ? e.message : e}`)
      }
    }
    if (errors.length) return fail(errors.join('; '))
    status.lastSuccessAt = new Date().toISOString()
    status.lastArchive = name
    status.lastError = null
    status.lastErrorAt = null
    return getCloudBackupStatus()
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e))
  } finally {
    fs.rmSync(archive, { force: true })
  }
}
