import { ArrowLeft, Terminal, Server, ShieldCheck, HardDrive } from 'lucide-react'

const REPO_URL = 'https://github.com/Gr33nOps/bugstow'

/**
 * Shown on the public static site when a visitor chooses the team option.
 * The public site has no backend to sign into, so this explains how to run
 * your own team server and links to the repository and docs.
 */
export function SelfHostInfo({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-8"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <h1 className="text-2xl font-bold tracking-tight">Self-host Bugstow for your team</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
          Team mode runs on a computer or server that <span className="font-semibold">your team</span> controls.
          Teammates connect to it over your network and share projects, issues and screenshots. Shared data is
          stored on that machine (a SQLite database and a screenshots folder), not on this website. No cloud
          service is required.
        </p>

        <div className="mt-8 space-y-3">
          <Step icon={Terminal} title="1 · Get it running">
            Clone the repo and start it with Docker Compose:
            <pre className="mt-2 bg-slate-900 text-slate-100 rounded-xl p-3 text-xs overflow-x-auto">
              {`git clone ${REPO_URL}.git
cd bugstow
cp server/.env.example .env   # set BUGSTOW_AUTH_SECRET, BASE_URL, TLS
docker compose up -d --build`}
            </pre>
            For teammates on your network, turn on HTTPS (<code>BUGSTOW_TLS=true</code>) so passwords and issues
            are encrypted in transit. Plain HTTP is only suitable for trying it on one computer.
          </Step>
          <Step icon={Server} title="2 · Create the admin">
            The server prints a one-time setup token in its log. Open the server's address, choose
            "My team", and enter the token to create the administrator. After that, only invited people can
            register.
          </Step>
          <Step icon={HardDrive} title="3 · Invite your team">
            Share the server's address on your network (e.g. <code>https://192.168.1.20:8080</code>). Each
            teammate trusts its certificate once, then signs up with the invited email.
          </Step>
          <Step icon={ShieldCheck} title="Access it safely">
            Keep it on your local network, or expose it through HTTPS or a VPN for remote access. Full setup,
            backup, and security notes are in the docs.
          </Step>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl"
          >
            Get the code &amp; full instructions
          </a>
          <a
            href={`${REPO_URL}/blob/main/docs/SELF_HOSTING.md`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Self-hosting guide
          </a>
        </div>
      </div>
    </div>
  )
}

function Step({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3.5 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
      <div className="w-8 h-8 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
        <Icon size={16} />
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <p className="font-semibold text-slate-900 dark:text-white mb-0.5">{title}</p>
        {children}
      </div>
    </div>
  )
}
