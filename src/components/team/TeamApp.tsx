import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus,
  Users,
  GitBranch,
  LogOut,
  ChevronDown,
  Bug,
  Palette,
  Lightbulb,
  Check,
  Trash2,
  X,
  ImagePlus,
  Copy,
  AlertCircle,
  ExternalLink,
  UserCircle2,
  HardDrive,
  Upload,
  WifiOff,
  KeyRound,
  RefreshCw,
  AlertTriangle,
  Archive,
} from 'lucide-react'
import { useTeamData } from '../../hooks/useTeamData'
import { signOut, authClient } from '../../lib/authClient'
import { getMe, resetUserPassword, IssueConflictError, listBackups, runBackupNow, type BackupStatus } from '../../services/teamApi'
import { connectionKind } from '../../lib/connection'
import { generateIssuePrompt } from '../../services/promptService'
import { validateBackupStructure, decryptBackup } from '../../services/backupService'
import { migrateBackupToTeam } from '../../services/teamMigration'
import type { IssueType, BackupData, EncryptedBackupPayload } from '../../types'
import type { TeamIssue, TeamMember, CurrentUser } from '../../types/team'

const TYPE_META: Record<IssueType, { label: string; icon: React.ElementType; cls: string }> = {
  bug: { label: 'Bug', icon: Bug, cls: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300' },
  uiux: { label: 'UI/UX', icon: Palette, cls: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300' },
  idea: { label: 'Idea', icon: Lightbulb, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300' },
}

function initials(name: string | null, email: string | null): string {
  const src = (name || email || '?').trim()
  const parts = src.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase()
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] || ''
      resolve({ base64, mimeType: file.type || 'image/png' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface TeamAppProps {
  onUseLocal: () => void
  userLabel: string
  offline?: boolean
}

/**
 * Loads the signed-in user first: after an admin password reset the server
 * refuses every other request until a new password is chosen, so that screen
 * must come before the workspace.
 */
export function TeamApp(props: TeamAppProps) {
  const [me, setMe] = useState<CurrentUser | null>(null)
  const [meError, setMeError] = useState<string | null>(null)

  const loadMe = () => {
    setMeError(null)
    getMe()
      .then(setMe)
      .catch(e => setMeError(e instanceof Error ? e.message : 'Could not reach the team server.'))
  }
  useEffect(loadMe, [])

  if (meError) {
    return (
      <CenteredPanel>
        <h1 className="text-lg font-bold">Can't load your account</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{meError}</p>
        <div className="flex gap-2">
          <button type="button" onClick={loadMe} className="px-4 py-2 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl">
            Try again
          </button>
          <button type="button" onClick={() => signOut()} className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
            Sign out
          </button>
        </div>
      </CenteredPanel>
    )
  }
  if (!me) {
    return <div className="h-full flex items-center justify-center text-sm text-slate-500">Loading…</div>
  }
  if (me.mustChangePassword) {
    return (
      <CenteredPanel>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <KeyRound size={18} /> Choose a new password
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your password was reset by the server administrator. Enter the temporary password they gave you, then pick
          a new one that only you know.
        </p>
        <PasswordForm
          currentLabel="Temporary password"
          submitLabel="Set new password"
          onDone={() => setMe({ ...me, mustChangePassword: false })}
        />
        <button type="button" onClick={() => signOut()} className="self-start text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          Sign out instead
        </button>
      </CenteredPanel>
    )
  }
  return <Workspace {...props} me={me} />
}

function CenteredPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-sm flex flex-col gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        {children}
      </div>
    </div>
  )
}

function Workspace({ onUseLocal, userLabel, offline = false, me }: TeamAppProps & { me: CurrentUser }) {
  const data = useTeamData(true)
  const {
    teams,
    activeTeam,
    activeTeamId,
    setActiveTeamId,
    projects,
    issues,
    members,
    loading,
    error,
  } = data

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<IssueType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'open' | 'fixed' | 'all'>('open')
  const [showNew, setShowNew] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showMigrate, setShowMigrate] = useState(false)
  const [showTeamMenu, setShowTeamMenu] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showBackups, setShowBackups] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  const filtered = useMemo(
    () =>
      issues.filter(
        i =>
          (typeFilter === 'all' || i.type === typeFilter) &&
          (statusFilter === 'all' || i.status === statusFilter)
      ),
    [issues, typeFilter, statusFilter]
  )

  const selected = issues.find(i => i.id === selectedId) || null

  // No team yet → onboarding.
  if (!loading && teams.length === 0) {
    return <CreateFirstTeam onCreate={data.createTeam} onUseLocal={onUseLocal} error={error} />
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top bar */}
      <header className="flex items-center gap-2 px-4 h-14 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur-sm shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTeamMenu(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm"
          >
            <span className="w-6 h-6 rounded-lg bg-[#5B50F6] text-white flex items-center justify-center text-xs">
              {activeTeam ? activeTeam.name.slice(0, 1).toUpperCase() : '?'}
            </span>
            {activeTeam?.name || 'Select team'}
            <ChevronDown size={15} className="text-slate-400" />
          </button>
          {showTeamMenu && (
            <div
              className="absolute z-30 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1"
              onMouseLeave={() => setShowTeamMenu(false)}
            >
              {teams.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTeamId(t.id)
                    setSelectedId(null)
                    setShowTeamMenu(false)
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span>{t.name}</span>
                  {t.id === activeTeamId && <Check size={14} className="text-[#5B50F6]" />}
                </button>
              ))}
              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
              <CreateTeamInline
                onCreate={async name => {
                  await data.createTeam(name)
                  setShowTeamMenu(false)
                }}
              />
            </div>
          )}
        </div>

        {offline && (
          <span
            title="This server runs in offline mode. All features work locally; only GitHub import is disabled."
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
          >
            <WifiOff size={12} /> Offline
          </span>
        )}

        <div className="flex-1" />

        {!offline && (
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <GitBranch size={16} /> Import
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowMembers(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
        >
          <Users size={16} /> <span className="hidden sm:inline">Members</span>
        </button>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl bg-[#5B50F6] hover:bg-[#4E44E6] text-white shadow-sm"
        >
          <Plus size={16} /> <span className="hidden sm:inline">New Issue</span>
        </button>

        {connectionKind() === 'lan-http' && (
          <span
            title="This server uses plain HTTP. Passwords and issues cross the network unencrypted. Ask the administrator to turn on HTTPS."
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-950/60"
          >
            <AlertTriangle size={12} /> Not encrypted
          </span>
        )}
        <UserMenu
          label={userLabel}
          onUseLocal={onUseLocal}
          onImportPersonal={() => setShowMigrate(true)}
          onChangePassword={() => setShowChangePassword(true)}
          onBackups={me.isServerAdmin ? () => setShowBackups(true) : undefined}
        />
      </header>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 text-xs overflow-x-auto">
        {(['open', 'fixed', 'all'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1 rounded-lg font-medium capitalize ${
              statusFilter === s ? 'bg-[#5B50F6] text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {s}
          </button>
        ))}
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
        {(['all', 'bug', 'uiux', 'idea'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={`px-2.5 py-1 rounded-lg font-medium ${
              typeFilter === t ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t === 'all' ? 'All types' : TYPE_META[t].label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        <div className={`${selected ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[380px] border-r border-slate-200 dark:border-slate-800 overflow-y-auto`}>
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">No issues here yet.</div>
          ) : (
            filtered.map(issue => (
              <button
                key={issue.id}
                type="button"
                onClick={() => setSelectedId(issue.id)}
                className={`text-left px-4 py-3 border-b border-slate-100 dark:border-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                  selectedId === issue.id ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <TypeBadge type={issue.type} />
                  {issue.status === 'fixed' && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">FIXED</span>
                  )}
                  {issue.github_number != null && (
                    <span className="text-[10px] text-slate-400">#{issue.github_number}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2">{issue.title}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                  {issue.project_name && <span>{issue.project_name}</span>}
                  {issue.screenshot_count > 0 && <span>· {issue.screenshot_count} img</span>}
                  <span className="flex-1" />
                  {issue.assignee_id && (
                    <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-bold flex items-center justify-center text-slate-600 dark:text-slate-200">
                      {initials(issue.assignee_name, issue.assignee_email)}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 min-w-0`}>
          {selected ? (
            <IssueDetail
              key={selected.id}
              issue={selected}
              members={members}
              projects={projects}
              loadScreenshotUrl={data.loadScreenshotUrl}
              onUpdate={data.updateIssue}
              onReload={data.replaceIssue}
              onDelete={async id => {
                await data.deleteIssue(id)
                setSelectedId(null)
                notify('Issue deleted')
              }}
              onClose={() => setSelectedId(null)}
              onToast={notify}
            />
          ) : (
            <div className="flex-1 hidden md:flex items-center justify-center text-sm text-slate-400">
              Select an issue to view details
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewIssueModal
          projects={projects}
          members={members}
          onCreate={data.createIssue}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false)
            notify('Issue created')
          }}
        />
      )}
      {showMembers && activeTeam && (
        <MembersModal
          role={activeTeam.role}
          me={me}
          members={members}
          invites={data.invites}
          onInvite={data.inviteMember}
          onRemove={data.removeMember}
          onClose={() => setShowMembers(false)}
          onToast={notify}
        />
      )}
      {showImport && (
        <ImportModal
          projects={projects}
          onImport={data.importGithub}
          onClose={() => setShowImport(false)}
          onToast={notify}
        />
      )}
      {showMigrate && activeTeamId && (
        <MigrateModal
          teamId={activeTeamId}
          teamName={activeTeam?.name || 'this team'}
          onClose={() => setShowMigrate(false)}
          onDone={async summary => {
            setShowMigrate(false)
            await data.reload()
            notify(`Imported ${summary.projects} projects, ${summary.issues} issues`)
          }}
          onToast={notify}
        />
      )}

      {showBackups && <BackupsModal onClose={() => setShowBackups(false)} />}

      {showChangePassword && (
        <ModalShell onClose={() => setShowChangePassword(false)}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Change password</h3>
              <button type="button" aria-label="Close" onClick={() => setShowChangePassword(false)} className="text-slate-400">
                <X size={16} />
              </button>
            </div>
            <PasswordForm
              currentLabel="Current password"
              submitLabel="Change password"
              onDone={() => {
                setShowChangePassword(false)
                notify('Password changed. Other devices were signed out.')
              }}
            />
          </div>
        </ModalShell>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm shadow-lg dark:bg-white dark:text-slate-900">
          {toast}
        </div>
      )}
    </div>
  )
}

function TypeBadge({ type }: { type: IssueType }) {
  const m = TYPE_META[type]
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${m.cls}`}>
      <Icon size={11} /> {m.label}
    </span>
  )
}

function UserMenu({
  label,
  onUseLocal,
  onImportPersonal,
  onChangePassword,
  onBackups,
}: {
  label: string
  onUseLocal: () => void
  onImportPersonal: () => void
  onChangePassword: () => void
  /** Only for the server administrator. */
  onBackups?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200"
        title={label}
      >
        <UserCircle2 size={20} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg py-1"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-3 py-2 text-xs text-slate-400 truncate">{label}</div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onImportPersonal()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Upload size={15} /> Import personal data
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onChangePassword()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <KeyRound size={15} /> Change password
          </button>
          {onBackups && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onBackups()
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Archive size={15} /> Backups
            </button>
          )}
          <button
            type="button"
            onClick={onUseLocal}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <HardDrive size={15} /> Switch to local
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function CreateTeamInline({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      onSubmit={async e => {
        e.preventDefault()
        if (!name.trim()) return
        setBusy(true)
        try {
          await onCreate(name.trim())
          setName('')
        } finally {
          setBusy(false)
        }
      }}
      className="px-2 py-1.5 flex gap-1.5"
    >
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="New team name"
        className="flex-1 px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#5B50F6]"
      />
      <button
        type="submit"
        disabled={busy}
        className="px-2 py-1 text-sm font-semibold text-white bg-[#5B50F6] rounded-lg disabled:opacity-50"
      >
        <Plus size={16} />
      </button>
    </form>
  )
}

function CreateFirstTeam({
  onCreate,
  onUseLocal,
  error,
}: {
  onCreate: (name: string) => Promise<unknown>
  onUseLocal: () => void
  error: string | null
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="h-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <form
        onSubmit={async e => {
          e.preventDefault()
          if (!name.trim()) return
          setBusy(true)
          setErr(null)
          try {
            await onCreate(name.trim())
          } catch (e2) {
            setErr(e2 instanceof Error ? e2.message : 'Could not create team.')
          } finally {
            setBusy(false)
          }
        }}
        className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-7 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[#5B50F6]">
            <Users size={18} />
          </div>
          <h1 className="text-lg font-bold">Create your first team</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          A team is a shared workspace. Invite people and assign issues once it exists.
        </p>
        {(err || error) && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300">
            {err || error}
          </div>
        )}
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Acme Web"
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6]"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create team'}
        </button>
        <button type="button" onClick={onUseLocal} className="text-xs text-slate-400 hover:text-slate-600">
          Use local mode instead
        </button>
      </form>
    </div>
  )
}

// ── Issue detail ─────────────────────────────────────────────────────────────
function IssueDetail({
  issue,
  members,
  projects,
  loadScreenshotUrl,
  onUpdate,
  onReload,
  onDelete,
  onClose,
  onToast,
}: {
  issue: TeamIssue
  members: TeamMember[]
  projects: { id: string; name: string }[]
  loadScreenshotUrl: (id: string) => Promise<string | undefined>
  onUpdate: (
    id: string,
    updates: Partial<{ title: string; description: string; type: IssueType; status: 'open' | 'fixed'; projectId: string | null; assigneeId: string | null }>
  ) => Promise<TeamIssue>
  onReload: (latest: TeamIssue) => void
  onDelete: (id: string) => Promise<void>
  onClose: () => void
  onToast: (m: string) => void
}) {
  const [conflict, setConflict] = useState<TeamIssue | null>(null)
  const [title, setTitle] = useState(issue.title)
  const [description, setDescription] = useState(issue.description)
  const [shots, setShots] = useState<string[]>([])

  useEffect(() => {
    setTitle(issue.title)
    setDescription(issue.description)
  }, [issue.id, issue.title, issue.description])

  useEffect(() => {
    let alive = true
    Promise.all(issue.screenshot_ids.map(id => loadScreenshotUrl(id))).then(urls => {
      if (alive) setShots(urls.filter((u): u is string => Boolean(u)))
    })
    return () => {
      alive = false
    }
  }, [issue.screenshot_ids, loadScreenshotUrl])

  const saveField = async (updates: Parameters<typeof onUpdate>[1]) => {
    if (conflict) return // must reload first
    try {
      await onUpdate(issue.id, updates)
    } catch (e) {
      if (e instanceof IssueConflictError) {
        setConflict(e.latest)
        return
      }
      onToast(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const copyPrompt = async () => {
    const text = generateIssuePrompt(
      {
        id: issue.id,
        projectId: issue.project_id,
        title,
        description,
        type: issue.type,
        status: issue.status,
        screenshotId: null,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
      },
      issue.project_id ? { id: issue.project_id, name: issue.project_name || 'Project', color: '#5B50F6', createdAt: '', updatedAt: '' } : null
    )
    try {
      await navigator.clipboard.writeText(text)
      onToast('Prompt copied')
    } catch {
      onToast('Copy failed')
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex items-center gap-2 px-5 h-12 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button type="button" onClick={onClose} className="md:hidden p-1 text-slate-400">
          <X size={18} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={copyPrompt}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
        >
          <Copy size={14} /> Copy as Prompt
        </button>
        <button
          type="button"
          onClick={() => saveField({ status: issue.status === 'open' ? 'fixed' : 'open' })}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg ${
            issue.status === 'open'
              ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          <Check size={14} /> {issue.status === 'open' ? 'Mark fixed' : 'Reopen'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(issue.id)}
          className="p-1.5 text-slate-400 hover:text-rose-600"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4 max-w-2xl">
        {conflict && (
          <div
            role="alert"
            className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-sm text-amber-900 dark:text-amber-100 flex flex-col gap-2"
          >
            <p className="flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong className="font-semibold">This issue was changed by another teammate.</strong> Reload it
                before saving. Your last change was not saved; copy any text you want to keep first.
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                onReload(conflict)
                setConflict(null)
              }}
              className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-900 text-white hover:bg-amber-950 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
            >
              <RefreshCw size={13} /> Reload issue
            </button>
          </div>
        )}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== issue.title && saveField({ title: title.trim() })}
          className="w-full text-lg font-bold bg-transparent focus:outline-none text-slate-900 dark:text-white"
        />

        <div className="flex flex-wrap gap-2 text-xs">
          <Select
            label="Type"
            value={issue.type}
            onChange={v => saveField({ type: v as IssueType })}
            options={[
              { value: 'bug', label: 'Bug' },
              { value: 'uiux', label: 'UI/UX' },
              { value: 'idea', label: 'Idea' },
            ]}
          />
          <Select
            label="Project"
            value={issue.project_id || ''}
            onChange={v => saveField({ projectId: v || null })}
            options={[{ value: '', label: 'Unassigned' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
          />
          <Select
            label="Assignee"
            value={issue.assignee_id || ''}
            onChange={v => saveField({ assigneeId: v || null })}
            options={[
              { value: '', label: 'Unassigned' },
              ...members.map(m => ({ value: m.user_id, label: m.name || m.email || m.user_id })),
            ]}
          />
        </div>

        {issue.github_url && (
          <a
            href={issue.github_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#5B50F6] hover:underline w-fit"
          >
            <GitBranch size={13} /> View on GitHub #{issue.github_number} <ExternalLink size={11} />
          </a>
        )}

        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={() => description !== issue.description && saveField({ description })}
          placeholder="Add a description…"
          rows={6}
          className="w-full px-3.5 py-3 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] resize-y text-slate-800 dark:text-slate-100"
        />

        {shots.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {shots.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer" className="block">
                <img src={url} alt="Screenshot" className="rounded-xl border border-slate-200 dark:border-slate-700 w-full" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <span className="text-slate-400">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="text-slate-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

// ── Modals ───────────────────────────────────────────────────────────────────
function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

function NewIssueModal({
  projects,
  members,
  onCreate,
  onClose,
  onDone,
}: {
  projects: { id: string; name: string }[]
  members: TeamMember[]
  onCreate: (
    data: { title: string; description: string; type: IssueType; projectId: string | null; assigneeId: string | null },
    screenshot?: { base64: string; mimeType: string; filename?: string }
  ) => Promise<TeamIssue>
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<IssueType>('bug')
  const [projectId, setProjectId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const img = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
      const f = img?.getAsFile()
      if (f) {
        setFile(f)
        setPreview(URL.createObjectURL(f))
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErr('Title is required.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      let shot: { base64: string; mimeType: string; filename?: string } | undefined
      if (file) {
        const { base64, mimeType } = await fileToBase64(file)
        shot = { base64, mimeType, filename: file.name }
      }
      await onCreate(
        { title: title.trim(), description, type, projectId: projectId || null, assigneeId: assigneeId || null },
        shot
      )
      onDone()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not create issue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">New issue</h3>
          <button type="button" onClick={onClose} className="text-slate-400">
            <X size={16} />
          </button>
        </div>
        {err && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle size={14} /> {err}
          </div>
        )}
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="What's the issue?"
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6]"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Details (optional)"
          rows={3}
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] resize-y"
        />
        <div className="grid grid-cols-3 gap-2">
          <select value={type} onChange={e => setType(e.target.value as IssueType)} className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <option value="bug">Bug</option>
            <option value="uiux">UI/UX</option>
            <option value="idea">Idea</option>
          </select>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <option value="">No project</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
            <option value="">Unassigned</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
            ))}
          </select>
        </div>

        {preview ? (
          <div className="relative">
            <img src={preview} alt="preview" className="rounded-xl border border-slate-200 dark:border-slate-700 max-h-40 w-auto" />
            <button
              type="button"
              onClick={() => {
                setFile(null)
                setPreview(null)
              }}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-[#5B50F6]"
          >
            <ImagePlus size={16} /> Paste (Ctrl/⌘+V) or click to attach a screenshot
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) {
              setFile(f)
              setPreview(URL.createObjectURL(f))
            }
          }}
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Create issue'}
        </button>
      </form>
    </ModalShell>
  )
}

function MembersModal({
  role,
  me,
  members,
  invites,
  onInvite,
  onRemove,
  onClose,
  onToast,
}: {
  role: 'owner' | 'admin' | 'member'
  me: CurrentUser
  members: TeamMember[]
  invites: { id: string; email: string; role: string }[]
  onInvite: (email: string, role: 'admin' | 'member') => Promise<void>
  onRemove: (userId: string) => Promise<void>
  onClose: () => void
  onToast: (m: string) => void
}) {
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [busy, setBusy] = useState(false)
  const canManage = role === 'owner' || role === 'admin'
  const [resetTarget, setResetTarget] = useState<TeamMember | null>(null)

  if (resetTarget) {
    return <ResetPasswordDialog member={resetTarget} onClose={() => setResetTarget(null)} />
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Users size={18} /> Members
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          {members.map(m => (
            <div key={m.user_id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold flex items-center justify-center text-slate-600 dark:text-slate-200">
                {initials(m.name, m.email)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                <p className="text-[11px] text-slate-400 truncate">{m.email}</p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 capitalize">{m.role}</span>
              {me.isServerAdmin && m.user_id !== me.id && (
                <button
                  type="button"
                  onClick={() => setResetTarget(m)}
                  title="Reset password"
                  aria-label={`Reset password for ${m.name || m.email}`}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <KeyRound size={14} />
                </button>
              )}
              {canManage && m.role !== 'owner' && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await onRemove(m.user_id)
                      onToast('Member removed')
                    } catch (e) {
                      onToast(e instanceof Error ? e.message : 'Failed')
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {invites.map(inv => (
            <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 opacity-70">
              <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-xs flex items-center justify-center text-slate-400">
                @
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{inv.email}</p>
                <p className="text-[11px] text-amber-500">Pending invite · {inv.role}</p>
              </div>
            </div>
          ))}
        </div>

        {canManage && (
          <form
            onSubmit={async e => {
              e.preventDefault()
              if (!email.includes('@')) {
                onToast('Enter a valid email')
                return
              }
              setBusy(true)
              try {
                await onInvite(email.trim(), inviteRole)
                setEmail('')
                onToast('Invited. They join when they sign up with that email.')
              } catch (e2) {
                onToast(e2 instanceof Error ? e2.message : 'Failed')
              } finally {
                setBusy(false)
              }
            }}
            className="flex gap-2"
          >
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="teammate@email.com"
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6]"
            />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'admin' | 'member')} className="px-2 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={busy} className="px-3 py-2 text-sm font-semibold text-white bg-[#5B50F6] rounded-xl disabled:opacity-50">
              Invite
            </button>
          </form>
        )}
        <p className="text-[11px] text-slate-400">
          People with an existing account are added instantly. Others join when they sign up with that email; the
          invite expires after 7 days.
        </p>
      </div>
    </ModalShell>
  )
}

const INPUT_CLS =
  'w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6]'

/** Current + new password form backed by better-auth's change-password. */
function PasswordForm({
  currentLabel,
  submitLabel,
  onDone,
}: {
  currentLabel: string
  submitLabel: string
  onDone: () => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < 8) return setErr('The new password needs at least 8 characters.')
    if (next !== confirm) return setErr("The new passwords don't match.")
    if (next === current) return setErr('Pick a password different from the current one.')
    setBusy(true)
    setErr(null)
    try {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      })
      if (error) {
        setErr(
          error.code === 'INVALID_PASSWORD'
            ? `${currentLabel} is incorrect.`
            : error.message || 'Could not change the password.'
        )
        return
      }
      onDone()
    } catch {
      setErr('Could not reach the team server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {err && (
        <div
          role="alert"
          className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
        >
          <AlertCircle size={14} className="shrink-0" /> {err}
        </div>
      )}
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        {currentLabel}
        <input
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          value={current}
          onChange={e => setCurrent(e.target.value)}
          className={INPUT_CLS}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        New password
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={next}
          onChange={e => setNext(e.target.value)}
          className={INPUT_CLS}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
        Repeat new password
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className={INPUT_CLS}
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-50"
      >
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}

/** Server admin: issue a one-time temporary password for a teammate. */
function ResetPasswordDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const who = member.name || member.email || 'this person'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [temp, setTemp] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = async () => {
    setBusy(true)
    setErr(null)
    try {
      setTemp(await resetUserPassword(member.user_id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not reset the password.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!temp) return
    try {
      await navigator.clipboard.writeText(temp)
      setCopied(true)
    } catch {
      // Clipboard can be unavailable over plain-HTTP LAN; the text is selectable.
      setErr('Copy is blocked here. Select the password and copy it manually.')
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <KeyRound size={18} /> Reset password
          </h3>
          <button type="button" aria-label="Close" onClick={onClose} className="text-slate-400">
            <X size={16} />
          </button>
        </div>
        {err && (
          <div
            role="alert"
            className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
          >
            <AlertCircle size={14} className="shrink-0" /> {err}
          </div>
        )}
        {temp ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Temporary password for <strong className="text-slate-900 dark:text-slate-100">{who}</strong>. Give it
              to them in person or over a channel you trust. It won't be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-base tracking-wide select-all break-all">
                {temp}
              </code>
              <button
                type="button"
                onClick={copy}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              They were signed out everywhere and will be asked to choose a new password when they sign in.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-sm font-semibold rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This creates a one-time password for{' '}
              <strong className="text-slate-900 dark:text-slate-100">{who}</strong>
              {member.name && member.email ? ` (${member.email})` : ''}. Their current password stops working and
              they're signed out on every device.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:opacity-50"
              >
                {busy ? 'Resetting…' : 'Reset password'}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}

/** Server admin: backup status (local + external copy) and "Back up now". */
function BackupsModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<BackupStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const load = () =>
    listBackups()
      .then(setStatus)
      .catch(e => setErr(e instanceof Error ? e.message : 'Could not load backups.'))
  useEffect(() => {
    load()
  }, [])

  const backupNow = async () => {
    setBusy(true)
    setErr(null)
    setDone(null)
    try {
      const res = await runBackupNow()
      setDone(
        res.external.configured && res.external.lastError
          ? 'Local backup saved. The external copy failed (see below).'
          : res.external.configured
            ? 'Backup saved locally and to the external location.'
            : 'Backup saved locally.'
      )
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Backup failed.')
    } finally {
      setBusy(false)
    }
  }

  const latest = status?.backups[status.backups.length - 1]
  const ext = status?.external

  return (
    <ModalShell onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Archive size={18} /> Backups
          </h3>
          <button type="button" aria-label="Close" onClick={onClose} className="text-slate-400">
            <X size={16} />
          </button>
        </div>

        {err && (
          <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" /> {err}
          </div>
        )}
        {done && <p className="text-sm text-emerald-700 dark:text-emerald-400">{done}</p>}

        {!status && !err ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : status ? (
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-slate-500">On this disk</dt>
            <dd>
              {status.backups.length} kept{latest ? `, newest ${formatBackupName(latest)}` : ''}
              <span className="block text-xs text-slate-500">
                {status.automatic
                  ? `Automatic every ${status.intervalHours} h, keeping ${status.retention}.`
                  : 'Automatic backups are off.'}{' '}
                Same disk as the live data.
              </span>
            </dd>
            <dt className="text-slate-500">External copy</dt>
            <dd>
              {!ext?.configured ? (
                <span className="text-amber-700 dark:text-amber-400">
                  Not set up. If this disk fails, the backups are lost with it. Set BUGSTOW_BACKUP_EXTERNAL_DIR
                  (docs/RELEASE_OFFLINE.md §8).
                </span>
              ) : ext.lastError ? (
                <span className="text-red-700 dark:text-red-400">
                  Last attempt failed: {ext.lastError}
                </span>
              ) : (
                <>
                  {ext.backups.length} kept in <code className="font-mono text-xs break-all">{ext.dir}</code>
                  {ext.lastSuccessAt && (
                    <span className="block text-xs text-slate-500">
                      Last copied {new Date(ext.lastSuccessAt).toLocaleString()}.
                    </span>
                  )}
                </>
              )}
            </dd>
          </dl>
        ) : null}

        <button
          type="button"
          onClick={backupNow}
          disabled={busy}
          className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-50"
        >
          {busy ? 'Backing up…' : 'Back up now'}
        </button>
        <p className="text-xs text-slate-500">
          Restoring is done on the server computer; see docs/RELEASE_OFFLINE.md §8.
        </p>
      </div>
    </ModalShell>
  )
}

/** "2026-09-23T10-30-00-000Z" → local date/time. */
function formatBackupName(name: string): string {
  const iso = name.replace(/T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z$/, 'T$1:$2:$3.$4Z')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? name : d.toLocaleString()
}

function ImportModal({
  projects,
  onImport,
  onClose,
  onToast,
}: {
  projects: { id: string; name: string }[]
  onImport: (repo: string, token: string, projectId: string | null, includeClosed: boolean) => Promise<{ imported: number; skipped: number }>
  onClose: () => void
  onToast: (m: string) => void
}) {
  const [repo, setRepo] = useState('')
  const [token, setToken] = useState('')
  const [projectId, setProjectId] = useState('')
  const [includeClosed, setIncludeClosed] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  return (
    <ModalShell onClose={onClose}>
      <form
        onSubmit={async e => {
          e.preventDefault()
          if (!/^[^/]+\/[^/]+$/.test(repo.trim().replace(/^https?:\/\/github\.com\//, ''))) {
            setErr('Enter a repo as owner/name.')
            return
          }
          setBusy(true)
          setErr(null)
          try {
            const r = await onImport(repo.trim(), token.trim(), projectId || null, includeClosed)
            onToast(`Imported ${r.imported}, skipped ${r.skipped}`)
            onClose()
          } catch (e2) {
            setErr(e2 instanceof Error ? e2.message : 'Import failed.')
          } finally {
            setBusy(false)
          }
        }}
        className="flex flex-col gap-3.5"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <GitBranch size={18} /> Import from GitHub
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <WifiOff size={12} /> Online-only feature — this reaches GitHub over the internet.
        </div>
        {err && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300">
            {err}
          </div>
        )}
        <input
          value={repo}
          onChange={e => setRepo(e.target.value)}
          placeholder="owner/repository"
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6]"
        />
        <input
          value={token}
          onChange={e => setToken(e.target.value)}
          type="password"
          placeholder="GitHub token (required for private repos)"
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6]"
        />
        <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
          <option value="">Import into: No project</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>Import into: {p.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={includeClosed} onChange={e => setIncludeClosed(e.target.checked)} />
          Include closed issues (as Fixed)
        </label>
        <p className="text-[11px] text-slate-400">
          The token is sent only with this request to read issues, and is never stored. A fine-grained token with read-only Issues access is enough.
        </p>
        <button type="submit" disabled={busy} className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-50">
          {busy ? 'Importing…' : 'Import issues'}
        </button>
      </form>
    </ModalShell>
  )
}

// ── Migrate personal data into the team ──────────────────────────────────────
function MigrateModal({
  teamId,
  teamName,
  onClose,
  onDone,
  onToast,
}: {
  teamId: string
  teamName: string
  onClose: () => void
  onDone: (summary: { projects: number; issues: number; screenshots: number }) => void
  onToast: (m: string) => void
}) {
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null)
  const [encrypted, setEncrypted] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [data, setData] = useState<BackupData | null>(null)
  const [summary, setSummary] = useState<{ projects: number; issues: number; screenshots: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = (file: File) => {
    setError(null)
    setData(null)
    setSummary(null)
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        setRaw(parsed)
        const check = validateBackupStructure(parsed)
        if (!check.isValid) {
          setError(check.error || 'Invalid backup file.')
          return
        }
        if (check.isEncrypted) {
          setEncrypted(true)
        } else if (check.data) {
          setEncrypted(false)
          setData(check.data)
          setSummary({
            projects: check.data.projects.length,
            issues: check.data.issues.length,
            screenshots: check.data.screenshots.length,
          })
        }
      } catch {
        setError('Could not read that file.')
      }
    }
    reader.readAsText(file)
  }

  const decrypt = async () => {
    setBusy(true)
    setError(null)
    try {
      const decrypted = await decryptBackup(raw as unknown as EncryptedBackupPayload, passphrase)
      const check = validateBackupStructure(decrypted)
      if (!check.isValid || !check.data) {
        setError(check.error || 'Decrypted backup is invalid.')
        return
      }
      setData(check.data)
      setSummary({
        projects: check.data.projects.length,
        issues: check.data.issues.length,
        screenshots: check.data.screenshots.length,
      })
    } catch {
      setError('Incorrect passphrase or corrupted file.')
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    if (!data) return
    setBusy(true)
    setError(null)
    try {
      const result = await migrateBackupToTeam(data, teamId, msg => onToast(msg))
      onDone(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Upload size={18} /> Import personal data
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Copy the projects, issues, and screenshots from a personal backup file into{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">{teamName}</span>. This adds to the
          team — it never touches or deletes your local browser data.
        </p>
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {!raw && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl hover:border-[#5B50F6]"
          >
            <Upload size={18} /> Select a personal backup (.json)
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
          }}
        />

        {raw && encrypted && !data && (
          <div className="flex flex-col gap-2.5">
            <input
              autoFocus
              type="password"
              placeholder="Backup passphrase"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6]"
            />
            <button
              type="button"
              disabled={busy || !passphrase}
              onClick={decrypt}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] rounded-xl disabled:opacity-50"
            >
              {busy ? 'Decrypting…' : 'Decrypt'}
            </button>
          </div>
        )}

        {summary && (
          <>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 space-y-1">
              <p>• {summary.projects} projects</p>
              <p>• {summary.issues} issues</p>
              <p>• {summary.screenshots} screenshots</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={run}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] rounded-xl disabled:opacity-50"
            >
              {busy ? 'Importing…' : `Import into ${teamName}`}
            </button>
          </>
        )}
      </div>
    </ModalShell>
  )
}
