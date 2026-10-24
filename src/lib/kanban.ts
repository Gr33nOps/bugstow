import type { IssueStatus } from '../types'

export const BOARD_COLUMNS: Array<{ status: IssueStatus; label: string }> = [
  { status: 'open', label: 'Open' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'fixed', label: 'Fixed' },
]

export function groupBoardIssues<T extends { status: string }>(issues: T[]): Record<IssueStatus, T[]> {
  const groups: Record<IssueStatus, T[]> = { open: [], in_progress: [], blocked: [], fixed: [] }
  for (const issue of issues) {
    const status = issue.status in groups ? issue.status as IssueStatus : 'open'
    groups[status].push(issue)
  }
  return groups
}
