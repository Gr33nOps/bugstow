import { useState, useEffect, useCallback, useRef } from 'react'
import type { Issue, Project, IssueType, IssueStatus, Tab, ApplicationSettings } from '../types'
import {
  IndexedDbIssueRepository,
  IndexedDbProjectRepository,
  IndexedDbScreenshotRepository,
  IndexedDbSettingsRepository
} from '../repositories/indexedDbRepositories'
import { restoreBackupData, type BackupData } from '../services/backupService'

export function useBugstowData() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [settings, setSettings] = useState<ApplicationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Map of screenshotId -> objectURL
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({})
  const screenshotUrlsRef = useRef<Record<string, string>>({})
  screenshotUrlsRef.current = screenshotUrls

  const issueRepo = useRef(new IndexedDbIssueRepository()).current
  const projectRepo = useRef(new IndexedDbProjectRepository()).current
  const screenshotRepo = useRef(new IndexedDbScreenshotRepository()).current
  const settingsRepo = useRef(new IndexedDbSettingsRepository()).current

  // Load or fetch screenshot object URL
  const loadScreenshotUrl = useCallback(async (screenshotId: string): Promise<string | undefined> => {
    if (screenshotUrlsRef.current[screenshotId]) {
      return screenshotUrlsRef.current[screenshotId]
    }
    try {
      const record = await screenshotRepo.getById(screenshotId)
      if (record && record.blob) {
        const url = URL.createObjectURL(record.blob)
        setScreenshotUrls(prev => ({ ...prev, [screenshotId]: url }))
        return url
      }
    } catch (err) {
      console.error('Failed to load screenshot Blob:', err)
    }
    return undefined
  }, [screenshotRepo])

  // Refresh all state
  const refreshData = useCallback(async () => {
    try {
      setError(null)
      const [allIssues, allProjects, appSettings] = await Promise.all([
        issueRepo.getAll(),
        projectRepo.getAll(),
        settingsRepo.get()
      ])

      setIssues(allIssues)
      setProjects(allProjects)
      setSettings(appSettings)

      // Preload screenshot URLs for all issues
      for (const issue of allIssues) {
        if (issue.screenshotId && !screenshotUrlsRef.current[issue.screenshotId]) {
          loadScreenshotUrl(issue.screenshotId)
        }
      }
    } catch (err) {
      console.error('Failed to load data from IndexedDB:', err)
      setError('Unable to load data from local database.')
    } finally {
      setLoading(false)
    }
  }, [issueRepo, projectRepo, settingsRepo, loadScreenshotUrl])

  useEffect(() => {
    refreshData()

    // Cleanup object URLs on unmount
    return () => {
      Object.values(screenshotUrlsRef.current).forEach(url => URL.revokeObjectURL(url))
    }
  }, [refreshData])

  // Create issue
  const createIssue = useCallback(async (
    data: {
      title: string
      description: string
      projectId: string | null
      type: IssueType
      status?: IssueStatus
    },
    screenshotBlob?: Blob | null,
    filename?: string
  ): Promise<Issue> => {
    try {
      const created = await issueRepo.create(
        { ...data, status: data.status || 'open' },
        screenshotBlob,
        filename
      )
      if (created.screenshotId && screenshotBlob) {
        const url = URL.createObjectURL(screenshotBlob)
        setScreenshotUrls(prev => ({ ...prev, [created.screenshotId!]: url }))
      }
      setIssues(prev => [created, ...prev])
      return created
    } catch (err) {
      console.error('Failed to create issue:', err)
      throw new Error(`Failed to save issue: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [issueRepo])

  // Update issue
  const updateIssue = useCallback(async (
    id: string,
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>,
    newScreenshotBlob?: Blob | null,
    filename?: string
  ): Promise<Issue> => {
    try {
      const existing = issues.find(i => i.id === id)
      const updated = await issueRepo.updateWithScreenshot(id, updates, newScreenshotBlob, filename)

      // Clean up previous screenshot URL if replaced/removed
      if (existing?.screenshotId && newScreenshotBlob !== undefined && existing.screenshotId !== updated.screenshotId) {
        if (screenshotUrlsRef.current[existing.screenshotId]) {
          URL.revokeObjectURL(screenshotUrlsRef.current[existing.screenshotId])
          setScreenshotUrls(prev => {
            const copy = { ...prev }
            delete copy[existing.screenshotId!]
            return copy
          })
        }
      }

      // Add new screenshot URL
      if (updated.screenshotId && newScreenshotBlob) {
        const url = URL.createObjectURL(newScreenshotBlob)
        setScreenshotUrls(prev => ({ ...prev, [updated.screenshotId!]: url }))
      }

      setIssues(prev => prev.map(i => i.id === id ? updated : i))
      return updated
    } catch (err) {
      console.error('Failed to update issue:', err)
      throw new Error(`Failed to update issue: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [issueRepo, issues])

  // Mark fixed
  const markFixed = useCallback(async (id: string): Promise<Issue> => {
    const updated = await issueRepo.update(id, { status: 'fixed' })
    setIssues(prev => prev.map(i => i.id === id ? updated : i))
    return updated
  }, [issueRepo])

  // Reopen
  const reopenIssue = useCallback(async (id: string): Promise<Issue> => {
    const updated = await issueRepo.update(id, { status: 'open' })
    setIssues(prev => prev.map(i => i.id === id ? updated : i))
    return updated
  }, [issueRepo])

  // Delete issue
  const deleteIssue = useCallback(async (id: string): Promise<void> => {
    const target = issues.find(i => i.id === id)
    await issueRepo.delete(id)
    if (target?.screenshotId && screenshotUrlsRef.current[target.screenshotId]) {
      URL.revokeObjectURL(screenshotUrlsRef.current[target.screenshotId])
      setScreenshotUrls(prev => {
        const copy = { ...prev }
        delete copy[target.screenshotId!]
        return copy
      })
    }
    setIssues(prev => prev.filter(i => i.id !== id))
  }, [issueRepo, issues])

  // Create project
  const createProject = useCallback(async (name: string, color: string, description?: string): Promise<Project> => {
    const created = await projectRepo.create(name, color, description)
    setProjects(prev => [...prev, created])
    return created
  }, [projectRepo])

  // Update project
  const updateProject = useCallback(async (id: string, updates: { name?: string; color?: string; description?: string }): Promise<Project> => {
    const updated = await projectRepo.update(id, updates)
    setProjects(prev => prev.map(p => p.id === id ? updated : p))
    return updated
  }, [projectRepo])

  // Delete project
  const deleteProject = useCallback(async (id: string): Promise<void> => {
    await projectRepo.delete(id)
    // Issues belonging to this project have been moved to unassigned (projectId: null)
    setProjects(prev => prev.filter(p => p.id !== id))
    setIssues(prev => prev.map(i => i.projectId === id ? { ...i, projectId: null } : i))
  }, [projectRepo])

  // Clear all data
  const clearAllData = useCallback(async (): Promise<void> => {
    const allScreenshots = await screenshotRepo.getAll()
    for (const s of allScreenshots) {
      if (screenshotUrlsRef.current[s.id]) {
        URL.revokeObjectURL(screenshotUrlsRef.current[s.id])
      }
    }
    setScreenshotUrls({})

    // We can restore with empty backup
    const emptyBackup: BackupData = {
      version: 1,
      createdAt: new Date().toISOString(),
      appVersion: '1.0.0',
      settings: {
        schemaVersion: 1,
        onboardingCompleted: true,
        lastBackupExportAt: null,
        backupReminderDismissedAt: null,
      },
      projects: [],
      issues: [],
      screenshots: [],
    }
    await restoreBackupData(emptyBackup)
    await refreshData()
  }, [screenshotRepo, refreshData])

  // Restore from backup
  const restoreBackup = useCallback(async (data: BackupData): Promise<void> => {
    // Revoke all existing URLs
    Object.values(screenshotUrlsRef.current).forEach(url => URL.revokeObjectURL(url))
    setScreenshotUrls({})

    await restoreBackupData(data)
    await refreshData()
  }, [refreshData])

  // Dismiss backup reminder
  const dismissBackupReminder = useCallback(async () => {
    const now = new Date().toISOString()
    const updated = await settingsRepo.update({ backupReminderDismissedAt: now })
    setSettings(updated)
  }, [settingsRepo])

  return {
    issues,
    projects,
    settings,
    loading,
    error,
    screenshotUrls,
    loadScreenshotUrl,
    createIssue,
    updateIssue,
    markFixed,
    reopenIssue,
    deleteIssue,
    createProject,
    updateProject,
    deleteProject,
    clearAllData,
    restoreBackup,
    dismissBackupReminder,
    refreshData,
  }
}
