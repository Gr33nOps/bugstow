import { describe, expect, it } from 'vitest'
import { issuesToCsv, issuesToMarkdown } from './portabilityExport'

const issues = [{ id: '1', title: '=HYPERLINK("bad")', description: 'First line\nSecond line', type: 'bug', status: 'blocked', priority: 'high', projectName: 'Website', createdAt: '2026-10-01', updatedAt: '2026-10-02', fixReferences: ['https://github.com/acme/app/pull/12'] }]

describe('portable issue exports', () => {
  it('quotes CSV and neutralizes spreadsheet formulas', () => {
    const csv = issuesToCsv(issues)
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"')
    expect(csv).toContain('"First line\nSecond line"')
    expect(csv).toContain('https://github.com/acme/app/pull/12')
  })

  it('includes issue details in Markdown without active HTML', () => {
    const markdown = issuesToMarkdown([{ ...issues[0], title: '<img src=x>' }])
    expect(markdown).toContain('&lt;img src=x&gt;')
    expect(markdown).toContain('**Status:** Blocked')
    expect(markdown).toContain('https://github.com/acme/app/pull/12')
  })
})
