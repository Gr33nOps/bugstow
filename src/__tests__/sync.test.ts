import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { closeDB, resetDBConnection, getDB } from '../storage/db'
import { IndexedDbIssueRepository, IndexedDbProjectRepository } from '../repositories/indexedDbRepositories'
import { syncStore, type KeyInfo } from '../sync/store'
import { prepareKey, syncOnce, SyncAbortedError } from '../sync/engine'
import { mergeRecords } from '../sync/merge'
import { MemoryProvider } from '../sync/providers/memory'
import { encryptFile, decryptFile, deriveKey, newSalt, WrongPassphraseError, INDEX_FILE } from '../sync/crypto'
import { RemoteChangedError, EMPTY_BASE, type SyncBase } from '../sync/types'

// Two browsers ("devices") with their own IndexedDB, one cloud.
const factories = { A: new IDBFactory(), B: new IDBFactory() }
async function onDevice(d: 'A' | 'B') {
  await closeDB()
  await syncStore._close()
  ;(globalThis as { indexedDB: IDBFactory }).indexedDB = factories[d]
  resetDBConnection()
}
const tick = () => new Promise(r => setTimeout(r, 5))
const issues = new IndexedDbIssueRepository()
const projects = new IndexedDbProjectRepository()
const PASS = 'correct horse battery staple'
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQGYR54AAAAASUVORK5CYII='), c => c.charCodeAt(0))

const state: Record<'A' | 'B', { key?: KeyInfo; base: SyncBase }> = { A: { base: EMPTY_BASE }, B: { base: EMPTY_BASE } }
let cloud: MemoryProvider

async function sync(d: 'A' | 'B', confirm?: () => Promise<boolean>) {
  await onDevice(d)
  if (!state[d].key) state[d].key = await prepareKey(cloud, PASS)
  const { result, base } = await syncOnce(cloud, state[d].key!, state[d].base, { confirmLargeDelete: confirm })
  state[d].base = base
  return result
}

describe('encryption', () => {
  it('round-trips, rejects a wrong passphrase, and binds the file name', async () => {
    const salt = newSalt()
    const key = await deriveKey(PASS, salt, 1000)
    const sealed = await encryptFile(key, 'shots/a.bin', PNG)
    expect(await decryptFile(key, 'shots/a.bin', sealed)).toEqual(PNG)
    await expect(decryptFile(await deriveKey('wrong', salt, 1000), 'shots/a.bin', sealed)).rejects.toThrow(
      WrongPassphraseError
    )
    await expect(decryptFile(key, 'shots/b.bin', sealed)).rejects.toThrow(WrongPassphraseError)
  })
})

describe('three-way merge', () => {
  const r = (id: string, at: string) => ({ id, updatedAt: at })
  it('newer edit wins; new items copy both ways', () => {
    const m = mergeRecords([r('a', '2026-01-02'), r('new-here', '2026-01-01')], [r('a', '2026-01-01'), r('new-there', '2026-01-01')], {})
    expect(m.final.map(x => x.id).sort()).toEqual(['a', 'new-here', 'new-there'])
    expect(m.putHere.map(x => x.id)).toEqual(['new-there'])
    expect(m.cloudChanged).toBe(true)
  })
  it('deletions propagate, but an edit made after the last sync beats a delete', () => {
    const base = { gone: '2026-01-01', edited: '2026-01-01' }
    const m = mergeRecords([r('gone', '2026-01-01'), r('edited', '2026-02-01')], [], base)
    expect(m.deleteHere).toEqual(['gone'])
    expect(m.final.map(x => x.id)).toEqual(['edited'])
    expect(m.editsKeptOverDeletes).toBe(1)
  })
})

describe('sync between two devices through one cloud', () => {
  beforeEach(async () => {
    // fresh devices and cloud for each scenario
    factories.A = new IDBFactory()
    factories.B = new IDBFactory()
    state.A = { base: EMPTY_BASE }
    state.B = { base: EMPTY_BASE }
    cloud = new MemoryProvider()
  })

  it('copies projects, issues and screenshots to a new device', async () => {
    await onDevice('A')
    const p = await projects.create('Website', '#5B50F6')
    await issues.create({ title: 'Navbar overlaps', description: 'on mobile', projectId: p.id, type: 'bug', status: 'open' }, new Blob([PNG], { type: 'image/png' }), 'nav.png')
    const up = await sync('A')
    expect(up.uploaded).toBe(3) // project, issue, screenshot

    const down = await sync('B')
    expect(down.downloaded).toBe(3)
    const db = await getDB()
    const [issue] = await db.getAll('issues')
    expect(issue.title).toBe('Navbar overlaps')
    expect(issue.projectId).toBe(p.id)
    const shot = await db.get('screenshots', issue.screenshotId!)
    expect(new Uint8Array(await shot!.blob.arrayBuffer())).toEqual(PNG)
  })

  it('keeps nothing readable in the cloud', async () => {
    await onDevice('A')
    await issues.create({ title: 'Secret payroll bug', description: 'do not leak', projectId: null, type: 'bug', status: 'open' }, new Blob([PNG], { type: 'image/png' }))
    await sync('A')
    const everything = await cloud.toBundle().text()
    expect(everything).not.toContain('Secret payroll')
    expect(everything).not.toContain('do not leak')
  })

  it('syncs edits and deletions both ways, including screenshot files', async () => {
    await onDevice('A')
    const i = await issues.create({ title: 'Old title', description: '', projectId: null, type: 'bug', status: 'open' }, new Blob([PNG], { type: 'image/png' }))
    await sync('A')
    await sync('B')

    await tick()
    await issues.update(i.id, { title: 'New title from phone' }) // on B
    await sync('B')
    await sync('A')
    expect((await (await getDB()).get('issues', i.id))!.title).toBe('New title from phone')

    await issues.delete(i.id) // on A
    const del = await sync('A')
    expect(del.deletedInCloud).toBe(1)
    expect(await cloud.listShots()).toEqual([]) // screenshot file removed from the cloud
    await sync('B')
    const db = await getDB()
    expect(await db.getAll('issues')).toEqual([])
    expect(await db.getAll('screenshots')).toEqual([])
  })

  it('an edit on one device beats a delete on the other', async () => {
    await onDevice('A')
    const i = await issues.create({ title: 'Keep me', description: '', projectId: null, type: 'idea', status: 'open' })
    await sync('A')
    await sync('B')

    await onDevice('A')
    await issues.delete(i.id)
    await sync('A')

    await onDevice('B')
    await tick()
    await issues.update(i.id, { description: 'edited offline after the last sync' })
    const r = await sync('B')
    expect(r.editsKeptOverDeletes).toBe(1)
    await sync('A')
    expect((await (await getDB()).get('issues', i.id))!.description).toBe('edited offline after the last sync')
  })

  it('issues of a project deleted elsewhere become Unassigned', async () => {
    await onDevice('A')
    const p = await projects.create('Temp', '#000000')
    const i = await issues.create({ title: 'In project', description: '', projectId: p.id, type: 'bug', status: 'open' })
    await sync('A')
    await sync('B')
    await onDevice('B')
    const db = await getDB()
    await db.delete('projects', p.id) // project removed without touching issues
    await sync('B')
    await sync('A')
    expect((await (await getDB()).get('issues', i.id))!.projectId).toBeNull()
  })

  it('asks before a sync that would delete most of the data, and can be stopped', async () => {
    await onDevice('A')
    for (let n = 0; n < 12; n++) await issues.create({ title: `Issue ${n}`, description: '', projectId: null, type: 'bug', status: 'open' })
    await sync('A')
    const db = await getDB()
    await db.clear('issues') // everything gone on this device
    await expect(sync('A', async () => false)).rejects.toThrow(SyncAbortedError)
    // Cloud untouched: a fresh device still gets all 12.
    await sync('B')
    expect((await (await getDB()).getAll('issues')).length).toBe(12)
  })

  it('merges again when another device wrote at the same time', async () => {
    await onDevice('A')
    await issues.create({ title: 'From A', description: '', projectId: null, type: 'bug', status: 'open' })
    await sync('A')
    await sync('B')
    await onDevice('B')
    await issues.create({ title: 'From B', description: '', projectId: null, type: 'bug', status: 'open' })

    // Make the first index write fail as if A wrote in between.
    const realPut = cloud.put.bind(cloud)
    let raced = false
    cloud.put = async (name, data, expectRev) => {
      if (name === INDEX_FILE && !raced) {
        raced = true
        throw new RemoteChangedError()
      }
      return realPut(name, data, expectRev)
    }
    await sync('B')
    expect(raced).toBe(true)
    const titles = (await (await getDB()).getAll('issues')).map(i => i.title).sort()
    expect(titles).toEqual(['From A', 'From B'])
  })

  it('refuses a wrong passphrase on the second device', async () => {
    await onDevice('A')
    await issues.create({ title: 'x', description: '', projectId: null, type: 'bug', status: 'open' })
    await sync('A')
    await onDevice('B')
    await expect(prepareKey(cloud, 'not the passphrase')).rejects.toThrow(WrongPassphraseError)
  })

  it('works through a single sync file (any cloud, any phone)', async () => {
    await onDevice('A')
    await issues.create({ title: 'Carried in a file', description: '', projectId: null, type: 'uiux', status: 'open' }, new Blob([PNG], { type: 'image/png' }))
    await sync('A')
    const file = cloud.toBundle()

    cloud = await MemoryProvider.fromBundle(file)
    await sync('B')
    const db = await getDB()
    const [issue] = await db.getAll('issues')
    expect(issue.title).toBe('Carried in a file')
    expect(await db.get('screenshots', issue.screenshotId!)).toBeTruthy()
  })
})
