export type IssueType = 'bug' | 'uiux' | 'idea'
export type IssueStatus = 'open' | 'fixed'
export type Tab = 'inbox' | 'projects' | 'fixed' | 'settings'

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
  status: IssueStatus
  screenshotId: string | null // Legacy single ID for backwards compatibility
  screenshotIds?: string[] // Multiple screenshots support
  githubUrl?: string // Set when imported from GitHub (also how re-imports find it)
  githubNumber?: number
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
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
