/** Accept only canonical GitHub repository, pull request, or commit links. */
export function normalizeGithubFixReference(input: string): string | null {
  try {
    const url = new URL(input.trim())
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash) return null
    const path = url.pathname.replace(/\/$/, '')
    if (!/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/(?:pull\/[1-9]\d*|commit\/[a-fA-F0-9]{7,40}))?$/.test(path)) return null
    return `https://github.com${path}`
  } catch { return null }
}
