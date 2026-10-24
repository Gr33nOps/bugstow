import { useState } from 'react'
import { normalizeGithubFixReference } from '../../lib/githubFixReferences'

export function FixReferences({ links, onChange }: { links: string[]; onChange: (links: string[]) => Promise<void> }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (next: string[]) => {
    setBusy(true)
    setError('')
    try { await onChange(next); return true }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save link'); return false }
    finally { setBusy(false) }
  }
  const add = async () => {
    const link = normalizeGithubFixReference(input)
    if (!link) { setError('Use a GitHub repository, pull request, or commit URL.'); return }
    if (links.includes(link)) { setError('This link is already saved.'); return }
    if (links.length >= 10) { setError('An issue can have up to 10 fix references.'); return }
    if (await save([...links, link])) setInput('')
  }
  return <section className="space-y-2">
    <h2 className="text-sm font-semibold">Fix references</h2>
    {links.length > 0 && <ul className="space-y-1">{links.map(link => <li key={link} className="flex items-center gap-2 text-sm"><a href={link} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-brand underline">{link}</a><button type="button" aria-label={`Remove ${link}`} disabled={busy} onClick={() => void save(links.filter(item => item !== link))} className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-700">Remove</button></li>)}</ul>}
    <details className="text-xs">
      <summary className="cursor-pointer text-brand">Add GitHub fix reference</summary>
      <p className="mt-2 text-slate-500">Link a repository, pull request, or commit. BugsTow only stores the URL.</p>
      <div className="mt-2 flex flex-wrap gap-2"><input type="url" aria-label="GitHub fix URL" value={input} onChange={event => setInput(event.target.value)} placeholder="https://github.com/owner/repo/pull/123" className="min-w-48 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" /><button type="button" disabled={busy || !input.trim()} onClick={() => void add()} className="rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700">Add link</button></div>
    </details>
    {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
  </section>
}
