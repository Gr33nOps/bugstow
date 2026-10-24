import { useEffect, useState, type ReactNode } from 'react'
import { detectTeamServer } from '../../lib/teamServer'
import { connectionKind } from '../../lib/connection'

/** Both the browser's local address and the installed shortcut remember Team. */
export function DesktopWorkspaceGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [available, setAvailable] = useState(false)
  const [saved, setSaved] = useState('')
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const info = await detectTeamServer()
        if (!alive || !info.available || info.edition !== 'desktop' || connectionKind() !== 'localhost') return
        const response = await fetch('/api/desktop/workspace')
        if (!response.ok || !alive) return
        const data = await response.json() as { url: string }
        if (!alive) return
        setAvailable(true); setSaved(data.url)
        if (data.url && !new URLSearchParams(location.search).has('local')) {
          const url = new URL(data.url)
          if (url.protocol === 'https:' && url.origin !== location.origin) location.replace(url.origin + '/#team')
        }
      } catch { /* The existing app remains usable if preferences cannot be read. */ }
      finally { if (alive) setReady(true) }
    })()
    return () => { alive = false }
  }, [])
  if (!ready) return <div className="p-6">Loading…</div>
  return <div className="flex h-full flex-col">
    {available && <details className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
      <summary className="cursor-pointer font-medium">Connect to your team — already have a shared BugsTow link?</summary>
      <form className="mx-auto max-w-2xl space-y-3 py-3" onSubmit={async e => {
        e.preventDefault(); setBusy(true); setError('')
        try {
          const response = await fetch('/api/desktop/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link.trim() }) })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error)
          // Preserve the invite on this first visit only; preferences store no token.
          const target = new URL(link.trim())
          location.assign(data.url + (target.hash.startsWith('#invite=') || target.hash.startsWith('#join=') ? '/' + target.hash : '/#team'))
        } catch (err) { setError(err instanceof Error ? err.message : 'Could not connect.') }
        finally { setBusy(false) }
      }}>
        <p>Paste your teammate’s link once. Your BugsTow shortcut and this browser address will open that shared workspace next time. Your existing Local data stays here.</p>
        <label className="block">Shared BugsTow link<input type="url" required value={link} onChange={e => setLink(e.target.value)} placeholder="https://your-team-address:5757" className="mt-1 w-full rounded border border-slate-300 bg-transparent p-2" /></label>
        <button disabled={busy} className="rounded bg-brand px-3 py-2 text-white">Save and open Team</button>
        <p>To return here, open this computer’s BugsTow address with <code>?local=1</code>, or run <code>bugstow disconnect</code>.</p>
        {saved && <button type="button" disabled={busy} onClick={async () => {
          setBusy(true); setError('')
          try {
            const r = await fetch('/api/desktop/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: '' }) })
            if (!r.ok) throw new Error('Could not disconnect.')
            setSaved('')
          } catch (err) { setError(err instanceof Error ? err.message : 'Could not disconnect.') }
          finally { setBusy(false) }
        }}>Disconnect from {saved}</button>}
        {error && <p role="alert" className="text-red-600">{error}</p>}
      </form>
    </details>}
    <div className="min-h-0 flex-1">{children}</div>
  </div>
}
