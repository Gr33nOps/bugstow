import { useEffect, useRef, useState } from 'react'
import { parseRepo } from '../../../services/githubImport'
import type { ExportIssue, ExportSummary } from '../../../../server/src/githubExport'

export function GithubExportModal({ issues, projects, onExport, onClose }: {
  issues: Array<ExportIssue & { projectId: string | null }>
  projects: Array<{ id: string; name: string }>
  onExport: (repo: string, token: string, issueIds: string[]) => Promise<ExportSummary>
  onClose: () => void
}) {
  const [repoInput, setRepoInput] = useState('')
  const [token, setToken] = useState('')
  const [project, setProject] = useState('all')
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [result, setResult] = useState<ExportSummary | null>(null)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const selected = issues.filter(i => project === 'all' || i.projectId === project)
  const count = selected.filter(i => !i.githubUrl).length
  const repo = parseRepo(repoInput)
  const cls = 'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2'
  return <dialog ref={dialog} onCancel={e => { e.preventDefault(); if (!running.current) onClose() }} className="m-auto w-full max-w-lg rounded-xl bg-white p-6 text-slate-900 shadow-xl backdrop:bg-black/50 dark:bg-slate-900 dark:text-white">
    <form onSubmit={async e => {
      e.preventDefault()
      if (!repo || running.current) return
      running.current = true; setBusy(true); setError(''); setResult(null)
      try { setResult(await onExport(repo.full, token, selected.map(i => i.id))) }
      catch (err) { setError(err instanceof Error ? err.message : 'Export failed. Check GitHub before retrying.') }
      finally { setToken(''); running.current = false; setBusy(false) }
    }} className="space-y-4">
      <h2 className="text-lg font-semibold">Export to GitHub</h2>
      <p className="text-sm">Creates issues in the repository you choose. Titles, descriptions, types and status leave BugsTow. Anyone with access to that repository can read them. Screenshots stay in BugsTow.</p>
      <label className="block text-sm">Issues to export<select disabled={busy} value={project} onChange={e => setProject(e.target.value)} className={cls}><option value="all">All issues</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="block text-sm">GitHub repository<input required disabled={busy} value={repoInput} onChange={e => setRepoInput(e.target.value)} placeholder="owner/repository" className={cls} /></label>
      <label className="block text-sm">Personal access token<input required type="password" autoComplete="off" disabled={busy} value={token} onChange={e => setToken(e.target.value)} className={cls} /></label>
      <p className="text-sm">Use a <a className="underline" href="https://github.com/settings/personal-access-tokens/new?name=BugsTow%20export&issues=write" target="_blank" rel="noreferrer">fine-grained token</a> with this repository selected and <strong>Issues: Read and write</strong>. The token is used for this export and is never saved.</p>
      <p className="text-sm">{count} issues to create; {selected.length - count} already linked issues will be skipped. Completed issues are closed on GitHub after creation.</p>
      {busy && <p role="status">Exporting… Keep this window open.</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {result && <div role="status"><p>{result.exported} exported, {result.skipped} skipped.</p>{result.error && <p className="text-red-600">{result.error}</p>}{result.warnings.map(w => <p key={w}>{w}</p>)}</div>}
      <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose}>Close</button><button disabled={busy || !repo || !token.trim() || count === 0} className="rounded-lg bg-brand px-4 py-2 text-white disabled:opacity-50">Export {count} issues</button></div>
    </form>
  </dialog>
}
