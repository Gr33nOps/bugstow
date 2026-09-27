import { ReconnectNeededError, RemoteChangedError, type SyncProvider, type Bytes } from '../types'

/**
 * A folder on this computer that your cloud's desktop app keeps in sync
 * (Mega, Terabox, OneDrive, iCloud Drive, Google Drive or Dropbox for desktop,
 * Syncthing...). BugsTow writes its encrypted files there and the cloud app
 * uploads them. Needs the File System Access API: desktop Chrome, Edge, Opera.
 */

// Minimal typings for the File System Access API (not in all TS DOM libs).
interface FsPermissionHandle {
  queryPermission(d: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(d: { mode: 'readwrite' }): Promise<PermissionState>
}
export interface FsDirHandle extends FsPermissionHandle {
  name: string
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<FsDirHandle>
  getFileHandle(name: string, o?: { create?: boolean }): Promise<FsFileHandle>
  removeEntry(name: string): Promise<void>
  values(): AsyncIterable<{ kind: 'file' | 'directory'; name: string }>
}
interface FsFileHandle {
  getFile(): Promise<File>
  createWritable(): Promise<{ write(d: Blob): Promise<void>; close(): Promise<void> }>
}

export function folderSyncSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function pickFolder(): Promise<FsDirHandle> {
  const picker = (window as unknown as { showDirectoryPicker: (o: object) => Promise<FsDirHandle> }).showDirectoryPicker
  return picker({ id: 'bugstow-sync', mode: 'readwrite' })
}

const isNotFound = (e: unknown) => e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')

export class FolderProvider implements SyncProvider {
  id = 'folder' as const

  constructor(private root: FsDirHandle) {}

  get folderName() {
    return this.root.name
  }

  /** Browsers ask again for folder access after a restart; this needs a click. */
  async ensureAccess(interactive: boolean): Promise<void> {
    if ((await this.root.queryPermission({ mode: 'readwrite' })) === 'granted') return
    if (interactive && (await this.root.requestPermission({ mode: 'readwrite' })) === 'granted') return
    throw new ReconnectNeededError(`Allow BugsTow to use the folder "${this.root.name}" again.`)
  }

  private async locate(name: string, create: boolean): Promise<{ dir: FsDirHandle; file: string }> {
    const parts = name.split('/')
    let dir = this.root
    for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create })
    return { dir, file: parts[parts.length - 1] }
  }

  private async stat(name: string): Promise<{ file: File; rev: string } | null> {
    try {
      const { dir, file } = await this.locate(name, false)
      const f = await (await dir.getFileHandle(file)).getFile()
      return { file: f, rev: `${f.lastModified}-${f.size}` }
    } catch (e) {
      if (isNotFound(e)) return null
      throw e
    }
  }

  async get(name: string) {
    await this.ensureAccess(false)
    const s = await this.stat(name)
    return s ? { data: new Uint8Array(await s.file.arrayBuffer()), rev: s.rev } : null
  }

  async put(name: string, data: Bytes, expectRev?: string | null) {
    await this.ensureAccess(false)
    if (expectRev !== undefined) {
      const cur = await this.stat(name)
      if (expectRev === null ? cur !== null : cur?.rev !== expectRev) throw new RemoteChangedError()
    }
    const { dir, file } = await this.locate(name, true)
    const w = await (await dir.getFileHandle(file, { create: true })).createWritable()
    await w.write(new Blob([data]))
    await w.close()
    return (await this.stat(name))?.rev ?? ''
  }

  async remove(name: string) {
    await this.ensureAccess(false)
    try {
      const { dir, file } = await this.locate(name, false)
      await dir.removeEntry(file)
    } catch (e) {
      if (!isNotFound(e)) throw e
    }
  }

  async listShots() {
    await this.ensureAccess(false)
    let dir: FsDirHandle
    try {
      dir = await this.root.getDirectoryHandle('shots')
    } catch (e) {
      if (isNotFound(e)) return []
      throw e
    }
    const names: string[] = []
    for await (const entry of dir.values()) if (entry.kind === 'file' && entry.name.endsWith('.bin')) names.push(`shots/${entry.name}`)
    return names
  }
}
