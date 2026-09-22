import type { Issue, Project, Screenshot, ApplicationSettings, IssueStatus } from '../types'

export interface IIssueRepository {
  getAll(): Promise<Issue[]>
  getById(id: string): Promise<Issue | undefined>
  getByProject(projectId: string | null): Promise<Issue[]>
  getByStatus(status: IssueStatus): Promise<Issue[]>
  create(
    issue: Omit<Issue, 'id' | 'createdAt' | 'updatedAt' | 'screenshotId' | 'screenshotIds' | 'status'> & {
      status?: IssueStatus
    },
    screenshotBlob?: Blob | null,
    filename?: string,
    additionalBlobs?: Array<{ blob: Blob; filename?: string }>
  ): Promise<Issue>
  update(
    id: string,
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Issue>
  updateWithScreenshot(
    id: string,
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>,
    newScreenshotBlob?: Blob | null,
    filename?: string
  ): Promise<Issue>
  updateWithScreenshots(
    id: string,
    updates: Partial<Omit<Issue, 'id' | 'createdAt' | 'updatedAt'>>,
    options?: {
      keepScreenshotIds?: string[]
      newScreenshots?: Array<{ blob: Blob; filename?: string }>
    }
  ): Promise<Issue>
  delete(id: string): Promise<void>
}

export interface IProjectRepository {
  getAll(): Promise<Project[]>
  getById(id: string): Promise<Project | undefined>
  create(name: string, color: string, description?: string): Promise<Project>
  update(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Project>
  delete(id: string): Promise<void> // Reassigns issues to unassigned (projectId: null)
}

export interface IScreenshotRepository {
  getById(id: string): Promise<Screenshot | undefined>
  save(blob: Blob, filename?: string): Promise<Screenshot>
  delete(id: string): Promise<void>
  getAll(): Promise<Screenshot[]>
}

export interface ISettingsRepository {
  get(): Promise<ApplicationSettings>
  update(settings: Partial<ApplicationSettings>): Promise<ApplicationSettings>
}
