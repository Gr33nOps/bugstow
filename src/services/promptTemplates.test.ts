import { describe, expect, it } from 'vitest'
import { generatePromptWithTemplate } from './promptTemplates'
import type { Issue } from '../types'

const issue: Issue = {
  id: '1', projectId: null, title: 'Dialog clips on mobile', description: 'The save button is hidden.',
  type: 'bug', status: 'blocked', priority: 'high', severity: 'major',
  details: { stepsToReproduce: 'Open a narrow viewport', browserOs: 'Firefox on Linux' },
  screenshotId: 'shot-1', createdAt: '', updatedAt: '',
}

describe('prompt templates', () => {
  it('keeps the original one-click fix prompt', () => {
    expect(generatePromptWithTemplate(issue, null, 'fix')).toContain('Please investigate and fix')
  })

  it('includes structured context in specialized prompts', () => {
    const prompt = generatePromptWithTemplate(issue, null, 'regression')
    expect(prompt).toContain('regression tests')
    expect(prompt).toContain('Dialog clips on mobile')
    expect(prompt).toContain('Priority: high')
    expect(prompt).toContain('Firefox on Linux')
    expect(prompt).toContain('Screenshot')
  })

  it('fills a custom local template without executing its text', () => {
    expect(generatePromptWithTemplate(issue, null, 'custom', 'Check {{title}}\n{{issue}}')).toContain('Check Dialog clips on mobile')
  })
})
