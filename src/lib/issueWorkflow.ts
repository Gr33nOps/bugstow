import type { IssueDetails, IssuePriority, IssueSeverity, IssueStatus } from '../types'

export function normalizeIssueFields<T extends { status?: string; priority?: string | null; severity?: string | null; details?: IssueDetails }>(issue: T) {
  return {
    ...issue,
    priority: (['critical', 'high', 'medium', 'low'].includes(issue.priority || '') ? issue.priority : 'medium') as IssuePriority,
    status: (['open', 'in_progress', 'blocked', 'fixed'].includes(issue.status || '') ? issue.status : 'open') as IssueStatus,
    severity: (['critical', 'major', 'minor'].includes(issue.severity || '') ? issue.severity : null) as IssueSeverity | null,
    details: issue.details || {},
  }
}

export interface WorkflowFilters {
  query?: string
  project?: string
  type?: string
  status?: string
  priority?: string
  severity?: string
  assignee?: string
  createdFrom?: string
  createdTo?: string
  updatedFrom?: string
  updatedTo?: string
  sort?: 'priority' | 'severity' | 'status' | 'type' | 'project' | 'assignee' | 'created' | 'updated' | 'title'
  direction?: 'asc' | 'desc'
}

export function filterAndSortIssues<T extends {
  title: string; description: string | null; status: string; priority?: string | null; severity?: string | null;
  type: string; projectId?: string | null; project_id?: string | null;
  assignee_id?: string | null; createdAt?: string; created_at?: string; updatedAt?: string; updated_at?: string
}>(issues: T[], filters: WorkflowFilters): T[] {
  const query = filters.query?.trim().toLowerCase() || ''
  const priorityOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
  const severityOrder: Record<string, number> = { minor: 1, major: 2, critical: 3 }
  const statusOrder: Record<string, number> = { open: 0, in_progress: 1, blocked: 2, fixed: 3 }
  const selected = issues.filter(issue => {
    const project = issue.projectId ?? issue.project_id ?? null
    if (filters.status && filters.status !== 'all' && (filters.status === 'active' ? issue.status === 'fixed' : issue.status !== filters.status)) return false
    if (filters.priority && filters.priority !== 'all' && (issue.priority || 'medium') !== filters.priority) return false
    if (filters.severity && filters.severity !== 'all' && issue.severity !== filters.severity) return false
    if (filters.type && filters.type !== 'all' && issue.type !== filters.type) return false
    if (filters.project && filters.project !== 'all' && (filters.project === 'unassigned' ? project !== null : project !== filters.project)) return false
    if (filters.assignee && filters.assignee !== 'all' && (filters.assignee === 'unassigned' ? Boolean(issue.assignee_id) : issue.assignee_id !== filters.assignee)) return false
    const created = (issue.createdAt || issue.created_at || '').slice(0, 10)
    const updated = (issue.updatedAt || issue.updated_at || '').slice(0, 10)
    if (filters.createdFrom && created < filters.createdFrom || filters.createdTo && created > filters.createdTo || filters.updatedFrom && updated < filters.updatedFrom || filters.updatedTo && updated > filters.updatedTo) return false
    return !query || `${issue.title} ${issue.description || ''}`.toLowerCase().includes(query)
  })
  const sort = filters.sort || 'created'
  const direction = filters.direction === 'asc' ? 1 : -1
  const value = (issue: T): string | number => {
    switch (sort) {
      case 'priority': return priorityOrder[issue.priority || 'medium'] ?? 1
      case 'severity': return severityOrder[issue.severity || ''] ?? 0
      case 'status': return statusOrder[issue.status] ?? 0
      case 'type': return issue.type
      case 'project': return issue.projectId ?? issue.project_id ?? ''
      case 'assignee': return issue.assignee_id || ''
      case 'updated': return issue.updatedAt || issue.updated_at || ''
      case 'title': return issue.title.toLowerCase()
      default: return issue.createdAt || issue.created_at || ''
    }
  }
  return selected.sort((a, b) => {
    const x = value(a), y = value(b)
    const cmp = x < y ? -1 : x > y ? 1 : 0
    return cmp * direction || String(b.updatedAt || b.updated_at || '').localeCompare(String(a.updatedAt || a.updated_at || ''))
  })
}
