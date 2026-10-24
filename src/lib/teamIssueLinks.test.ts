import { expect, it } from 'vitest'
import { issueLink, readIssueLink } from './teamIssueLinks'

it('keeps workspace and issue IDs in a same-origin direct link', () => {
  const url = issueLink('https://example.test/app?mode=team', 'team one', 'issue/2')
  expect(url).toBe('https://example.test/app?mode=team&team=team+one&issue=issue%2F2')
  expect(readIssueLink(url)).toEqual({ teamId: 'team one', issueId: 'issue/2' })
})
