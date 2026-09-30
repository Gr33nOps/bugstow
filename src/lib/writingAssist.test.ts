import { describe, expect, it } from 'vitest'
import { appendSpeechTranscript, normalizeCustomBadge, polishWriting } from './writingAssist'

describe('polishWriting', () => {
  it('fixes common mistakes and sentence flow without rewriting the message', async () => {
    await expect(polishWriting('this  button dont work\nit happen alot', 'description')).resolves.toBe(
      "This button doesn't work.\nIt happens a lot."
    )
  })

  it('fixes spelling mistakes and keeps titles concise', async () => {
    await expect(polishWriting('  teh checkout button is not fixign speling mistaks  ', 'title')).resolves.toBe(
      'The checkout button is not fixing spelling mistakes'
    )
  })

  it('corrects transposed and repeated letters', async () => {
    await expect(polishWriting('pelase fix memebers and improt setence nicley', 'description')).resolves.toBe(
      'Please fix members and import sentence nicely.'
    )
  })

  it('leaves URLs, product terms, and already polished text intact', async () => {
    await expect(polishWriting('Open https://example.com/a-b in BugsTow. It fails.', 'description')).resolves.toBe(
      'Open https://example.com/a-b in BugsTow. It fails.'
    )
  })
})

describe('custom badges', () => {
  it('normalizes a short user label', () => {
    expect(normalizeCustomBadge('  performance   issue  ')).toBe('Performance issue')
  })

  it('limits a badge without cutting through a word when possible', () => {
    expect(normalizeCustomBadge('Needs product review and approval')).toBe('Needs product review')
  })
})

describe('voice transcript insertion', () => {
  it('adds dictated text without replacing what the user wrote', () => {
    expect(appendSpeechTranscript('Checkout fails.', 'only on mobile')).toBe('Checkout fails. Only on mobile')
    expect(appendSpeechTranscript('', 'new issue')).toBe('New issue')
  })
})
