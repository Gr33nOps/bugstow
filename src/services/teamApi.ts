import type { IssueType } from '../types'
import type { Team, TeamMember, TeamInvite, TeamProject, TeamIssue, CurrentUser } from '../types/team'

/** An API error with the HTTP status and, when present, the server's error code and body. */
export class TeamApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly body?: Record<string, unknown>
  ) {
    super(message)
  }
}

/** Thrown when an issue was saved by someone else since it was loaded (HTTP 409). */
export class IssueConflictError extends TeamApiError {
  constructor(message: string, readonly latest: TeamIssue) {
    super(message, 409, 'CONFLICT')
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`
    let body: Record<string, unknown> | undefined
    try {
      body = await res.json()
      if (typeof body?.error === 'string') msg = body.error
    } catch {
      // ignore parse errors
    }
    if (res.status === 409 && body?.code === 'CONFLICT' && body.issue) {
      throw new IssueConflictError(msg, body.issue as TeamIssue)
    }
    throw new TeamApiError(msg, res.status, typeof body?.code === 'string' ? body.code : undefined, body)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Current user & server admin ─────────────────────────────────────────────
export async function getMe(): Promise<CurrentUser> {
  return api<CurrentUser>('me')
}
/** Server admin only. Returns a one-time temporary password for the user. */
export async function resetUserPassword(userId: string): Promise<string> {
  return (
    await api<{ temporaryPassword: string }>('admin/users/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  ).temporaryPassword
}

// ── Teams ──────────────────────────────────────────────────────────────────
export async function listTeams(): Promise<Team[]> {
  return (await api<{ teams: Team[] }>('teams')).teams
}
export async function createTeam(name: string): Promise<Team> {
  return (await api<{ team: Team }>('teams', { method: 'POST', body: JSON.stringify({ name }) })).team
}

// ── Members ─────────────────────────────────────────────────────────────────
export async function listMembers(teamId: string): Promise<{ members: TeamMember[]; invites: TeamInvite[] }> {
  return api(`members?teamId=${encodeURIComponent(teamId)}`)
}
export async function inviteMember(teamId: string, email: string, role: 'admin' | 'member'): Promise<void> {
  await api(`members?teamId=${encodeURIComponent(teamId)}`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  })
}
export async function removeMember(teamId: string, userId: string): Promise<void> {
  await api(`members?teamId=${encodeURIComponent(teamId)}&userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
}
export async function cancelInvite(teamId: string, inviteId: string): Promise<void> {
  await api(`members?teamId=${encodeURIComponent(teamId)}&inviteId=${encodeURIComponent(inviteId)}`, {
    method: 'DELETE',
  })
}

// ── Projects ────────────────────────────────────────────────────────────────
export async function listProjects(teamId: string): Promise<TeamProject[]> {
  return (await api<{ projects: TeamProject[] }>(`projects?teamId=${encodeURIComponent(teamId)}`)).projects
}
export async function createProject(
  teamId: string,
  name: string,
  color: string,
  description?: string
): Promise<TeamProject> {
  return (
    await api<{ project: TeamProject }>(`projects?teamId=${encodeURIComponent(teamId)}`, {
      method: 'POST',
      body: JSON.stringify({ name, color, description }),
    })
  ).project
}
export async function deleteProject(id: string): Promise<void> {
  await api(`projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ── Issues ──────────────────────────────────────────────────────────────────
export async function listIssues(teamId: string): Promise<TeamIssue[]> {
  return (await api<{ issues: TeamIssue[] }>(`issues?teamId=${encodeURIComponent(teamId)}`)).issues
}
export async function createIssue(
  teamId: string,
  data: { title: string; description: string; type: IssueType; projectId: string | null; assigneeId: string | null }
): Promise<TeamIssue> {
  return (
    await api<{ issue: TeamIssue }>(`issues?teamId=${encodeURIComponent(teamId)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  ).issue
}
/**
 * Save changes to an issue. `expectedUpdatedAt` is the version you edited;
 * if a teammate saved in between, this throws IssueConflictError instead of
 * overwriting their change.
 */
export async function updateIssue(
  id: string,
  updates: Partial<{
    title: string
    description: string
    type: IssueType
    status: 'open' | 'fixed'
    projectId: string | null
    assigneeId: string | null
  }>,
  expectedUpdatedAt?: string
): Promise<TeamIssue> {
  return (
    await api<{ issue: TeamIssue }>(`issues?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...updates, expectedUpdatedAt }),
    })
  ).issue
}
export async function deleteIssue(id: string): Promise<void> {
  await api(`issues?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ── Screenshots ─────────────────────────────────────────────────────────────
export async function uploadScreenshot(
  issueId: string,
  base64: string,
  mimeType: string,
  filename?: string
): Promise<string> {
  return (
    await api<{ id: string }>(`screenshots?issueId=${encodeURIComponent(issueId)}`, {
      method: 'POST',
      body: JSON.stringify({ base64, mimeType, filename }),
    })
  ).id
}
export async function fetchScreenshotBlob(id: string): Promise<Blob> {
  const res = await fetch(`/api/screenshots?id=${encodeURIComponent(id)}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Could not load screenshot.')
  return res.blob()
}

// ── GitHub import ────────────────────────────────────────────────────────────
export async function importGithubIssues(params: {
  teamId: string
  projectId: string | null
  repo: string
  token: string
  includeClosed: boolean
}): Promise<{ imported: number; skipped: number }> {
  return api('github-import', { method: 'POST', body: JSON.stringify(params) })
}

// ── Backups (server administrator) ───────────────────────────────────────────
export interface BackupStatus {
  backups: string[]
  automatic: boolean
  intervalHours: number
  retention: number
  external: {
    configured: boolean
    dir: string | null
    lastSuccessAt: string | null
    lastBackup: string | null
    lastError: string | null
    lastErrorAt: string | null
    backups: string[]
  }
  /** Encrypted copies in your own cloud (synced folder and/or WebDAV). */
  cloud: {
    configured: boolean
    targets: string[]
    encrypted: boolean
    lastSuccessAt: string | null
    lastArchive: string | null
    lastError: string | null
    lastErrorAt: string | null
  }
}
export async function listBackups(): Promise<BackupStatus> {
  return api<BackupStatus>('admin/backups')
}
export async function runBackupNow(): Promise<{
  ok: true
  external: Omit<BackupStatus['external'], 'backups'>
  cloud: BackupStatus['cloud']
}> {
  return api('admin/backup', { method: 'POST' })
}
