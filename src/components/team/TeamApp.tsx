import React, { useState, useEffect, useMemo, useRef } from "react"
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
} from "lucide-react"
import { filterTeamIssues } from "../../lib/teamFilters"
import { useTeamData } from "../../hooks/useTeamData"
import { signOut, authClient } from "../../lib/authClient"
import {
  getMe,
  resetUserPassword,
  IssueConflictError,
  listBackups,
  runBackupNow,
  type BackupStatus,
} from "../../services/teamApi"
import { connectionKind } from "../../lib/connection"
import { GithubImportModal } from "../features/github/GithubImportModal"
import { BugstowLogoIcon, BRAND_PRIMARY, GithubMark } from "../common/Icon"
import { ModeSwitch } from "../common/ModeSwitch"
import { isDesktopEdition } from "../../lib/teamServer"
import { generateIssuePrompt } from "../../services/promptService"
import {
  validateBackupStructure,
  decryptBackup,
  createBackupData,
} from "../../services/backupService"
import { migrateBackupToTeam, type MigrationResult } from "../../services/teamMigration"
import { getDB } from "../../storage/db"
import type { IssueType, BackupData, EncryptedBackupPayload } from "../../types"
import type { TeamIssue, TeamMember, CurrentUser } from "../../types/team"

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
  const [query, setQuery] = useState("")
  const [projectFilter, setProjectFilter] = useState("all")
  useEffect(() => {
    setProjectFilter("all")
    setSelectedId(null)
  }, [activeTeamId])
  const [typeFilter, setTypeFilter] = useState<IssueType | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"open" | "fixed" | "all">(
    "open",
  )
  const [showNew, setShowNew] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showMigrate, setShowMigrate] = useState(false)
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
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showBackups, setShowBackups] = useState(false)
  const [moving, setMoving] = useState<{ id: string; name: string } | null>(null)
  const canMoveProjects = activeTeam?.role === "owner" || activeTeam?.role === "admin"
  const [toast, setToast] = useState<string | null>(null)

  const notify = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  const filtered = useMemo(
    () =>
      filterTeamIssues(issues, {
        query,
        project: projectFilter,
        status: statusFilter,
        type: typeFilter,
      }),
    [issues, query, projectFilter, statusFilter, typeFilter],
  )

  const selected = issues.find((i) => i.id === selectedId) || null

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
      <aside
        aria-label="Team navigation"
        className="app-sidebar hidden lg:flex w-60 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800"
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
            aria-current={statusFilter === "open" ? "page" : undefined}
            onClick={() => {
              setStatusFilter("open")
              setSelectedId(null)
            }}
          >
            <Inbox size={18} />
            <span className="flex-1 text-left">Open issues</span>
            <span className="text-xs">
              {issues.filter((i) => i.status === "open").length}
            </span>
          </button>
          <button
            type="button"
            className="nav-item"
            aria-current={statusFilter === "fixed" ? "page" : undefined}
            onClick={() => {
              setStatusFilter("fixed")
              setSelectedId(null)
            }}
          >
            <CheckCircle2 size={18} />
            <span className="flex-1 text-left">Completed</span>
            <span className="text-xs">
              {issues.filter((i) => i.status === "fixed").length}
            </span>
          </button>
        </nav>
        <div className="px-3 mt-7 flex-1 overflow-y-auto">
          <p className="px-3 mb-2 text-xs text-slate-500 dark:text-slate-400">
            Your projects
          </p>
          <button
            type="button"
            className="nav-item"
            aria-current={projectFilter === "all" ? "page" : undefined}
            onClick={() => setProjectFilter("all")}
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
            onClick={() => setShowMembers(true)}
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
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        {/* relative z-20: its menus (workspace switcher) must open above the page below. */}
        <header className="relative z-20 flex items-center gap-2 px-3 sm:px-5 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur-sm shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTeamMenu((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm max-w-[45vw] sm:max-w-xs"
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
                onMouseLeave={() => setShowTeamMenu(false)}
              >
                {teams.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTeamId(t.id)
                      setSelectedId(null)
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
              title="This server runs in offline mode. All features work locally; only GitHub import is disabled."
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
            >
              <WifiOff size={12} /> Offline
            </span>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setShowImport(true)}
            aria-label="Import from GitHub"
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <GithubMark size={16} />{" "}
            <span className="hidden sm:inline">Import from GitHub</span>
          </button>
          <button
            type="button"
            onClick={() => setShowMembers(true)}
            aria-label="People and invitations"
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <Users size={16} />{" "}
            <span className="hidden sm:inline">Invite people</span>
          </button>
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
                : "Open issues"}
          </h1>
          <p className="page-description">
            {activeTeam?.name || "Your workspace"} · {filtered.length} issue
            {filtered.length === 1 ? "" : "s"}
          </p>
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
            aria-label="Issue status"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="open">Open</option>
            <option value="fixed">Completed</option>
            <option value="all">All statuses</option>
          </select>
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
          <select
            aria-label="Project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="lg:hidden max-w-40 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex">
          <div
            className={`${
              selected ? "hidden md:flex" : "flex"
            } flex-col bg-white dark:bg-slate-900 w-full ${
              selected ? "md:w-[340px] xl:w-[400px]" : ""
            } border-r border-slate-200 dark:border-slate-800 overflow-y-auto`}
          >
            {loading ? (
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
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => setSelectedId(issue.id)}
                  className={`w-full text-left px-5 py-4 border-b border-slate-100 dark:border-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                    selectedId === issue.id
                      ? "bg-indigo-50/60 dark:bg-indigo-950/30"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <TypeBadge type={issue.type} />
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
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2">
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
              ))
            )}
          </div>

          <div className={`${selected ? "flex" : "hidden"} flex-1 min-w-0`}>
            {selected ? (
              <IssueDetail
                key={selected.id}
                issue={selected}
                members={members}
                projects={projects}
                loadScreenshotUrl={data.loadScreenshotUrl}
                onUpdate={data.updateIssue}
                onReload={data.replaceIssue}
                onDelete={async (id) => {
                  await data.deleteIssue(id)
                  setSelectedId(null)
                  notify("Issue deleted")
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
              notify("Issue created")
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
            onClose={() => setShowMigrate(false)}
            onDone={async (r) => {
              setShowMigrate(false)
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
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: IssueType }) {
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
  return (
    <div className="relative">
      <button
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
          onMouseLeave={() => setOpen(false)}
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
function ProjectMenu({ name, onMove }: { name: string; onMove: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="absolute right-1 top-1/2 -translate-y-1/2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`More for ${name}`}
        aria-expanded={open}
        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 focus:opacity-100 aria-expanded:opacity-100"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 mt-1 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onMove()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FolderInput size={15} /> Move to workspace…
          </button>
        </div>
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
        className="flex-1 px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={busy}
        className="px-2 py-1 text-sm font-semibold text-white bg-brand rounded-lg disabled:opacity-50"
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
    updates: Partial<{
      title: string
      description: string
      type: IssueType
      status: "open" | "fixed"
      projectId: string | null
      assigneeId: string | null
    }>,
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
    Promise.all(issue.screenshot_ids.map((id) => loadScreenshotUrl(id)))
      .then((urls) => {
        if (alive) setShots(urls.filter((u): u is string => Boolean(u)))
      })
      .catch(() => {
        // Screenshots are optional; the issue still opens without them.
        if (alive) setShots([])
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
      onToast(e instanceof Error ? e.message : "Update failed")
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
      issue.project_id
        ? {
            id: issue.project_id,
            name: issue.project_name || "Project",
            color: "#0f766e",
            createdAt: "",
            updatedAt: "",
          }
        : null,
    )
    try {
      await navigator.clipboard.writeText(text)
      onToast("Prompt copied")
    } catch {
      onToast("Copy failed")
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex items-center gap-2 px-5 h-12 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close issue"
          className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
        >
          <X size={18} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={copyPrompt}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
        >
          <Copy size={14} /> Copy for AI
        </button>
        <button
          type="button"
          onClick={() =>
            saveField({ status: issue.status === "open" ? "fixed" : "open" })
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg ${
            issue.status === "open"
              ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          <Check size={14} />{" "}
          {issue.status === "open" ? "Mark fixed" : "Reopen"}
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
            className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-sm text-amber-900 dark:text-amber-100 flex flex-col gap-2"
          >
            <p className="flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong className="font-semibold">
                  This issue was changed by another teammate.
                </strong>{" "}
                Reload it before saving. Your last change was not saved; copy
                any text you want to keep first.
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
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() =>
            title.trim() &&
            title !== issue.title &&
            saveField({ title: title.trim() })
          }
          className="w-full text-lg font-semibold bg-transparent focus:outline-none text-slate-900 dark:text-white"
        />

        <div className="flex flex-wrap gap-2 text-xs">
          <Select
            label="Type"
            value={issue.type}
            onChange={(v) => saveField({ type: v as IssueType })}
            options={[
              { value: "bug", label: "Bug" },
              { value: "uiux", label: "UI/UX" },
              { value: "idea", label: "Idea" },
            ]}
          />
          <Select
            label="Project"
            value={issue.project_id || ""}
            onChange={(v) => saveField({ projectId: v || null })}
            options={[
              { value: "", label: "Unassigned" },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          <Select
            label="Assignee"
            value={issue.assignee_id || ""}
            onChange={(v) => saveField({ assigneeId: v || null })}
            options={[
              { value: "", label: "Unassigned" },
              ...members.map((m) => ({
                value: m.user_id,
                label: m.name || m.email || m.user_id,
              })),
            ]}
          />
        </div>

        {issue.github_url && (
          <a
            href={issue.github_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline w-fit"
          >
            <GitBranch size={13} /> View on GitHub #{issue.github_number}{" "}
            <ExternalLink size={11} />
          </a>
        )}

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            description !== issue.description && saveField({ description })
          }
          placeholder="Add a description…"
          rows={6}
          className="w-full px-3.5 py-3 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand resize-y text-slate-800 dark:text-slate-100"
        />

        {shots.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {shots.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <img
                  src={url}
                  alt="Screenshot"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 w-full"
                />
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
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-slate-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

// ── Modals ───────────────────────────────────────────────────────────────────
function ModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workspace dialog"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
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
    data: {
      title: string
      description: string
      type: IssueType
      projectId: string | null
      assigneeId: string | null
    },
    screenshot?: { base64: string; mimeType: string; filename?: string },
  ) => Promise<TeamIssue>
  onClose: () => void
  onDone: () => void
}) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<IssueType>("bug")
  const [projectId, setProjectId] = useState("")
  const [assigneeId, setAssigneeId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const img = Array.from(e.clipboardData?.items || []).find((i) =>
        i.type.startsWith("image/"),
      )
      const f = img?.getAsFile()
      if (f) {
        setFile(f)
        setPreview(URL.createObjectURL(f))
      }
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
    setBusy(true)
    setErr(null)
    try {
      let shot: {
        base64: string
        mimeType: string
        filename?: string
      } | undefined
      if (file) {
        const { base64, mimeType } = await fileToBase64(file)
        shot = { base64, mimeType, filename: file.name }
      }
      await onCreate(
        {
          title: title.trim(),
          description,
          type,
          projectId: projectId || null,
          assigneeId: assigneeId || null,
        },
        shot,
      )
      onDone()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not create issue.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">New issue</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
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
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's the issue?"
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details (optional)"
          rows={3}
          className="w-full px-4 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand resize-y"
        />
        <div className="grid grid-cols-3 gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as IssueType)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="bug">Bug</option>
            <option value="uiux">UI/UX</option>
            <option value="idea">Idea</option>
          </select>
          <select
            value={projectId}
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
            onChange={(e) => setAssigneeId(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name || m.email}
              </option>
            ))}
          </select>
        </div>

        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="preview"
              className="rounded-lg border border-slate-200 dark:border-slate-700 max-h-40 w-auto"
            />
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
            className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:border-brand"
          >
            <ImagePlus size={16} /> Paste (Ctrl/⌘+V) or click to attach a
            screenshot
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
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
  members,
  invites,
  onInvite,
  onCancelInvite,
  onRemove,
  onClose,
  onToast,
}: {
  role: "owner" | "admin" | "member"
  me: CurrentUser
  members: TeamMember[]
  invites: { id: string; email: string; role: string }[]
  onInvite: (email: string, role: "admin" | "member") => Promise<void>
  onCancelInvite: (inviteId: string) => Promise<void>
  onRemove: (userId: string) => Promise<void>
  onClose: () => void
  onToast: (m: string) => void
}) {
  const [email, setEmail] = useState("")
  const [lastInvited, setLastInvited] = useState("")
  const [inviteError, setInviteError] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member")
  const [busy, setBusy] = useState(false)
  const canManage = role === "owner" || role === "admin"
  const [resetTarget, setResetTarget] = useState<TeamMember | null>(null)

  if (resetTarget) {
    return (
      <ResetPasswordDialog
        member={resetTarget}
        onClose={() => setResetTarget(null)}
      />
    )
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users size={18} /> People & invitations
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-2 text-slate-400"
          >
            <X size={16} />
          </button>
        </div>

        {canManage && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!email.includes("@")) {
                onToast("Enter a valid email")
                return
              }
              setBusy(true)
              setInviteError("")
              try {
                await onInvite(email.trim(), inviteRole)
                setLastInvited(email.trim().toLowerCase())
                setEmail("")
                onToast("Ready. Share the join link with your teammate.")
              } catch (e2) {
                setInviteError(
                  e2 instanceof Error
                    ? e2.message
                    : "Could not invite. Try again.",
                )
              } finally {
                setBusy(false)
              }
            }}
            className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto] gap-2"
          >
            <input
              type="email"
              required
              aria-label="Teammate email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@email.com"
              className="min-w-0 col-span-2 sm:col-span-1 flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"
            />
            <select
              aria-label="Team role"
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "admin" | "member")
              }
              className="px-2 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={busy}
              className="px-3 py-2 text-sm font-semibold text-white bg-brand rounded-lg disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create invitation"}
            </button>
          </form>
        )}
        <div className="max-h-60 overflow-y-auto flex flex-col divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <span className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-semibold flex items-center justify-center text-slate-600 dark:text-slate-200">
                {initials(m.name, m.email)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.name || m.email}
                </p>
                <p className="text-xs text-slate-400 truncate">{m.email}</p>
              </div>
              <span className="text-xs font-semibold text-slate-500 capitalize">
                {m.role}
              </span>
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
              {canManage && m.role !== "owner" && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await onRemove(m.user_id)
                      onToast("Member removed")
                    } catch (e) {
                      onToast(e instanceof Error ? e.message : "Failed")
                    }
                  }}
                  aria-label={`Remove ${m.name || m.email}`}
                  className="p-2 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 px-3 py-2.5 opacity-70"
            >
              <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-xs flex items-center justify-center text-slate-400">
                @
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{inv.email}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Pending · {inv.role}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setLastInvited(inv.email)}
                  className="px-2 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-300"
                >
                  Share link
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await onCancelInvite(inv.id)
                      onToast("Invite cancelled")
                    } catch (e) {
                      onToast(e instanceof Error ? e.message : "Failed")
                    }
                  }}
                  aria-label={`Cancel invite for ${inv.email}`}
                  title="Cancel invite"
                  className="p-1 text-slate-400 hover:text-rose-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {inviteError && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {inviteError}
          </p>
        )}
        {canManage && (
          <HowTheyJoin email={lastInvited} shareUrl={me.shareUrl ?? null} onToast={onToast} />
        )}
      </div>
    </ModalShell>
  )
}

/**
 * BugsTow never sends email (no internet service is involved), so an invite is
 * only a name on a list. This says so, gives the join link to send yourself,
 * and, when that link can't be opened by anyone else, says how to fix that:
 * `bugstow share` (Tailscale) for people on other networks.
 */
function HowTheyJoin({
  email,
  shareUrl,
  onToast,
}: {
  email: string
  /** Set while the desktop app is shared through Tailscale. */
  shareUrl: string | null
  onToast: (m: string) => void
}) {
  const base = shareUrl || window.location.origin
  const address = email ? `${base}/#join=${encodeURIComponent(email)}` : base
  const desktop = isDesktopEdition()
  const onlyThisComputer = !shareUrl && connectionKind() === "localhost"
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      onToast(`${what} copied`)
    } catch {
      onToast("Select it and copy it yourself")
    }
  }
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3.5 flex flex-col gap-2.5 text-sm">
      <p className="font-semibold">
        {email ? `Send ${email} this link` : "How people join"}
      </p>
      <p className="text-slate-600 dark:text-slate-300">
        BugsTow doesn't send emails. Invite their email above, then send them
        the link in your own chat or email. They open it and create an account
        with that same email. Invitations last 7 days.
      </p>
      <div className="flex items-center gap-2">
        <input
          aria-label="Join link"
          readOnly
          value={address}
          onFocus={(e) => e.target.select()}
          className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
        />
        <button
          type="button"
          onClick={() => copy(address, "Link")}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Copy
        </button>
      </div>

      {shareUrl && (
        <div
          role="note"
          className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col gap-1.5"
        >
          <p>
            <strong>Shared through Tailscale.</strong> For this link to open for
            them, your friend also needs:
          </p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>
              This PC shared with them in Tailscale:{" "}
              <a
                href="https://login.tailscale.com/admin/machines"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold"
              >
                Machines
              </a>{" "}
              → this PC → ⋯ → Share.
            </li>
            <li>The free Tailscale app, signed in, with your share accepted.</li>
          </ol>
          <p>Keep this computer on while they use BugsTow.</p>
        </div>
      )}

      {onlyThisComputer && desktop && (
        <div
          role="note"
          className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-1.5"
        >
          <p>
            <strong>Right now this link only opens on this computer.</strong>{" "}
            First let them reach it, one of two ways:
          </p>
          <dl className="grid gap-2">
            <div>
              <dt className="font-semibold">On the same Wi-Fi or office network</dt>
              <dd>
                In a terminal, run{" "}
                <button
                  type="button"
                  onClick={() => copy("bugstow start --lan", "Command")}
                  title="Copy"
                  className="font-mono px-1 rounded bg-amber-100 dark:bg-amber-900/60 hover:underline"
                >
                  bugstow start --lan
                </button>
                , then open this panel from the address it prints.
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Somewhere else</dt>
              <dd>
                Install{" "}
                <a
                  href="https://tailscale.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold"
                >
                  Tailscale
                </a>{" "}
                (free) on this PC and theirs, run{" "}
                <button
                  type="button"
                  onClick={() => copy("bugstow share", "Command")}
                  title="Copy"
                  className="font-mono px-1 rounded bg-amber-100 dark:bg-amber-900/60 hover:underline"
                >
                  bugstow share
                </button>{" "}
                and follow what it prints. Then reopen this panel.
              </dd>
            </div>
          </dl>
        </div>
      )}

      {desktop && !shareUrl && !onlyThisComputer && (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          This link works for people on the same network as this PC, while it’s on.
          For someone elsewhere, run <code>bugstow share</code> (Tailscale).
        </p>
      )}

      {onlyThisComputer && !desktop && (
        <div
          role="note"
          className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200"
        >
          <strong>Nobody else can open this address.</strong> Set{" "}
          <code>BUGSTOW_BASE_URL</code> to the server's network address (see
          docs/SELF_HOSTING.md), so teammates can open it.
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Want some projects to stay yours only? Keep them in a workspace nobody
        else is in: next to a project in the sidebar, choose ⋯ → Move to
        workspace.
      </p>
    </div>
  )
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
  const who = member.name || member.email || "this person"
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
              {member.name && member.email ? ` (${member.email})` : ""}. Their
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
  onClose,
  onDone,
  onToast,
}: {
  teamId: string
  teamName: string
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
        if (alive) setLocal(d.projects.length || d.issues.length ? d : null)
      })
      .catch(() => {
        if (alive) setLocal(null)
      })
    return () => {
      alive = false
    }
  }, [])

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
          <h3 className="text-lg font-semibold">Copy Local issues into {teamName}</h3>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="p-2 -mt-1 text-slate-400">
            <X size={16} />
          </button>
        </div>

        {local === "loading" && !useFile ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Looking for Local issues in this browser…</p>
        ) : fromLocal ? (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Found in Local, in this browser. Your Local issues stay where they are; this adds copies here.
          </p>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {local === null && !useFile
              ? "Local in this browser is empty. To bring issues from another device, download a backup there (Settings → Data & backups) and choose it here."
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

        {!fromLocal && local !== "loading" && !raw && (
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
                : `Copy ${summary.issues} issue${summary.issues === 1 ? "" : "s"} into ${teamName}`}
            </button>
          </>
        )}

        {fromLocal && (
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
