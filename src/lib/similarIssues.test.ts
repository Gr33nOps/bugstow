import { describe, expect, it } from 'vitest'
import { findSimilarIssues } from './similarIssues'

const issues = [
  { id: 'a', title: 'Save button hidden on mobile', description: 'Dialog is too tall' },
  { id: 'b', title: 'Login fails with wrong password', description: 'Authentication error' },
  { id: 'c', title: 'Mobile save button not visible', description: 'Dialog clips the footer' },
]

describe('similar issue suggestions', () => {
  it('ranks related titles ahead of unrelated issues', () => {
    expect(findSimilarIssues('Mobile save button clipped', 'Footer is hidden', issues).map(issue => issue.id)).toEqual(['c', 'a'])
  })

  it('does not suggest matches for a short or unrelated title', () => {
    expect(findSimilarIssues('New', '', issues)).toEqual([])
    expect(findSimilarIssues('CSV export encoding', '', issues)).toEqual([])
  })
})
