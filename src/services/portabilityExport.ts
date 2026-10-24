import type { IssueDetails } from '../types'
import { triggerDownload } from './backupService'

export interface PortableIssue {
  id: string
  title: string
  description: string
  type: string
  status: string
  priority?: string | null
  severity?: string | null
  projectName?: string | null
  assigneeName?: string | null
  createdAt: string
  updatedAt: string
  details?: IssueDetails
  githubUrl?: string | null
  fixReferences?: string[]
}

const FIELDS: Array<[string, (issue: PortableIssue) => string]> = [
  ['Title', issue => issue.title],
  ['Description', issue => issue.description],
  ['Type', issue => issue.type],
  ['Status', issue => issue.status.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())],
  ['Priority', issue => issue.priority || 'medium'],
  ['Severity', issue => issue.severity || ''],
  ['Project', issue => issue.projectName || ''],
  ['Assignee', issue => issue.assigneeName || ''],
  ['Created', issue => issue.createdAt],
  ['Updated', issue => issue.updatedAt],
  ['Steps to reproduce', issue => issue.details?.stepsToReproduce || ''],
  ['Expected behavior', issue => issue.details?.expectedBehavior || ''],
  ['Actual behavior', issue => issue.details?.actualBehavior || ''],
  ['Environment', issue => issue.details?.environment || ''],
  ['Browser and OS', issue => issue.details?.browserOs || ''],
  ['App version', issue => issue.details?.appVersion || ''],
  ['Additional notes', issue => issue.details?.additionalNotes || ''],
  ['GitHub issue', issue => issue.githubUrl || ''],
  ['Fix references', issue => (issue.fixReferences || []).join('\n')],
]

function csvCell(value: string): string {
  // Spreadsheet apps may evaluate imported cells as formulas. Keep the text literal.
  const safe = /^\s*[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function issuesToCsv(issues: PortableIssue[]): string {
  return '\uFEFF' + [FIELDS.map(([label]) => csvCell(label)).join(','), ...issues.map(issue => FIELDS.map(([, read]) => csvCell(read(issue))).join(','))].join('\r\n')
}

function safeMarkdown(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export function issuesToMarkdown(issues: PortableIssue[]): string {
  const entries = issues.map(issue => {
    const fields = FIELDS.slice(2).map(([label, read]) => [label, read(issue)] as const).filter(([, value]) => value.trim())
    return `## ${safeMarkdown(issue.title)}\n\n${fields.map(([label, value]) => `**${label}:** ${safeMarkdown(value)}`).join('  \n')}\n\n${issue.description ? safeMarkdown(issue.description) : ''}`.trim()
  })
  return `# BugsTow issues\n\n${entries.join('\n\n---\n\n')}\n`
}

export function downloadPortableIssues(issues: PortableIssue[], format: 'csv' | 'markdown'): void {
  const date = new Date().toISOString().slice(0, 10)
  if (format === 'csv') triggerDownload(new Blob([issuesToCsv(issues)], { type: 'text/csv;charset=utf-8' }), `bugstow-issues-${date}.csv`)
  else triggerDownload(new Blob([issuesToMarkdown(issues)], { type: 'text/markdown;charset=utf-8' }), `bugstow-issues-${date}.md`)
}
