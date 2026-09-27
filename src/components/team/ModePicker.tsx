import { HardDrive, Users, Server, Cloud, ArrowRight, AppWindow, Check } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppMode } from '../../hooks/useAppMode'

function Choice({ icon, title, children, action, recommended = false, onClick }: {
  icon: ReactNode; title: string; children: ReactNode; action: string; recommended?: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={`welcome-choice group flex flex-col text-left p-6 sm:p-7 rounded-xl border bg-white dark:bg-slate-900 ${recommended ? 'border-indigo-500 ring-1 ring-indigo-500 shadow-lg shadow-indigo-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
      <span className="flex items-center justify-between w-full mb-6">
        <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">{icon}</span>
        {recommended && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">Recommended</span>}
      </span>
      <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</span>
      <span className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 mt-2 mb-7">{children}</span>
      <span className="mt-auto flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300">{action}<ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
    </button>
  )
}

export function ModePicker({ teamAvailable, desktop = false, onChoose, onSelfHost, onUseOwnCloud }: {
  teamAvailable: boolean; desktop?: boolean; onChoose: (mode: AppMode) => void; onSelfHost: () => void; onUseOwnCloud: () => void
}) {
  return (
    <div className="welcome-surface min-h-full flex flex-col items-center justify-center px-5 py-12 sm:p-12">
      <div className="w-full max-w-4xl">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-indigo-600 dark:text-indigo-300 mb-10"><span className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 text-white"><Check size={18} /></span>BugsTow</div>
        <div className="max-w-xl mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300 mb-3">A calmer place to track issues</p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white tracking-tight leading-tight">Less setup.<br />More getting things fixed.</h1>
          <p className="text-base text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">Choose where your work lives. You can change this later.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {desktop ? (
            <Choice icon={<HardDrive size={24} />} title="Save on this computer" action="Set up my workspace" recommended onClick={() => onChoose('team')}>
              Keep issues in a local folder with automatic backups. Create your sign-in once, then start working.
            </Choice>
          ) : (
            <Choice icon={<AppWindow size={24} />} title="Just for me" action="Start without an account" recommended={!teamAvailable} onClick={() => onChoose('local')}>
              Start right away in this browser. Works offline. Export backups to keep your work safe if browser data is cleared.
            </Choice>
          )}
          {desktop ? (
            <Choice icon={<AppWindow size={24} />} title="Only in this browser" action="Start without an account" onClick={() => onChoose('local')}>
              A lightweight workspace with no sign-in. Export backups regularly: clearing browser data removes your issues.
            </Choice>
          ) : (
            <Choice icon={teamAvailable ? <Users size={24} /> : <Server size={24} />} title={teamAvailable ? 'Work with my team' : 'Set up a team'} action={teamAvailable ? 'Sign in or join your team' : 'See setup steps'} recommended={teamAvailable} onClick={() => teamAvailable ? onChoose('team') : onSelfHost()}>
              {teamAvailable ? 'Share projects, assign issues and work together. Your team keeps the data on this server.' : 'Run BugsTow on a computer your team controls, then invite people to work together.'}
            </Choice>
          )}
        </div>
        <button type="button" onClick={onUseOwnCloud} className="welcome-choice mt-4 w-full flex items-start sm:items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900 p-5 text-left">
          <Cloud size={24} className="shrink-0 text-indigo-600 dark:text-indigo-300 mt-1 sm:mt-0" />
          <span className="flex-1"><span className="block text-sm font-semibold text-slate-900 dark:text-white">My work, on more than one device</span><span className="block text-sm text-slate-600 dark:text-slate-300 mt-1">Connect your own cloud storage. Your data is encrypted before upload.</span></span>
          <ArrowRight size={18} className="shrink-0 text-indigo-600 dark:text-indigo-300 mt-1" />
        </button>
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">Your browser, your computer or your team’s server. You choose where to keep your work.</p>
      </div>
    </div>
  )
}
