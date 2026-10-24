import { describe, expect, it } from 'vitest'
import { parseExtensionCapture } from './extensionCapture'

const nonce = 'a'.repeat(32)

describe('optional browser capture handoff', () => {
  it('accepts only a matching explicit draft', () => {
    const draft = parseExtensionCapture({ type: 'bugstow-capture', nonce, title: 'Broken button', pageUrl: 'https://example.com/path', selectedText: 'Save failed' }, nonce)
    expect(draft?.title).toBe('Broken button')
    expect(draft?.description).toContain('https://example.com/path')
    expect(draft?.description).toContain('Save failed')
    expect(parseExtensionCapture({ type: 'bugstow-capture', nonce: 'wrong', title: 'x' }, nonce)).toBeNull()
  })

  it('rejects unsafe URLs and oversized screenshots', () => {
    expect(parseExtensionCapture({ type: 'bugstow-capture', nonce, pageUrl: 'javascript:alert(1)' }, nonce)).toBeNull()
    expect(parseExtensionCapture({ type: 'bugstow-capture', nonce, pageUrl: 'https://user:pass@example.com' }, nonce)).toBeNull()
    expect(parseExtensionCapture({ type: 'bugstow-capture', nonce, pageUrl: 'https://example.com', screenshotDataUrl: 'data:image/png;base64,' + 'x'.repeat(14_000_001) }, nonce)).toBeNull()
  })
})
