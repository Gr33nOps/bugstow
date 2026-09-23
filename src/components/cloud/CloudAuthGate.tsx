import React, { useState } from 'react'
import { Users, AlertCircle } from 'lucide-react'
import { authClient } from '../../lib/authClient'

/**
 * Email/password sign-in and sign-up against the self-hosted team server's
 * local auth (better-auth + SQLite). On success, the session updates and the workspace renders.
 */
export function CloudAuthGate({
  onUseLocal,
  setupComplete = true,
}: {
  onUseLocal: () => void
  setupComplete?: boolean
}) {
  // Before any admin exists, default to sign-up: the first account is the admin.
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(setupComplete ? 'sign-in' : 'sign-up')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.includes('@') || password.length < 8) {
      setError('Enter a valid email and a password of at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      const res =
        mode === 'sign-in'
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ email, password, name: name.trim() || email.split('@')[0] })
      if (res.error) {
        setError(res.error.message || 'Authentication failed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-7 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[#5B50F6]">
            <Users size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              {!setupComplete
                ? 'Create the administrator'
                : mode === 'sign-in'
                  ? 'Sign in to your team'
                  : 'Create your account'}
            </h1>
            <p className="text-xs text-slate-400">Bugstow Team</p>
          </div>
        </div>

        {!setupComplete && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl text-xs text-indigo-800 dark:text-indigo-300">
            This server has no accounts yet. The first account you create becomes the administrator.
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {mode === 'sign-up' && (
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] text-slate-900 dark:text-white"
          />
        )}
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] text-slate-900 dark:text-white"
        />
        <input
          type="password"
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] text-slate-900 dark:text-white"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl shadow-sm disabled:opacity-50"
        >
          {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
              setError(null)
            }}
            className="text-[#5B50F6] dark:text-indigo-400 font-semibold hover:underline"
          >
            {mode === 'sign-in' ? 'Create an account' : 'I already have an account'}
          </button>
          <button
            type="button"
            onClick={onUseLocal}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Use local mode
          </button>
        </div>
      </form>
    </div>
  )
}
