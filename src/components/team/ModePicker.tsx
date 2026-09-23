import { HardDrive, Users, Server } from 'lucide-react'
import type { AppMode } from '../../hooks/useAppMode'

/**
 * First-run choice between local-only and team mode.
 *
 * - On a self-hosted team server (`teamAvailable`), the team card leads to
 *   sign-in.
 * - On the public static site, it leads to self-hosting instructions instead,
 *   since there is no backend to sign into here.
 */
export function ModePicker({
  teamAvailable,
  onChoose,
  onSelfHost,
}: {
  teamAvailable: boolean
  onChoose: (mode: AppMode) => void
  onSelfHost: () => void
}) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome to Bugstow</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            How do you want to use it? You can change this later.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onChoose('local')}
            className="text-left p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#5B50F6] hover:shadow-md transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 mb-4">
              <HardDrive size={22} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Just me · Local</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Your projects, issues and screenshots stay in this browser. No account or server needed, and it keeps
              working offline. Export an encrypted backup anytime.
            </p>
          </button>

          {teamAvailable ? (
            <button
              type="button"
              onClick={() => onChoose('team')}
              className="text-left p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#5B50F6] hover:shadow-md transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[#5B50F6] dark:text-indigo-300 mb-4">
                <Users size={22} />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">My team</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Sign in to share projects and issues with your team and assign work. Shared data is stored on this
                server, which your team runs.
              </p>
            </button>
          ) : (
            <button
              type="button"
              onClick={onSelfHost}
              className="text-left p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#5B50F6] hover:shadow-md transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[#5B50F6] dark:text-indigo-300 mb-4">
                <Server size={22} />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Self-host for your team</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Run BugsTow on a computer your team controls so teammates can share issues. Shared data is stored
                there, not on this website. See how to install it.
              </p>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
