import { useState, useEffect, lazy, Suspense } from 'react'
import App from './App'
import { useAppMode } from './hooks/useAppMode'
import { detectTeamServer, type TeamServerInfo } from './lib/teamServer'
import { ModePicker } from './components/team/ModePicker'
import { SelfHostInfo } from './components/team/SelfHostInfo'

// Team mode (auth client + shared workspace) is a separate chunk, fetched only
// from a team server. The public Personal site never loads it.
const TeamRoot = lazy(() => import('./components/team/TeamRoot'))

function Loading() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-500 bg-slate-50 dark:bg-slate-950">
      Loading…
    </div>
  )
}

/**
 * Top-level router between Personal (local, in-browser) and Team (self-hosted)
 * modes. A single build works on the public static site and on a team server;
 * it detects which one it is at runtime (see lib/teamServer.ts).
 */
export default function RootApp() {
  const { mode, setMode } = useAppMode()
  const [team, setTeam] = useState<TeamServerInfo | null>(null)
  const [showSelfHost, setShowSelfHost] = useState(false)
  // Chosen "use my own cloud" on the welcome screen: open Settings → Sync once.
  const [startInSync, setStartInSync] = useState(false)

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
          onUseOwnCloud={() => {
            setStartInSync(true)
            setMode('local')
          }}
        />
      </div>
    )
  }

  if (mode === 'team') {
    // Saved team choice but no team server here (e.g. public site) → info.
    if (!team.available) {
      return (
        <div className="h-full">
          <SelfHostInfo onBack={() => setMode('local')} />
        </div>
      )
    }
    return (
      <div className="h-full">
        <Suspense fallback={<Loading />}>
          <TeamRoot
            setupComplete={team.setupComplete}
            offline={team.offline}
            onUseLocal={() => setMode('local')}
          />
        </Suspense>
      </div>
    )
  }

  // Local mode
  return <App startInSync={startInSync} onSwitchToTeam={team.available ? () => setMode('team') : () => setShowSelfHost(true)} />
}
