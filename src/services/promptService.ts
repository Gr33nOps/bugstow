import type { Issue, Project } from '../types'

export function generateIssuePrompt(issue: Issue, project?: Project | null): string {
  const isIdea = issue.type === 'idea'
  const projectName = project ? project.name : (issue.projectId ? 'Unknown' : 'None (Unassigned)')
  const typeLabel = issue.type === 'uiux' ? 'UI/UX' : issue.type === 'bug' ? 'Bug' : 'Idea'

  if (isIdea) {
    let prompt = `Please implement the following idea in my project.\n\n`
    if (projectName && projectName !== 'None (Unassigned)') {
      prompt += `Project: ${projectName}\n`
    }
    prompt += `Issue type: Idea\n`
    prompt += `Feature: ${issue.title}\n`

    if (issue.description && issue.description.trim()) {
      prompt += `\nAdditional context:\n${issue.description.trim()}\n`
    }

    prompt += `\nInspect the relevant code, understand the requirements, and implement the feature following the project's existing patterns and architecture.\n`
    prompt += `Explain what was added and how to test it.`
    return prompt
  }

  // Bug or UI/UX
  let prompt = `Please investigate and fix the following issue in my project.\n\n`
  if (projectName && projectName !== 'None (Unassigned)') {
    prompt += `Project: ${projectName}\n`
  }
  prompt += `Issue type: ${typeLabel}\n`
  prompt += `Problem: ${issue.title}\n`

  if (issue.description && issue.description.trim()) {
    prompt += `\nAdditional context:\n${issue.description.trim()}\n`
  }

  prompt += `\nInspect the relevant code, identify the underlying cause, and implement an appropriate fix.\n`
  prompt += `Preserve existing functionality and avoid unrelated changes.\n`
  prompt += `After implementing the fix, explain what changed and how I can verify the issue is resolved.`
  return prompt
}

export async function copyPromptToClipboard(issue: Issue, project?: Project | null): Promise<boolean> {
  const prompt = generateIssuePrompt(issue, project)
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(prompt)
      return true
    }
    // Fallback for non-secure contexts or older browsers
    const textarea = document.createElement('textarea')
    textarea.value = prompt
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch (err) {
    console.error('Failed to copy prompt to clipboard:', err)
    return false
  }
}
