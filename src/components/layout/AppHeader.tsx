import { useEffect, useRef } from "react"
import {
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  ChevronDown,
  Plus,
} from "lucide-react"
import type { Tab, Project, IssueType } from "../../types"
import type { Theme } from "../../hooks/useTheme"

interface AppHeaderProps {
  currentTab: Tab
  activeProject?: Project | null
  onClearProjectFilter?: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  typeFilter: IssueType | "all"
  onTypeFilterChange: (type: IssueType | "all") => void
  onImportGithub: () => void
  onExportGithub: () => void
  onCreateProject: () => void
  onNewIssue: () => void
  onOpenKeyboardShortcuts: () => void
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  issueCount?: number
  storageUsedFormatted?: string
  theme: Theme
  onToggleTheme: () => void
}

export function AppHeader({
  currentTab,
  activeProject,
  onImportGithub,
  onExportGithub,
  onCreateProject,
  onNewIssue,
  onOpenKeyboardShortcuts,
  sidebarCollapsed,
  onToggleSidebar,
  theme,
  onToggleTheme,
}: AppHeaderProps) {
  const actionsRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) actionsRef.current.open = false
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  const names = {
    inbox: "Open issues",
    trash: "Trash",
    fixed: "Completed",
    projects: "Projects",
    settings: "Settings",
  }
  return (
    <header className="relative z-20 hidden md:flex h-14 shrink-0 items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-3 min-w-0 text-sm">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
        <span className="text-slate-500 dark:text-slate-400">Workspace</span>
        <ChevronRight size={14} className="text-slate-400" />
        <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
          {activeProject?.name || names[currentTab]}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <details ref={actionsRef} data-popover className="relative mr-2 text-sm" onKeyDown={event => {
          if (event.key === 'Escape') { event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() }
        }}>
          <summary className="action-trigger">Actions <ChevronDown size={14} /></summary>
          <div className="absolute right-0 z-40 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {[
              { label: 'New project', action: onCreateProject },
              { label: 'Import from GitHub', action: onImportGithub },
              { label: 'Export to GitHub', action: onExportGithub },
            ].map(({ label, action }) => <button key={label} type="button" onClick={() => {
              if (actionsRef.current) { actionsRef.current.open = false; actionsRef.current.querySelector('summary')?.focus() }
              action()
            }}>{label}</button>)}
          </div>
        </details>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={`Change theme (currently ${theme})`}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {theme === "dark" ? (
            <Moon size={17} />
          ) : theme === "light" ? (
            <Sun size={17} />
          ) : (
            <Monitor size={17} />
          )}
        </button>
        <button
          type="button"
          onClick={onOpenKeyboardShortcuts}
          aria-label="Keyboard shortcuts"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <HelpCircle size={17} />
        </button>
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={onNewIssue}
            className="ml-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-brand text-white hover:bg-brand-hover"
          >
            <Plus size={16} />
            New issue
          </button>
        )}
      </div>
    </header>
  )
}
