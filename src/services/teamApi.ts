import { getAuthToken } from '../lib/authClient'
import type { IssueType } from '../types'
import type { Team, TeamMember, TeamInvite, CloudProject, CloudIssue } from '../types/cloud'

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('You are signed out. Please sign in again.')
  const res = await fetch(`/api/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {
      // ignore parse errors
    }
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
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
export async function listProjects(teamId: string): Promise<CloudProject[]> {
  return (await api<{ projects: CloudProject[] }>(`projects?teamId=${encodeURIComponent(teamId)}`)).projects
}
export async function createCloudProject(
  teamId: string,
  name: string,
  color: string,
  description?: string
): Promise<CloudProject> {
  return (
    await api<{ project: CloudProject }>(`projects?teamId=${encodeURIComponent(teamId)}`, {
      method: 'POST',
      body: JSON.stringify({ name, color, description }),
    })
  ).project
}
export async function deleteCloudProject(id: string): Promise<void> {
  await api(`projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ── Issues ──────────────────────────────────────────────────────────────────
export async function listIssues(teamId: string): Promise<CloudIssue[]> {
  return (await api<{ issues: CloudIssue[] }>(`issues?teamId=${encodeURIComponent(teamId)}`)).issues
}
export async function createCloudIssue(
  teamId: string,
  data: { title: string; description: string; type: IssueType; projectId: string | null; assigneeId: string | null }
): Promise<CloudIssue> {
  return (
    await api<{ issue: CloudIssue }>(`issues?teamId=${encodeURIComponent(teamId)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  ).issue
}
export async function updateCloudIssue(
  id: string,
  updates: Partial<{
    title: string
    description: string
    type: IssueType
    status: 'open' | 'fixed'
    projectId: string | null
    assigneeId: string | null
  }>
): Promise<CloudIssue> {
  return (
    await api<{ issue: CloudIssue }>(`issues?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  ).issue
}
export async function deleteCloudIssue(id: string): Promise<void> {
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
  const token = await getAuthToken()
  const res = await fetch(`/api/screenshots?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
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
