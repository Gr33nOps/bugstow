/**
 * Three-way merge of records between this device (local), the cloud (remote)
 * and what this device last agreed with the cloud (base: id → updatedAt).
 *
 *  - Changed on both sides: the newer `updatedAt` wins.
 *  - Present on one side only:
 *      not in base → it's new there, copy it to the other side;
 *      in base     → it was deleted on the other side. Delete it here too,
 *                    unless it was edited after the last sync (an edit beats
 *                    a delete, so nothing written after a sync is lost).
 */

export interface Versioned {
  id: string
  updatedAt: string
}

export interface MergeOutcome<T> {
  final: T[]
  /** Records to write to this device. */
  putHere: T[]
  /** Record ids to delete on this device. */
  deleteHere: string[]
  /** True when the cloud copy differs from `final`. */
  cloudChanged: boolean
  uploaded: number
  downloaded: number
  deletedHere: number
  deletedInCloud: number
  editsKeptOverDeletes: number
}

const t = (iso: string) => Date.parse(iso) || 0

export function mergeRecords<T extends Versioned>(local: T[], remote: T[], base: Record<string, string>): MergeOutcome<T> {
  const L = new Map(local.map(r => [r.id, r]))
  const R = new Map(remote.map(r => [r.id, r]))
  const out: MergeOutcome<T> = {
    final: [],
    putHere: [],
    deleteHere: [],
    cloudChanged: false,
    uploaded: 0,
    downloaded: 0,
    deletedHere: 0,
    deletedInCloud: 0,
    editsKeptOverDeletes: 0,
  }

  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(id)
    const r = R.get(id)
    const b = base[id]

    if (l && r) {
      if (t(l.updatedAt) > t(r.updatedAt)) {
        out.final.push(l)
        out.cloudChanged = true
        out.uploaded++
      } else if (t(r.updatedAt) > t(l.updatedAt)) {
        out.final.push(r)
        out.putHere.push(r)
        out.downloaded++
      } else {
        out.final.push(r)
      }
    } else if (l) {
      if (b === undefined) {
        out.final.push(l) // new on this device
        out.cloudChanged = true
        out.uploaded++
      } else if (t(l.updatedAt) > t(b)) {
        out.final.push(l) // deleted in the cloud, but edited here since: keep
        out.cloudChanged = true
        out.editsKeptOverDeletes++
      } else {
        out.deleteHere.push(id) // deleted on another device
        out.deletedHere++
      }
    } else if (r) {
      if (b === undefined) {
        out.final.push(r) // new from another device
        out.putHere.push(r)
        out.downloaded++
      } else if (t(r.updatedAt) > t(b)) {
        out.final.push(r) // deleted here, but edited elsewhere since: keep
        out.putHere.push(r)
        out.editsKeptOverDeletes++
      } else {
        out.cloudChanged = true // deleted on this device
        out.deletedInCloud++
      }
    }
  }
  return out
}
