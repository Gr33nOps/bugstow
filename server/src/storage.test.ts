import { test } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

// Isolate the data dir before importing modules that read config at load time.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bugstow-test-'))
process.env.BUGSTOW_DATA_DIR = tmp
process.env.BUGSTOW_AUTH_SECRET = 'test-secret-abcdefghijklmnop'

const { saveScreenshot, resolveScreenshot } = await import('./storage.ts')

// 1x1 transparent PNG.
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQGYR54AAAAASUVORK5CYII='

test('saveScreenshot stores a valid PNG and resolves back to a file', () => {
  const stored = saveScreenshot(PNG, 'image/png')
  assert.equal(stored.mimeType, 'image/png')
  const abs = resolveScreenshot(stored.storagePath)
  assert.ok(abs, 'stored screenshot should resolve')
  assert.ok(fs.existsSync(abs!), 'file should exist on disk')
})

test('saveScreenshot rejects disallowed mime types', () => {
  assert.throws(() => saveScreenshot(PNG, 'application/x-msdownload'))
  assert.throws(() => saveScreenshot(PNG, 'text/html'))
})

test('saveScreenshot enforces the size limit', () => {
  const big = Buffer.alloc(11 * 1024 * 1024, 1).toString('base64') // 11 MB > 10 MB default
  assert.throws(() => saveScreenshot(big, 'image/png'), /maximum/)
})

test('resolveScreenshot blocks path traversal', () => {
  assert.equal(resolveScreenshot('../secret.txt'), null)
  assert.equal(resolveScreenshot('../../etc/passwd'), null)
  assert.equal(resolveScreenshot('subdir/../../escape.png'), null)
})

test('resolveScreenshot returns null for missing files', () => {
  assert.equal(resolveScreenshot('does-not-exist.png'), null)
})

test('saveScreenshot rejects content that is not the declared image type', () => {
  const html = Buffer.from('<html><script>alert(1)</script></html>').toString('base64')
  assert.throws(() => saveScreenshot(html, 'image/png'), /does not match/)
  // A real PNG declared as JPEG is rejected too.
  assert.throws(() => saveScreenshot(PNG, 'image/jpeg'), /does not match/)
})

test('saveScreenshot rejects malformed base64 and empty uploads', () => {
  assert.throws(() => saveScreenshot('not*base64!!', 'image/png'), /base64/)
  assert.throws(() => saveScreenshot(PNG.slice(0, -3), 'image/png'), /base64/)
  assert.throws(() => saveScreenshot('', 'image/png'), /Empty/)
})

test('saveScreenshot stores the exact bytes, including base64 with every character and line breaks', () => {
  // A PNG signature followed by all 256 byte values: its base64 uses the whole
  // alphabet (lower-case letters, +, /), which a too-greedy cleanup would break.
  const bytes = Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.from(Array.from({ length: 256 }, (_, i) => i))])
  const b64 = bytes.toString('base64')
  assert.match(b64, /s/)
  const wrapped = b64.replace(/(.{76})/g, '$1\r\n') // MIME-style line breaks
  const stored = saveScreenshot(wrapped, 'image/png')
  const onDisk = fs.readFileSync(resolveScreenshot(stored.storagePath)!)
  assert.ok(onDisk.equals(bytes), 'stored file is byte-identical to the upload')
})

test('matchesImageSignature recognises each allowed format', async () => {
  const { matchesImageSignature } = await import('./storage.ts')
  assert.ok(matchesImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'))
  assert.ok(matchesImageSignature(Buffer.from('GIF89a'), 'image/gif'))
  assert.ok(matchesImageSignature(Buffer.from('RIFF\0\0\0\0WEBPVP8 '), 'image/webp'))
  assert.equal(matchesImageSignature(Buffer.from('RIFF\0\0\0\0AVI '), 'image/webp'), false)
})
