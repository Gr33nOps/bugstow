import { useCallback, useEffect, useRef, useState } from 'react'
import { syncStore, type Connection, type SyncStatus } from '../sync/store'
import { onSyncStatus, runSync, type RunOutcome } from '../sync/controller'
import { completeOAuthRedirect } from '../sync/oauth'
import { onLocalChange } from '../sync/events'

export type SyncState = SyncStatus & { running: boolean }

/** A sign-in that came back from Google/Dropbox and still needs the passphrase. */
export type PendingConnection = Omit<Connection, 'connectedAt'>

const AUTO_EVERY_MS = 3 * 60_000
const AFTER_CHANGE_MS = 8_000

/**
 * Cloud sync for Personal mode, app-wide. Syncs automatically when the app
 * opens, when it comes back to the foreground, a few seconds after a change,
 * and every few minutes while visible. Nothing happens until a cloud is
 * connected.
 */
export function useCloudSync(opts: { onDataChanged: () => void; onToast: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [status, setStatus] = useState<SyncState>({ lastSyncAt: null, lastResult: null, lastError: null, lastErrorAt: null, running: false })
  const [pending, setPending] = useState<PendingConnection | null>(null)
  const [needsAttention, setNeedsAttention] = useState(false)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const reloadConnection = useCallback(async () => {
    setConnection((await syncStore.getConnection()) ?? null)
  }, [])

  const handleOutcome = useCallback((o: RunOutcome | null, interactive: boolean) => {
    if (!o) return
    if (o.ok) {
      const r = o.result
      if (r.downloaded || r.deletedHere || r.editsKeptOverDeletes) optsRef.current.onDataChanged()
      if (interactive) {
        optsRef.current.onToast(
          r.uploaded || r.downloaded || r.deletedHere || r.deletedInCloud ? 'Synced with your cloud' : 'Already up to date'
        )
      }
    } else if (interactive && !o.aborted) {
      optsRef.current.onToast(o.error, 'error')
    }
  }, [])

  /** Sync now. `interactive` = the user clicked (can ask questions and re-grant access). */
  const sync = useCallback(
    async (interactive = false) => {
      const o = await runSync({
        interactive,
        confirmLargeDelete: async ({ here, inCloud, total }) => {
          if (!interactive) return false // never mass-delete in the background
          const where =
            here >= inCloud
              ? `delete ${here} of ${total} items on this device (they were deleted on another device)`
              : `delete ${inCloud} of ${total} items from your cloud (they were deleted on this device)`
          return window.confirm(`This sync would ${where}. Continue?`)
        },
      })
      if (o && !o.ok && o.aborted && !interactive) {
        // Surface in Settings: a large deletion needs the user's confirmation.
        await syncStore.setStatus({
          ...(await syncStore.getStatus()),
          lastError: 'Sync paused: it would delete many items. Open Settings → Sync and press "Sync now" to review.',
          lastErrorAt: new Date().toISOString(),
        })
        setNeedsAttention(true)
      }
      handleOutcome(o, interactive)
      return o
    },
    [handleOutcome]
  )

  // Status updates from the controller.
  useEffect(() => onSyncStatus(setStatus), [])

  // Finish a Google/Dropbox sign-in, then load the saved connection.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const outcome = await completeOAuthRedirect()
      if (!alive) return
      if (outcome && 'error' in outcome) {
        optsRef.current.onToast(outcome.error, 'error')
        setNeedsAttention(true)
      } else if (outcome) {
        setPending({ provider: outcome.provider, config: outcome.config })
        setNeedsAttention(true)
      }
      await reloadConnection()
    })()
    return () => {
      alive = false
    }
  }, [reloadConnection])

  // Automatic sync.
  useEffect(() => {
    if (!connection || connection.provider === 'file') return
    sync(false)
    let timer: ReturnType<typeof setTimeout> | null = null
    const soon = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => sync(false), AFTER_CHANGE_MS)
    }
    const offChange = onLocalChange(soon)
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    const every = setInterval(() => {
      if (document.visibilityState === 'visible') sync(false)
    }, AUTO_EVERY_MS)
    return () => {
      offChange()
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(every)
      if (timer) clearTimeout(timer)
    }
  }, [connection, sync])

  return {
    connection,
    status,
    pending,
    setPending,
    needsAttention,
    clearAttention: () => setNeedsAttention(false),
    reloadConnection,
    sync,
  }
}

export type CloudSync = ReturnType<typeof useCloudSync>
