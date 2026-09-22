import { useState, useEffect } from 'react'
import App from './App'
import { useAppMode } from './hooks/useAppMode'
import { useSession } from './lib/authClient'
import { detectTeamServer, type TeamServerInfo } from './lib/teamServer'
import { ModePicker } from './components/cloud/ModePicker'
import { CloudAuthGate } from './components/cloud/CloudAuthGate'
import { CloudApp } from './components/cloud/CloudApp'
import { SelfHostInfo } from './components/cloud/SelfHostInfo'

function Loading() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-400 bg-slate-50 dark:bg-slate-950">
      Loading…
    </div>
  )
}

/**
 * Sign-in gate + workspace for team mode. Isolated in its own component so that
 * `useSession()` (which probes /api/auth/get-session) only runs when a team
 * server is actually present — the public static site never mounts this.
 */
function TeamGate({
  setupComplete,
  offline,
  onUseLocal,
}: {
  setupComplete: boolean
  offline: boolean
  onUseLocal: () => void
}) {
  const session = useSession()
  if (session.isPending) return <Loading />
  if (!session.data?.user) {
    return <CloudAuthGate setupComplete={setupComplete} onUseLocal={onUseLocal} />
  }
  const user = session.data.user
  return (
    <CloudApp onUseLocal={onUseLocal} userLabel={user.email || user.name || 'Account'} offline={offline} />
  )
}

/**
 * Top-level router between Personal (local, in-browser) and Team (self-hosted)
 * modes. A single build works on the public static site and on a team server;
 * it detects which one it is at runtime via /api/health.
 */
export default function RootApp() {
  const { mode, setMode } = useAppMode()
  const [team, setTeam] = useState<TeamServerInfo | null>(null)
  const [showSelfHost, setShowSelfHost] = useState(false)

  useEffect(() => {
    detectTeamServer().then(setTeam)
  }, [])

  if (team === null) return <Loading />

  if (showSelfHost) {
    return (
      <div className="h-full">
        <SelfHostInfo onBack={() => setShowSelfHost(false)} />
      </div>
    )
  }

  if (mode === null) {
    return (
      <div className="h-full">
        <ModePicker
          teamAvailable={team.available}
          onChoose={setMode}
          onSelfHost={() => setShowSelfHost(true)}
        />
      </div>
    )
  }

  if (mode === 'cloud') {
    // Persisted cloud choice but no team server here (e.g. public site) → info.
    if (!team.available) {
      return (
        <div className="h-full">
          <SelfHostInfo onBack={() => setMode('local')} />
        </div>
      )
    }
    return (
      <div className="h-full">
        <TeamGate
          setupComplete={team.setupComplete}
          offline={team.offline}
          onUseLocal={() => setMode('local')}
        />
      </div>
    )
  }

  // Local mode
  return (
    <App onSwitchToCloud={team.available ? () => setMode('cloud') : () => setShowSelfHost(true)} />
  )
}
