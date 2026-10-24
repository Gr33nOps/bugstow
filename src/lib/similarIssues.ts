type SimilarIssue = { id: string; title: string; description: string }
const STOP = new Set(['the', 'and', 'with', 'from', 'into', 'this', 'that', 'when', 'then', 'not', 'are', 'for', 'was', 'too', 'can', 'has', 'have', 'your', 'you', 'issue'])

function words(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(word => !STOP.has(word)))
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const word of a) if (b.has(word)) shared++
  return shared / (a.size + b.size - shared)
}

/** Small on-device lexical matcher; it never uploads issue text or changes issues. */
export function findSimilarIssues<T extends SimilarIssue>(title: string, description: string, issues: T[], limit = 3): T[] {
  const queryTitle = words(title)
  if (queryTitle.size < 2) return []
  const queryDescription = words(description)
  return issues.map(issue => ({
    issue,
    score: similarity(queryTitle, words(issue.title)) * 0.8 + similarity(queryDescription, words(issue.description)) * 0.2,
  })).filter(item => item.score >= 0.25).sort((a, b) => b.score - a.score || a.issue.title.localeCompare(b.issue.title)).slice(0, limit).map(item => item.issue)
}
