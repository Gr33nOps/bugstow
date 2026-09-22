import { useState, useEffect, useCallback, useRef } from 'react'
import type { IssueType } from '../types'
import type { Team, TeamMember, TeamInvite, CloudProject, CloudIssue } from '../types/cloud'
import * as api from '../services/teamApi'

const ACTIVE_TEAM_KEY = 'bugstow_active_team'

export function useCloudData(signedIn: boolean) {
  const [teams, setTeams] = useState<Team[]>([])
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_TEAM_KEY)
    } catch {
      return null
    }
  })
  const [projects, setProjects] = useState<CloudProject[]>([])
  const [issues, setIssues] = useState<CloudIssue[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({})
  const urlsRef = useRef<Record<string, string>>({})
  urlsRef.current = screenshotUrls

  const setActiveTeamId = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(ACTIVE_TEAM_KEY, id)
      else localStorage.removeItem(ACTIVE_TEAM_KEY)
    } catch {
      // ignore
    }
    setActiveTeamIdState(id)
  }, [])

  // Load teams once signed in.
  const refreshTeams = useCallback(async () => {
    const list = await api.listTeams()
    setTeams(list)
    setActiveTeamIdState(prev => {
      if (prev && list.some(t => t.id === prev)) return prev
      const first = list[0]?.id ?? null
      try {
        if (first) localStorage.setItem(ACTIVE_TEAM_KEY, first)
      } catch {
        // ignore
      }
      return first
    })
    return list
  }, [])

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    setLoading(true)
    setError(null)
    refreshTeams()
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load teams.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [signedIn, refreshTeams])

  // Load team contents when the active team changes.
  const refreshTeamData = useCallback(async (teamId: string) => {
    const [proj, iss, mem] = await Promise.all([
      api.listProjects(teamId),
      api.listIssues(teamId),
      api.listMembers(teamId),
    ])
    setProjects(proj)
    setIssues(iss)
    setMembers(mem.members)
    setInvites(mem.invites)
  }, [])

  useEffect(() => {
    if (!signedIn || !activeTeamId) {
      setProjects([])
      setIssues([])
      setMembers([])
      setInvites([])
      return
    }
    let cancelled = false
    refreshTeamData(activeTeamId).catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load team data.')
    })
    return () => {
      cancelled = true
    }
  }, [signedIn, activeTeamId, refreshTeamData])

  // Clean up object URLs on unmount.
  useEffect(() => {
    return () => {
      Object.values(urlsRef.current).forEach(u => URL.revokeObjectURL(u))
    }
  }, [])

  const loadScreenshotUrl = useCallback(async (screenshotId: string): Promise<string | undefined> => {
    if (urlsRef.current[screenshotId]) return urlsRef.current[screenshotId]
    try {
      const blob = await api.fetchScreenshotBlob(screenshotId)
      const url = URL.createObjectURL(blob)
      setScreenshotUrls(prev => ({ ...prev, [screenshotId]: url }))
      return url
    } catch {
      return undefined
    }
  }, [])

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createTeam = useCallback(
    async (name: string) => {
      const team = await api.createTeam(name)
      setTeams(prev => [...prev, team])
      setActiveTeamId(team.id)
      return team
    },
    [setActiveTeamId]
  )

  const createIssue = useCallback(
    async (
      data: { title: string; description: string; type: IssueType; projectId: string | null; assigneeId: string | null },
      screenshot?: { base64: string; mimeType: string; filename?: string }
    ) => {
      if (!activeTeamId) throw new Error('No team selected.')
      const issue = await api.createCloudIssue(activeTeamId, data)
      if (screenshot) {
        const sid = await api.uploadScreenshot(issue.id, screenshot.base64, screenshot.mimeType, screenshot.filename)
        issue.screenshot_count = 1
        issue.screenshot_ids = [sid]
      }
      setIssues(prev => [issue, ...prev])
      return issue
    },
    [activeTeamId]
  )

  const updateIssue = useCallback(
    async (
      id: string,
      updates: Partial<{
        title: string
        description: string
        type: IssueType
        status: 'open' | 'fixed'
        projectId: string | null
        assigneeId: string | null
      }>
    ) => {
      const updated = await api.updateCloudIssue(id, updates)
      setIssues(prev => prev.map(i => (i.id === id ? { ...i, ...updated } : i)))
      return updated
    },
    []
  )

  const deleteIssue = useCallback(async (id: string) => {
    await api.deleteCloudIssue(id)
    setIssues(prev => prev.filter(i => i.id !== id))
  }, [])

  const createProject = useCallback(
    async (name: string, color: string, description?: string) => {
      if (!activeTeamId) throw new Error('No team selected.')
      const project = await api.createCloudProject(activeTeamId, name, color, description)
      setProjects(prev => [...prev, project])
      return project
    },
    [activeTeamId]
  )

  const deleteProject = useCallback(async (id: string) => {
    await api.deleteCloudProject(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setIssues(prev => prev.map(i => (i.project_id === id ? { ...i, project_id: null, project_name: null } : i)))
  }, [])

  const inviteMember = useCallback(
    async (email: string, role: 'admin' | 'member') => {
      if (!activeTeamId) throw new Error('No team selected.')
      await api.inviteMember(activeTeamId, email, role)
      const mem = await api.listMembers(activeTeamId)
      setMembers(mem.members)
      setInvites(mem.invites)
    },
    [activeTeamId]
  )

  const removeMember = useCallback(
    async (userId: string) => {
      if (!activeTeamId) throw new Error('No team selected.')
      await api.removeMember(activeTeamId, userId)
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    },
    [activeTeamId]
  )

  const importGithub = useCallback(
    async (repo: string, token: string, projectId: string | null, includeClosed: boolean) => {
      if (!activeTeamId) throw new Error('No team selected.')
      const result = await api.importGithubIssues({ teamId: activeTeamId, projectId, repo, token, includeClosed })
      await refreshTeamData(activeTeamId)
      return result
    },
    [activeTeamId, refreshTeamData]
  )

  const activeTeam = teams.find(t => t.id === activeTeamId) || null

  return {
    teams,
    activeTeam,
    activeTeamId,
    setActiveTeamId,
    projects,
    issues,
    members,
    invites,
    loading,
    error,
    screenshotUrls,
    loadScreenshotUrl,
    refreshTeams,
    createTeam,
    createIssue,
    updateIssue,
    deleteIssue,
    createProject,
    deleteProject,
    inviteMember,
    removeMember,
    importGithub,
  }
}
