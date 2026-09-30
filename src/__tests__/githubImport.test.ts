import { describe, it, expect } from 'vitest'
import {
  parseRepo,
  errorCodeFor,
  fetchGithubIssues,
  planImport,
  tokenCreateUrl,
  GithubImportError,
} from '../services/githubImport'

describe('parseRepo: whatever people paste', () => {
  it.each([
    ['acme/web', 'acme/web'],
    ['https://github.com/acme/web', 'acme/web'],
    ['https://github.com/acme/web/', 'acme/web'],
    ['https://github.com/acme/web/issues?q=is%3Aopen', 'acme/web'],
    ['https://github.com/acme/web/issues/12', 'acme/web'],
    ['github.com/acme/web.git', 'acme/web'],
    ['git@github.com:acme/web.git', 'acme/web'],
    ['  https://www.github.com/Acme-Co/my.repo_2  ', 'Acme-Co/my.repo_2'],
  ])('%s → %s', (input, full) => {
    expect(parseRepo(input)?.full).toBe(full)
  })

  it.each(['', 'acme', 'https://gitlab.com/acme', 'acme/..', 'ac me/web', 'https://github.com/'])('rejects %j', input => {
    expect(parseRepo(input)).toBeNull()
  })
})

describe('what GitHub’s answer means for the person', () => {
  it('without a key, "not found", "unauthorized" and anonymous rate limits all mean: add a key', () => {
    expect(errorCodeFor(404, null, false)).toBe('NEEDS_TOKEN')
    expect(errorCodeFor(401, null, false)).toBe('NEEDS_TOKEN')
    expect(errorCodeFor(403, '0', false)).toBe('NEEDS_TOKEN')
  })
  it('with a key, they mean: fix the key, or wait', () => {
    expect(errorCodeFor(404, null, true)).toBe('NOT_FOUND')
    expect(errorCodeFor(401, null, true)).toBe('BAD_TOKEN')
    expect(errorCodeFor(403, '12', true)).toBe('BAD_TOKEN')
    expect(errorCodeFor(403, '0', true)).toBe('RATE_LIMITED')
  })
})

describe('fetchGithubIssues', () => {
  const issue = (n: number, extra: object = {}) => ({
    number: n,
    title: `Issue ${n}`,
    body: null,
    html_url: `https://github.com/acme/web/issues/${n}`,
    state: 'open',
    labels: [],
    ...extra,
  })

  it('pages through, leaves out pull requests and maps labels to types', async () => {
    const pages: Record<string, object[]> = {
      '1': [...Array.from({ length: 99 }, (_, i) => issue(i + 1)), issue(100, { pull_request: {} })],
      '2': [issue(101, { labels: [{ name: 'enhancement' }], state: 'closed' })],
    }
    const seen: string[] = []
    const fakeFetch = (async (url: string, init: RequestInit) => {
      seen.push(url)
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer k')
      return Response.json(pages[new URL(url).searchParams.get('page')!] ?? [])
    }) as unknown as typeof fetch
    const got = await fetchGithubIssues(parseRepo('acme/web')!, { token: ' k ', includeClosed: true, fetchImpl: fakeFetch })
    expect(got).toHaveLength(100)
    expect(got.at(-1)).toMatchObject({ number: 101, type: 'idea', closed: true })
    expect(seen[0]).toContain('state=all')
  })

  it('turns a private repository into NEEDS_TOKEN and a dead network into NETWORK', async () => {
    const notFound = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch
    await expect(fetchGithubIssues(parseRepo('acme/secret')!, { includeClosed: false, fetchImpl: notFound })).rejects.toMatchObject({
      code: 'NEEDS_TOKEN',
    })
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    const err = await fetchGithubIssues(parseRepo('acme/web')!, { includeClosed: false, fetchImpl: offline }).catch(e => e)
    expect(err).toBeInstanceOf(GithubImportError)
    expect(err.code).toBe('NETWORK')
  })
})

describe('planImport: importing the same repository again', () => {
  const gh = (n: number, closed = false) => ({
    number: n,
    title: `Issue ${n}`,
    body: '',
    url: `https://github.com/acme/web/issues/${n}`,
    closed,
    type: 'bug' as const,
  })

  it('adds only new issues and follows GitHub’s open/closed for known ones', () => {
    const existing = [
      { id: 'a', status: 'open' as const, githubUrl: gh(1).url },
      { id: 'b', status: 'open' as const, githubUrl: gh(2).url },
      { id: 'c', status: 'open' as const }, // made here, never imported
    ]
    const plan = planImport(existing, [gh(1), gh(2, true), gh(3)])
    expect(plan.create.map(i => i.number)).toEqual([3])
    expect(plan.setStatus).toEqual([{ id: 'b', status: 'fixed' }])
    expect(plan.unchanged).toBe(1)
  })
})

describe('tokenCreateUrl', () => {
  it('opens GitHub’s fine-grained key page asking only to read issues', () => {
    const url = new URL(tokenCreateUrl(parseRepo('acme/web')))
    expect(url.origin + url.pathname).toBe('https://github.com/settings/personal-access-tokens/new')
    expect(url.searchParams.get('issues')).toBe('read')
    expect(url.searchParams.get('target_name')).toBe('acme')
    expect(url.searchParams.get('expires_in')).toBe('90')
  })
  it('keeps the key name within GitHub’s 40-character limit', () => {
    const long = parseRepo('acme/a-really-long-repository-name-that-goes-on-and-on')
    expect(new URL(tokenCreateUrl(long)).searchParams.get('name')!.length).toBeLessThanOrEqual(40)
  })
})
