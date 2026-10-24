import type { Issue, Project } from '../types'
import { generateIssuePrompt } from './promptService'

export const PROMPT_TEMPLATES = [
  { id: 'fix', label: 'Fix this bug', instruction: '' },
  { id: 'investigate', label: 'Investigate root cause', instruction: 'Investigate the root cause of this issue. Explain the evidence, likely cause, and a safe fix. Do not change code yet.' },
  { id: 'regression', label: 'Generate regression tests', instruction: 'Generate regression tests for this issue. Cover the reported behavior and edge cases, and explain what each test proves.' },
  { id: 'review', label: 'Review the implementation', instruction: 'Review the implementation related to this issue. Identify correctness, security, accessibility, and maintainability problems with specific evidence.' },
  { id: 'uiux', label: 'Improve UI/UX', instruction: 'Improve the user experience for this issue. Preserve the product style and accessibility, and explain the interaction changes.' },
  { id: 'feature', label: 'Implement this feature', instruction: 'Implement this feature following the project’s existing architecture. Include relevant tests and explain how to verify it.' },
] as const

export type PromptTemplateId = typeof PROMPT_TEMPLATES[number]['id'] | 'custom'
const STORAGE_KEY = 'bugstow_custom_prompt_template'

export function getSavedCustomTemplate(): string {
  try { return localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
}

export function saveCustomTemplate(value: string): void {
  if (!value.trim()) throw new Error('Write a template before saving it.')
  if (value.length > 10_000) throw new Error('Template is too long.')
  localStorage.setItem(STORAGE_KEY, value)
}

function context(issue: Issue, project?: Project | null): string {
  const fields: Array<[string, string | undefined | null]> = [
    ['Title', issue.title],
    ['Project', project?.name],
    ['Type', issue.customType || issue.type],
    ['Status', issue.status],
    ['Priority', issue.priority || 'medium'],
    ['Severity', issue.severity],
    ['Description', issue.description],
    ['Steps to reproduce', issue.details?.stepsToReproduce],
    ['Expected behavior', issue.details?.expectedBehavior],
    ['Actual behavior', issue.details?.actualBehavior],
    ['Environment', issue.details?.environment],
    ['Browser and operating system', issue.details?.browserOs],
    ['Application version', issue.details?.appVersion],
    ['Additional notes', issue.details?.additionalNotes],
    ['GitHub issue', issue.githubUrl],
    ['Screenshot', issue.screenshotId || issue.screenshotIds?.length ? 'Attached when your clipboard supports images' : undefined],
  ]
  return fields.filter(([, value]) => value?.trim()).map(([label, value]) => `${label}: ${value}`).join('\n')
}

export function generatePromptWithTemplate(issue: Issue, project: Project | null | undefined, templateId: PromptTemplateId, customTemplate = ''): string {
  if (templateId === 'fix') return generateIssuePrompt(issue, project)
  const report = context(issue, project)
  if (templateId === 'custom') {
    const template = customTemplate.trim() || getSavedCustomTemplate()
    if (!template) return generateIssuePrompt(issue, project)
    return template.replaceAll('{{title}}', issue.title).replaceAll('{{description}}', issue.description).replaceAll('{{issue}}', report)
  }
  const instruction = PROMPT_TEMPLATES.find(template => template.id === templateId)?.instruction || PROMPT_TEMPLATES[0].instruction
  return `${instruction}\n\nIssue details:\n${report}`
}
