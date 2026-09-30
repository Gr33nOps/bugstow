import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project, Issue, Screenshot, ApplicationSettings } from '../types'

export const DB_NAME = 'bugstow_db'
export const DB_VERSION = 1

export interface BugstowDBSchema extends DBSchema {
  projects: {
    key: string
    value: Project
    indexes: {
      'by-created': string
    }
  }
  issues: {
    key: string
    value: Issue
    indexes: {
      'by-project': string
      'by-status': string
      'by-created': string
    }
  }
  screenshots: {
    key: string
    value: Screenshot
  }
  settings: {
    key: string
    value: ApplicationSettings & { id: string }
  }
}

let dbPromise: Promise<IDBPDatabase<BugstowDBSchema>> | null = null

export const DEFAULT_SETTINGS: ApplicationSettings = {
  schemaVersion: 1,
  onboardingCompleted: true,
  lastBackupExportAt: null,
  backupReminderDismissedAt: null,
}

export async function getDB(): Promise<IDBPDatabase<BugstowDBSchema>> {
  if (dbPromise) return dbPromise

  dbPromise = openDB<BugstowDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Version 1: Initial schema
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' })
          projectStore.createIndex('by-created', 'createdAt')
        }

        if (!db.objectStoreNames.contains('issues')) {
          const issueStore = db.createObjectStore('issues', { keyPath: 'id' })
          issueStore.createIndex('by-project', 'projectId')
          issueStore.createIndex('by-status', 'status')
          issueStore.createIndex('by-created', 'createdAt')
        }

        if (!db.objectStoreNames.contains('screenshots')) {
          db.createObjectStore('screenshots', { keyPath: 'id' })
        }

        if (!db.objectStoreNames.contains('settings')) {
          const settingsStore = db.createObjectStore('settings', { keyPath: 'id' })
          settingsStore.put({ id: 'app_settings', ...DEFAULT_SETTINGS })
        }
      }
    },
    blocked() {
      console.warn('Database upgrade was blocked by another tab or connection.')
    },
    blocking() {
      console.warn('Closing database connection to allow pending upgrade.')
      if (dbPromise) {
        dbPromise.then(db => db.close())
        dbPromise = null
      }
    },
    terminated() {
      console.error('Database connection was abnormally terminated.')
      dbPromise = null
    }
  })

  return dbPromise
}

export async function clearAllData(): Promise<void> {
  const db = await getDB()
  // Atomically wipe every user data store and reset settings to defaults.
  const tx = db.transaction(['projects', 'issues', 'screenshots', 'settings'], 'readwrite')
  try {
    await tx.objectStore('projects').clear()
    await tx.objectStore('issues').clear()
    await tx.objectStore('screenshots').clear()
    await tx.objectStore('settings').clear()
    await tx.objectStore('settings').put({ id: 'app_settings', ...DEFAULT_SETTINGS })
    await tx.done
  } catch (err) {
    tx.abort()
    throw err
  }
}

export async function closeDB(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
}

export function resetDBConnection(): void {
  if (dbPromise) {
    dbPromise.then(db => db.close()).catch(() => {})
  }
  dbPromise = null
}
