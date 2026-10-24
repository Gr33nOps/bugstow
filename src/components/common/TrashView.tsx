import { useState } from 'react'

interface TrashItem { id: string; title: string; deletedAt?: string | null }

export function TrashView({ issues, onRestore, onPurge }: {
  issues: TrashItem[]
  onRestore: (id: string) => Promise<void>
  onPurge: (id: string) => Promise<void>
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const run = async (id: string, action: (id: string) => Promise<void>) => {
    setBusyId(id)
    setError('')
    try { await action(id) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not update Trash') }
    finally { setBusyId(null) }
  }
  return <section aria-label="Trash" className="flex-1 overflow-y-auto bg-white p-6 dark:bg-slate-900">
    <h1 className="text-xl font-semibold">Trash</h1>
    <p className="mt-1 text-sm text-slate-500">Issues stay here until you permanently delete them. Their screenshots and details can be restored.</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    {issues.length === 0 && <p className="mt-8 text-sm text-slate-500">Trash is empty.</p>}
    <ul className="mt-5 divide-y divide-slate-200 dark:divide-slate-700">
      {issues.map(issue => <li key={issue.id} className="flex flex-wrap items-center gap-3 py-3">
        <span className="min-w-0 flex-1 break-words text-sm">{issue.title}</span>
        <button type="button" disabled={busyId !== null} onClick={() => void run(issue.id, onRestore)} className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700">Restore</button>
        <button type="button" disabled={busyId !== null} onClick={() => { if (window.confirm(`Permanently delete “${issue.title}” and its screenshots? This cannot be undone.`)) void run(issue.id, onPurge) }} className="rounded border border-red-400 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50 dark:text-red-300">Delete permanently</button>
      </li>)}
    </ul>
  </section>
}
