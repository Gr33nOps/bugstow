import React, { useEffect, useRef, useState } from 'react'
import { Cloud, Server, FolderSync, FileLock2, RefreshCw, AlertCircle, AlertTriangle, ArrowLeft, Check } from 'lucide-react'
import type { CloudSync, PendingConnection } from '../../../hooks/useCloudSync'
import type { ProviderId } from '../../../sync/types'
import { isDesktopEdition } from '../../../lib/teamServer'
import {
  PROVIDER_LABEL,
  connect,
  disconnect,
  probeExisting,
  testWebDav,
  exportSyncFile,
  importSyncFile,
  hasFileKey,
} from '../../../sync/controller'
import { GOOGLE_CLIENT_ID, DROPBOX_CLIENT_ID, startGoogleSignIn, startDropboxSignIn } from '../../../sync/oauth'
import { folderSyncSupported, pickFolder, type FsDirHandle } from '../../../sync/providers/folder'
import { triggerDownload } from '../../../services/backupService'

const MIN_PASSPHRASE = 10

/**
 * On a shared team server the strict CSP blocks connections to other hosts.
 * The installed desktop app allows them (server/src/app.ts).
 */
const onTeamServer = () =>
  typeof document !== 'undefined' &&
  document.querySelector('meta[name="bugstow-server"]')?.getAttribute('content') === 'team' &&
  !isDesktopEdition()

interface Option {
  id: ProviderId
  icon: React.ElementType
  what: string
  unavailable?: string
}

function options(): Option[] {
  const team = onTeamServer()
  const blockedHere = team
    ? 'Not available on a team server: its security policy only lets this page talk to the server itself. Use a synced folder or a sync file.'
    : undefined
  return [
    {
      id: 'gdrive',
      icon: Cloud,
      what: 'Syncs automatically on phones and computers. Stored in a hidden BugsTow folder in your Drive that only BugsTow can see. Google asks you to sign in again about once an hour; after that it is one tap.',
      unavailable: blockedHere ?? (GOOGLE_CLIENT_ID ? undefined : 'Not available in this copy of BugsTow: it was built without a Google client ID (see docs/CLOUD_SYNC.md).'),
    },
    {
      id: 'dropbox',
      icon: Cloud,
      what: 'Syncs automatically on phones and computers. Stored in Dropbox › Apps › BugsTow; BugsTow can’t see the rest of your Dropbox. Stays connected.',
      unavailable: blockedHere ?? (DROPBOX_CLIENT_ID ? undefined : 'Not available in this copy of BugsTow: it was built without a Dropbox app key (see docs/CLOUD_SYNC.md).'),
    },
    {
      id: 'webdav',
      icon: Server,
      what: 'A WebDAV server you run, such as Nextcloud, ownCloud or a Synology NAS. Syncs automatically. It must use https and allow this site (CORS). Hosted services like pCloud or Koofr usually block browser access; use a synced folder for those.',
      unavailable: blockedHere,
    },
    {
      id: 'folder',
      icon: FolderSync,
      what: 'For Mega, Terabox, OneDrive, iCloud Drive, or Google Drive / Dropbox for desktop: pick a folder their desktop app syncs. BugsTow writes there and your cloud app uploads it. Not automatic on phones.',
      unavailable: folderSyncSupported() ? undefined : 'Needs desktop Chrome or Edge. On a phone, use a sync file.',
    },
    {
      id: 'file',
      icon: FileLock2,
      what: 'Works with any cloud and any phone. Export one encrypted file, put it in your cloud, then import it on your other device to merge. Nothing happens automatically.',
    },
  ]
}

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000)
  if (s < 45) return 'just now'
  if (s < 90 * 60) return `${Math.max(1, Math.round(s / 60))} min ago`
  if (s < 36 * 3600) return `${Math.round(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString()
}

function whereText(provider: ProviderId, config: Record<string, unknown>): string {
  switch (provider) {
    case 'gdrive':
      return 'Hidden BugsTow folder in your Google Drive'
    case 'dropbox':
      return 'Dropbox › Apps › BugsTow'
    case 'webdav':
      return String(config.url || '')
    case 'folder':
      return `Folder “${(config.handle as FsDirHandle | undefined)?.name ?? ''}”`
    case 'file':
      return 'Sync file (manual)'
  }
}

const INPUT =
  'w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] text-slate-900 dark:text-white'
const LABEL = 'flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300'
const PRIMARY =
  'px-4 py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-50'
const SECONDARY =
  'px-4 py-2.5 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50'

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
      <AlertCircle size={14} className="shrink-0 mt-px" /> <span>{children}</span>
    </div>
  )
}

type Step = { kind: 'idle' } | { kind: 'webdav' } | { kind: 'passphrase'; draft: PendingConnection } | { kind: 'file' }

export function CloudSyncPanel({
  sync,
  onToast,
  onDataChanged,
}: {
  sync: CloudSync
  onToast: (m: string, t?: 'success' | 'error' | 'info') => void
  onDataChanged: () => void
}) {
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)

  // Returning from Google/Dropbox sign-in: ask for the passphrase.
  useEffect(() => {
    if (sync.pending) {
      setStep({ kind: 'passphrase', draft: sync.pending })
      sync.setPending(null)
    }
  }, [sync])

  const choose = async (id: ProviderId) => {
    setError(null)
    try {
      if (id === 'gdrive') return startGoogleSignIn()
      if (id === 'dropbox') return await startDropboxSignIn()
      if (id === 'webdav') return setStep({ kind: 'webdav' })
      if (id === 'file') return setStep({ kind: 'file' })
      if (id === 'folder') {
        const handle = await pickFolder()
        setStep({ kind: 'passphrase', draft: { provider: 'folder', config: { handle } } })
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // picker closed
      setError(e instanceof Error ? e.message : 'Could not start connecting.')
    }
  }

  const c = sync.connection
  const st = sync.status

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Sync</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3.5">
        See the same issues on your phone and computers through a cloud account you choose. Everything is encrypted
        with your passphrase on this device first; your cloud only stores unreadable files.
      </p>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        {step.kind === 'passphrase' ? (
          <PassphraseStep
            draft={step.draft}
            onCancel={() => setStep({ kind: 'idle' })}
            onDone={async existing => {
              setStep({ kind: 'idle' })
              await sync.reloadConnection()
              onToast(existing ? 'Connected. Getting your data from the cloud…' : 'Connected. Uploading your data…', 'info')
              await sync.sync(true)
            }}
          />
        ) : step.kind === 'webdav' ? (
          <WebDavStep
            onCancel={() => setStep({ kind: 'idle' })}
            onNext={cfg => setStep({ kind: 'passphrase', draft: { provider: 'webdav', config: cfg } })}
          />
        ) : step.kind === 'file' ? (
          <FileStep onBack={() => setStep({ kind: 'idle' })} onToast={onToast} onDataChanged={onDataChanged} />
        ) : c && c.provider !== 'file' ? (
          <div className="p-5 flex flex-col gap-3.5">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
                  {PROVIDER_LABEL[c.provider]}
                  <span className="font-normal text-slate-500 dark:text-slate-400"> · {st.running ? 'syncing…' : `synced ${ago(st.lastSyncAt)}`}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{whereText(c.provider, c.config)}</p>
                {st.lastResult && !st.lastError && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Last sync: {st.lastResult.uploaded} sent, {st.lastResult.downloaded} received
                    {st.lastResult.deletedHere + st.lastResult.deletedInCloud > 0 &&
                      `, ${st.lastResult.deletedHere + st.lastResult.deletedInCloud} removed`}
                    {st.lastResult.shotsPending > 0 && `, ${st.lastResult.shotsPending} screenshot(s) still uploading from another device`}.
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={st.running}
                onClick={() => {
                  sync.clearAttention()
                  sync.sync(true)
                }}
                className={`${SECONDARY} flex items-center gap-1.5 shrink-0`}
              >
                <RefreshCw size={14} className={st.running ? 'animate-spin motion-reduce:animate-none' : ''} /> Sync now
              </button>
            </div>

            {st.lastError && (
              <div role="alert" className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-100 flex flex-col gap-2">
                <p className="flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-px" /> <span>{st.lastError}</span>
                </p>
                {(c.provider === 'gdrive' || c.provider === 'dropbox') && /sign in|reconnect|revoked|expired/i.test(st.lastError) && (
                  <button type="button" onClick={() => choose(c.provider)} className="self-start text-xs font-semibold underline">
                    Reconnect {PROVIDER_LABEL[c.provider]}
                  </button>
                )}
                {c.provider === 'folder' && /allow/i.test(st.lastError) && (
                  <button type="button" onClick={() => sync.sync(true)} className="self-start text-xs font-semibold underline">
                    Allow folder access
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={async () => {
                if (!window.confirm('Stop syncing on this device? Your data stays on this device and in your cloud.')) return
                await disconnect()
                await sync.reloadConnection()
                onToast('Sync turned off on this device', 'info')
              }}
              className="self-start text-xs text-slate-500 hover:text-red-600 dark:text-slate-400"
            >
              Turn off sync on this device
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {error && (
              <div className="p-4">
                <ErrorBox>{error}</ErrorBox>
              </div>
            )}
            {options().map(o => {
              const Icon = o.icon
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={!!o.unavailable}
                  onClick={() => choose(o.id)}
                  className="w-full flex items-start gap-3.5 px-5 py-4 text-left enabled:hover:bg-slate-50 dark:enabled:hover:bg-slate-800/60 disabled:cursor-not-allowed"
                >
                  <Icon size={18} className="shrink-0 mt-0.5 text-slate-500 dark:text-slate-400" />
                  <span className="flex-1">
                    <span className={`text-[15px] font-semibold block ${o.unavailable ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                      {PROVIDER_LABEL[o.id]}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">{o.what}</span>
                    {o.unavailable && <span className="text-xs text-amber-700 dark:text-amber-400 block mt-1">{o.unavailable}</span>}
                  </span>
                  {!o.unavailable && <span className="text-slate-400 text-lg font-bold">&rsaquo;</span>}
                </button>
              )
            })}
            {c?.provider === 'file' && (
              <p className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                You're using a sync file (last merged {ago(st.lastSyncAt)}). Choose it again to export or import.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PassphraseStep({
  draft,
  onCancel,
  onDone,
}: {
  draft: PendingConnection
  onCancel: () => void
  onDone: (existing: boolean) => void
}) {
  const [existing, setExisting] = useState<boolean | null>(null)
  const [pass, setPass] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = PROVIDER_LABEL[draft.provider]

  useEffect(() => {
    let alive = true
    probeExisting(draft)
      .then(e => alive && setExisting(e))
      .catch(e => alive && setError(e instanceof Error ? e.message : `Could not open ${label}.`))
    return () => {
      alive = false
    }
  }, [draft, label])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (pass.length < MIN_PASSPHRASE) return setError(`Use at least ${MIN_PASSPHRASE} characters.`)
    if (!existing && pass !== repeat) return setError('The two passphrases don’t match.')
    setBusy(true)
    try {
      const r = await connect({ ...draft, connectedAt: new Date().toISOString() }, pass)
      onDone(r.existing)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="p-5 flex flex-col gap-3.5">
      <button type="button" onClick={onCancel} className="self-start flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft size={13} /> Back
      </button>
      {existing === null && !error && <p className="text-sm text-slate-500">Checking {label}…</p>}
      {existing !== null && (
        <>
          <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
            {existing ? 'Enter your sync passphrase' : 'Create a sync passphrase'}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {existing
              ? `${label} already has BugsTow data from another device. Enter the passphrase you chose there; this device's issues will be merged with it.`
              : 'BugsTow encrypts everything with this passphrase before it leaves this device. You’ll enter it once on each device you sync. If you forget it, the cloud copy can’t be opened (the data on this device isn’t affected).'}
          </p>
        </>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      {existing !== null && (
        <>
          <label className={LABEL}>
            Passphrase
            <input type="password" autoComplete={existing ? 'current-password' : 'new-password'} autoFocus value={pass} onChange={e => setPass(e.target.value)} className={INPUT} />
          </label>
          {!existing && (
            <label className={LABEL}>
              Repeat passphrase
              <input type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} className={INPUT} />
            </label>
          )}
          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? 'Setting up encryption…' : existing ? 'Unlock and sync' : 'Start syncing'}
          </button>
        </>
      )}
    </form>
  )
}

function WebDavStep({ onCancel, onNext }: { onCancel: () => void; onNext: (cfg: { url: string; username: string; password: string }) => void }) {
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const cfg = { url: url.trim(), username: username.trim(), password }
      await testWebDav(cfg)
      onNext(cfg)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="p-5 flex flex-col gap-3.5">
      <button type="button" onClick={onCancel} className="self-start flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft size={13} /> Back
      </button>
      <p className="text-[15px] font-semibold text-slate-900 dark:text-white">Connect a WebDAV folder</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Create an empty folder for BugsTow first. Use an <strong>app password</strong> (in Nextcloud: Settings → Security),
        not your main password, so you can revoke it on its own. It is stored on this device only.
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}
      <label className={LABEL}>
        Folder address
        <input type="url" required inputMode="url" autoComplete="url" placeholder="https://cloud.example.com/remote.php/dav/files/you/BugsTow" value={url} onChange={e => setUrl(e.target.value)} className={INPUT} />
      </label>
      <label className={LABEL}>
        Username
        <input type="text" required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className={INPUT} />
      </label>
      <label className={LABEL}>
        App password
        <input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={INPUT} />
      </label>
      <button type="submit" disabled={busy} className={PRIMARY}>
        {busy ? 'Checking…' : 'Continue'}
      </button>
    </form>
  )
}

function FileStep({
  onBack,
  onToast,
  onDataChanged,
}: {
  onBack: () => void
  onToast: (m: string, t?: 'success' | 'error' | 'info') => void
  onDataChanged: () => void
}) {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [pass, setPass] = useState('')
  const [repeat, setRepeat] = useState('')
  const [askPass, setAskPass] = useState<'export' | 'import' | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [merged, setMerged] = useState<Blob | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    hasFileKey().then(setHasKey)
  }, [])

  const fileName = () => `bugstow-sync-${new Date().toISOString().slice(0, 10)}.bugstow-sync`

  const doExport = async (passphrase?: string) => {
    setError(null)
    setBusy(true)
    try {
      triggerDownload(await exportSyncFile(passphrase), fileName())
      setAskPass(null)
      setHasKey(true)
      onToast('Sync file saved. Upload it to your cloud.')
    } catch (e) {
      if (e instanceof Error && e.name === 'PassphraseNeededError') setAskPass('export')
      else setError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  const doImport = async (file: File, passphrase?: string) => {
    setError(null)
    setBusy(true)
    try {
      const { result, merged } = await importSyncFile(file, passphrase, async ({ here, total }) =>
        window.confirm(`Importing this file would delete ${here} of ${total} items on this device. Continue?`)
      )
      setAskPass(null)
      setPendingFile(null)
      setHasKey(true)
      setMerged(merged)
      setSummary(`Merged: ${result.downloaded} received, ${result.uploaded} added from this device, ${result.deletedHere} removed here.`)
      onDataChanged()
    } catch (e) {
      if (e instanceof Error && e.name === 'PassphraseNeededError') {
        setPendingFile(file)
        setAskPass('import')
      } else setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  const submitPass = (e: React.FormEvent) => {
    e.preventDefault()
    if (pass.length < MIN_PASSPHRASE) return setError(`Use at least ${MIN_PASSPHRASE} characters.`)
    if (askPass === 'export' && pass !== repeat) return setError('The two passphrases don’t match.')
    if (askPass === 'export') doExport(pass)
    else if (pendingFile) doImport(pendingFile, pass)
  }

  return (
    <div className="p-5 flex flex-col gap-3.5">
      <button type="button" onClick={onBack} className="self-start flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft size={13} /> Back
      </button>
      <p className="text-[15px] font-semibold text-slate-900 dark:text-white">Sync with a file</p>
      <ol className="text-sm text-slate-600 dark:text-slate-300 list-decimal pl-5 space-y-1">
        <li>Export a sync file here and upload it to any cloud (Mega, Terabox, Drive, OneDrive…).</li>
        <li>On your other device, open BugsTow → Settings → Sync → Sync file → Import, and pick that file.</li>
        <li>To send changes back, export from that device and import here.</li>
      </ol>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        The file is encrypted with your sync passphrase. Deletions carry over too, and an edit always wins over a delete.
      </p>
      {error && <ErrorBox>{error}</ErrorBox>}

      {askPass ? (
        <form onSubmit={submitPass} className="flex flex-col gap-3">
          <label className={LABEL}>
            {askPass === 'export' ? 'Create a sync passphrase' : 'Sync passphrase for this file'}
            <input type="password" autoFocus autoComplete={askPass === 'export' ? 'new-password' : 'current-password'} value={pass} onChange={e => setPass(e.target.value)} className={INPUT} />
          </label>
          {askPass === 'export' && (
            <label className={LABEL}>
              Repeat passphrase
              <input type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} className={INPUT} />
            </label>
          )}
          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? 'Working…' : askPass === 'export' ? 'Encrypt and export' : 'Unlock and merge'}
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || hasKey === null} onClick={() => doExport()} className={PRIMARY}>
            Export sync file
          </button>
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={SECONDARY}>
            Import sync file
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) doImport(f)
            }}
          />
        </div>
      )}

      {summary && (
        <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
          <p className="flex items-start gap-2">
            <Check size={15} className="shrink-0 mt-0.5 text-emerald-600" /> {summary}
          </p>
          {merged && (
            <button type="button" onClick={() => triggerDownload(merged, fileName())} className={`${SECONDARY} self-start`}>
              Download merged file to upload back
            </button>
          )}
        </div>
      )}
    </div>
  )
}
