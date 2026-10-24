import { describe, expect, it } from 'vitest'
import { groupBoardIssues } from './kanban'

describe('Kanban grouping', () => {
  it('puts each issue in its workflow column', () => {
    const groups = groupBoardIssues([{ id: 'a', status: 'open' }, { id: 'b', status: 'fixed' }, { id: 'c', status: 'blocked' }])
    expect(groups.open.map(issue => issue.id)).toEqual(['a'])
    expect(groups.blocked.map(issue => issue.id)).toEqual(['c'])
    expect(groups.fixed.map(issue => issue.id)).toEqual(['b'])
  })
})
