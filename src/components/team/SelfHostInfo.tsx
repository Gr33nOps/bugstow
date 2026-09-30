import { ArrowLeft, Terminal, Server, ShieldCheck, HardDrive } from 'lucide-react'

const REPO_URL = 'https://github.com/Gr33nOps/bugstow'

/**
 * Shown on the public static site when a visitor chooses the team option.
 * A static build (no server) has no backend to sign into, so this explains how to run
 * your own team server and links to the repository and docs.
 */
export function SelfHostInfo({ onBack }: { onBack: () => void }) {
  return (
    <div className="welcome-surface min-h-full overflow-y-auto text-slate-900 dark:text-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 mb-8"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <h1 className="text-2xl font-semibold tracking-tight">Bring your team together</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
          One computer holds your shared workspace. Everyone connects in their browser.
          Use the desktop app for an easy start, or Docker for a dedicated server.
        </p>

        <div className="mt-8 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">Already installed the desktop app?</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Open it, choose Team, then on that computer run one of these:</p>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="font-medium">People on the same Wi-Fi or office network</dt>
              <dd><pre className="mt-1.5 rounded-lg bg-slate-950 px-4 py-3 text-white overflow-x-auto">bugstow start --lan</pre></dd>
            </div>
            <div>
              <dt className="font-medium">People somewhere else (both of you install Tailscale, free)</dt>
              <dd><pre className="mt-1.5 rounded-lg bg-slate-950 px-4 py-3 text-white overflow-x-auto">bugstow share</pre></dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Then open People &amp; invitations → Create invite link, and send the link in any chat. They pick a username and password; no email needed. Keep that computer on while they use it.</p>
          <a className="inline-block mt-3 text-sm font-semibold text-indigo-600 dark:text-indigo-300" href={`${REPO_URL}/blob/main/docs/INSTALL.md`} target="_blank" rel="noreferrer">Desktop installation guide</a>
        </div>
        <h2 className="mt-8 text-lg font-semibold">For a dedicated server</h2>
        <div className="mt-4 space-y-3">
          <Step icon={Terminal} title="1 · Get it running">
            Clone the repo and start it with Docker Compose:
            <pre className="mt-2 bg-slate-900 text-slate-100 rounded-lg p-3 text-xs overflow-x-auto">
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
            "Work with my team", and enter the token to create the administrator. After that, only invited people can
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
            className="px-4 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg"
          >
            Get the code &amp; full instructions
          </a>
          <a
            href={`${REPO_URL}/blob/main/docs/SELF_HOSTING.md`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
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
    <div className="flex gap-3.5 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
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
