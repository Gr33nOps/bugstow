import type { Issue, Project } from '../types'

export type ProviderId = 'gdrive' | 'dropbox' | 'webdav' | 'folder' | 'file'

/** Bytes backed by a plain ArrayBuffer (what Web Crypto, Blob and fetch accept). */
export type Bytes = Uint8Array<ArrayBuffer>

/**
 * A place in the user's own cloud that holds BugsTow's encrypted sync files:
 * one index file plus one file per screenshot (`shots/<id>.bin`).
 * `rev` is the provider's version marker for a file (etag, rev, version...).
 */
export interface SyncProvider {
  id: ProviderId
  /** Read a file; null when it doesn't exist. */
  get(name: string): Promise<{ data: Bytes; rev: string } | null>
  /**
   * Write a file. `expectRev`: a string means "only if the file is still at
   * this version", null means "only if it doesn't exist yet", undefined means
   * unconditional. Throws RemoteChangedError when the condition fails.
   */
  put(name: string, data: Bytes, expectRev?: string | null): Promise<string>
  remove(name: string): Promise<void>
  /** Screenshot file names present in the cloud (`shots/<id>.bin`). */
  listShots(): Promise<string[]>
}

/** Someone else wrote in between: re-read and merge again. */
export class RemoteChangedError extends Error {
  name = 'RemoteChangedError'
  constructor() {
    super('The data in your cloud changed while syncing.')
  }
}

/** The provider needs the user to sign in / grant access again. */
export class ReconnectNeededError extends Error {
  name = 'ReconnectNeededError'
  constructor(message = 'Your cloud connection expired. Reconnect to keep syncing.') {
    super(message)
  }
}

export interface ShotMeta {
  id: string
  mimeType: string
  filename: string
  createdAt: string
}

/** Decrypted content of the index file. */
export interface RemoteIndex {
  v: 1
  writtenAt: string
  projects: Project[]
  issues: Issue[]
  shots: ShotMeta[]
}

/** What this device last agreed with the cloud: id → updatedAt, and screenshot ids. */
export interface SyncBase {
  projects: Record<string, string>
  issues: Record<string, string>
  shots: string[]
}

export const EMPTY_BASE: SyncBase = { projects: {}, issues: {}, shots: [] }

export interface SyncResult {
  uploaded: number
  downloaded: number
  deletedHere: number
  deletedInCloud: number
  /** Edited on one side, deleted on the other: the edit was kept. */
  editsKeptOverDeletes: number
  /** Screenshots another device hasn't finished uploading yet. */
  shotsPending: number
  at: string
}
