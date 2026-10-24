export type IssueType = 'bug' | 'uiux' | 'idea'
export type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'fixed'
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low'
export type IssueSeverity = 'critical' | 'major' | 'minor'
export interface IssueDetails {
  stepsToReproduce?: string
  expectedBehavior?: string
  actualBehavior?: string
  environment?: string
  browserOs?: string
  appVersion?: string
  additionalNotes?: string
}
export type Tab = 'inbox' | 'projects' | 'fixed' | 'trash' | 'settings'

export interface Project {
  id: string
  name: string
  description?: string
  color: string
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

export interface Issue {
  id: string
  projectId: string | null // null = Unassigned
  title: string
  description: string
  type: IssueType
  /** Optional user-defined badge. `type` remains for backwards-compatible grouping. */
  customType?: string
  status: IssueStatus
  priority?: IssuePriority
  severity?: IssueSeverity | null
  details?: IssueDetails
  screenshotId: string | null // Legacy single ID for backwards compatibility
  screenshotIds?: string[] // Multiple screenshots support
  githubUrl?: string // Set when imported from GitHub (also how re-imports find it)
  githubNumber?: number
  fixReferences?: string[] // GitHub repository, pull request, or commit links
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  deletedAt?: string
}

export interface Screenshot {
  id: string
  blob: Blob
  mimeType: string
  filename: string
  createdAt: string // ISO timestamp
}

export interface ApplicationSettings {
  schemaVersion: number
  theme?: 'light' | 'dark' | 'system'
  onboardingCompleted: boolean
  lastBackupExportAt: string | null
  backupReminderDismissedAt: string | null
}

export interface BackupData {
  version: 1
  createdAt: string
  appVersion: string
  settings: ApplicationSettings
  projects: Project[]
  issues: Issue[]
  screenshots: Array<{
    id: string
    mimeType: string
    filename: string
    createdAt: string
    dataUrl: string // base64 representation of the Blob
  }>
}

export interface EncryptedBackupPayload {
  version: 1
  isEncrypted: true
  algorithm: 'AES-GCM'
  iterations: number
  salt: string // base64
  iv: string // base64
  ciphertext: string // base64
}

export type ExportPayload = BackupData | EncryptedBackupPayload

export interface StorageEstimateInfo {
  usageBytes: number
  quotaBytes: number
  persisted: boolean
  isSupported: boolean
}
