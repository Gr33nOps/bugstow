import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X, ExternalLink, Check, AlertCircle, KeyRound, ChevronDown } from 'lucide-react'
import { GithubMark } from '../../common/Icon'
import {
  parseRepo,
  tokenCreateUrl,
  importErrorMessage,
  type GithubImportErrorCode,
  type GithubRepoRef,
  type ImportSummary,
  type ImportTarget,
} from '../../../services/githubImport'

const KNOWN_CODES: GithubImportErrorCode[] = [
  'INVALID_REPO',
  'NEEDS_TOKEN',
  'BAD_TOKEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'OFFLINE',
  'NETWORK',
]
/** Errors that a key fixes: the dialog then shows the key step. */
const KEY_CODES: GithubImportErrorCode[] = ['NEEDS_TOKEN', 'BAD_TOKEN', 'NOT_FOUND']

export interface GithubImportRequest {
  repo: GithubRepoRef
  token?: string
  includeClosed: boolean
  target: ImportTarget
}

const INPUT_CLS =
  'w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] focus:ring-2 focus:ring-[#5B50F6]/15 text-slate-900 dark:text-white placeholder:text-slate-400'

/**
 * Import issues from a GitHub repository. The same dialog in every mode; the
 * caller decides how the import runs (browser or BugsTow server).
 *
 * Public repositories import with just a link. A key is only asked for when
 * GitHub says it's needed, with the steps to make one right there.
 */
export function GithubImportModal({
  projects,
  onImport,
  onClose,
  onShowResult,
}: {
  projects: Array<{ id: string; name: string }>
  onImport: (req: GithubImportRequest) => Promise<ImportSummary>
  onClose: () => void
  /** Called with the project the issues went into, to show them. */
  onShowResult?: (projectId: string | null) => void
}) {
  const [link, setLink] = useState('')
  const [targetChoice, setTargetChoice] = useState<string>('auto') // 'auto' | 'none' | project id
  const [includeClosed, setIncludeClosed] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ code?: GithubImportErrorCode; text: string } | null>(null)
  const [done, setDone] = useState<{ summary: ImportSummary; repo: GithubRepoRef; projectName: string | null } | null>(
    null
  )
  const keyInputRef = useRef<HTMLInputElement>(null)

  const repo = useMemo(() => parseRepo(link), [link])
  // Importing the same repository again goes into the project it went to before.
  const sameNameProject = repo ? projects.find(p => p.name.toLowerCase() === repo.name.toLowerCase()) : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const target = (): ImportTarget => {
    if (targetChoice === 'none') return { kind: 'none' }
    if (targetChoice !== 'auto') return { kind: 'existing', id: targetChoice }
    if (sameNameProject) return { kind: 'existing', id: sameNameProject.id }
    return repo ? { kind: 'new', name: repo.name } : { kind: 'none' }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repo) {
      setError({ code: 'INVALID_REPO', text: importErrorMessage('INVALID_REPO') })
      return
    }
    // GitHub already said a key is needed and none was pasted: point at the box
    // instead of asking GitHub again. (An empty box otherwise just means "try
    // without a key", which is right for public repositories.)
    if (!token.trim() && error?.code && KEY_CODES.includes(error.code)) {
      keyInputRef.current?.focus()
      return
    }
    setError(null)
    setBusy(true)
    try {
      const t = target()
      const summary = await onImport({ repo, token: token.trim() || undefined, includeClosed, target: t })
      const projectName =
        t.kind === 'new'
          ? summary.projectId
            ? t.name
            : null
          : t.kind === 'existing'
            ? (projects.find(p => p.id === t.id)?.name ?? null)
            : null
      setToken('') // used for this import only
      setDone({ summary, repo, projectName })
    } catch (err) {
      const raw = (err as { code?: string }).code
      const code = KNOWN_CODES.includes(raw as GithubImportErrorCode) ? (raw as GithubImportErrorCode) : undefined
      if (code && KEY_CODES.includes(code)) {
        setShowKey(true)
        setTimeout(() => keyInputRef.current?.focus(), 0)
      }
      setError({ code, text: code ? importErrorMessage(code) : err instanceof Error ? err.message : 'Import failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="gh-import-title">
      <div className="absolute inset-0 bg-black/45 dark:bg-black/70" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl text-slate-900 dark:text-slate-100">
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0">
              <GithubMark size={20} />
            </span>
            <div>
              <h2 id="gh-import-title" className="text-lg font-bold leading-tight">
                Import issues from GitHub
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Each GitHub issue becomes a BugsTow issue, linked back to GitHub.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          <DoneView
            done={done}
            includeClosed={includeClosed}
            onClose={onClose}
            onShow={onShowResult ? () => onShowResult(done.summary.projectId) : undefined}
            onAnother={() => {
              setDone(null)
              setLink('')
              setTargetChoice('auto')
              setShowKey(false)
            }}
          />
        ) : (
          <form onSubmit={submit} className="px-6 pb-6 pt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Repository</span>
              <input
                autoFocus
                value={link}
                onChange={e => {
                  setLink(e.target.value)
                  setError(null)
                }}
                placeholder="https://github.com/owner/repository"
                spellCheck={false}
                autoComplete="off"
                className={INPUT_CLS}
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {repo ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <Check size={13} /> {repo.full}
                  </span>
                ) : (
                  'Paste the link from your browser, or type owner/name.'
                )}
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Put them in</span>
              <span className="relative block">
                <select
                  value={targetChoice}
                  onChange={e => setTargetChoice(e.target.value)}
                  className={`${INPUT_CLS} appearance-none pr-9 cursor-pointer`}
                >
                  <option value="auto">
                    {sameNameProject
                      ? `${sameNameProject.name} (same project as before)`
                      : repo
                        ? `A new project called "${repo.name}"`
                        : 'A new project named after the repository'}
                  </option>
                  {projects
                    .filter(p => p.id !== sameNameProject?.id)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  <option value="none">No project</option>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeClosed}
                onChange={e => setIncludeClosed(e.target.checked)}
                className="w-4 h-4 accent-[#5B50F6]"
              />
              Also bring in closed issues (they're marked Fixed)
            </label>

            {showKey ? (
              <KeyStep
                repo={repo}
                token={token}
                setToken={setToken}
                inputRef={keyInputRef}
                reason={error?.code && KEY_CODES.includes(error.code) ? error.text : undefined}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowKey(true)
                  setTimeout(() => keyInputRef.current?.focus(), 0)
                }}
                className="self-start inline-flex items-center gap-1.5 text-sm font-medium text-[#5B50F6] dark:text-indigo-400 hover:underline"
              >
                <KeyRound size={14} /> Private repository? Add a key
              </button>
            )}

            {error && !(error.code && KEY_CODES.includes(error.code)) && (
              <div
                role="alert"
                className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-start gap-2"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error.text}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !link.trim()}
                className="flex-[2] inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-50"
              >
                <GithubMark size={15} />
                {busy ? 'Importing…' : 'Import issues'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function KeyStep({
  repo,
  token,
  setToken,
  inputRef,
  reason,
}: {
  repo: GithubRepoRef | null
  token: string
  setToken: (v: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  /** Why the key is needed now (GitHub's answer), shown at the top. */
  reason?: string
}) {
  return (
    <div
      role={reason ? 'alert' : undefined}
      className={`rounded-xl border p-4 flex flex-col gap-3 ${
        reason
          ? 'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'
      }`}
    >
      <p className="text-sm font-semibold flex items-center gap-1.5">
        <KeyRound size={15} className="text-[#5B50F6] dark:text-indigo-400" /> Add a read-only key from GitHub
      </p>
      {reason && <p className="text-sm text-amber-900 dark:text-amber-200 -mt-1">{reason}</p>}
      <ol className="text-sm text-slate-600 dark:text-slate-300 flex flex-col gap-2.5 list-decimal pl-5">
        <li>
          <a
            href={tokenCreateUrl(repo)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90"
          >
            <GithubMark size={14} /> Create a key on GitHub <ExternalLink size={13} />
          </a>
        </li>
        <li>
          On that page, under <strong>Repository access</strong> choose <strong>Only select repositories</strong>
          {repo ? (
            <>
              {' '}
              and pick <strong>{repo.name}</strong>
            </>
          ) : null}
          . Under <strong>Permissions</strong>, set <strong>Issues</strong> to <strong>Read-only</strong>. Then click{' '}
          <strong>Generate token</strong>.
        </li>
        <li>
          Copy the key and paste it here:
          <input
            ref={inputRef}
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="github_pat_…"
            autoComplete="off"
            spellCheck={false}
            aria-label="GitHub key"
            className={`${INPUT_CLS} mt-2 font-mono`}
          />
        </li>
      </ol>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        The key is used for this import only. BugsTow doesn't save it, and it can only read issues.
      </p>
    </div>
  )
}

function DoneView({
  done,
  includeClosed,
  onClose,
  onShow,
  onAnother,
}: {
  done: { summary: ImportSummary; repo: GithubRepoRef; projectName: string | null }
  includeClosed: boolean
  onClose: () => void
  onShow?: () => void
  onAnother: () => void
}) {
  const { imported, updated, unchanged } = done.summary
  const total = imported + updated + unchanged
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  const headline =
    total === 0
      ? `${done.repo.full} has no ${includeClosed ? '' : 'open '}issues to import.`
      : imported > 0
        ? `Imported ${plural(imported, 'issue')} from ${done.repo.full}`
        : `Everything from ${done.repo.full} is already here`
  return (
    <div className="px-6 pb-6 pt-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
          <Check size={18} />
        </span>
        <div className="text-sm">
          <p className="font-semibold text-base">{headline}</p>
          <ul className="mt-1.5 text-slate-600 dark:text-slate-300 flex flex-col gap-0.5">
            {imported > 0 && done.projectName && <li>Into the project “{done.projectName}”.</li>}
            {updated > 0 && (
              <li>
                {plural(updated, 'issue')} imported before now {updated === 1 ? 'matches' : 'match'} GitHub's open/closed
                state.
              </li>
            )}
            {unchanged > 0 && (
              <li>
                {plural(unchanged, 'issue')} {unchanged === 1 ? 'was' : 'were'} already up to date.
              </li>
            )}
          </ul>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Import the same repository again anytime to pick up new issues. Nothing is duplicated.
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onAnother}
          className="flex-1 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Import another
        </button>
        <button
          type="button"
          onClick={() => {
            onShow?.()
            onClose()
          }}
          className="flex-[2] py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl"
        >
          {onShow && total > 0 ? 'Show the issues' : 'Done'}
        </button>
      </div>
    </div>
  )
}
