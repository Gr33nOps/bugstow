import { useState, useEffect, useCallback, useRef } from 'react'
import type { Issue, Project, IssueType, IssueStatus, Tab, ApplicationSettings } from '../types'
import {
  IndexedDbIssueRepository,
  IndexedDbProjectRepository,
  IndexedDbScreenshotRepository,
  IndexedDbSettingsRepository
} from '../repositories/indexedDbRepositories'
import { restoreBackupData, type BackupData } from '../services/backupService'
import { clearAllData as clearAllDataStores } from '../storage/db'
import { notifyLocalChange } from '../sync/events'
import { syncStore } from '../sync/store'

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

  // Get raw Blob for clipboard copying
  const getScreenshotBlob = useCallback(async (screenshotId: string): Promise<Blob | undefined> => {
    try {
      const record = await screenshotRepo.getById(screenshotId)
      return record?.blob
    } catch (err) {
      console.error('Failed to get screenshot blob:', err)
      return undefined
    }
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

      // Preload screenshot URLs for all issues (including multi-screenshots)
      for (const issue of allIssues) {
        const ids = issue.screenshotIds || (issue.screenshotId ? [issue.screenshotId] : [])
        for (const sid of ids) {
          if (!screenshotUrlsRef.current[sid]) {
            loadScreenshotUrl(sid)
          }
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
    filename?: string,
    additionalBlobs?: Array<{ blob: Blob; filename?: string }>
  ): Promise<Issue> => {
    try {
      const created = await issueRepo.create(
        { ...data, status: data.status || 'open' },
        screenshotBlob,
        filename,
        additionalBlobs
      )
      if (screenshotBlob && created.screenshotId) {
        const url = URL.createObjectURL(screenshotBlob)
        setScreenshotUrls(prev => ({ ...prev, [created.screenshotId!]: url }))
      }
      if (additionalBlobs && created.screenshotIds) {
        created.screenshotIds.slice(1).forEach((sid, idx) => {
          const blob = additionalBlobs[idx]?.blob
          if (blob) {
            const url = URL.createObjectURL(blob)
            setScreenshotUrls(prev => ({ ...prev, [sid]: url }))
          }
        })
      }
      setIssues(prev => [created, ...prev])
      notifyLocalChange()
      return created
    } catch (err) {
      console.error('Failed to create issue:', err)
      throw new Error(`Failed to save issue: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [issueRepo])

  // Update issue (legacy single image replacement)
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
      notifyLocalChange()
      return updated
    } catch (err) {
      console.error('Failed to update issue:', err)
      throw new Error(`Failed to update issue: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [issueRepo, issues])

  // Update issue with multiple screenshots (add, remove, reorder)
  const updateIssueScreenshots = useCallback(async (
    id: string,
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>,
    options?: {
      keepScreenshotIds?: string[]
      newScreenshots?: Array<{ blob: Blob; filename?: string }>
    }
  ): Promise<Issue> => {
    try {
      const updated = await issueRepo.updateWithScreenshots(id, updates, options)

      // Preload URLs for new screenshots
      if (options?.newScreenshots && options.newScreenshots.length > 0) {
        for (const sid of (updated.screenshotIds || [])) {
          if (!screenshotUrlsRef.current[sid]) {
            await loadScreenshotUrl(sid)
          }
        }
      }

      setIssues(prev => prev.map(i => i.id === id ? updated : i))
      notifyLocalChange()
      return updated
    } catch (err) {
      console.error('Failed to update issue screenshots:', err)
      throw new Error(`Failed to update issue screenshots: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [issueRepo, loadScreenshotUrl])

  // Mark fixed
  const markFixed = useCallback(async (id: string): Promise<Issue> => {
    const updated = await issueRepo.update(id, { status: 'fixed' })
    setIssues(prev => prev.map(i => i.id === id ? updated : i))
    notifyLocalChange()
    return updated
  }, [issueRepo])

  // Reopen
  const reopenIssue = useCallback(async (id: string): Promise<Issue> => {
    const updated = await issueRepo.update(id, { status: 'open' })
    setIssues(prev => prev.map(i => i.id === id ? updated : i))
    notifyLocalChange()
    return updated
  }, [issueRepo])

  // Delete issue
  const deleteIssue = useCallback(async (id: string): Promise<void> => {
    const target = issues.find(i => i.id === id)
    await issueRepo.delete(id)
    const ids = target?.screenshotIds || (target?.screenshotId ? [target.screenshotId] : [])
    ids.forEach(sid => {
      if (screenshotUrlsRef.current[sid]) {
        URL.revokeObjectURL(screenshotUrlsRef.current[sid])
      }
    })
    setScreenshotUrls(prev => {
      const copy = { ...prev }
      ids.forEach(sid => delete copy[sid])
      return copy
    })
    setIssues(prev => prev.filter(i => i.id !== id))
    notifyLocalChange()
  }, [issueRepo, issues])

  // Create project
  const createProject = useCallback(async (name: string, color: string, description?: string): Promise<Project> => {
    const created = await projectRepo.create(name, color, description)
    setProjects(prev => [...prev, created])
    notifyLocalChange()
    return created
  }, [projectRepo])

  // Update project
  const updateProject = useCallback(async (id: string, updates: { name?: string; color?: string; description?: string }): Promise<Project> => {
    const updated = await projectRepo.update(id, updates)
    setProjects(prev => prev.map(p => p.id === id ? updated : p))
    notifyLocalChange()
    return updated
  }, [projectRepo])

  // Delete project
  const deleteProject = useCallback(async (id: string): Promise<void> => {
    await projectRepo.delete(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setIssues(prev => prev.map(i => i.projectId === id ? { ...i, projectId: null } : i))
    notifyLocalChange()
  }, [projectRepo])

  // Clear all data
  const clearAllData = useCallback(async (): Promise<void> => {
    // Wipe the underlying IndexedDB stores first, then reset local state.
    // Cloud sync is disconnected so the cloud copy is neither deleted by the
    // next sync nor downloaded straight back.
    await clearAllDataStores()
    await syncStore.disconnect()
    Object.values(screenshotUrlsRef.current).forEach(url => URL.revokeObjectURL(url))
    setScreenshotUrls({})
    setIssues([])
    setProjects([])
    await refreshData()
  }, [refreshData])

  // Restore backup
  const restoreBackup = useCallback(async (data: BackupData): Promise<void> => {
    await restoreBackupData(data)
    await syncStore.resetBases()
    await refreshData()
    notifyLocalChange()
  }, [refreshData])

  // Dismiss backup reminder
  const dismissBackupReminder = useCallback(async (): Promise<void> => {
    const now = new Date().toISOString()
    await settingsRepo.update({ backupReminderDismissedAt: now })
    setSettings(prev => prev ? { ...prev, backupReminderDismissedAt: now } : null)
  }, [settingsRepo])

  return {
    issues,
    projects,
    settings,
    loading,
    error,
    screenshotUrls,
    loadScreenshotUrl,
    getScreenshotBlob,
    createIssue,
    updateIssue,
    updateIssueScreenshots,
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
