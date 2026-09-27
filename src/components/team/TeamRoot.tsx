import { useSession } from '../../lib/authClient'
import { TeamAuthGate } from './TeamAuthGate'
import { TeamApp } from './TeamApp'

/**
 * Entry point for Team mode: sign-in gate + workspace.
 *
 * Loaded lazily by RootApp only when this page is served by a self-hosted team
 * server and the user picks Team mode. The public Personal site therefore
 * never downloads the auth client or Team UI, and `useSession()` (which calls
 * /api/auth/get-session) never runs there.
 */
export default function TeamRoot({
  setupComplete,
  offline,
  onUseLocal,
}: {
  setupComplete: boolean
  offline: boolean
  onUseLocal: () => void
}) {
  const session = useSession()
  if (session.isPending) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-500 bg-slate-50 dark:bg-slate-950">
        Loading…
      </div>
    )
  }
  if (!session.data?.user) {
    return <TeamAuthGate setupComplete={setupComplete} onUseLocal={onUseLocal} />
  }
  const user = session.data.user
  return <TeamApp onUseLocal={onUseLocal} userLabel={user.email || user.name || 'Account'} offline={offline} />
}
