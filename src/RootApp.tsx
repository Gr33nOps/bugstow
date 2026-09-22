import App from './App'
import { useAppMode } from './hooks/useAppMode'
import { useSession, cloudEnabled } from './lib/authClient'
import { ModePicker } from './components/cloud/ModePicker'
import { CloudAuthGate } from './components/cloud/CloudAuthGate'
import { CloudApp } from './components/cloud/CloudApp'

/**
 * Chooses between local-first mode (the original in-browser app) and cloud/team
 * mode (Neon-backed, signed in). The choice is remembered; users can switch
 * between them at any time.
 */
export default function RootApp() {
  const { mode, setMode } = useAppMode()
  const session = useSession()

  if (mode === null) {
    return (
      <div className="h-full">
        <ModePicker onChoose={setMode} />
      </div>
    )
  }

  if (mode === 'cloud') {
    if (!cloudEnabled) {
      // Deployment without cloud configured — fall back to local.
      return <App />
    }
    if (session.isPending) {
      return (
        <div className="h-full flex items-center justify-center text-sm text-slate-400 bg-slate-50 dark:bg-slate-950">
          Loading…
        </div>
      )
    }
    if (!session.data?.user) {
      return (
        <div className="h-full">
          <CloudAuthGate onUseLocal={() => setMode('local')} />
        </div>
      )
    }
    const user = session.data.user
    return (
      <div className="h-full">
        <CloudApp onUseLocal={() => setMode('local')} userLabel={user.email || user.name || 'Account'} />
      </div>
    )
  }

  // Local mode
  return <App onSwitchToCloud={cloudEnabled ? () => setMode('cloud') : undefined} />
}
