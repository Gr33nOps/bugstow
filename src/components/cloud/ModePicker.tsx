import { HardDrive, Users } from 'lucide-react'
import type { AppMode } from '../../hooks/useAppMode'
import { cloudEnabled } from '../../lib/authClient'

/**
 * First-run choice between local-only and cloud/team mode. Shown once; the
 * choice is remembered and can be changed later from Settings.
 */
export function ModePicker({ onChoose }: { onChoose: (mode: AppMode) => void }) {
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
              Private and offline. Everything stays in this browser. No account needed. Optional encrypted cloud backup.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChoose('cloud')}
            disabled={!cloudEnabled}
            className="text-left p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#5B50F6] hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[#5B50F6] dark:text-indigo-300 mb-4">
              <Users size={22} />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Team · Cloud</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Sign in, invite teammates, assign issues, and import from GitHub. Data is shared and synced across devices.
            </p>
            {!cloudEnabled && (
              <span className="inline-block mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                Cloud isn’t configured on this deployment.
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
