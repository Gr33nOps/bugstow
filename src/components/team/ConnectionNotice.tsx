import { Lock, AlertTriangle, Monitor } from 'lucide-react'
import { connectionKind } from '../../lib/connection'
import { isDesktopEdition } from '../../lib/teamServer'

/** One line (or a warning box) describing whether this connection is encrypted. */
export function ConnectionNotice() {
  const kind = connectionKind()

  if (kind === 'lan-https') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
        <Lock size={13} className="shrink-0" /> Encrypted connection (HTTPS)
      </p>
    )
  }

  if (kind === 'localhost') {
    // The installed desktop app is meant to run on localhost; nothing to warn about.
    if (isDesktopEdition()) return null
    return (
      <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Monitor size={13} className="shrink-0 mt-px" />
        <span>
          Connected on this computer only (localhost). Fine for trying BugsTow; teammates need the server's network
          address, preferably with HTTPS.
        </span>
      </p>
    )
  }

  return (
    <div
      role="note"
      className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2"
    >
      <AlertTriangle size={15} className="shrink-0 mt-px" />
      <span>
        <strong className="font-semibold">Not encrypted.</strong> This server uses plain HTTP, so your password and
        your team's issues cross the network in readable form. Anyone on the same network can see them. Ask the
        administrator to turn on HTTPS.
      </span>
    </div>
  )
}
