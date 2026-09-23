import React, { useState, useEffect } from 'react'
import { Users, HardDrive, AlertCircle } from 'lucide-react'
import { authClient } from '../../lib/authClient'
import { ConnectionNotice } from './ConnectionNotice'
import { isDesktopEdition } from '../../lib/teamServer'

/** Must match SETUP_TOKEN_HEADER in server/src/setup.ts. */
const SETUP_TOKEN_HEADER = 'x-bugstow-setup-token'

const INPUT_CLS =
  'w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] text-slate-900 dark:text-white'
const LABEL_CLS = 'flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300'

/**
 * The desktop launcher opens the app at `/#setup=<token>` on first run, so the
 * person who installed it doesn't have to copy the token by hand. Read once,
 * when this (lazy) module loads, and removed from the address bar.
 */
const LINK_SETUP_TOKEN = (() => {
  if (typeof location === 'undefined') return ''
  const m = /^#setup=([A-Za-z0-9-]{20,})$/.exec(location.hash)
  if (!m) return ''
  history.replaceState(null, '', location.pathname + location.search)
  return m[1]
})()

/**
 * Email/password sign-in and sign-up against the self-hosted team server's
 * local auth (better-auth + SQLite). On success, the session updates and the
 * workspace renders.
 *
 * On a fresh server (no accounts yet) this is the first-administrator setup,
 * which needs the one-time setup token printed in the server log.
 */
export function TeamAuthGate({
  onUseLocal,
  setupComplete = true,
}: {
  onUseLocal: () => void
  setupComplete?: boolean
}) {
  // The page may have loaded before the administrator was created (e.g. the
  // admin just signed out), so ask the server again instead of trusting it.
  const [setupDone, setSetupDone] = useState(setupComplete)
  const firstRun = !setupDone
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(firstRun ? 'sign-up' : 'sign-in')
  useEffect(() => {
    let alive = true
    fetch('/api/health', { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then(h => {
        if (alive && h && typeof h.setupComplete === 'boolean' && h.setupComplete !== setupDone) {
          setSetupDone(h.setupComplete)
          setMode(h.setupComplete ? 'sign-in' : 'sign-up')
        }
      })
      .catch(() => {
        // keep what we know; sign-in will report connection problems
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const desktop = isDesktopEdition()
  const [setupToken, setSetupToken] = useState(LINK_SETUP_TOKEN)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (firstRun && !setupToken.trim()) {
      setError(desktop ? 'Enter the setup token (run: bugstow setup-token).' : 'Enter the setup token from the server log.')
      return
    }
    if (!email.includes('@') || password.length < 8) {
      setError('Enter a valid email and a password of at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      const res =
        mode === 'sign-in'
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: name.trim() || email.split('@')[0],
              fetchOptions: firstRun ? { headers: { [SETUP_TOKEN_HEADER]: setupToken.trim() } } : undefined,
            })
      if (res.error) {
        setError(
          res.error.status === 429
            ? 'Too many failed attempts. Wait 15 minutes and try again.'
            : res.error.message || 'Authentication failed.'
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the team server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[#5B50F6]">
            {desktop ? <HardDrive size={18} /> : <Users size={18} />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {desktop
                ? firstRun
                  ? 'Create your sign-in'
                  : mode === 'sign-in'
                    ? 'Sign in'
                    : 'Create your account'
                : firstRun
                  ? 'Set up this server'
                  : mode === 'sign-in'
                    ? 'Sign in to your team'
                    : 'Create your account'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{desktop ? 'Saved on this PC' : 'BugsTow Team'}</p>
          </div>
        </div>

        <ConnectionNotice />

        {firstRun && desktop && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You'll use this to open BugsTow on this PC. The email is only your sign-in name: it isn't sent anywhere
            and nothing is emailed to it.
          </p>
        )}
        {firstRun && !desktop && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No accounts exist yet. The account you create now becomes the server administrator. To prove you run
            this server, enter the setup token from its log.
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
          >
            <AlertCircle size={15} className="shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {firstRun && !(desktop && LINK_SETUP_TOKEN) && (
          <label className={LABEL_CLS}>
            Setup token
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={setupToken}
              onChange={e => setSetupToken(e.target.value)}
              placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
              className={`${INPUT_CLS} font-mono`}
            />
            <span className="font-normal text-slate-500 dark:text-slate-400">
              {desktop ? (
                <>
                  In a terminal, run <code className="font-mono">bugstow setup-token</code>.
                </>
              ) : (
                <>
                  On the server computer run <code className="font-mono">docker compose logs bugstow</code> or{' '}
              <code className="font-mono">docker exec bugstow npm run -s setup-token</code>.
                </>
              )}
            </span>
          </label>
        )}

        {mode === 'sign-up' && (
          <label className={LABEL_CLS}>
            Your name
            <input type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={INPUT_CLS} />
          </label>
        )}
        <label className={LABEL_CLS}>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={INPUT_CLS}
          />
        </label>
        <label className={LABEL_CLS}>
          Password
          <input
            type="password"
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={INPUT_CLS}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-50"
        >
          {busy ? 'Please wait…' : firstRun ? (desktop ? 'Create sign-in' : 'Create administrator') : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>

        <div className="flex items-center justify-between text-xs">
          {!firstRun && !desktop ? (
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
                setError(null)
              }}
              className="text-[#5B50F6] dark:text-indigo-400 font-semibold hover:underline"
            >
              {mode === 'sign-in' ? 'I was invited: create my account' : 'I already have an account'}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onUseLocal}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {desktop ? 'Keep issues in this browser instead' : 'Use Personal mode'}
          </button>
        </div>
      </form>
    </div>
  )
}
