import {
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
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
  onNewIssue,
  onOpenKeyboardShortcuts,
  sidebarCollapsed,
  onToggleSidebar,
  theme,
  onToggleTheme,
}: AppHeaderProps) {
  const names = {
    inbox: "Open issues",
    fixed: "Completed",
    projects: "Projects",
    settings: "Settings",
  }
  return (
    <header className="hidden md:flex h-14 shrink-0 items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
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
      <div className="flex items-center gap-1">
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
