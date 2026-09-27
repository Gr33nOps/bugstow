import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { config, ALLOWED_IMAGE_TYPES } from './config.ts'

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/**
 * True when the bytes really are the declared image format (file signature
 * check). Stops non-images (HTML, scripts, archives) being stored and later
 * served under an image content type.
 */
export function matchesImageSignature(buf: Buffer, mimeType: string): boolean {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => buf[offset + i] === b)
  switch (mimeType) {
    case 'image/png':
      return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case 'image/jpeg':
      return starts([0xff, 0xd8, 0xff])
    case 'image/gif':
      return starts([0x47, 0x49, 0x46, 0x38]) // GIF8
    case 'image/webp':
      return starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8) // RIFF....WEBP
    default:
      return false
  }
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

export interface StoredScreenshot {
  storagePath: string // relative to screenshots dir
  mimeType: string
}

/**
 * Persist a base64-encoded image to the screenshots volume. Validates the
 * declared mime type and enforces the size limit. Returns the relative storage
 * path (never an absolute path exposed to clients).
 */
export function saveScreenshot(base64: string, mimeType: string): StoredScreenshot {
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error('Unsupported image type.')
  }
  const clean = base64.replace(/\s+/g, '')
  // Node's decoder silently skips invalid characters; reject them instead.
  if (clean.length % 4 !== 0 || !BASE64.test(clean)) throw new Error('Image data is not valid base64.')
  // Check the size before decoding so an oversized upload is not buffered twice.
  if (Math.floor((clean.length * 3) / 4) > config.maxUploadBytes + 2) {
    throw new Error('Image exceeds the maximum allowed size.')
  }
  const buffer = Buffer.from(clean, 'base64')
  if (buffer.byteLength === 0) throw new Error('Empty image.')
  if (buffer.byteLength > config.maxUploadBytes) {
    throw new Error('Image exceeds the maximum allowed size.')
  }
  if (!matchesImageSignature(buffer, mimeType)) {
    throw new Error('The file content does not match the image type.')
  }
  const ext = EXT_BY_MIME[mimeType] || 'png'
  const name = `${randomUUID()}.${ext}`
  const abs = path.join(config.screenshotsDir, name)
  fs.writeFileSync(abs, buffer, { flag: 'wx' }) // never overwrite an existing file
  return { storagePath: name, mimeType }
}

/** Resolve a stored relative path to an absolute path, guarding against traversal. */
export function resolveScreenshot(storagePath: string): string | null {
  const abs = path.resolve(config.screenshotsDir, storagePath)
  const root = path.resolve(config.screenshotsDir)
  if (!abs.startsWith(root + path.sep)) return null // path traversal guard
  if (!fs.existsSync(abs)) return null
  return abs
}

export function deleteScreenshotFile(storagePath: string): void {
  const abs = resolveScreenshot(storagePath)
  if (abs) {
    try {
      fs.unlinkSync(abs)
    } catch {
      // best-effort; row is removed regardless
    }
  }
}
