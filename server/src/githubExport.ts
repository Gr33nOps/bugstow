export interface ExportIssue {
  id: string
  title: string
  description: string
  type: string
  status: string
  githubUrl?: string | null
}
export interface ExportSummary {
  exported: number
  skipped: number
  error: string | null
  warnings: string[]
}
export async function exportGithubIssues(
  repo: string, token: string, issues: ExportIssue[],
  saveLink: (id: string, url: string, number: number) => Promise<void>,
  fetchImpl: typeof fetch = fetch,
): Promise<ExportSummary> {
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(repo) || ['.', '..'].includes(repo.split('/')[1])) throw new Error('Enter a GitHub repository as owner/name.')
  if (!token.trim()) throw new Error('A GitHub token with Issues: Read and write is required.')
  const result: ExportSummary = { exported: 0, skipped: 0, error: null, warnings: [] }
  const request = async (suffix: string, method: string, body: unknown) => {
    let response: Response
    try {
      response = await fetchImpl(`https://api.github.com/repos/${repo}/issues${suffix}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(30000),
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token.trim()}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify(body),
      })
    } catch {
      throw new Error('GitHub could not be reached. Check the repository before retrying: the last issue may have been created.')
    }
    if (!response.ok) {
      if (response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0') throw new Error('GitHub rate limit reached. Wait before exporting the remaining issues.')
      if ([401, 403, 404].includes(response.status)) throw new Error('Check repository access and that your token has Issues: Read and write. GitHub may also require a pause before retrying.')
      throw new Error(`GitHub rejected the issue (${response.status}). Check that issues are enabled and the title and description fit GitHub limits.`)
    }
    return response.json()
  }
  for (const issue of issues) {
    if (issue.githubUrl) { result.skipped++; continue }
    let createdUrl = ''
    try {
      const created = await request('', 'POST', {
        title: issue.title,
        body: `${issue.description}\n\n---\nType: ${issue.type}\nBugsTow status: ${issue.status}\n<!-- bugstow:${issue.id} -->`,
      }) as { number: number; html_url: string }
      if (!Number.isSafeInteger(created.number) || created.number < 1) throw new Error('Unexpected GitHub response. Check the repository before retrying.')
      createdUrl = `https://github.com/${repo}/issues/${created.number}`
      await saveLink(issue.id, createdUrl, created.number)
      result.exported++
      if (issue.status === 'fixed') {
        try { await request(`/${created.number}`, 'PATCH', { state: 'closed' }) }
        catch { result.warnings.push(`Created ${createdUrl}, but could not close it. Close it on GitHub.`) }
      }
    } catch (err) {
      result.error = createdUrl
        ? `Created ${createdUrl}, but could not save its link in BugsTow. Keep this URL and do not export this issue again.`
        : err instanceof Error ? err.message : 'Export failed.'
      break
    }
  }
  return result
}
