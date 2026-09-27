import { getDB, DEFAULT_SETTINGS } from '../storage/db'
import type { Issue, Project, Screenshot, ApplicationSettings, IssueStatus } from '../types'
import type {
  IIssueRepository,
  IProjectRepository,
  IScreenshotRepository,
  ISettingsRepository
} from './interfaces'

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export class IndexedDbIssueRepository implements IIssueRepository {
  async getAll(): Promise<Issue[]> {
    const db = await getDB()
    const all = await db.getAll('issues')
    // Return newest first by default
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async getById(id: string): Promise<Issue | undefined> {
    const db = await getDB()
    return db.get('issues', id)
  }

  async getByProject(projectId: string | null): Promise<Issue[]> {
    const db = await getDB()
    if (projectId === null) {
      const all = await db.getAll('issues')
      return all.filter(i => i.projectId === null)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    const list = await db.getAllFromIndex('issues', 'by-project', projectId)
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async getByStatus(status: IssueStatus): Promise<Issue[]> {
    const db = await getDB()
    const list = await db.getAllFromIndex('issues', 'by-status', status)
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async create(
    issueData: Omit<Issue, 'id' | 'createdAt' | 'updatedAt' | 'screenshotId' | 'screenshotIds' | 'status'> & {
      status?: IssueStatus
    },
    screenshotBlob?: Blob | null,
    filename?: string,
    additionalBlobs?: Array<{ blob: Blob; filename?: string }>
  ): Promise<Issue> {
    const db = await getDB()
    const issueId = generateUUID()
    const now = new Date().toISOString()
    const screenshotIds: string[] = []

    // Run in atomic transaction
    const tx = db.transaction(['issues', 'screenshots'], 'readwrite')
    try {
      if (screenshotBlob) {
        const screenshotId = generateUUID()
        const screenshotRecord: Screenshot = {
          id: screenshotId,
          blob: screenshotBlob,
          mimeType: screenshotBlob.type || 'image/png',
          filename: filename || `screenshot-${Date.now()}.${screenshotBlob.type?.split('/')[1] || 'png'}`,
          createdAt: now
        }
        await tx.objectStore('screenshots').put(screenshotRecord)
        screenshotIds.push(screenshotId)
      }

      if (additionalBlobs && additionalBlobs.length > 0) {
        for (const item of additionalBlobs) {
          const sid = generateUUID()
          const sRecord: Screenshot = {
            id: sid,
            blob: item.blob,
            mimeType: item.blob.type || 'image/png',
            filename: item.filename || `screenshot-${Date.now()}.${item.blob.type?.split('/')[1] || 'png'}`,
            createdAt: now
          }
          await tx.objectStore('screenshots').put(sRecord)
          screenshotIds.push(sid)
        }
      }

      const newIssue: Issue = {
        id: issueId,
        projectId: issueData.projectId || null,
        title: issueData.title.trim(),
        description: issueData.description || '',
        type: issueData.type,
        status: issueData.status || 'open',
        screenshotId: screenshotIds[0] || null,
        screenshotIds,
        ...(issueData.githubUrl ? { githubUrl: issueData.githubUrl, githubNumber: issueData.githubNumber } : {}),
        createdAt: now,
        updatedAt: now
      }

      await tx.objectStore('issues').put(newIssue)
      await tx.done
      return newIssue
    } catch (err) {
      tx.abort()
      throw err
    }
  }

  async update(
    id: string,
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Issue> {
    const db = await getDB()
    const tx = db.transaction('issues', 'readwrite')
    const existing = await tx.store.get(id)
    if (!existing) {
      throw new Error(`Issue with id ${id} not found`)
    }

    const updated: Issue = {
      ...existing,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      updatedAt: new Date().toISOString()
    }

    await tx.store.put(updated)
    await tx.done
    return updated
  }

  async updateWithScreenshot(
    id: string,
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>,
    newScreenshotBlob?: Blob | null,
    filename?: string
  ): Promise<Issue> {
    const db = await getDB()
    const tx = db.transaction(['issues', 'screenshots'], 'readwrite')
    const issueStore = tx.objectStore('issues')
    const screenshotStore = tx.objectStore('screenshots')

    const existing = await issueStore.get(id)
    if (!existing) {
      tx.abort()
      throw new Error(`Issue with id ${id} not found`)
    }

    const now = new Date().toISOString()
    let screenshotId = existing.screenshotId

    // Handle screenshot changes
    if (newScreenshotBlob !== undefined) {
      // If there was an existing screenshot, remove it
      if (existing.screenshotId) {
        await screenshotStore.delete(existing.screenshotId)
      }

      if (newScreenshotBlob === null) {
        screenshotId = null
      } else {
        screenshotId = generateUUID()
        const screenshotRecord: Screenshot = {
          id: screenshotId,
          blob: newScreenshotBlob,
          mimeType: newScreenshotBlob.type || 'image/png',
          filename: filename || `screenshot-${Date.now()}.${newScreenshotBlob.type?.split('/')[1] || 'png'}`,
          createdAt: now
        }
        await screenshotStore.put(screenshotRecord)
      }
    }

    const updated: Issue = {
      ...existing,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      screenshotId,
      screenshotIds: screenshotId ? [screenshotId] : [],
      updatedAt: now
    }

    await issueStore.put(updated)
    await tx.done
    return updated
  }

  async updateWithScreenshots(
    id: string,
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>,
    options?: {
      keepScreenshotIds?: string[]
      newScreenshots?: Array<{ blob: Blob; filename?: string }>
    }
  ): Promise<Issue> {
    const db = await getDB()
    const tx = db.transaction(['issues', 'screenshots'], 'readwrite')
    const issueStore = tx.objectStore('issues')
    const screenshotStore = tx.objectStore('screenshots')

    const existing = await issueStore.get(id)
    if (!existing) {
      tx.abort()
      throw new Error(`Issue with id ${id} not found`)
    }

    const now = new Date().toISOString()
    const currentIds = existing.screenshotIds || (existing.screenshotId ? [existing.screenshotId] : [])
    const keepIds = options?.keepScreenshotIds || currentIds

    // Delete any screenshot that is not kept
    for (const sid of currentIds) {
      if (!keepIds.includes(sid)) {
        await screenshotStore.delete(sid)
      }
    }

    // Add new screenshots
    const addedIds: string[] = []
    if (options?.newScreenshots && options.newScreenshots.length > 0) {
      for (const item of options.newScreenshots) {
        const sid = generateUUID()
        const sRecord: Screenshot = {
          id: sid,
          blob: item.blob,
          mimeType: item.blob.type || 'image/png',
          filename: item.filename || `screenshot-${Date.now()}.${item.blob.type?.split('/')[1] || 'png'}`,
          createdAt: now
        }
        await screenshotStore.put(sRecord)
        addedIds.push(sid)
      }
    }

    const finalScreenshotIds = [...keepIds, ...addedIds]
    const updated: Issue = {
      ...existing,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      screenshotId: finalScreenshotIds[0] || null,
      screenshotIds: finalScreenshotIds,
      updatedAt: now
    }

    await issueStore.put(updated)
    await tx.done
    return updated
  }

  async delete(id: string): Promise<void> {
    const db = await getDB()
    const tx = db.transaction(['issues', 'screenshots'], 'readwrite')
    const issueStore = tx.objectStore('issues')
    const screenshotStore = tx.objectStore('screenshots')

    const existing = await issueStore.get(id)
    if (existing) {
      const idsToDelete = new Set<string>()
      if (existing.screenshotId) idsToDelete.add(existing.screenshotId)
      if (existing.screenshotIds) {
        existing.screenshotIds.forEach(sid => idsToDelete.add(sid))
      }
      for (const sid of idsToDelete) {
        await screenshotStore.delete(sid)
      }
      await issueStore.delete(id)
    }
    await tx.done
  }
}

export class IndexedDbProjectRepository implements IProjectRepository {
  async getAll(): Promise<Project[]> {
    const db = await getDB()
    const all = await db.getAll('projects')
    return all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  async getById(id: string): Promise<Project | undefined> {
    const db = await getDB()
    return db.get('projects', id)
  }

  async create(name: string, color: string, description?: string): Promise<Project> {
    const db = await getDB()
    const now = new Date().toISOString()
    const project: Project = {
      id: generateUUID(),
      name: name.trim(),
      color,
      description: description?.trim(),
      createdAt: now,
      updatedAt: now
    }
    await db.put('projects', project)
    return project
  }

  async update(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Project> {
    const db = await getDB()
    const tx = db.transaction('projects', 'readwrite')
    const existing = await tx.store.get(id)
    if (!existing) {
      throw new Error(`Project with id ${id} not found`)
    }

    const updated: Project = {
      ...existing,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      updatedAt: new Date().toISOString()
    }
    await tx.store.put(updated)
    await tx.done
    return updated
  }

  async delete(id: string): Promise<void> {
    const db = await getDB()
    // Atomic transaction across projects and issues
    // Moves all issues belonging to this project to Unassigned (projectId: null)
    const tx = db.transaction(['projects', 'issues'], 'readwrite')
    const projectStore = tx.objectStore('projects')
    const issueStore = tx.objectStore('issues')

    await projectStore.delete(id)

    // Reassign issues
    const issues = await issueStore.getAll()
    const now = new Date().toISOString()
    for (const issue of issues) {
      if (issue.projectId === id) {
        await issueStore.put({
          ...issue,
          projectId: null,
          updatedAt: now
        })
      }
    }

    await tx.done
  }
}

export class IndexedDbScreenshotRepository implements IScreenshotRepository {
  async getById(id: string): Promise<Screenshot | undefined> {
    const db = await getDB()
    return db.get('screenshots', id)
  }

  async save(blob: Blob, filename?: string): Promise<Screenshot> {
    const db = await getDB()
    const id = generateUUID()
    const now = new Date().toISOString()
    const screenshot: Screenshot = {
      id,
      blob,
      mimeType: blob.type || 'image/png',
      filename: filename || `screenshot-${Date.now()}.${blob.type?.split('/')[1] || 'png'}`,
      createdAt: now
    }
    await db.put('screenshots', screenshot)
    return screenshot
  }

  async delete(id: string): Promise<void> {
    const db = await getDB()
    await db.delete('screenshots', id)
  }

  async getAll(): Promise<Screenshot[]> {
    const db = await getDB()
    return db.getAll('screenshots')
  }
}

export class IndexedDbSettingsRepository implements ISettingsRepository {
  async get(): Promise<ApplicationSettings> {
    const db = await getDB()
    const settings = await db.get('settings', 'app_settings')
    if (!settings) {
      const defaultWithId = { id: 'app_settings', ...DEFAULT_SETTINGS }
      await db.put('settings', defaultWithId)
      return DEFAULT_SETTINGS
    }
    const { id: _, ...rest } = settings
    return rest
  }

  async update(updates: Partial<ApplicationSettings>): Promise<ApplicationSettings> {
    const db = await getDB()
    const current = await this.get()
    const updated: ApplicationSettings = {
      ...current,
      ...updates
    }
    await db.put('settings', { id: 'app_settings', ...updated })
    return updated
  }
}
