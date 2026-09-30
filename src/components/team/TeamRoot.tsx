import { useEffect, useState } from 'react'
import { useSession } from '../../lib/authClient'
import { clearPendingInvite, displayLogin, pendingInvite } from '../../lib/login'
import { TeamAuthGate } from './TeamAuthGate'
import { TeamApp } from './TeamApp'
import type { Project } from '../../types'

function Loading() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-500 bg-slate-50 dark:bg-slate-950">
      Loading…
    </div>
  )
}

/**
 * Someone already signed in opened an invite link (or chose "I already have
 * an account" on it): add the workspace to their account, then open it.
 */
function useAcceptPendingInvite(signedIn: boolean) {
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle')
  useEffect(() => {
    const token = signedIn ? pendingInvite() : ''
    if (!token) return
    setState('working')
    fetch('/api/invite-links/accept', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async r => {
        clearPendingInvite()
        if (!r.ok) return setState('failed')
        const { teamId } = await r.json()
        try {
          localStorage.setItem('bugstow_active_team', teamId)
        } catch {
          // opens the first workspace instead
        }
        setState('idle')
      })
      .catch(() => setState('failed'))
  }, [signedIn])
  return state
}

/**
 * Entry point for Team: sign-in gate + workspace.
 *
 * Loaded lazily by RootApp only when this page is served by a BugsTow server
 * and Team is chosen. Local on a static site therefore never downloads the
 * auth client or Team UI, and `useSession()` (which calls
 * /api/auth/get-session) never runs there.
 */
export default function TeamRoot({
  setupComplete,
  offline,
  onUseLocal,
  localProjectToCopy,
  onLocalProjectCopyClosed,
}: {
  setupComplete: boolean
  offline: boolean
  onUseLocal: () => void
  localProjectToCopy?: Pick<Project, 'id' | 'name'> | null
  onLocalProjectCopyClosed?: () => void
}) {
  const session = useSession()
  const signedIn = Boolean(session.data?.user)
  const invite = useAcceptPendingInvite(signedIn)
  if (session.isPending || invite === 'working') return <Loading />
  if (!session.data?.user) {
    return <TeamAuthGate setupComplete={setupComplete} onUseLocal={onUseLocal} />
  }
  const user = session.data.user
  return (
    <>
      {invite === 'failed' && (
        <div role="alert" className="px-4 py-2 text-sm bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-b border-amber-300 dark:border-amber-800">
          That invite link has expired or was already used. Ask for a new one.
        </div>
      )}
      <TeamApp
        onUseLocal={onUseLocal}
        userLabel={displayLogin(user.email) || user.name || 'Account'}
        offline={offline}
        localProjectToCopy={localProjectToCopy}
        onLocalProjectCopyClosed={onLocalProjectCopyClosed}
      />
    </>
  )
}
