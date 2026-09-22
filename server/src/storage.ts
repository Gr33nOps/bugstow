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
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.byteLength === 0) throw new Error('Empty image.')
  if (buffer.byteLength > config.maxUploadBytes) {
    throw new Error('Image exceeds the maximum allowed size.')
  }
  const ext = EXT_BY_MIME[mimeType] || 'png'
  const name = `${randomUUID()}.${ext}`
  const abs = path.join(config.screenshotsDir, name)
  fs.writeFileSync(abs, buffer)
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
