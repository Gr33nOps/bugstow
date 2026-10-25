import { ProjectModal } from '../features/projects/ProjectsView'
import { ViewSwitcher } from '../common/ViewSwitcher'
import { useTheme } from '../../hooks/useTheme'
import { Sun, Moon } from 'lucide-react'
import React, { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { useDialogFocus } from '../../hooks/useDialogFocus'
import {
  Plus,
  Inbox,
  CheckCircle2,
  Search,
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
  MoreHorizontal,
  FolderInput,
  Link2,
  Edit3,
} from "lucide-react"
import { filterAndSortIssues, type WorkflowFilters } from '../../lib/issueWorkflow'
import { findSimilarIssues } from '../../lib/similarIssues'
import { DuplicateSuggestions } from '../common/DuplicateSuggestions'
import { KanbanBoard } from '../common/KanbanBoard'
import { downloadPortableIssues } from '../../services/portabilityExport'
import { captureScreenshotFile, type ExtensionCaptureDraft } from '../../lib/extensionCapture'
import { useTeamData } from "../../hooks/useTeamData"
import { signOut, authClient } from "../../lib/authClient"
import {
  getMe,
  exportGithubIssues,
  resetUserPassword,
  getLinkedIssue,
  IssueConflictError,
  listBackups,
  runBackupNow,
  type BackupStatus,
  listInviteLinks,
  createInviteLink,
  deleteInviteLink,
  fetchScreenshotBlob,
  type InviteLink,
} from "../../services/teamApi"
import { displayLogin } from "../../lib/login"
import { connectionKind } from "../../lib/connection"
import { GithubImportModal } from "../features/github/GithubImportModal"
import { GithubExportModal } from "../features/github/GithubExportModal"
import { BugstowLogoIcon, BRAND_PRIMARY, GithubMark, timeAgo } from "../common/Icon"
import { ModeSwitch } from "../common/ModeSwitch"
import { isDesktopEdition } from "../../lib/teamServer"
import { copyTextAndImageToClipboard, generateIssuePrompt } from "../../services/promptService"
import { WritingTools } from "../common/WritingTools"
import { normalizeCustomBadge } from "../../lib/writingAssist"
import {
  validateBackupStructure,
  decryptBackup,
  createBackupData,
} from "../../services/backupService"
import { migrateBackupToTeam, selectProjectBackup, type MigrationResult } from "../../services/teamMigration"
import { getDB } from "../../storage/db"
import type { IssueType, IssuePriority, IssueSeverity, IssueDetails, BackupData, EncryptedBackupPayload } from "../../types"
import { IssueReportFields, PriorityBadge, STATUS_LABELS } from '../common/IssueReportFields'
import type { TeamIssue, TeamMember, CurrentUser } from "../../types/team"
import { placeFloatingMenu } from "../../lib/floatingMenu"
import { TeamIssueDetail } from "./TeamIssueDetail"
import { TrashView } from '../common/TrashView'
import { issueLink, readIssueLink } from '../../lib/teamIssueLinks'

const TYPE_META: Record<IssueType, {
  label: string
  icon: React.ElementType
  cls: string
}> = {
  bug: {
    label: "Bug",
    icon: Bug,
    cls: "text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-300",
  },
  uiux: {
    label: "UI/UX",
    icon: Palette,
    cls: "text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300",
  },
  idea: {
    label: "Idea",
    icon: Lightbulb,
    cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300",
  },
}

function initials(name: string | null, email: string | null): string {
  const src = (name || email || "?").trim()
  const parts = src.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase()
}

function fileToBase64(
  file: File,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(",")[1] || ""
      resolve({ base64, mimeType: file.type || "image/png" })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface TeamAppProps {
  onUseLocal: () => void
  userLabel: string
  offline?: boolean
  localProjectToCopy?: { id: string; name: string } | null
  onLocalProjectCopyClosed?: () => void
  captureDraft?: ExtensionCaptureDraft | null
  onCaptureHandled?: () => void
}

/**
 * Loads the signed-in user first: after an admin password reset the server
 * refuses every other request until a new password is chosen, so that screen
 * must come before the workspace.
 */
export function TeamApp(props: TeamAppProps) {

  useEffect(() => {
    const dismiss = (event: Event) => document.querySelectorAll<HTMLDetailsElement>('details[data-popover][open]').forEach(menu => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menu.contains(event.target as Node)) { menu.open = false; if (event instanceof KeyboardEvent) menu.querySelector('summary')?.focus() }
    })
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss) }
  }, [])
  const [me, setMe] = useState<CurrentUser | null>(null)
  const [meError, setMeError] = useState<string | null>(null)

  const loadMe = () => {
    setMeError(null)
    getMe()
      .then(setMe)
      .catch((e) =>
        setMeError(
          e instanceof Error ? e.message : "Could not reach the team server.",
        ),
      )
  }
  useEffect(loadMe, [])

  if (meError) {
    return (
      <CenteredPanel>
        <h1 className="text-lg font-semibold">Can't load your account</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{meError}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadMe}
            className="px-4 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </CenteredPanel>
    )
  }
  if (!me) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    )
  }
  if (me.mustChangePassword) {
    return (
      <CenteredPanel>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <KeyRound size={18} /> Choose a new password
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your password was reset by the server administrator. Enter the
          temporary password they gave you, then pick a new one that only you
          know.
        </p>
        <PasswordForm
          currentLabel="Temporary password"
          submitLabel="Set new password"
          onDone={() => setMe({ ...me, mustChangePassword: false })}
        />
        <button
          type="button"
          onClick={() => signOut()}
          className="self-start text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
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
      <div className="w-full max-w-sm flex flex-col gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
        {children}
      </div>
    </div>
  )
}

function Workspace({
  onUseLocal,
  userLabel,
  offline = false,
  localProjectToCopy,
  onLocalProjectCopyClosed,
  captureDraft,
  onCaptureHandled,
  me,
}: TeamAppProps & { me: CurrentUser }) {
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
  const [linkedIssue, setLinkedIssue] = useState<TeamIssue | null>(null)
  const [linkError, setLinkError] = useState('')
  const [trashOpen, setTrashOpen] = useState(false)
  const { theme, toggleTheme, isDark } = useTheme()
  const [showProjectCreate, setShowProjectCreate] = useState(false)
  const [boardView, setBoardView] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState('status')
  const [bulkValue, setBulkValue] = useState('fixed')
  const [undoId, setUndoId] = useState<string | null>(null)
  const clearIssueLink = () => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('issue')) return
    url.searchParams.delete('issue')
    url.searchParams.delete('team')
    window.history.replaceState({}, '', url)
  }
  const [query, setQuery] = useState("")
  const [projectFilter, setProjectFilter] = useState("all")
  useEffect(() => {
    setProjectFilter("all")
    setSelectedId(null)
    setSelectedIds([])
  }, [activeTeamId])
  useEffect(() => {
    const link = readIssueLink(window.location.href)
    if (!link || teams.length === 0) return
    if (!teams.some(team => team.id === link.teamId)) { setLinkError('This issue is not available in your workspaces.'); return }
    if (activeTeamId !== link.teamId) { setActiveTeamId(link.teamId); return }
    let cancelled = false
    getLinkedIssue(link.issueId).then(issue => { if (cancelled) return; setLinkedIssue(issue); setSelectedId(issue.id); setLinkError(''); setTrashOpen(false) }).catch(() => { if (cancelled) return; setLinkedIssue(null); setSelectedId(null); setLinkError('This issue is unavailable or has been moved to Trash.') })
    return () => { cancelled = true }
  }, [teams, activeTeamId, setActiveTeamId])
  useEffect(() => {
    const onPop = () => {
      const link = readIssueLink(window.location.href)
      if (!link) { setSelectedId(null); setLinkError(''); return }
      if (link.teamId !== activeTeamId) setActiveTeamId(link.teamId)
      getLinkedIssue(link.issueId).then(issue => { setLinkedIssue(issue); setSelectedId(issue.id); setLinkError('') }).catch(() => { setSelectedId(null); setLinkError('This issue is unavailable or has been moved to Trash.') })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [activeTeamId, setActiveTeamId])
  const [typeFilter, setTypeFilter] = useState<IssueType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<string>(
    "active",
  )
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [sort, setSort] = useState<WorkflowFilters['sort']>('created')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [updatedFrom, setUpdatedFrom] = useState('')
  const [updatedTo, setUpdatedTo] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [initialCapture, setInitialCapture] = useState<ExtensionCaptureDraft | null>(null)
  const captureFile = useMemo(() => initialCapture ? captureScreenshotFile(initialCapture) : null, [initialCapture])
  useEffect(() => {
    if (!captureDraft) return
    setInitialCapture(captureDraft)
    setShowNew(true)
    onCaptureHandled?.()
  }, [captureDraft, onCaptureHandled])
  const [showMembers, setShowMembers] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showMigrate, setShowMigrate] = useState(false)
  useEffect(() => {
    if (localProjectToCopy) setShowMigrate(true)
  }, [localProjectToCopy])
  const closeMigrate = () => {
    setShowMigrate(false)
    onLocalProjectCopyClosed?.()
  }
  // Issues kept in Local in this same browser: offered for copying in when
  // the workspace is still empty (typically right after switching to Team).
  const [localIssueCount, setLocalIssueCount] = useState(0)
  useEffect(() => {
    let alive = true
    getDB()
      .then((db) => db.count("issues"))
      .then((n) => {
        if (alive) setLocalIssueCount(n)
      })
      .catch(() => {
        // no Local data in this browser
      })
    return () => {
      alive = false
    }
  }, [])
  const [showTeamMenu, setShowTeamMenu] = useState(false)
  const workspaceMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showTeamMenu) return
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !workspaceMenuRef.current?.contains(event.target as Node)) { setShowTeamMenu(false); if (event instanceof KeyboardEvent) workspaceMenuRef.current?.querySelector('button')?.focus() }
    }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss) }
  }, [showTeamMenu])
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showBackups, setShowBackups] = useState(false)
  const [moving, setMoving] = useState<{ id: string; name: string } | null>(null)
  const canMoveProjects = activeTeam?.role === "owner" || activeTeam?.role === "admin"
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  const remoteAddress = me.shareUrl || (connectionKind() === "lan-https" ? location.origin : null)
  const remoteTipKey = remoteAddress ? `bugstow_remote_tip:${remoteAddress}` : ""
  const [showRemoteTip, setShowRemoteTip] = useState(() => {
    if (!remoteAddress || me.isServerAdmin) return false
    try { return localStorage.getItem(`bugstow_remote_tip:${remoteAddress}`) !== "hidden" } catch { return true }
  })

  const notify = (msg: string, duration = 2800) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    if (msg !== 'Issue moved to Trash') setUndoId(null)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), duration)
  }
  const portableIssues = useMemo(() => issues.map(issue => ({
    id: issue.id, title: issue.title, description: issue.description, type: issue.type,
    status: issue.status, priority: issue.priority, severity: issue.severity,
    projectName: issue.project_name, assigneeName: issue.assignee_name,
    createdAt: issue.created_at, updatedAt: issue.updated_at, details: issue.details,
    githubUrl: issue.github_url, fixReferences: issue.fix_references,
  })), [issues])

  const filtered = useMemo(
    () =>
      filterAndSortIssues(issues, {
        query,
        project: projectFilter,
        status: statusFilter,
        type: typeFilter,
        priority: priorityFilter,
        severity: severityFilter,
        assignee: assigneeFilter,
        sort, direction,
        createdFrom, createdTo, updatedFrom, updatedTo,
      }),
    [issues, query, projectFilter, statusFilter, typeFilter, priorityFilter, severityFilter, assigneeFilter, sort, direction, createdFrom, createdTo, updatedFrom, updatedTo],
  )

  useEffect(() => {
    const visible = new Set(filtered.map(issue => issue.id))
    setSelectedIds(current => current.filter(id => visible.has(id)))
  }, [filtered, activeTeamId])

  const selected = issues.find((i) => i.id === selectedId) || (linkedIssue?.id === selectedId && linkedIssue.team_id === activeTeamId ? linkedIssue : null)

  // No team yet → onboarding.
  if (!loading && teams.length === 0) {
    return (
      <CreateFirstTeam
        onCreate={data.createTeam}
        onUseLocal={onUseLocal}
        error={error}
      />
    )
  }

  return (
    <div className="h-full flex bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-slate-900">Skip to content</a>
      <aside
        aria-label="Team navigation"
        className="app-sidebar hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800"
      >
        <div className="flex items-center gap-2.5 px-6 h-20 shrink-0">
          <BugstowLogoIcon size={26} color={BRAND_PRIMARY} />
          <span className="text-lg font-semibold tracking-tight">BugsTow</span>
        </div>
        <div className="px-3">
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-brand hover:bg-brand-hover text-white rounded-lg"
          >
            <Plus size={18} />
            New issue
          </button>
        </div>
        <nav aria-label="Issues" className="px-3 mt-6 space-y-1">
          <button
            type="button"
            className="nav-item"
            aria-current={statusFilter === "active" ? "page" : undefined}
            onClick={() => {
              setTrashOpen(false)
              setStatusFilter("active")
              setSelectedId(null)
              clearIssueLink()
            }}
          >
            <Inbox size={18} />
            <span className="flex-1 text-left">Active issues</span>
            <span className="text-xs">
              {issues.filter((i) => i.status !== "fixed").length}
            </span>
          </button>
          <button
            type="button"
            className="nav-item"
            aria-current={statusFilter === "fixed" ? "page" : undefined}
            onClick={() => {
              setTrashOpen(false)
              setStatusFilter("fixed")
              setSelectedId(null)
              clearIssueLink()
            }}
          >
            <CheckCircle2 size={18} />
            <span className="flex-1 text-left">Completed</span>
            <span className="text-xs">
              {issues.filter((i) => i.status === "fixed").length}
            </span>
          </button>
          <button type="button" className="nav-item" aria-current={trashOpen ? 'page' : undefined} onClick={() => { setTrashOpen(true); setSelectedId(null); clearIssueLink() }}><Trash2 size={18} /><span className="flex-1 text-left">Trash</span><span className="text-xs">{data.trashIssues.length}</span></button>
        </nav>
        <div className="px-3 mt-7 flex-1 overflow-y-auto">
          <p className="px-3 mb-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Your projects</span><button type="button" aria-label="New project" onClick={() => setShowProjectCreate(true)} className="float-right rounded p-1 hover:bg-slate-200 dark:hover:bg-slate-800"><Plus size={14} /></button>
          </p>
          <button
            type="button"
            className="nav-item"
            aria-current={projectFilter === "all" ? "page" : undefined}
            onClick={() => { setProjectFilter("all"); setSelectedId(null); clearIssueLink() }}
          >
            <GitBranch size={16} />
            All projects
          </button>
          {projects.map((p) => (
            <div key={p.id} className="group relative">
              <button
                type="button"
                className="nav-item pr-9"
                aria-current={projectFilter === p.id ? "page" : undefined}
                onClick={() => {
                  setProjectFilter(p.id)
                  setSelectedId(null)
                  clearIssueLink()
                }}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate">{p.name}</span>
              </button>
              {canMoveProjects && (
                <ProjectMenu
                  name={p.name}
                  onMove={() => setMoving({ id: p.id, name: p.name })}
                  onDelete={async () => { const count = issues.filter(issue => issue.project_id === p.id).length; if (!window.confirm(`Delete project “${p.name}”? Its ${count} issue${count === 1 ? '' : 's'} will remain in this workspace as unassigned.`)) return; try { await data.deleteProject(p.id); setProjectFilter('all'); notify('Project deleted; its issues are unassigned') } catch (error) { notify(error instanceof Error ? error.message : 'Could not delete project') } }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="p-3 space-y-1 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            className="nav-item"
            onClick={() => setShowImport(true)}
          >
            <GithubMark size={18} />
            Import from GitHub
          </button>
          <button
            type="button"
            className="nav-item"
            onClick={() => { setShowMembers(true); void data.reload().catch(error => notify(error instanceof Error ? error.message : "Could not refresh members")) }}
          >
            <Users size={18} />
            People & invitations
          </button>
          {me.isServerAdmin && (
            <button
              type="button"
              className="nav-item"
              onClick={() => setShowBackups(true)}
            >
              <Archive size={18} />
              Backups
            </button>
          )}
          <ModeSwitch mode="team" onSwitch={onUseLocal} />
        </div>
      </aside>
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        {/* relative z-20: its menus (workspace switcher) must open above the page below. */}
        <header className="relative z-20 flex items-center gap-2 px-3 sm:px-5 h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div ref={workspaceMenuRef} className="relative min-w-0 flex-1 sm:flex-none">
            <button
              type="button"
              onClick={() => setShowTeamMenu((v) => !v)}
              className="flex max-w-full items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm sm:max-w-xs"
            >
              <span className="w-6 h-6 shrink-0 rounded-lg bg-brand text-white flex items-center justify-center text-xs">
                {activeTeam ? activeTeam.name.slice(0, 1).toUpperCase() : "?"}
              </span>
              <span className="truncate">
                {activeTeam?.name ||
                  (isDesktopEdition() ? "Select workspace" : "Select team")}
              </span>
              <ChevronDown size={15} className="shrink-0 text-slate-400" />
            </button>
            {showTeamMenu && (
              <div
                className="absolute z-30 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1"

              >
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTeamId(t.id)
                      setSelectedId(null)
                      clearIssueLink()
                      setShowTeamMenu(false)
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="min-w-0 text-left">
                      <span className="block truncate">{t.name}</span>
                      <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                        {peopleLabel(t.member_count)}
                      </span>
                    </span>
                    {t.id === activeTeamId && (
                      <Check size={14} className="text-brand" />
                    )}
                  </button>
                ))}
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                <CreateTeamInline
                  onCreate={async (name) => {
                    await data.createTeam(name)
                    setShowTeamMenu(false)
                  }}
                />
              </div>
            )}
          </div>

          {offline && (
            <span
              title="This server runs in offline mode. All features work locally; GitHub import and export are disabled."
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
            >
              <WifiOff size={12} /> Offline
            </span>
          )}

          <div className="hidden flex-1 sm:block" />
          <details data-popover className="relative shrink-0 text-sm">
            <summary className="action-trigger">Actions <ChevronDown size={14} /></summary>
            <div onClick={event => { if ((event.target as HTMLElement).closest('button')) { const menu = event.currentTarget.closest('details'); menu?.removeAttribute('open'); menu?.querySelector('summary')?.focus() } }} className="absolute right-0 z-40 mt-2 flex w-56 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <button type="button" onClick={() => setShowProjectCreate(true)} className="lg:hidden">New project</button>
          <button type="button" disabled={offline || !data.activeTeamId} onClick={() => setShowExport(true)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50">Export to GitHub</button>
          {offline && <p className="px-1 text-xs text-slate-500 dark:text-slate-400">GitHub access is disabled on this server.</p>}
          <details className="relative text-sm">
            <summary className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 dark:border-slate-700">Download issues</summary>
            <div className="mt-1 space-y-1 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
              <button type="button" onClick={() => downloadPortableIssues(portableIssues, 'csv')} className="block w-full rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800">CSV</button>
              <button type="button" onClick={() => downloadPortableIssues(portableIssues, 'markdown')} className="block w-full rounded px-2 py-1 text-left hover:bg-slate-100 dark:hover:bg-slate-800">Markdown</button>
            </div>
          </details>
          <button type="button" onClick={() => { setTrashOpen(value => !value); setSelectedId(null); clearIssueLink() }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm lg:hidden">{trashOpen ? 'Issues' : `Trash (${data.trashIssues.length})`}</button>

          <button
            type="button"
            onClick={() => setShowImport(true)}
            aria-label="Import from GitHub"
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <GithubMark size={16} />{" "}
            <span>Import from GitHub</span>
          </button>
          <button
            type="button"
            onClick={() => { setShowMembers(true); void data.reload().catch(error => notify(error instanceof Error ? error.message : "Could not refresh members")) }}
            aria-label="People and invitations"
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <Users size={16} />{" "}
            <span>Invite people</span>
          </button>
            </div>
          </details>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            aria-label="New issue"
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-brand hover:bg-brand-hover text-white shadow-sm"
          >
            <Plus size={16} />{" "}
            <span className="hidden sm:inline">New issue</span>
          </button>

          {connectionKind() === "lan-http" && (
            <span
              title="This server uses plain HTTP. Passwords and issues cross the network unencrypted. Ask the administrator to turn on HTTPS."
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-950/60"
            >
              <AlertTriangle size={12} /> Not encrypted
            </span>
          )}
          <button type="button" onClick={toggleTheme} aria-label={`Change theme (currently ${theme})`} className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{isDark ? <Moon size={17} /> : <Sun size={17} />}</button>
          <UserMenu
            label={userLabel}
            onUseLocal={onUseLocal}
            onImportPersonal={() => setShowMigrate(true)}
            onChangePassword={() => setShowChangePassword(true)}
            onBackups={
              me.isServerAdmin ? () => setShowBackups(true) : undefined
            }
          />
        </header>

        {showRemoteTip && remoteAddress && (
          <div className="flex flex-wrap items-center gap-3 border-b border-teal-200 bg-teal-50 px-5 py-3 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100">
            <div className="min-w-52 flex-1">
              <strong className="font-semibold">Open this workspace from your BugsTow shortcut.</strong>{" "}
              Run this once on your computer, then the normal shortcut returns here every time.
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`bugstow connect ${remoteAddress}`)
                  notify("Setup command copied")
                } catch {
                  notify(`Run: bugstow connect ${remoteAddress}`)
                }
              }}
              className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 dark:bg-teal-300 dark:text-teal-950 dark:hover:bg-teal-200"
            >
              Copy setup command
            </button>
            <button
              type="button"
              aria-label="Dismiss workspace shortcut tip"
              onClick={() => {
                try { localStorage.setItem(remoteTipKey, "hidden") } catch { /* keep this dismissal for this visit */ }
                setShowRemoteTip(false)
              }}
              className="rounded-lg p-2 text-teal-700 hover:bg-teal-100 dark:text-teal-300 dark:hover:bg-teal-900/60"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {trashOpen ? <TrashView issues={data.trashIssues.map(issue => ({ id: issue.id, title: issue.title, deletedAt: issue.deleted_at }))} onRestore={async id => { await data.restoreIssue(id); notify('Issue restored') }} onPurge={async id => { await data.purgeIssue(id); notify('Issue permanently deleted') }} /> : <>
        {linkError && <div role="alert" className="border-b border-amber-300 bg-amber-50 px-5 py-2 text-sm text-amber-900">{linkError}</div>}
        <div
          className={`page-heading shrink-0 ${
            selected ? "hidden md:block" : ""
          }`}
        >
          <h1 className="page-title">
            {statusFilter === "fixed"
              ? "Completed"
              : statusFilter === "all"
                ? "All issues"
                : statusFilter === "active" ? "Active issues" : `${statusFilter.replace('_', ' ')} issues`}
          </h1>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p className="page-description">
            {activeTeam?.name || "Your workspace"} · {filtered.length} issue
            {filtered.length === 1 ? "" : "s"}
          </p>
          <ViewSwitcher board={boardView} onChange={value => { setBoardView(value); setStatusFilter("all"); setSelectedId(null); clearIssueLink() }} /></div>
        </div>
        <div
          className={`${
            selected ? "hidden md:flex" : "flex"
          } flex-wrap gap-2 px-5 sm:px-7 pb-5 border-b border-slate-200 dark:border-slate-800`}
        >
          <div className="relative flex-1 min-w-40">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              aria-label="Search issues"
              type="search"
              placeholder="Search issues…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            />
          </div>
          <select
            aria-label="Project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="max-w-40 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Issue status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="active">Active</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="fixed">Completed</option>
            <option value="all">All statuses</option>
          </select>
          <details className="issue-filters w-full text-sm"><summary>More filters and sorting</summary><div className="filter-grid">
          <select aria-label="Priority" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><option value="all">All priorities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
          <select aria-label="Severity" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><option value="all">All severities</option><option value="critical">Critical</option><option value="major">Major</option><option value="minor">Minor</option></select>
          <select aria-label="Assignee" value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><option value="all">All assignees</option><option value="unassigned">Unassigned</option>{members.map(member => <option key={member.user_id} value={member.user_id}>{member.name || displayLogin(member.email) || 'Member'}</option>)}</select>
          <select aria-label="Sort issues" value={sort} onChange={e => setSort(e.target.value as WorkflowFilters['sort'])} className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"><option value="created">Created</option><option value="updated">Updated</option><option value="priority">Priority</option><option value="severity">Severity</option><option value="status">Status</option><option value="type">Type</option><option value="project">Project</option><option value="assignee">Assignee</option><option value="title">Title</option></select>
          <button type="button" aria-label="Reverse sort order" onClick={() => setDirection(value => value === 'asc' ? 'desc' : 'asc')} className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700">{direction === 'desc' ? 'Descending' : 'Ascending'}</button>
          <select
            aria-label="Issue type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="all">All types</option>
            <option value="bug">Bug</option>
            <option value="uiux">UI/UX</option>
            <option value="idea">Idea</option>
          </select>
          <label>Created from<input type="date" value={createdFrom} onChange={event => setCreatedFrom(event.target.value)} className="ml-2 rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label>Created to<input type="date" value={createdTo} onChange={event => setCreatedTo(event.target.value)} className="ml-2 rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label>Updated from<input type="date" value={updatedFrom} onChange={event => setUpdatedFrom(event.target.value)} className="ml-2 rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></label>
          <label>Updated to<input type="date" value={updatedTo} onChange={event => setUpdatedTo(event.target.value)} className="ml-2 rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></label>
          </div></details>



        </div>

        <div className={`${selected ? "hidden md:block" : ""} shrink-0`}>
        {selectedIds.length === 0 && filtered.length > 0 && <div className="border-b border-slate-200 px-5 py-2 dark:border-slate-700"><button type="button" className="selection-button" onClick={() => setSelectedIds(filtered.map(issue => issue.id))}>Select all {filtered.length} filtered</button></div>}
        {selectedIds.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-2 text-sm dark:border-slate-700"><strong>{selectedIds.length} selected</strong>
          <button type="button" className="selection-button" onClick={() => setSelectedIds(filtered.map(issue => issue.id))}>Select all {filtered.length} filtered</button>
          <button type="button" className="selection-button" onClick={() => setSelectedIds([])}>Clear</button>
          <select aria-label="Bulk action" value={bulkAction} onChange={event => { setBulkAction(event.target.value); setBulkValue(event.target.value === 'priority' ? 'medium' : event.target.value === 'status' ? 'fixed' : '') }} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"><option value="status">Change status</option><option value="priority">Change priority</option><option value="projectId">Move to project</option><option value="assigneeId">Assign to person</option><option value="trash">Move to Trash</option></select>
          {bulkAction === 'status' && <select aria-label="New status" value={bulkValue} onChange={event => setBulkValue(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
          {bulkAction === 'priority' && <select aria-label="New priority" value={bulkValue} onChange={event => setBulkValue(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>}
          {bulkAction === 'projectId' && <select aria-label="Destination project" value={bulkValue} onChange={event => setBulkValue(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"><option value="">Unassigned</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}
          {bulkAction === 'assigneeId' && <select aria-label="New assignee" value={bulkValue} onChange={event => setBulkValue(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"><option value="">Unassigned</option>{members.map(member => <option key={member.user_id} value={member.user_id}>{member.name || displayLogin(member.email)}</option>)}</select>}
          <button type="button" className="rounded bg-brand px-3 py-1.5 font-semibold text-white" onClick={async () => { if (bulkAction === 'trash' && !window.confirm(`Move ${selectedIds.length} issues to Trash?`)) return; try { const count = await data.bulkUpdate(selectedIds, { [bulkAction]: bulkAction === 'trash' ? true : bulkValue || null }); setSelectedIds([]); setSelectedId(null); notify(`${count} issues updated`) } catch (error) { notify(error instanceof Error ? error.message : 'Bulk update failed') } }}>Apply</button>
        </div>}

        </div>

        {/* Body */}
        <div className="issue-workspace flex-1 min-h-0 min-w-0 flex">
          <div
            className={`${
              selected ? "hidden md:flex md:flex-1 md:min-w-0" : "flex"
            } issue-master-pane min-w-0 flex-col bg-white dark:bg-slate-900 w-full border-r border-slate-200 dark:border-slate-800 overflow-y-auto`}
          >
            {boardView ? <KanbanBoard issues={filtered.map(issue => ({ ...issue, projectName: issue.project_name }))} onOpen={issue => { setSelectedId(issue.id); setLinkedIssue(null); if (activeTeamId) window.history.pushState({}, '', issueLink(window.location.href, activeTeamId, issue.id)) }} onStatusChange={async (issue, status) => { await data.updateIssue(issue.id, { status }); notify('Issue status updated') }} /> : loading ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 flex flex-col items-center gap-3 text-center text-sm text-slate-500 dark:text-slate-400">
                {issues.length
                  ? "No issues match your filters."
                  : "Your workspace is ready. Add your first issue or import from GitHub."}
                {issues.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("")
                      setTypeFilter("all")
                      setProjectFilter("all")
                      setStatusFilter("all")
                      setPriorityFilter('all')
                      setSeverityFilter('all')
                      setAssigneeFilter('all')
                      setCreatedFrom(''); setCreatedTo(''); setUpdatedFrom(''); setUpdatedTo('')
                    }}
                    className="text-brand dark:text-brand-light font-medium"
                  >
                    Clear filters
                  </button>
                )}
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNew(true)}
                    aria-label="New issue"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-brand hover:bg-brand-hover text-white"
                  >
                    <Plus size={15} /> New issue
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImport(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <GithubMark size={15} /> Import from GitHub
                  </button>
                  {issues.length === 0 && localIssueCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowMigrate(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <HardDrive size={15} /> Copy {localIssueCount} Local issue
                      {localIssueCount === 1 ? "" : "s"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              filtered.map((issue) => (
                <div
                  key={issue.id}
                  className={`team-issue-row flex items-center gap-3 w-full px-5 py-4 border-b border-slate-100 dark:border-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                    selectedId === issue.id
                      ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                      : ""
                  }`}
                >
                  <input type="checkbox" aria-label={`Select ${issue.title}`} checked={selectedIds.includes(issue.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, issue.id] : current.filter(id => id !== issue.id))} className="mt-1" />
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800" aria-hidden="true">{issue.type === "bug" ? <Bug size={18} /> : issue.type === "idea" ? <Lightbulb size={18} /> : <Palette size={18} />}</span>
                  <button type="button" onClick={() => { setSelectedId(issue.id); setLinkedIssue(null); setLinkError(''); if (activeTeamId) window.history.pushState({}, '', issueLink(window.location.href, activeTeamId, issue.id)) }} className="team-issue-content min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <TypeBadge type={issue.type} customLabel={issue.custom_type} />
                    <PriorityBadge priority={issue.priority} />
                    {(issue.status === 'in_progress' || issue.status === 'blocked') && <span className="text-xs font-semibold text-slate-500">{STATUS_LABELS[issue.status]}</span>}
                    {issue.status === "fixed" && (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        FIXED
                      </span>
                    )}
                    {issue.github_number != null && (
                      <span className="text-xs text-slate-400">
                        #{issue.github_number}
                      </span>
                    )}
                  </div>
                  <p className="team-issue-title text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2">
                    {issue.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400 min-w-0">
                    {issue.project_name && (
                      <span className="truncate">{issue.project_name}</span>
                    )}
                    {issue.screenshot_count > 0 && (
                      <span>· {issue.screenshot_count} img</span>
                    )}
                    <span className="flex-1" />
                    {issue.assignee_id && (
                      <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-semibold flex items-center justify-center text-slate-600 dark:text-slate-200">
                        {initials(issue.assignee_name, issue.assignee_email)}
                      </span>
                    )}
                  </div>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className={`${selected ? "flex" : "hidden"} issue-detail-pane flex-1 min-w-0 shrink-0`}>
            {selected ? (
              <TeamIssueDetail
                key={selected.id}
                issue={selected}
                members={members}
                projects={projects}
                loadScreenshotUrl={data.loadScreenshotUrl}
                onUpdate={data.updateIssue}
                onSyncScreenshots={data.syncIssueScreenshots}
                onReload={data.replaceIssue}
                onDelete={async (id) => {
                  await data.deleteIssue(id)
                  setSelectedId(null)
                  const url = new URL(window.location.href); url.searchParams.delete('issue'); window.history.replaceState({}, '', url)
                  setUndoId(id)
                  notify("Issue moved to Trash", 5000)
                  window.setTimeout(() => setUndoId(current => current === id ? null : current), 5000)
                }}
                onClose={() => { setSelectedId(null); const url = new URL(window.location.href); url.searchParams.delete('issue'); window.history.pushState({}, '', url) }}
                onToast={notify}
                currentUserId={me.id}
                onCopyLink={async () => { if (!activeTeamId) return; const base = me.shareUrl ? new URL(`${window.location.pathname}${window.location.search}`, me.shareUrl).href : window.location.href; await navigator.clipboard.writeText(issueLink(base, activeTeamId, selected.id)); notify('Issue link copied') }}
              />
            ) : (
              <div className="flex-1 hidden md:flex items-center justify-center text-sm text-slate-400">
                Select an issue to view details
              </div>
            )}
          </div>
        </div>
        </>}

        {showNew && (
          <NewIssueModal
            projects={projects}
            issues={issues}
            initialTitle={initialCapture?.title}
            initialDescription={initialCapture?.description}
            initialFile={captureFile}
            members={members}
            onCreate={data.createIssue}
            onClose={() => { setShowNew(false); setInitialCapture(null) }}
            onDone={() => {
              setShowNew(false)
              setInitialCapture(null)
              notify("Issue created")
            }}
          />
        )}
        {showMembers && activeTeam && (
          <MembersModal
            role={activeTeam.role}
            me={me}
            teamId={activeTeam.id}
            teamName={activeTeam.name}
            members={members}
            invites={data.invites}
            onCancelInvite={data.cancelInvite}
            onRemove={data.removeMember}
            onClose={() => setShowMembers(false)}
            onToast={notify}
          />
        )}
        {moving && activeTeam && (
          <MoveProjectModal
            project={moving}
            from={activeTeam}
            teams={teams}
            onClose={() => setMoving(null)}
            onMove={async (toTeamId, newName) => {
              let dest = teams.find((t) => t.id === toTeamId)
              if (newName) dest = await data.createTeam(newName, { activate: false })
              if (!dest) throw new Error("Pick a workspace.")
              const r = await data.moveProject(moving.id, dest.id)
              // Stay where you are; the toast says where it went.
              if (projectFilter === moving.id) setProjectFilter("all")
              notify(
                `Moved “${moving.name}” and ${r.moved} issue${r.moved === 1 ? "" : "s"} to ${dest.name}`,
              )
              setMoving(null)
            }}
          />
        )}
        {showExport && <GithubExportModal
          issues={data.issues.map(i => ({ ...i, projectId: i.project_id, githubUrl: i.github_url }))}
          projects={data.projects}
          onClose={() => setShowExport(false)}
          onExport={async (repo, token, ids) => {
            if (!data.activeTeamId) throw new Error('Choose a workspace first.')
            const result = await exportGithubIssues(data.activeTeamId, repo, token, ids)
            try { await data.reload() } catch { result.warnings.push('Export finished, but refreshing BugsTow failed. Reload before exporting again.') }
            return result
          }}
        />}
        {showImport && (
          <GithubImportModal
            projects={projects}
            onClose={() => setShowImport(false)}
            onImport={async (req) => {
              const r = await data.importGithub({
                repo: req.repo.full,
                token: req.token || "",
                includeClosed: req.includeClosed,
                projectId:
                  req.target.kind === "existing" ? req.target.id : null,
                newProjectName:
                  req.target.kind === "new" ? req.target.name : undefined,
              })
              if (r.imported || r.updated)
                notify(`Imported from ${req.repo.full}`)
              return r
            }}
          />
        )}
        {showMigrate && activeTeamId && (
          <MigrateModal
            teamId={activeTeamId}
            teamName={activeTeam?.name || "this team"}
            projectToCopy={localProjectToCopy}
            onClose={closeMigrate}
            onDone={async (r) => {
              closeMigrate()
              await data.reload()
              notify(
                `Copied ${r.issues} issue${r.issues === 1 ? "" : "s"}` +
                  (r.projects ? ` and ${r.projects} project${r.projects === 1 ? "" : "s"}` : "") +
                  (r.alreadyThere ? `. ${r.alreadyThere} GitHub issue${r.alreadyThere === 1 ? " was" : "s were"} already here.` : ""),
              )
            }}
            onToast={notify}
          />
        )}

        {showProjectCreate && <ProjectModal onClose={() => setShowProjectCreate(false)} onSave={async (name, color) => { await data.createProject(name, color); setShowProjectCreate(false); notify("Project created") }} />}
        {showBackups && <BackupsModal onClose={() => setShowBackups(false)} />}

        {showChangePassword && (
          <ModalShell onClose={() => setShowChangePassword(false)}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Change password</h3>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setShowChangePassword(false)}
                  className="text-slate-400"
                >
                  <X size={16} />
                </button>
              </div>
              <PasswordForm
                currentLabel="Current password"
                submitLabel="Change password"
                onDone={() => {
                  setShowChangePassword(false)
                  notify("Password changed. Other devices were signed out.")
                }}
              />
            </div>
          </ModalShell>
        )}

        {toast && (
          <div
            role="status"
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm shadow-lg dark:bg-white dark:text-slate-900"
          >
            {toast} {undoId && <button type="button" className="ml-2 font-semibold underline" onClick={async () => { try { await data.restoreIssue(undoId); setUndoId(null); notify('Issue restored') } catch (error) { notify(error instanceof Error ? error.message : 'Could not restore issue') } }}>Undo</button>}
          </div>
        )}
      </main>
    </div>
  )
}

function TypeBadge({ type, customLabel }: { type: IssueType; customLabel?: string | null }) {
  if (customLabel) {
    return (
      <span className="inline-flex max-w-36 items-center gap-1 truncate rounded-md bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
        <span aria-hidden="true">●</span> {customLabel}
      </span>
    )
  }
  const m = TYPE_META[type]
  const Icon = m.icon
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold ${m.cls}`}
    >
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
  /** Only for the server administrator. */
}: {
  label: string
  onUseLocal: () => void
  onImportPersonal: () => void
  onChangePassword: () => void
  onBackups?: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menuRef.current?.contains(event.target as Node)) { setOpen(false); if (event instanceof KeyboardEvent) menuRef.current?.querySelector('button')?.focus() }
    }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', dismiss)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss) }
  }, [open])
  return (
    <div ref={menuRef} className="relative">
      <button
        aria-label="Account menu" aria-expanded={open}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200"
        title={label}
      >
        <UserCircle2 size={20} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1"

        >
          <div className="px-3 py-2 text-xs text-slate-400 truncate">
            {label}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onImportPersonal()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Upload size={15} /> Copy Local issues
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
            title="Opens Local: your own separate list in this browser, no account. Team issues stay where they are. To keep a Team project to yourself instead, use ⋯ next to it → Move to workspace."
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <HardDrive size={15} /> Switch to Local
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

/** The ⋯ next to a project in the sidebar. */
function ProjectMenu({ name, onMove, onDelete }: { name: string; onMove: () => void; onDelete: () => void }) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!position) return
    const closeIfOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setPosition(null)
    }
    const close = () => setPosition(null)
    document.addEventListener("mousedown", closeIfOutside)
    window.addEventListener("resize", close)
    window.addEventListener("scroll", close, true)
    return () => {
      document.removeEventListener("mousedown", closeIfOutside)
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [position])
  return (
    <div className="absolute right-1 top-1/2 -translate-y-1/2">
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          if (position) {
            setPosition(null)
            return
          }
          setPosition(placeFloatingMenu(
            event.currentTarget.getBoundingClientRect(),
            { width: window.innerWidth, height: window.innerHeight },
            { width: 208, height: 90 },
          ))
        }}
        aria-label={`More for ${name}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 focus:opacity-100 aria-expanded:opacity-100"
      >
        <MoreHorizontal size={15} aria-hidden="true" />
      </button>
      {position && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${name}`}
          className="fixed z-[70] w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1"
          style={position}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setPosition(null)
              onMove()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FolderInput size={15} aria-hidden="true" /> Move to workspace…
          </button>
          <button type="button" role="menuitem" onClick={() => { setPosition(null); onDelete() }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"><Trash2 size={15} /> Delete project…</button>
        </div>,
        document.body,
      )}
    </div>
  )
}

/** "Only you" or "3 people": whether a workspace is private or shared. */
function peopleLabel(count: number): string {
  return count <= 1 ? "Only you" : `${count} people`
}

/**
 * Move a project (with its issues and screenshots) to another workspace,
 * typically out of a shared one into one only you are in.
 */
function MoveProjectModal({
  project,
  from,
  teams,
  onMove,
  onClose,
}: {
  project: { id: string; name: string }
  from: { id: string; name: string; member_count: number }
  teams: Array<{ id: string; name: string; member_count: number }>
  onMove: (toTeamId: string | null, newWorkspaceName?: string) => Promise<void>
  onClose: () => void
}) {
  const others = teams.filter((t) => t.id !== from.id)
  const [choice, setChoice] = useState<string>(others[0]?.id ?? "new")
  const [newName, setNewName] = useState("Private")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const othersHere = from.member_count - 1
  return (
    <ModalShell onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (choice === "new" && !newName.trim()) {
            setErr("Give the new workspace a name.")
            return
          }
          setBusy(true)
          setErr(null)
          try {
            await onMove(
              choice === "new" ? null : choice,
              choice === "new" ? newName.trim() : undefined,
            )
          } catch (e2) {
            setErr(e2 instanceof Error ? e2.message : "Could not move the project.")
            setBusy(false)
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold">Move “{project.name}”</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Its issues and screenshots move with it.
          {othersHere > 0 &&
            ` The other ${othersHere} ${othersHere === 1 ? "person" : "people"} in ${from.name} won’t see it any more.`}
        </p>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold mb-1">Move it to</legend>
          {others.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer has-[:checked]:border-brand"
            >
              <input
                type="radio"
                name="dest"
                value={t.id}
                checked={choice === t.id}
                onChange={() => setChoice(t.id)}
                className="accent-brand"
              />
              <span className="flex-1 min-w-0 truncate text-sm font-medium">
                {t.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {peopleLabel(t.member_count)}
              </span>
            </label>
          ))}
          <label className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer has-[:checked]:border-brand">
            <input
              type="radio"
              name="dest"
              value="new"
              checked={choice === "new"}
              onChange={() => setChoice("new")}
              className="accent-brand"
            />
            <span className="text-sm font-medium">New workspace, only you</span>
            <input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                setChoice("new")
              }}
              aria-label="New workspace name"
              className="flex-1 min-w-32 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md"
            />
          </label>
        </fieldset>
        {err && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {err}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg disabled:opacity-50"
          >
            {busy ? "Moving…" : "Move project"}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function CreateTeamInline({
  onCreate,
}: {
  onCreate: (name: string) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setBusy(true)
        try {
          await onCreate(name.trim())
          setName("")
        } finally {
          setBusy(false)
        }
      }}
      className="px-2 py-1.5 flex gap-1.5"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={isDesktopEdition() ? "New workspace name" : "New team name"}
        aria-label="New workspace name"
        className="min-w-0 flex-1 px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        aria-label="Create workspace"
        className="shrink-0 px-2 py-1 text-sm font-semibold text-white bg-brand rounded-lg disabled:opacity-50"
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
  const desktop = isDesktopEdition()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="h-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          setBusy(true)
          setErr(null)
          try {
            await onCreate(name.trim())
          } catch (e2) {
            setErr(
              e2 instanceof Error
                ? e2.message
                : desktop
                  ? "Could not create the workspace."
                  : "Could not create team.",
            )
          } finally {
            setBusy(false)
          }
        }}
        className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-7 flex flex-col gap-4"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-brand">
            <Users size={18} />
          </div>
          <h1 className="text-lg font-semibold">
            {desktop ? "Name your workspace" : "Create your first team"}
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {desktop
            ? "Your projects and issues live in a workspace. One is enough for most people; you can add more later."
            : "A team is a shared workspace. Invite people and assign issues once it exists."}
        </p>
        {(err || error) && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300">
            {err || error}
          </div>
        )}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label={desktop ? "Workspace name" : "Team name"}
          placeholder={desktop ? "e.g. My projects" : "e.g. Acme Web"}
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg disabled:opacity-50"
        >
          {busy ? "Creating…" : desktop ? "Create workspace" : "Create team"}
        </button>
        <button
          type="button"
          onClick={onUseLocal}
          className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Use Local instead (just you, no account)
        </button>
      </form>
    </div>
  )
}

// ── Modals ───────────────────────────────────────────────────────────────────
function ModalShell({
  children,
  onClose,
  dismissible = true,
}: {
  children: React.ReactNode
  onClose: () => void
  dismissible?: boolean
}) {
  const dialogRef = useDialogFocus(onClose, dismissible)
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Workspace dialog"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={() => { if (dismissible) onClose() }}
      />
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 text-slate-900 dark:text-slate-100 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  )
}

function NewIssueModal({
  projects,
  issues,
  initialTitle,
  initialDescription,
  initialFile,
  members,
  onCreate,
  onClose,
  onDone,
}: {
  projects: { id: string; name: string }[]
  issues: TeamIssue[]
  initialTitle?: string
  initialDescription?: string
  initialFile?: File | null
  members: TeamMember[]
  onCreate: (
    data: {
      title: string
      description: string
      type: IssueType
      customType?: string
      priority?: IssuePriority
      severity?: IssueSeverity | null
      details?: IssueDetails
      projectId: string | null
      assigneeId: string | null
    },
    screenshots?: Array<{ base64: string; mimeType: string; filename?: string }>,
  ) => Promise<TeamIssue>
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState(initialTitle || "")
  const [description, setDescription] = useState(initialDescription || "")
  const [type, setType] = useState<IssueType | "custom">("bug")
  const [customType, setCustomType] = useState("")
  const [priority, setPriority] = useState<IssuePriority>('medium')
  const [severity, setSeverity] = useState<IssueSeverity | null>(null)
  const [details, setDetails] = useState<IssueDetails>({})
  const [projectId, setProjectId] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [files, setFiles] = useState<Array<{ file: File; previewUrl: string }>>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const similar = useMemo(() => findSimilarIssues(title, description, issues), [title, description, issues])
  const fileRef = useRef<HTMLInputElement>(null)
  const initialFileHandled = useRef<File | null>(null)
  const filesRef = useRef<Array<{ file: File; previewUrl: string }>>([])

  filesRef.current = files
  useEffect(() => () => {
    filesRef.current.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl))
  }, [])

  const addFiles = (incoming: Iterable<File>) => {
    const additions = Array.from(incoming)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    if (additions.length > 0) setFiles((current) => [...current, ...additions])
    if (fileRef.current) fileRef.current.value = ""
  }
  useEffect(() => { if (initialFile && initialFileHandled.current !== initialFile) { initialFileHandled.current = initialFile; addFiles([initialFile]) } }, [initialFile])

  const removeFile = (index: number) => {
    setFiles((current) => {
      const target = current[index]
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const pasted = Array.from(e.clipboardData?.items || [])
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      if (pasted.length > 0) addFiles(pasted)
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setErr("Title is required.")
      return
    }
    if (type === "custom" && !normalizeCustomBadge(customType)) {
      setErr("Enter a name for the custom badge.")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const shots = await Promise.all(files.map(async ({ file }) => {
        const { base64, mimeType } = await fileToBase64(file)
        return { base64, mimeType, filename: file.name }
      }))
      await onCreate(
        {
          title: title.trim(),
          description,
          type: type === "custom" ? "idea" : type,
          customType: type === "custom" ? normalizeCustomBadge(customType) : undefined,
          priority,
          severity: type === 'bug' ? severity : null,
          details,
          projectId: projectId || null,
          assigneeId: assigneeId || null,
        },
        shots,
      )
      onDone()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not create issue.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose} dismissible={!busy}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">New issue</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={busy}
            className="p-2 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>
        {err && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle size={14} /> {err}
          </div>
        )}
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="new-team-issue-title" className="text-xs font-medium text-slate-500 dark:text-slate-400">Title</label>
            <WritingTools value={title} kind="title" fieldName="Title" onChange={setTitle} />
          </div>
          <input
            id="new-team-issue-title"
            name="title"
            autoFocus
            autoComplete="off"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the issue?"
            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="new-team-issue-description" className="text-xs font-medium text-slate-500 dark:text-slate-400">Description</label>
            <WritingTools value={description} kind="description" fieldName="Description" onChange={setDescription} />
          </div>
          <textarea
            id="new-team-issue-description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details (optional)"
            rows={3}
            className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand resize-y"
          />
        </div>
        <DuplicateSuggestions issues={similar} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={type}
            aria-label="Issue type"
            onChange={(e) => setType(e.target.value as IssueType | "custom")}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="bug">Bug</option>
            <option value="uiux">UI/UX</option>
            <option value="idea">Idea</option>
            <option value="custom">Custom badge…</option>
          </select>
          <select
            value={projectId}
            aria-label="Project"
            onChange={(e) => setProjectId(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={assigneeId}
            aria-label="Assignee"
            onChange={(e) => setAssigneeId(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name || displayLogin(m.email)}
              </option>
            ))}
          </select>
        </div>

        {type === "custom" && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Custom badge
            <input
              name="customType"
              value={customType}
              maxLength={24}
              onChange={(event) => setCustomType(event.target.value)}
              placeholder="For example: Performance"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
        )}

        <IssueReportFields priority={priority} onPriorityChange={setPriority} severity={severity} onSeverityChange={setSeverity} details={details} onDetailsChange={setDetails} bug={type === 'bug'} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map(({ file, previewUrl }, index) => (
            <div key={`${file.name}-${index}`} className="group relative aspect-video overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <img src={previewUrl} alt={file.name || `Screenshot ${index + 1}`} width="800" height="450" loading="lazy" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${file.name || `screenshot ${index + 1}`}`}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/75 text-white"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-3 text-center text-xs text-slate-500 hover:border-brand dark:border-slate-700"
          >
            <ImagePlus size={16} /> {files.length > 0 ? "Add more" : "Add screenshots"}
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Choose several images or paste screenshots one after another.</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
          }}
        />

        <button
          type="submit"
          disabled={busy || !title.trim() || (type === "custom" && !normalizeCustomBadge(customType))}
          className="w-full py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg disabled:opacity-50"
        >
          {busy ? "Saving…" : "Create issue"}
        </button>
      </form>
    </ModalShell>
  )
}

function MembersModal({
  role,
  me,
  teamId,
  teamName,
  members,
  invites,
  onCancelInvite,
  onRemove,
  onClose,
  onToast,
}: {
  role: "owner" | "admin" | "member"
  me: CurrentUser
  teamId: string
  teamName: string
  members: TeamMember[]
  /** Email invitations from before invite links; still shown so they can be cancelled. */
  invites: { id: string; email: string; role: string }[]
  onCancelInvite: (inviteId: string) => Promise<void>
  onRemove: (userId: string) => Promise<void>
  onClose: () => void
  onToast: (m: string) => void
}) {
  const canManage = role === "owner" || role === "admin"
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member")
  const [newLink, setNewLink] = useState<string | null>(null)
  const [openLinks, setOpenLinks] = useState<InviteLink[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [resetTarget, setResetTarget] = useState<TeamMember | null>(null)
  const base = me.shareUrl || window.location.origin

  const loadLinks = () => {
    if (!canManage) return
    listInviteLinks(teamId)
      .then(setOpenLinks)
      .catch(() => {
        // the list is a convenience; creating links still works
      })
  }
  useEffect(loadLinks, [teamId, canManage])

  if (resetTarget) {
    return <ResetPasswordDialog member={resetTarget} onClose={() => setResetTarget(null)} />
  }

  const makeLink = async () => {
    setBusy(true)
    setError("")
    try {
      const { token } = await createInviteLink(teamId, inviteRole)
      setNewLink(`${base}/#invite=${token}`)
      loadLinks()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a link. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">People in {teamName}</h3>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="p-2 text-slate-400">
            <X size={16} />
          </button>
        </div>

        {canManage && (
          <section className="flex flex-col gap-3" aria-labelledby="invite-heading">
            <h4 id="invite-heading" className="text-sm font-semibold">
              Invite someone
            </h4>
            {!newLink ? (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Their role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                  className="px-2 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="member">As a member</option>
                  <option value="admin">As an admin (can invite too)</option>
                </select>
                <button
                  type="button"
                  onClick={makeLink}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Create invite link"}
                </button>
              </div>
            ) : (
              <InviteLinkBox link={newLink} onToast={onToast} onAnother={() => setNewLink(null)} />
            )}
            {error && (
              <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
                {error}
              </p>
            )}
            <Reachability shareUrl={me.shareUrl ?? null} onToast={onToast} />
          </section>
        )}

        <section className="flex flex-col gap-2" aria-label="Members">
          <div className="max-h-60 overflow-y-auto flex flex-col divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
            {members.map((m) => {
              const login = displayLogin(m.email)
              return (
                <div key={m.user_id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-semibold flex items-center justify-center text-slate-600 dark:text-slate-200">
                    {initials(m.name, login)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {m.name || login}
                      {m.user_id === me.id && <span className="font-normal text-slate-400"> (you)</span>}
                    </p>
                    {m.name && m.name !== login && <p className="text-xs text-slate-400 truncate">{login}</p>}
                  </div>
                  <span className="text-xs font-semibold text-slate-500 capitalize">{m.role}</span>
                  {me.isServerAdmin && m.user_id !== me.id && (
                    <button
                      type="button"
                      onClick={() => setResetTarget(m)}
                      title="Reset password"
                      aria-label={`Reset password for ${m.name || login}`}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      <KeyRound size={14} />
                    </button>
                  )}
                  {canManage && m.role !== "owner" && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await onRemove(m.user_id)
                          onToast("Removed from the workspace")
                        } catch (e) {
                          onToast(e instanceof Error ? e.message : "Failed")
                        }
                      }}
                      aria-label={`Remove ${m.name || login}`}
                      className="p-2 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
            {canManage &&
              openLinks.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-8 h-8 rounded-full border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400">
                    <Link2 size={14} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">Invite link, not used yet</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {l.role === "admin" ? "Admin" : "Member"} · made {timeAgo(l.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deleteInviteLink(teamId, l.id)
                        loadLinks()
                        onToast("Link cancelled. It no longer works.")
                      } catch (e) {
                        onToast(e instanceof Error ? e.message : "Failed")
                      }
                    }}
                    aria-label="Cancel this invite link"
                    title="Cancel link"
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            {canManage &&
              invites.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 opacity-70">
                  <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-xs flex items-center justify-center text-slate-400">
                    @
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{inv.email}</p>
                    <p className="text-xs text-slate-500">Older email invitation · {inv.role}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await onCancelInvite(inv.id)
                        onToast("Invitation cancelled")
                      } catch (e) {
                        onToast(e instanceof Error ? e.message : "Failed")
                      }
                    }}
                    aria-label={`Cancel invitation for ${inv.email}`}
                    title="Cancel invitation"
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Everyone here sees every project in {teamName}. To keep a project to yourself, use ⋯ next to it → Move to
            workspace.
          </p>
        </section>
      </div>
    </ModalShell>
  )
}

/** A fresh invite link, ready to copy. It's shown once: only its hash is stored. */
function InviteLinkBox({ link, onToast, onAnother }: { link: string; onToast: (m: string) => void; onAnother: () => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      onToast("Invite link copied")
    } catch {
      onToast("Select the link and copy it yourself")
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
      <div className="flex items-center gap-2">
        <input
          aria-label="Invite link"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
        />
        <button
          type="button"
          onClick={copy}
          className="px-3 py-2 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg"
        >
          Copy
        </button>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Send it in any chat. It works once, for one person, for 7 days. They open it, pick a username and password,
        and they're in.
      </p>
      <button
        type="button"
        onClick={onAnother}
        className="self-start text-xs font-semibold text-brand dark:text-indigo-300 hover:underline"
      >
        Create another link
      </button>
    </div>
  )
}

/**
 * Whether the people you invite can reach this BugsTow at all, and if not,
 * how to fix it: the Wi-Fi (`bugstow start --lan`) or Tailscale (`bugstow share`).
 */
function Reachability({ shareUrl, onToast }: { shareUrl: string | null; onToast: (m: string) => void }) {
  const desktop = isDesktopEdition()
  const onlyThisComputer = !shareUrl && connectionKind() === "localhost"
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      onToast("Command copied")
    } catch {
      onToast("Select it and copy it yourself")
    }
  }
  const Cmd = ({ text }: { text: string }) => (
    <button
      type="button"
      onClick={() => copy(text)}
      title="Copy"
      className="font-mono px-1 rounded bg-amber-100 dark:bg-amber-900/60 hover:underline"
    >
      {text}
    </button>
  )

  if (shareUrl) {
    return (
      <p className="text-xs text-slate-600 dark:text-slate-300">
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">Shared through Tailscale.</span> The link
        opens for people you've shared this PC with in Tailscale (
        <a
          href="https://login.tailscale.com/admin/machines"
          target="_blank"
          rel="noopener noreferrer"
          className="selection-button"
        >
          Machines
        </a>{" "}
        → this PC → ⋯ → Share) who have the Tailscale app. Keep this PC on while they use it.
      </p>
    )
  }
  if (onlyThisComputer && desktop) {
    return (
      <div
        role="note"
        className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-2"
      >
        <p>
          <strong>Right now links only open on this computer.</strong> Let people reach it first:
        </p>
        <p>
          <strong>Same Wi-Fi or office:</strong> run <Cmd text="bugstow start --lan" /> and open this panel from the
          address it prints.
        </p>
        <p>
          <strong>Somewhere else:</strong> install{" "}
          <a href="https://tailscale.com/download" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
            Tailscale
          </a>{" "}
          (free) on this PC and theirs, run <Cmd text="bugstow share" />, then reopen this panel.
        </p>
      </div>
    )
  }
  if (onlyThisComputer) {
    return (
      <p role="note" className="text-xs text-amber-800 dark:text-amber-300">
        Nobody else can open this address. Set <code>BUGSTOW_BASE_URL</code> to the server's network address (see
        docs/SELF_HOSTING.md).
      </p>
    )
  }
  return desktop ? (
    <p className="text-xs text-slate-600 dark:text-slate-300">
      The link works for people on the same network as this PC, while it's on. For someone elsewhere, run{" "}
      <code>bugstow share</code> (Tailscale).
    </p>
  ) : null
}

const INPUT_CLS =
  "w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"

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
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < 8)
      return setErr("The new password needs at least 8 characters.")
    if (next !== confirm) return setErr("The new passwords don't match.")
    if (next === current)
      return setErr("Pick a password different from the current one.")
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
          error.code === "INVALID_PASSWORD"
            ? `${currentLabel} is incorrect.`
            : error.message || "Could not change the password.",
        )
        return
      }
      onDone()
    } catch {
      setErr("Could not reach the team server.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {err && (
        <div
          role="alert"
          className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
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
          onChange={(e) => setCurrent(e.target.value)}
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
          onChange={(e) => setNext(e.target.value)}
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
          onChange={(e) => setConfirm(e.target.value)}
          className={INPUT_CLS}
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg disabled:opacity-50"
      >
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  )
}

/** Server admin: issue a one-time temporary password for a teammate. */
function ResetPasswordDialog({
  member,
  onClose,
}: {
  member: TeamMember
  onClose: () => void
}) {
  const who = member.name || displayLogin(member.email) || "this person"
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
      setErr(e instanceof Error ? e.message : "Could not reset the password.")
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
      setErr("Copy is blocked here. Select the password and copy it manually.")
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound size={18} /> Reset password
          </h3>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="p-2 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>
        {err && (
          <div
            role="alert"
            className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
          >
            <AlertCircle size={14} className="shrink-0" /> {err}
          </div>
        )}
        {temp ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Temporary password for{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {who}
              </strong>
              . Give it to them in person or over a channel you trust. It won't
              be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-base tracking-wide select-all break-all">
                {temp}
              </code>
              <button
                type="button"
                onClick={copy}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}{" "}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              They were signed out everywhere and will be asked to choose a new
              password when they sign in.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This creates a one-time password for{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {who}
              </strong>
              {member.name && member.email && member.name !== displayLogin(member.email) ? ` (${displayLogin(member.email)})` : ""}. Their
              current password stops working and they're signed out on every
              device.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {busy ? "Resetting…" : "Reset password"}
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
      .catch((e) =>
        setErr(e instanceof Error ? e.message : "Could not load backups."),
      )
  useEffect(() => {
    void load()
  }, [])

  const backupNow = async () => {
    setBusy(true)
    setErr(null)
    setDone(null)
    try {
      const res = await runBackupNow()
      setDone(
        !res.external.configured
          ? "Backup saved on this disk."
          : res.external.lastError
            ? "Backup saved on this disk. The copy to the second drive failed (see below)."
            : "Backup saved on this disk and on the second drive.",
      )
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Backup failed.")
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
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Archive size={18} /> Backups
          </h3>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="p-2 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        {err && (
          <div
            role="alert"
            className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
          >
            <AlertCircle size={14} className="shrink-0" /> {err}
          </div>
        )}
        {done && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {done}
          </p>
        )}

        {!status && !err ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : status ? (
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-slate-500">On this disk</dt>
            <dd>
              {status.backups.length} kept
              {latest ? `, newest ${formatBackupName(latest)}` : ""}
              <span className="block text-xs text-slate-500">
                {status.automatic
                  ? `Automatic every ${status.intervalHours} h, keeping ${status.retention}.`
                  : "Automatic backups are off."}{" "}
                Same disk as the live data.
              </span>
            </dd>
            <dt className="text-slate-500">Second drive</dt>
            <dd>
              {!ext?.configured ? (
                <span className="text-amber-700 dark:text-amber-400">
                  Not set up. If this disk fails, the backups are lost with it.
                  {isDesktopEdition()
                    ? " Add BUGSTOW_BACKUP_EXTERNAL_DIR to bugstow.env (docs/INSTALL.md)."
                    : " Set BUGSTOW_BACKUP_EXTERNAL_DIR (docs/RELEASE_OFFLINE.md §8)."}
                </span>
              ) : ext.lastError ? (
                <span className="text-red-700 dark:text-red-400">
                  Last attempt failed: {ext.lastError}
                </span>
              ) : (
                <>
                  {ext.backups.length} kept in{" "}
                  <code className="font-mono text-xs break-all">{ext.dir}</code>
                  {ext.lastSuccessAt && (
                    <span className="block text-xs text-slate-500">
                      Last copied {new Date(ext.lastSuccessAt).toLocaleString()}
                      .
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
          className="w-full py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg disabled:opacity-50"
        >
          {busy ? "Backing up…" : "Back up now"}
        </button>
        <p className="text-xs text-slate-500">
          Restoring is done on the server computer; see docs/RELEASE_OFFLINE.md
          §8.
        </p>
      </div>
    </ModalShell>
  )
}

/** "2026-09-23T10-30-00-000Z" → local date/time. */
function formatBackupName(name: string): string {
  const iso = name.replace(/T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z$/, "T$1:$2:$3.$4Z")
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? name : d.toLocaleString()
}

// ── Copy Local issues into the team ──────────────────────────────────────────
type CopySummary = { projects: number; issues: number; screenshots: number }

function summarize(d: BackupData): CopySummary {
  return { projects: d.projects.length, issues: d.issues.length, screenshots: d.screenshots.length }
}

const copiedKey = (teamId: string) => `bugstow_local_copied_${teamId}`

function MigrateModal({
  teamId,
  teamName,
  projectToCopy,
  onClose,
  onDone,
  onToast,
}: {
  teamId: string
  teamName: string
  projectToCopy?: { id: string; name: string } | null
  onClose: () => void
  onDone: (result: MigrationResult) => void
  onToast: (m: string) => void
}) {
  // Local lives in this same browser (same address), so it can be read
  // directly. A backup file covers Local from another device.
  const [local, setLocal] = useState<BackupData | null | "loading">("loading")
  const [useFile, setUseFile] = useState(false)
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null)
  const [encrypted, setEncrypted] = useState(false)
  const [passphrase, setPassphrase] = useState("")
  const [fileData, setFileData] = useState<BackupData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const copiedBefore = (() => {
    try {
      return localStorage.getItem(copiedKey(teamId))
    } catch {
      return null
    }
  })()

  useEffect(() => {
    let alive = true
    createBackupData()
      .then((d) => {
        const source = projectToCopy ? selectProjectBackup(d, projectToCopy.id) : d
        if (alive) setLocal(source.projects.length || source.issues.length ? source : null)
      })
      .catch(() => {
        if (alive) setLocal(null)
      })
    return () => {
      alive = false
    }
  }, [projectToCopy])

  const onFile = (file: File) => {
    setError(null)
    setFileData(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        setRaw(parsed)
        const check = validateBackupStructure(parsed)
        if (!check.isValid) {
          setError(check.error || "That isn’t a BugsTow backup file.")
          return
        }
        setEncrypted(Boolean(check.isEncrypted))
        if (!check.isEncrypted && check.data) setFileData(check.data)
      } catch {
        setError("Could not read that file.")
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
        setError(check.error || "The decrypted backup is damaged.")
        return
      }
      setFileData(check.data)
    } catch {
      setError("Wrong passphrase, or the file is damaged.")
    } finally {
      setBusy(false)
    }
  }

  const fromLocal = !useFile && local !== null && local !== "loading"
  const source = fromLocal ? (local as BackupData) : fileData
  const summary = source ? summarize(source) : null

  const run = async () => {
    if (!source) return
    setBusy(true)
    setError(null)
    try {
      const result = await migrateBackupToTeam(source, teamId, (msg) => onToast(msg))
      if (fromLocal) {
        try {
          localStorage.setItem(copiedKey(teamId), new Date().toISOString())
        } catch {
          // only used for the "copied before" note
        }
      }
      onDone(result)
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : "Copying stopped.") + " Issues copied so far are kept.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold">
            {projectToCopy ? `Copy ${projectToCopy.name} to ${teamName}` : `Copy Local issues into ${teamName}`}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="p-2 -mt-1 text-slate-400">
            <X size={16} />
          </button>
        </div>

        {local === "loading" && !useFile ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Looking for Local issues in this browser…</p>
        ) : fromLocal ? (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {projectToCopy
              ? `This copies the project and its issues to ${teamName}. The Local project stays where it is.`
              : "Found in Local, in this browser. Your Local issues stay where they are; this adds copies here."}
          </p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {local === null && !useFile
              ? projectToCopy
                ? "That Local project could not be found in this browser. Switch back to Local and try again."
                : "Local in this browser is empty. To bring issues from another device, download a backup there (Settings → Data & backups) and choose it here."
              : "Choose a backup file downloaded from Local (Settings → Data & backups)."}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2"
          >
            <AlertCircle size={14} className="shrink-0" /> {error}
          </div>
        )}

        {!projectToCopy && !fromLocal && local !== "loading" && !raw && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 py-6 text-sm text-slate-600 dark:text-slate-300 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg hover:border-brand"
          >
            <Upload size={18} /> Choose a backup file (.json)
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
          }}
        />

        {!fromLocal && raw && encrypted && !fileData && (
          <div className="flex flex-col gap-2.5">
            <label className="text-sm font-medium" htmlFor="copy-passphrase">
              This backup is encrypted. Its passphrase:
            </label>
            <input
              id="copy-passphrase"
              autoFocus
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"
            />
            <button
              type="button"
              disabled={busy || !passphrase}
              onClick={decrypt}
              className="w-full py-2.5 text-sm font-semibold text-white bg-brand rounded-lg disabled:opacity-50"
            >
              {busy ? "Opening…" : "Open backup"}
            </button>
          </div>
        )}

        {summary && (
          <>
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700 text-center">
              {(
                [
                  ["Projects", summary.projects],
                  ["Issues", summary.issues],
                  ["Screenshots", summary.screenshots],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="bg-white dark:bg-slate-900 py-3">
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{n}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Completed issues stay completed. Projects with the same name are reused, and GitHub issues already here
              aren’t copied twice.
              {fromLocal &&
                copiedBefore &&
                ` You copied Local here on ${new Date(copiedBefore).toLocaleDateString()}; copying again adds its other issues again.`}
            </p>
            <button
              type="button"
              disabled={busy || summary.issues + summary.projects === 0}
              onClick={run}
              className="w-full py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover rounded-lg disabled:opacity-50"
            >
              {busy
                ? "Copying…"
                : projectToCopy
                  ? `Copy project to ${teamName}`
                  : `Copy ${summary.issues} issue${summary.issues === 1 ? "" : "s"} into ${teamName}`}
            </button>
          </>
        )}

        {fromLocal && !projectToCopy && (
          <button
            type="button"
            onClick={() => setUseFile(true)}
            className="self-start text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline underline-offset-2"
          >
            Use a backup file from another device instead
          </button>
        )}
      </div>
    </ModalShell>
  )
}
