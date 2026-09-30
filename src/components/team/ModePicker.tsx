import { User, Users, ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { AppMode } from '../../hooks/useAppMode'
import { BugstowLogoIcon, BRAND_PRIMARY } from '../common/Icon'

function Choice({ icon, title, who, facts, action, onClick }: {
  icon: ReactNode
  title: string
  who: string
  facts: string[]
  action: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="welcome-choice group flex flex-col text-left p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
    >
      <span className="flex items-center gap-2.5 text-slate-900 dark:text-white">
        {icon}
        <span className="text-xl font-semibold tracking-tight">{title}</span>
      </span>
      <span className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{who}</span>
      <ul className="mt-5 mb-7 space-y-2 text-sm text-slate-600 dark:text-slate-300">
        {facts.map(f => (
          <li key={f} className="flex gap-2.5">
            <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
            {f}
          </li>
        ))}
      </ul>
      <span className="mt-auto flex items-center gap-2 text-sm font-semibold text-brand">
        {action}
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

/**
 * First run: Local (just you, in this browser) or Team (a sign-in, shared with
 * people you invite). On a team server Team comes first; everywhere else Local.
 */
export function ModePicker({ teamAvailable, desktop = false, onChoose, onSelfHost }: {
  teamAvailable: boolean
  desktop?: boolean
  onChoose: (mode: AppMode) => void
  onSelfHost: () => void
}) {
  const local = (
    <Choice
      key="local"
      icon={<User size={20} />}
      title="Local"
      who="Just you"
      facts={['No account, starts right away', 'Saved in this browser', 'Works offline']}
      action="Start with Local"
      onClick={() => onChoose('local')}
    />
  )
  const team = teamAvailable ? (
    <Choice
      key="team"
      icon={<Users size={20} />}
      title="Team"
      who="You and people you invite"
      facts={
        desktop
          ? ['A sign-in for each person', 'Saved in a folder on this PC, backed up daily', 'Invite people on your Wi-Fi or through Tailscale']
          : ['Sign in, or accept an invitation', 'Saved on this server', 'Assign issues to each other']
      }
      action={desktop ? 'Set up Team' : 'Sign in to Team'}
      onClick={() => onChoose('team')}
    />
  ) : (
    <Choice
      key="team"
      icon={<Users size={20} />}
      title="Team"
      who="You and people you invite"
      facts={['Needs the BugsTow app on one computer', 'Others join from their browser']}
      action="How to set it up"
      onClick={onSelfHost}
    />
  )
  const teamFirst = teamAvailable && !desktop

  return (
    <div className="welcome-surface min-h-full flex flex-col justify-center px-4 py-10 sm:p-12">
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 mb-10">
          <BugstowLogoIcon size={26} color={BRAND_PRIMARY} />
          <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">BugsTow</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Just you, or with other people?
        </h1>
        <p className="mt-2 mb-8 text-base text-slate-600 dark:text-slate-300">
          You can switch any time at the bottom of the sidebar.
        </p>
        <div className="grid md:grid-cols-2 gap-4">{teamFirst ? [team, local] : [local, team]}</div>
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          {desktop
            ? 'Either way, your issues stay on this computer. BugsTow doesn’t upload them anywhere.'
            : teamAvailable
              ? 'Team issues are kept on this server. Local issues stay in this browser.'
              : 'Local issues stay in this browser. BugsTow doesn’t upload them anywhere.'}
        </p>
      </div>
    </div>
  )
}
