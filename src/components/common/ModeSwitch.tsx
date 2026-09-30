import { User, Users } from 'lucide-react'

type Mode = 'local' | 'team'

const LABEL: Record<Mode, string> = { local: 'Local', team: 'Team' }
const HINT: Record<Mode, string> = {
  local: 'Just you, saved in this browser',
  team: 'You and people you invite',
}

/**
 * The Local | Team switch at the bottom of both sidebars, so switching is in
 * the same place whichever mode you're in. Switching never moves or deletes
 * anything; each mode keeps its own issues.
 */
export function ModeSwitch({
  mode,
  onSwitch,
  collapsed = false,
}: {
  mode: Mode
  /** Go to the other mode. */
  onSwitch: () => void
  collapsed?: boolean
}) {
  const other: Mode = mode === 'local' ? 'team' : 'local'
  const Icon = { local: User, team: Users }

  if (collapsed) {
    const OtherIcon = Icon[other]
    return (
      <button
        type="button"
        onClick={onSwitch}
        className="nav-item justify-center"
        title={`Switch to ${LABEL[other]}: ${HINT[other].toLowerCase()}`}
        aria-label={`Switch to ${LABEL[other]}`}
      >
        <OtherIcon size={18} />
      </button>
    )
  }

  return (
    <div className="px-1 pt-3">
      <div
        role="group"
        aria-label="Workspace mode"
        className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800"
      >
        {(['local', 'team'] as const).map((m) => {
          const active = m === mode
          const MIcon = Icon[m]
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={active ? undefined : onSwitch}
              title={active ? HINT[m] : `Switch to ${LABEL[m]}: ${HINT[m].toLowerCase()}`}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold shadow-xs cursor-default'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
              }`}
            >
              <MIcon size={15} />
              {LABEL[m]}
            </button>
          )
        })}
      </div>
      <p className="mt-2 px-1 text-xs text-slate-500 dark:text-slate-400">{HINT[mode]}</p>
    </div>
  )
}
