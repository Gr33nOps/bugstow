import { fromB64, toB64 } from '../crypto'
import { RemoteChangedError, type ProviderId, type SyncProvider, type Bytes } from '../types'

/**
 * Keeps the sync files in memory. Used for the "sync file" option: the whole
 * set of (already encrypted) files is packed into one `.bugstow-sync` file the
 * user can put in any cloud and open on any device, including phones.
 */
export class MemoryProvider implements SyncProvider {
  id: ProviderId
  private files = new Map<string, { data: Bytes; rev: number }>()
  private counter = 0

  constructor(id: ProviderId = 'file') {
    this.id = id
  }

  async get(name: string) {
    const f = this.files.get(name)
    return f ? { data: f.data, rev: String(f.rev) } : null
  }

  async put(name: string, data: Bytes, expectRev?: string | null) {
    const cur = this.files.get(name)
    if (expectRev === null && cur) throw new RemoteChangedError()
    if (typeof expectRev === 'string' && (!cur || String(cur.rev) !== expectRev)) throw new RemoteChangedError()
    const rev = ++this.counter
    this.files.set(name, { data, rev })
    return String(rev)
  }

  async remove(name: string) {
    this.files.delete(name)
  }

  async listShots() {
    return [...this.files.keys()].filter(n => n.startsWith('shots/'))
  }

  get isEmpty() {
    return this.files.size === 0
  }

  /** Pack into one file. Every entry is already encrypted. */
  toBundle(): Blob {
    const files: Record<string, string> = {}
    for (const [name, f] of this.files) files[name] = toB64(f.data)
    return new Blob([JSON.stringify({ format: 'bugstow-sync-bundle', v: 1, files })], {
      type: 'application/octet-stream',
    })
  }

  static async fromBundle(blob: Blob): Promise<MemoryProvider> {
    let parsed: { format?: string; v?: number; files?: Record<string, string> }
    try {
      parsed = JSON.parse(await blob.text())
    } catch {
      throw new Error('This is not a BugsTow sync file.')
    }
    if (parsed.format !== 'bugstow-sync-bundle' || parsed.v !== 1 || !parsed.files) {
      throw new Error('This is not a BugsTow sync file.')
    }
    const p = new MemoryProvider('file')
    for (const [name, b64] of Object.entries(parsed.files)) await p.put(name, fromB64(b64))
    return p
  }
}
