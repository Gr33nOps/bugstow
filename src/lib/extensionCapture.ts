export interface ExtensionCaptureDraft { title: string; description: string; screenshotDataUrl?: string }

/** Validate a user-initiated extension draft before showing it in the issue form. */
export function parseExtensionCapture(value: unknown, expectedNonce: string): ExtensionCaptureDraft | null {
  if (!/^[a-f0-9]{32}$/.test(expectedNonce) || !value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  if (input.type !== 'bugstow-capture' || input.nonce !== expectedNonce || typeof input.pageUrl !== 'string') return null
  let pageUrl: URL
  try { pageUrl = new URL(input.pageUrl) } catch { return null }
  if (!['http:', 'https:'].includes(pageUrl.protocol) || pageUrl.username || pageUrl.password || pageUrl.href.length > 2048) return null
  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.length > 200)) return null
  if (input.selectedText !== undefined && (typeof input.selectedText !== 'string' || input.selectedText.length > 4000)) return null
  if (input.screenshotDataUrl !== undefined && (typeof input.screenshotDataUrl !== 'string' || input.screenshotDataUrl.length > 14_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input.screenshotDataUrl))) return null
  const description = `Page: ${pageUrl.href}` + (input.selectedText ? `\n\nSelected text:\n${input.selectedText}` : '')
  return { title: String(input.title || pageUrl.hostname).trim() || 'Captured page', description, screenshotDataUrl: input.screenshotDataUrl as string | undefined }
}

export function captureScreenshotFile(draft: ExtensionCaptureDraft): File | null {
  if (!draft.screenshotDataUrl) return null
  try {
    const bytes = atob(draft.screenshotDataUrl.slice('data:image/png;base64,'.length))
    if (bytes.length > 10 * 1024 * 1024) return null
    const data = Uint8Array.from(bytes, char => char.charCodeAt(0))
    return new File([data], 'page-capture.png', { type: 'image/png' })
  } catch { return null }
}
