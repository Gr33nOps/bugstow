import type { Issue, IssueType } from '../types'

/**
 * GitHub issue import, shared by every place it's offered.
 *
 * Browser-storage mode calls the GitHub API straight from the browser
 * (api.github.com allows it). Server-backed mode (PC folder / team) sends the
 * request through the BugsTow server instead; see server/src/api.ts. Both use
 * the same wording and error codes, so the import dialog is identical.
 *
 * Public repositories need no key. Private ones (or many imports in a short
 * time) need a read-only personal access token, which is used for one import
 * and never stored.
 */

export interface GithubRepoRef {
  owner: string
  name: string
  /** "owner/name" */
  full: string
}

/** Accepts owner/name, a repository URL (any page of it), or a git remote. */
export function parseRepo(input: string): GithubRepoRef | null {
  let s = input.trim()
  if (!s) return null
  s = s.replace(/^git@github\.com:/i, '')
  s = s.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, '')
  s = s.replace(/[?#].*$/, '')
  const [owner, rawName] = s.split('/').filter(Boolean)
  if (!owner || !rawName) return null
  const name = rawName.replace(/\.git$/i, '')
  const valid = /^[A-Za-z0-9-]{1,39}$/.test(owner) && /^[A-Za-z0-9_.-]{1,100}$/.test(name) && name !== '.' && name !== '..'
  return valid ? { owner, name, full: `${owner}/${name}` } : null
}

/** Picks a BugsTow type from the issue's labels. */
export function mapIssueType(labels: Array<{ name?: string } | string> = []): IssueType {
  const names = labels.map(l => (typeof l === 'string' ? l : l.name || '').toLowerCase())
  if (names.some(n => /(ui|ux|design|css|layout|visual)/.test(n))) return 'uiux'
  if (names.some(n => /(feature|enhancement|idea|proposal|request)/.test(n))) return 'idea'
  return 'bug'
}

/**
 * GitHub's "new fine-grained token" page, pre-filled where GitHub supports it.
 * The dialog also spells out what to pick, in case a field isn't pre-filled.
 */
export function tokenCreateUrl(repo?: GithubRepoRef | null): string {
  // GitHub's template URL: name ≤ 40 characters, expires_in in days,
  // <permission>=<level> (docs: "Managing your personal access tokens").
  const q = new URLSearchParams({
    name: (repo ? `BugsTow: ${repo.name}` : 'BugsTow import').slice(0, 40),
    description: 'Read-only access so BugsTow can import issues.',
    expires_in: '90',
    issues: 'read',
  })
  if (repo) q.set('target_name', repo.owner)
  return `https://github.com/settings/personal-access-tokens/new?${q}`
}

export type GithubImportErrorCode =
  | 'INVALID_REPO' // not a repository link
  | 'NEEDS_TOKEN' // private, or not found without a key, or anonymous rate limit
  | 'BAD_TOKEN' // key rejected or lacks access to this repository
  | 'NOT_FOUND' // with a key: no such repository, or the key can't see it
  | 'RATE_LIMITED' // with a key: GitHub asks to slow down
  | 'OFFLINE' // a team server whose administrator turned internet features off
  | 'NETWORK' // GitHub couldn't be reached

export class GithubImportError extends Error {
  constructor(
    readonly code: GithubImportErrorCode,
    message = importErrorMessage(code)
  ) {
    super(message)
    this.name = 'GithubImportError'
  }
}

export function importErrorMessage(code: GithubImportErrorCode): string {
  switch (code) {
    case 'INVALID_REPO':
      return 'That doesn’t look like a GitHub repository. Paste its link, like https://github.com/owner/repo.'
    case 'NEEDS_TOKEN':
      return 'GitHub needs a key to show this repository’s issues. It’s probably private.'
    case 'BAD_TOKEN':
      return 'GitHub didn’t accept that key for this repository. Check that it includes this repository and has Issues: Read-only.'
    case 'NOT_FOUND':
      return 'GitHub couldn’t find this repository with that key. Check the link, and that the key includes this repository.'
    case 'RATE_LIMITED':
      return 'GitHub asked to slow down. Wait a few minutes and try again.'
    case 'OFFLINE':
      return 'Internet features are turned off on this BugsTow server. Whoever runs it can turn them on (BUGSTOW_OFFLINE=false).'
    case 'NETWORK':
      return 'Couldn’t reach GitHub. Check your internet connection and try again.'
  }
}

/** An issue as BugsTow needs it (pull requests are left out). */
export interface GithubIssue {
  number: number
  title: string
  body: string
  url: string
  closed: boolean
  type: IssueType
}

interface RawIssue {
  number: number
  title: string
  body: string | null
  html_url: string
  state: string
  labels?: Array<{ name?: string } | string>
  pull_request?: unknown
}

/** Up to 1,000 issues; more than enough for a first import, and re-import is cheap. */
const MAX_PAGES = 10

export async function fetchGithubIssues(
  repo: GithubRepoRef,
  opts: { token?: string; includeClosed: boolean; fetchImpl?: typeof fetch }
): Promise<GithubIssue[]> {
  const doFetch = opts.fetchImpl ?? fetch
  const token = opts.token?.trim()
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const state = opts.includeClosed ? 'all' : 'open'
  const out: GithubIssue[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://api.github.com/repos/${repo.owner}/${repo.name}/issues?state=${state}&per_page=100&page=${page}`
    let resp: Response
    try {
      resp = await doFetch(url, { headers })
    } catch {
      throw new GithubImportError('NETWORK')
    }
    if (!resp.ok) throw new GithubImportError(errorCodeFor(resp.status, resp.headers.get('x-ratelimit-remaining'), Boolean(token)))
    const batch = (await resp.json()) as RawIssue[]
    if (!Array.isArray(batch) || batch.length === 0) break
    for (const gh of batch) {
      if (gh.pull_request) continue
      out.push({
        number: gh.number,
        title: gh.title || `#${gh.number}`,
        body: gh.body || '',
        url: gh.html_url,
        closed: gh.state === 'closed',
        type: mapIssueType(gh.labels),
      })
    }
    if (batch.length < 100) break
  }
  return out
}

/** How a GitHub HTTP status maps to what the person should do next. */
export function errorCodeFor(status: number, rateRemaining: string | null, hadToken: boolean): GithubImportErrorCode {
  if (status === 403 || status === 429) {
    if (rateRemaining === '0' || status === 429) return hadToken ? 'RATE_LIMITED' : 'NEEDS_TOKEN'
    return hadToken ? 'BAD_TOKEN' : 'NEEDS_TOKEN'
  }
  if (status === 401) return hadToken ? 'BAD_TOKEN' : 'NEEDS_TOKEN'
  if (status === 404) return hadToken ? 'NOT_FOUND' : 'NEEDS_TOKEN'
  return 'NETWORK'
}

/**
 * What an import changes, given the issues already here. New GitHub issues
 * are added; for issues imported before, only open/closed follows GitHub
 * (titles and notes edited here are kept).
 */
export function planImport(
  existing: Array<Pick<Issue, 'id' | 'status' | 'githubUrl'>>,
  incoming: GithubIssue[]
): { create: GithubIssue[]; setStatus: Array<{ id: string; status: 'open' | 'fixed' }>; unchanged: number } {
  const byUrl = new Map(existing.filter(i => i.githubUrl).map(i => [i.githubUrl!, i]))
  const create: GithubIssue[] = []
  const setStatus: Array<{ id: string; status: 'open' | 'fixed' }> = []
  let unchanged = 0
  for (const gh of incoming) {
    const here = byUrl.get(gh.url)
    if (!here) {
      create.push(gh)
      continue
    }
    const status = gh.closed ? 'fixed' : 'open'
    if (here.status !== status) setStatus.push({ id: here.id, status })
    else unchanged++
  }
  return { create, setStatus, unchanged }
}

export interface ImportSummary {
  imported: number
  updated: number
  unchanged: number
  projectId: string | null
}

/** Where imported issues go: a new project named after the repository, one that exists, or none. */
export type ImportTarget = { kind: 'new'; name: string } | { kind: 'existing'; id: string } | { kind: 'none' }

const PROJECT_COLORS = ['#5B50F6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444', '#06B6D4']

/** A stable colour for a project created by an import. */
export function projectColorFor(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PROJECT_COLORS[h % PROJECT_COLORS.length]
}
