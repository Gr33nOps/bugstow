import type { Issue, Project } from '../types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function buildPromptHtml(prompt: string, imageDataUrl: string): string {
  return `<div><div style="white-space:pre-wrap">${escapeHtml(prompt)}</div><p><img src="${escapeHtml(imageDataUrl)}" alt="Issue screenshot" /></p></div>`
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Could not read screenshot.'))
    reader.readAsDataURL(blob)
  })
}

export function generateIssuePrompt(issue: Issue, project?: Project | null): string {
  const isIdea = issue.type === 'idea' && !issue.customType
  const projectName = project ? project.name : (issue.projectId ? 'Unknown' : 'None (Unassigned)')
  const typeLabel = issue.customType || (issue.type === 'uiux' ? 'UI/UX' : issue.type === 'bug' ? 'Bug' : 'Idea')

  if (isIdea) {
    let prompt = `Please implement the following idea in my project.\n\n`
    if (projectName && projectName !== 'None (Unassigned)') {
      prompt += `Project: ${projectName}\n`
    }
    prompt += `Issue type: Idea\n`
    prompt += `Feature: ${issue.title}\n`
    if (issue.githubUrl) prompt += `GitHub issue: ${issue.githubUrl}\n`

    if (issue.description && issue.description.trim()) {
      prompt += `\nAdditional context:\n${issue.description.trim()}\n`
    }

    prompt += `\nInspect the relevant code, understand the requirements, and implement the feature following the project's existing patterns and architecture.\n`
    prompt += `Explain what was added and how to test it.`
    return prompt
  }

  // Bug, UI/UX, or a user-defined issue type.
  let prompt = issue.customType
    ? `Please work on the following issue in my project.\n\n`
    : `Please investigate and fix the following issue in my project.\n\n`
  if (projectName && projectName !== 'None (Unassigned)') {
    prompt += `Project: ${projectName}\n`
  }
  prompt += `Issue type: ${typeLabel}\n`
  prompt += `Problem: ${issue.title}\n`
  if (issue.githubUrl) prompt += `GitHub issue: ${issue.githubUrl}\n`

  if (issue.description && issue.description.trim()) {
    prompt += `\nAdditional context:\n${issue.description.trim()}\n`
  }

  prompt += `\nInspect the relevant code, identify the underlying cause, and implement an appropriate fix.\n`
  prompt += `Preserve existing functionality and avoid unrelated changes.\n`
  prompt += `After implementing the fix, explain what changed and how I can verify the issue is resolved.`
  return prompt
}

/**
 * Converts any image Blob (JPEG, WebP, etc.) to a PNG Blob required by ClipboardItem API
 */
export async function convertBlobToPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob

  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(blob)
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(blob)
          return
        }
        ctx.drawImage(img, 0, 0)
        canvas.toBlob(pngBlob => {
          if (pngBlob) resolve(pngBlob)
          else resolve(blob)
        }, 'image/png')
      } catch (err) {
        console.warn('Canvas conversion to PNG failed:', err)
        resolve(blob)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(blob)
    }

    img.src = url
  })
}

/**
 * Copies plain text prompt to clipboard
 */
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

/**
 * Copies a screenshot image to clipboard as PNG
 */
export async function copyScreenshotImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    const pngBlob = await convertBlobToPng(blob)
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      const item = new ClipboardItem({ 'image/png': pngBlob })
      await navigator.clipboard.write([item])
      return true
    }
    return false
  } catch (err) {
    console.error('Failed to copy image to clipboard:', err)
    return false
  }
}

/**
 * Copies BOTH Prompt Text AND Screenshot Image into clipboard simultaneously.
 * When pasted into AI chat tools or Slack, the image is attached
 * and the prompt text is filled into the text box.
 */
export async function copyPromptAndImageToClipboard(
  issue: Issue,
  project?: Project | null,
  screenshotBlob?: Blob | null
): Promise<{ textCopied: boolean; imageCopied: boolean }> {
  const prompt = generateIssuePrompt(issue, project)

  return copyTextAndImageToClipboard(prompt, screenshotBlob)
}

/** Copy a prompt and image as one rich clipboard item when the browser supports it. */
export async function copyTextAndImageToClipboard(
  prompt: string,
  screenshotBlob?: Blob | null
): Promise<{ textCopied: boolean; imageCopied: boolean }> {

  if (!screenshotBlob) {
    let textSuccess = false
    try {
      await navigator.clipboard.writeText(prompt)
      textSuccess = true
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = prompt
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      textSuccess = document.execCommand('copy')
      textarea.remove()
    }
    return { textCopied: textSuccess, imageCopied: false }
  }

  try {
    const pngBlob = await convertBlobToPng(screenshotBlob)
    const textBlob = new Blob([prompt], { type: 'text/plain' })

    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      // Try writing both representations into a single clipboard item
      try {
        const imageDataUrl = await blobToDataUrl(pngBlob)
        const htmlBlob = new Blob([buildPromptHtml(prompt, imageDataUrl)], { type: 'text/html' })
        const item = new ClipboardItem({
          'text/plain': textBlob,
          'text/html': htmlBlob,
          'image/png': pngBlob,
        })
        await navigator.clipboard.write([item])
        return { textCopied: true, imageCopied: true }
      } catch (multiWriteErr) {
        console.warn('Simultaneous clipboard write not supported, writing image then fallback:', multiWriteErr)
      }
    }
  } catch (err) {
    console.warn('Failed to prepare combined clipboard payload:', err)
  }

  // Fallback: copy text directly
  let textCopied = false
  try {
    await navigator.clipboard.writeText(prompt)
    textCopied = true
  } catch {
    // The caller can explain that the browser blocked clipboard access.
  }
  return { textCopied, imageCopied: false }
}
