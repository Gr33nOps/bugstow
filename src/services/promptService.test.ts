import { describe, expect, it } from 'vitest'
import { buildPromptHtml } from './promptService'

describe('combined prompt clipboard content', () => {
  it('contains readable text and an embedded screenshot in one rich clipboard payload', () => {
    const html = buildPromptHtml('Fix <checkout> & keep the cart.', 'data:image/png;base64,abc123')
    expect(html).toContain('Fix &lt;checkout&gt; &amp; keep the cart.')
    expect(html).toContain('src="data:image/png;base64,abc123"')
    expect(html).toContain('alt="Issue screenshot"')
  })
})
