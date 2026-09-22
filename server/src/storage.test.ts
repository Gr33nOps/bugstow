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
