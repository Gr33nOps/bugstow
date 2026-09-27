import { useState, useEffect, lazy, Suspense } from "react"
import App from "./App"
import { loadWithFallback } from "./lib/lazyModule"
import { useAppMode } from "./hooks/useAppMode"
import { detectTeamServer, type TeamServerInfo } from "./lib/teamServer"
import { ModePicker } from "./components/team/ModePicker"
import { SelfHostInfo } from "./components/team/SelfHostInfo"

// Team mode (auth client + shared workspace) is a separate chunk, fetched only
// from a team server. The public Personal site never loads it.
function TeamLoadError() {
  return (
    <div className="h-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div
        role="alert"
        className="max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6"
      >
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Reload your workspace
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Part of the app could not load. The app may have updated, or the
          server may be offline. Check your connection and reload. Your saved
          data stays where it is.
        </p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-5 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium"
        >
          Reload app
        </button>
      </div>
    </div>
  )
}
const TeamRoot = lazy(() =>
  loadWithFallback(() => import("./components/team/TeamRoot"), {
    default: TeamLoadError,
  }),
)

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
          desktop={team.edition === "desktop"}
          onChoose={setMode}
          onSelfHost={() => setShowSelfHost(true)}
          onUseOwnCloud={() => {
            setStartInSync(true)
            setMode("local")
          }}
        />
      </div>
    )
  }

  if (mode === "team") {
    // Saved team choice but no team server here (e.g. a static build) → info.
    if (!team.available) {
      return (
        <div className="h-full">
          <SelfHostInfo onBack={() => setMode("local")} />
        </div>
      )
    }
    return (
      <div className="h-full">
        <Suspense fallback={<Loading />}>
          <TeamRoot
            setupComplete={team.setupComplete}
            offline={team.offline}
            onUseLocal={() => setMode("local")}
          />
        </Suspense>
      </div>
    )
  }

  // Local mode
  return (
    <App
      startInSync={startInSync}
      onSwitchToTeam={
        team.available ? () => setMode("team") : () => setShowSelfHost(true)
      }
    />
  )
}
