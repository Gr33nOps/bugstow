const GITHUB_FIX = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/(?:pull\/[1-9]\d*|commit\/[a-fA-F0-9]{7,40}))?$/

export function parseFixReferences(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 10 || !value.every(item => typeof item === 'string')) return null
  const links = value.map(item => item.trim().replace(/\/$/, ''))
  if (new Set(links).size !== links.length || !links.every(link => {
    if (!GITHUB_FIX.test(link) || link.length > 300) return false
    const segments = new URL(link).pathname.split('/').filter(Boolean)
    return segments[0] !== '.' && segments[0] !== '..' && segments[1] !== '.' && segments[1] !== '..' && new URL(link).href === link
  })) return null
  return links
}
