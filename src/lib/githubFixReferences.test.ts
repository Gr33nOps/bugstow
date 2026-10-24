import { describe, expect, it } from 'vitest'
import { normalizeGithubFixReference } from './githubFixReferences'

describe('GitHub fix references', () => {
  it('accepts repository, pull request, and commit URLs', () => {
    expect(normalizeGithubFixReference(' https://github.com/acme/app/pull/12 ')).toBe('https://github.com/acme/app/pull/12')
    expect(normalizeGithubFixReference('https://github.com/acme/app/commit/abcdef1234567')).toBe('https://github.com/acme/app/commit/abcdef1234567')
    expect(normalizeGithubFixReference('https://github.com/acme/app')).toBe('https://github.com/acme/app')
  })

  it('rejects external hosts, credentials, query strings, and unrelated paths', () => {
    for (const url of ['https://github.com.evil.test/a/b', 'https://x@github.com/a/b', 'http://github.com/a/b', 'https://github.com/a/b/issues/1', 'https://github.com/a/b?x=1']) {
      expect(normalizeGithubFixReference(url)).toBeNull()
    }
  })
})
