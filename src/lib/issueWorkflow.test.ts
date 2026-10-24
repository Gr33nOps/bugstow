import { describe, expect, it } from 'vitest'
import { filterAndSortIssues, normalizeIssueFields } from './issueWorkflow'

const issues = [
  { id: 'a', title: 'Login fails', description: '', status: 'in_progress', priority: 'high', severity: 'major', projectId: 'web', type: 'bug', createdAt: '2025-01-01', updatedAt: '2025-01-04' },
  { id: 'b', title: 'Button overlap', description: '', status: 'blocked', priority: 'critical', severity: 'minor', projectId: 'web', type: 'uiux', createdAt: '2025-01-02', updatedAt: '2025-01-03' },
  { id: 'c', title: 'Login typo', description: '', status: 'fixed', priority: 'low', severity: null, projectId: null, type: 'bug', createdAt: '2025-01-03', updatedAt: '2025-01-02' },
]

describe('issue workflow', () => {
  it('defaults legacy priority and preserves an existing fixed status', () => {
    expect(normalizeIssueFields({ status: 'fixed' })).toMatchObject({ priority: 'medium', status: 'fixed' })
  })
  it('keeps active work and blocked issues in the not completed view', () => {
    expect(filterAndSortIssues(issues, { status: 'active', sort: 'created', direction: 'desc' }).map(i => i.id)).toEqual(['b', 'a'])
  })
  it('filters severity, type, project, and text then sorts priority in both directions', () => {
    expect(filterAndSortIssues(issues, { severity: 'major', type: 'bug', project: 'web', query: 'login', sort: 'priority', direction: 'asc' }).map(i => i.id)).toEqual(['a'])
    expect(filterAndSortIssues(issues, { project: 'web', sort: 'priority', direction: 'desc' }).map(i => i.id)).toEqual(['b', 'a'])
    expect(filterAndSortIssues(issues, { project: 'web', sort: 'priority', direction: 'asc' }).map(i => i.id)).toEqual(['a', 'b'])
  })
  it('filters by inclusive creation and update dates', () => {
    expect(filterAndSortIssues(issues, { createdFrom: '2025-01-02', createdTo: '2025-01-03', updatedFrom: '2025-01-03' }).map(i => i.id)).toEqual(['b'])
  })
})
