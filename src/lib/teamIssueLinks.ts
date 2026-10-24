export function issueLink(origin: string, teamId: string, issueId: string): string {
  const url = new URL(origin)
  url.searchParams.set('team', teamId)
  url.searchParams.set('issue', issueId)
  return url.href
}

export function readIssueLink(origin: string): { teamId: string; issueId: string } | null {
  const url = new URL(origin)
  const teamId = url.searchParams.get('team')
  const issueId = url.searchParams.get('issue')
  return teamId && issueId ? { teamId, issueId } : null
}
