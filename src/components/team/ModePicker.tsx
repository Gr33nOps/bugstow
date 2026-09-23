import { HardDrive, Users, Server, Cloud, ArrowRight, AppWindow } from 'lucide-react'
import type { AppMode } from '../../hooks/useAppMode'

/**
 * First-run choice between local-only and team mode.
 *
 * - On a self-hosted team server (`teamAvailable`), the team card leads to
 *   sign-in.
 * - On the public static site, it leads to self-hosting instructions instead,
 *   since there is no backend to sign into here.
 * - "Use your own cloud storage" is Personal mode that opens Settings → Sync,
 *   so people can bring existing issues onto a new device (e.g. a phone).
 */
export function ModePicker({
  teamAvailable,
  desktop = false,
  onChoose,
  onSelfHost,
  onUseOwnCloud,
}: {
  teamAvailable: boolean
  /** Installed desktop app: saving to this PC's data folder is the main choice. */
  desktop?: boolean
  onChoose: (mode: AppMode) => void
  onSelfHost: () => void
  onUseOwnCloud: () => void
}) {
  if (desktop) return <DesktopModePicker onChoose={onChoose} onUseOwnCloud={onUseOwnCloud} />

  // Shown second on phones (next to the other "Just me" option, above the fold)
  // and as a full-width last row on wider screens. Only one copy is ever
  // displayed, so tab order always matches what is on screen.
  const ownCloud = (placement: string) => (
    <button
      type="button"
      onClick={onUseOwnCloud}
      className={`group text-left px-6 py-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#5B50F6] transition-colors flex-col sm:flex-row sm:items-center gap-4 ${placement}`}
    >
      <Cloud size={24} className="shrink-0 text-[#5B50F6] dark:text-indigo-300" aria-hidden="true" />
      <span className="flex-1">
        <span className="block text-base font-bold text-slate-900 dark:text-white">
          Just me · Synced with my own cloud
        </span>
        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
          Use the same issues on your phone and computers. Connect your own Google Drive, Dropbox, WebDAV server,
          or a folder that Mega, Terabox or OneDrive syncs. Everything is encrypted with your passphrase before it
          leaves your device, and this website never receives it.
        </span>
      </span>
      <span className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-[#5B50F6] dark:text-indigo-300">
        Choose my cloud <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome to BugsTow</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            How do you want to use it? You can change this later.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onChoose('local')}
            className="flex flex-col text-left p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#5B50F6] hover:shadow-md transition-all"
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

          {ownCloud('flex sm:hidden')}

          {teamAvailable ? (
            <button
              type="button"
              onClick={() => onChoose('team')}
              className="flex flex-col text-left p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#5B50F6] hover:shadow-md transition-all"
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
              className="flex flex-col text-left p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#5B50F6] hover:shadow-md transition-all"
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

          {ownCloud('hidden sm:flex sm:col-span-2')}
        </div>
      </div>
    </div>
  )
}

/**
 * Welcome screen of the installed app (`bugstow` launcher). The server runs on
 * this computer, so the recommended place for data is its data folder; the
 * browser-only options stay available underneath.
 */
function DesktopModePicker({
  onChoose,
  onUseOwnCloud,
}: {
  onChoose: (mode: AppMode) => void
  onUseOwnCloud: () => void
}) {
  const secondary =
    'flex flex-col text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#5B50F6] transition-colors'
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Welcome to BugsTow</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Where should your issues be saved? You can change this later.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onChoose('team')}
          className="group w-full text-left p-6 rounded-2xl border-2 border-[#5B50F6] bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <HardDrive size={28} className="shrink-0 self-start sm:mt-0.5 text-[#5B50F6] dark:text-indigo-300" aria-hidden="true" />
          <span className="flex-1">
            <span className="block text-lg font-bold text-slate-900 dark:text-white">In a folder on this PC</span>
            <span className="block text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              Issues and screenshots are saved in BugsTow's data folder and backed up there automatically. Clearing the
              browser doesn't touch them. You create a sign-in once; it stays on this computer.
            </span>
          </span>
          <span className="shrink-0 flex items-center gap-1.5 text-sm font-semibold text-[#5B50F6] dark:text-indigo-300">
            Use this PC <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>

        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-6 mb-2">Or keep them in this browser</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => onChoose('local')} className={secondary}>
            <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
              <AppWindow size={15} className="text-[#5B50F6] dark:text-indigo-300" aria-hidden="true" />
              Only in this browser
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              No sign-in. Clearing this browser's data erases your issues, so export a backup now and then.
            </span>
          </button>
          <button type="button" onClick={onUseOwnCloud} className={secondary}>
            <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
              <Cloud size={15} className="text-[#5B50F6] dark:text-indigo-300" aria-hidden="true" />
              Synced with my own cloud
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              The same issues on your other computers, encrypted with your passphrase and synced through your Google
              Drive, Dropbox, WebDAV server or a synced folder.
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
