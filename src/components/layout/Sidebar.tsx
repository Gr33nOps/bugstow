import {
  Inbox,
  FolderOpen,
  CheckCircle2,
  Settings,
  Plus,
  HardDrive,
  ChevronRight,
} from "lucide-react"
import type { Tab, Project } from "../../types"
import { BugstowLogoIcon, BRAND_PRIMARY, GithubMark } from "../common/Icon"
import { shortcut } from "../../lib/platform"

interface SidebarProps {
  currentTab: Tab
  onSelectTab: (tab: Tab) => void
  inboxCount: number
  fixedCount: number
  projects: Project[]
  activeProjectFilterId?: string | null
  onSelectProjectFilter: (projectId: string | null) => void
  onNewIssue: () => void
  onImportGithub?: () => void
  onCreateProject?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  storageEstimateText?: string
}

export function Sidebar({
  currentTab,
  onSelectTab,
  inboxCount,
  fixedCount,
  projects,
  activeProjectFilterId,
  onSelectProjectFilter,
  onNewIssue,
  onImportGithub,
  onCreateProject,
  collapsed = false,
  storageEstimateText,
}: SidebarProps) {
  const navigate = (tab: Tab) => {
    onSelectTab(tab)
    onSelectProjectFilter(null)
  }
  const items = [
    {
      id: "inbox" as const,
      label: "Open issues",
      icon: Inbox,
      count: inboxCount,
    },
    {
      id: "fixed" as const,
      label: "Completed",
      icon: CheckCircle2,
      count: fixedCount,
    },
    {
      id: "projects" as const,
      label: "Projects",
      icon: FolderOpen,
      count: projects.length,
    },
  ]
  return (
    <aside
      aria-label="Workspace navigation"
      className={`app-sidebar ${
        collapsed ? "w-18" : "w-64"
      } shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full`}
    >
      <button
        type="button"
        onClick={() => navigate("inbox")}
        aria-label="BugsTow home"
        className={`flex items-center gap-2.5 h-20 shrink-0 ${
          collapsed ? "justify-center" : "px-6"
        }`}
      >
        <BugstowLogoIcon size={26} color={BRAND_PRIMARY} />
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            BugsTow
          </span>
        )}
      </button>
      <div className="px-3">
        <button
          type="button"
          onClick={onNewIssue}
          title={`New issue (${shortcut("K")})`}
          aria-label="New issue"
          className={`w-full flex items-center ${
            collapsed ? "justify-center" : "gap-2.5"
          } rounded-lg bg-brand hover:bg-brand-hover text-white px-3 py-2.5 text-sm font-medium`}
        >
          <Plus size={18} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">New issue</span>
              <kbd className="text-xs opacity-70">{shortcut("K")}</kbd>
            </>
          )}
        </button>
      </div>
      <nav className="px-3 mt-6 space-y-1" aria-label="Main">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.id)}
            title={item.label}
            aria-label={item.label}
            aria-current={
              currentTab === item.id && !activeProjectFilterId
                ? "page"
                : undefined
            }
            className={`nav-item ${collapsed ? "justify-center" : ""}`}
          >
            <item.icon size={18} />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {item.count}
                </span>
              </>
            )}
          </button>
        ))}
      </nav>
      {!collapsed && (
        <div className="px-3 mt-7 flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center justify-between px-3 mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Your projects</span>
            {onCreateProject && (
              <button
                type="button"
                onClick={onCreateProject}
                aria-label="New project"
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
          {projects.length === 0 ? (
            <p className="px-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Group related issues in a project.
            </p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  onSelectTab("inbox")
                  onSelectProjectFilter(project.id)
                }}
                className="nav-item"
                aria-current={
                  activeProjectFilterId === project.id ? "page" : undefined
                }
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="truncate flex-1 text-left">
                  {project.name}
                </span>
                <ChevronRight size={13} className="text-slate-400" />
              </button>
            ))
          )}
        </div>
      )}
      {collapsed && <div className="flex-1" />}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
        {onImportGithub && (
          <button
            type="button"
            onClick={onImportGithub}
            className={`nav-item ${collapsed ? "justify-center" : ""}`}
            title="Import from GitHub"
            aria-label="Import from GitHub"
          >
            <GithubMark size={18} />
            {!collapsed && "Import from GitHub"}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate("settings")}
          className={`nav-item ${collapsed ? "justify-center" : ""}`}
          title="Settings"
          aria-label="Settings"
          aria-current={currentTab === "settings" ? "page" : undefined}
        >
          <Settings size={18} />
          {!collapsed && "Settings"}
        </button>
        {!collapsed && (
          <div className="px-3 pt-4 pb-2 text-xs text-slate-500 dark:text-slate-400">
            <p className="flex items-center gap-2">
              <HardDrive size={13} />
              Local, in this browser
            </p>
            {storageEstimateText && (
              <p className="mt-1.5 pl-5">{storageEstimateText}</p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
