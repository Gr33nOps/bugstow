import React, { useState, useEffect } from 'react'
import { Users, HardDrive, AlertCircle } from 'lucide-react'
import { authClient } from '../../lib/authClient'
import { ConnectionNotice } from './ConnectionNotice'
import { isDesktopEdition } from '../../lib/teamServer'
import { isValidUsername, loginToEmail, readInviteFromAddress, clearPendingInvite, savePendingInvite } from '../../lib/login'

/** Must match SETUP_TOKEN_HEADER in server/src/setup.ts. */
const SETUP_TOKEN_HEADER = 'x-bugstow-setup-token'
/** Must match INVITE_LINK_HEADER in server/src/inviteLinks.ts. */
const INVITE_LINK_HEADER = 'x-bugstow-invite'

const INPUT_CLS =
  'w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand text-slate-900 dark:text-white'
const LABEL_CLS = 'flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300'
const HINT_CLS = 'font-normal text-slate-500 dark:text-slate-400'

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

/** An invite link (`/#invite=<token>`), kept for this tab until it's used. */
const INVITE_TOKEN = readInviteFromAddress()

type InviteInfo = { teamName: string; invitedBy: string | null } | 'invalid' | null

/**
 * Sign-in for Team, against this server's own accounts (better-auth + SQLite).
 *
 * - Opened an invite link: "Join <workspace>", pick a username and password.
 * - Otherwise: sign in with a username (or the email of an older account).
 * - Fresh server: create the first account, which needs the one-time setup token.
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
  // Older email invitations (/#join=<email>) still work.
  const [invitedEmail] = useState(() => new URLSearchParams(location.hash.slice(1)).get('join') || '')
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'join'>(
    firstRun || invitedEmail ? 'sign-up' : INVITE_TOKEN ? 'join' : 'sign-in'
  )
  const [invite, setInvite] = useState<InviteInfo>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/health', { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then(h => {
        if (alive && h && typeof h.setupComplete === 'boolean' && h.setupComplete !== setupDone) {
          setSetupDone(h.setupComplete)
          setMode(h.setupComplete ? (INVITE_TOKEN ? 'join' : 'sign-in') : 'sign-up')
        }
      })
      .catch(() => {
        // keep what we know; sign-in will report connection problems
      })
    if (INVITE_TOKEN) {
      fetch(`/api/invite-links/info?token=${encodeURIComponent(INVITE_TOKEN)}`, { headers: { Accept: 'application/json' } })
        .then(async r => {
          if (!alive) return
          if (!r.ok) {
            setInvite('invalid')
            clearPendingInvite()
            setMode('sign-in')
            return
          }
          const j = await r.json()
          setInvite({ teamName: j.teamName, invitedBy: j.invitedBy })
        })
        .catch(() => {
          // offline: the join attempt itself will explain
        })
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [name, setName] = useState('')
  const [login, setLogin] = useState(invitedEmail)
  const [password, setPassword] = useState('')
  const desktop = isDesktopEdition()
  const [setupToken, setSetupToken] = useState(LINK_SETUP_TOKEN)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const teamName = invite && invite !== 'invalid' ? invite.teamName : 'the workspace'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (firstRun && !setupToken.trim()) {
      setError(desktop ? 'Enter the setup token (run: bugstow setup-token).' : 'Enter the setup token from the server log.')
      return
    }
    const value = login.trim()
    if (mode === 'join' && !isValidUsername(value)) {
      setError('Pick a username of 2–32 letters, numbers, dots, dashes or underscores.')
      return
    }
    if (mode !== 'join' && !(value.includes('@') || isValidUsername(value))) {
      setError(mode === 'sign-in' ? 'Enter your username.' : 'Enter a username (letters, numbers, dots, dashes).')
      return
    }
    if (password.length < 8) {
      setError('The password needs at least 8 characters.')
      return
    }
    const email = loginToEmail(value)
    const headers: Record<string, string> = {}
    if (firstRun) headers[SETUP_TOKEN_HEADER] = setupToken.trim()
    if (mode === 'join') headers[INVITE_LINK_HEADER] = INVITE_TOKEN
    // Joining uses the link itself; drop the saved copy first so the signed-in
    // app doesn't try to use it a second time.
    if (mode === 'join') clearPendingInvite()
    setBusy(true)
    try {
      const res =
        mode === 'sign-in'
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: name.trim() || value.split('@')[0],
              fetchOptions: Object.keys(headers).length ? { headers } : undefined,
            })
      if (res.error) {
        if (mode === 'join') savePendingInvite(INVITE_TOKEN)
        const msg = res.error.message || ''
        setError(
          res.error.status === 429
            ? 'Too many failed attempts. Wait 15 minutes and try again.'
            : /already exists/i.test(msg)
              ? mode === 'join'
                ? 'That username is taken. Pick another one, or choose “I already have an account”.'
                : 'An account with that name already exists. Sign in instead.'
              : /invalid (email|password)/i.test(msg)
                ? 'Wrong username or password.'
                : msg || 'Sign-in failed.'
        )
      }
    } catch (err) {
      if (mode === 'join') savePendingInvite(INVITE_TOKEN)
      setError(err instanceof Error ? err.message : 'Could not reach BugsTow.')
    } finally {
      setBusy(false)
    }
  }

  const title = firstRun
    ? desktop
      ? 'Create your sign-in'
      : 'Set up this server'
    : mode === 'join'
      ? `Join ${teamName}`
      : mode === 'sign-in'
        ? 'Sign in to Team'
        : 'Create your account'

  return (
    <div className="welcome-surface min-h-full flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-slate-950">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 sm:p-7 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-brand">
            {desktop && firstRun ? <HardDrive size={18} /> : <Users size={18} />}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">{title}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">BugsTow Team</p>
          </div>
        </div>

        <ConnectionNotice />

        {mode === 'join' && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {invite && invite !== 'invalid' && invite.invitedBy ? `${invite.invitedBy} invited you. ` : ''}
            Pick a username and password. You'll use them to sign in here next time.
          </p>
        )}
        {invite === 'invalid' && (
          <div role="note" className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3 text-sm text-amber-900 dark:text-amber-200">
            This invite link has expired or was already used. Ask the person who sent it for a new one. If you already
            joined, sign in below.
          </div>
        )}
        {!firstRun && mode === 'sign-up' && invitedEmail && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Create a password for the email you were invited with.
          </p>
        )}
        {firstRun && desktop && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            You'll use this to open Team on this PC. Nothing is sent anywhere.
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
            className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-start gap-2"
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
            <span className={HINT_CLS}>
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

        {mode === 'sign-up' && invitedEmail && (
          <label className={LABEL_CLS}>
            Your name
            <input type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={INPUT_CLS} />
          </label>
        )}
        <label className={LABEL_CLS}>
          {mode === 'sign-in' ? 'Username' : invitedEmail && mode === 'sign-up' ? 'Email' : 'Username'}
          <input
            type="text"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            readOnly={Boolean(invitedEmail) && mode === 'sign-up'}
            value={login}
            onChange={e => setLogin(e.target.value)}
            className={INPUT_CLS}
          />
          {mode === 'join' && <span className={HINT_CLS}>Letters, numbers, dots or dashes. Others see it next to your issues.</span>}
          {mode === 'sign-in' && <span className={HINT_CLS}>Older accounts can use their email here.</span>}
        </label>
        <label className={LABEL_CLS}>
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={INPUT_CLS}
          />
          {mode !== 'sign-in' && <span className={HINT_CLS}>At least 8 characters.</span>}
        </label>

        <button
          type="submit"
          disabled={busy || (mode === 'join' && invite === null)}
          className="w-full py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg disabled:opacity-50"
        >
          {busy
            ? 'Please wait…'
            : firstRun
              ? desktop
                ? 'Create sign-in'
                : 'Create administrator'
              : mode === 'join'
                ? `Join ${teamName}`
                : mode === 'sign-in'
                  ? 'Sign in'
                  : 'Create account'}
        </button>

        <div className="flex items-center justify-between gap-3 text-xs">
          {mode === 'join' ? (
            <button
              type="button"
              onClick={() => {
                // The link is kept: after signing in, the workspace is added to this account.
                setMode('sign-in')
                setError(null)
              }}
              className="text-brand dark:text-indigo-400 font-semibold hover:underline"
            >
              I already have an account
            </button>
          ) : mode === 'sign-in' && INVITE_TOKEN && invite !== 'invalid' ? (
            <button
              type="button"
              onClick={() => {
                setMode('join')
                setError(null)
              }}
              className="text-brand dark:text-indigo-400 font-semibold hover:underline"
            >
              I’m new here
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onUseLocal}
            className="text-right text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Use Local instead
          </button>
        </div>
      </form>
    </div>
  )
}
