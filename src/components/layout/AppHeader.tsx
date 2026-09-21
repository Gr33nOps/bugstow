import React from 'react'
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Plus,
  Command,
  HelpCircle,
  ShieldCheck,
  X,
  SlidersHorizontal,
  ChevronRight,
  Inbox,
  FolderOpen,
  CheckCircle2,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import type { Tab, Project, IssueType } from '../../types'
import type { Theme } from '../../hooks/useTheme'
import { BRAND_PRIMARY } from '../common/Icon'

interface AppHeaderProps {
  currentTab: Tab
  activeProject?: Project | null
  onClearProjectFilter?: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  typeFilter: IssueType | 'all'
  onTypeFilterChange: (type: IssueType | 'all') => void
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
  onClearProjectFilter,
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  onNewIssue,
  onOpenKeyboardShortcuts,
  sidebarCollapsed,
  onToggleSidebar,
  issueCount,
  storageUsedFormatted,
  theme,
  onToggleTheme,
}: AppHeaderProps) {
  const tabTitles: Record<Tab, { label: string; icon: React.ElementType }> = {
    inbox: { label: 'Inbox', icon: Inbox },
    projects: { label: 'Projects', icon: FolderOpen },
    fixed: { label: 'Fixed Issues', icon: CheckCircle2 },
    settings: { label: 'Settings', icon: SettingsIcon },
  }

  const currentTabMeta = tabTitles[currentTab] || tabTitles.inbox
  const TabIcon = currentTabMeta.icon

  const typeOptions: Array<{ value: IssueType | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'bug', label: 'Bugs' },
    { value: 'uiux', label: 'UI/UX' },
    { value: 'idea', label: 'Ideas' },
  ]

  return (
    <header className="hidden md:flex h-16 shrink-0 items-center justify-between px-6 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-20 select-none transition-colors">
      {/* Left: Sidebar toggle & Breadcrumbs */}
      <div className="flex items-center gap-3.5 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 truncate">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-[15px]">
            <TabIcon size={18} className="text-[#5B50F6]" />
            <span>{currentTabMeta.label}</span>
          </div>

          {activeProject && (
            <>
              <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: activeProject.color }}
                />
                <span className="truncate max-w-[160px]">{activeProject.name}</span>
                {onClearProjectFilter && (
                  <button
                    type="button"
                    onClick={onClearProjectFilter}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ml-0.5"
                    title="Clear project filter"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </>
          )}

          {issueCount !== undefined && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 ml-1">
              {issueCount}
            </span>
          )}
        </div>
      </div>

      {/* Center: Search Bar */}
      {(currentTab === 'inbox' || currentTab === 'fixed') && (
        <div className="relative w-80 lg:w-96 max-w-md mx-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search issues, notes, or prompts..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm bg-slate-100/80 dark:bg-slate-800/80 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:bg-white dark:focus:bg-slate-900 focus:border-[#5B50F6] focus:ring-2 focus:ring-[#5B50F6]/15 rounded-xl transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none text-slate-900 dark:text-slate-100"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
            >
              <X size={14} />
            </button>
          ) : (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500 text-xs font-mono">
              <span>/</span>
            </div>
          )}
        </div>
      )}

      {/* Right: Type filters, Theme toggle, Vault badge, New Issue */}
      <div className="flex items-center gap-3">
        {/* Type filter pills */}
        {(currentTab === 'inbox' || currentTab === 'fixed') && (
          <div className="hidden lg:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            {typeOptions.map(opt => {
              const active = typeFilter === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onTypeFilterChange(opt.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Theme Toggle Button (Light / Dark) */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Toggle dark/light theme"
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={`Current theme: ${theme}. Click to switch theme.`}
        >
          {theme === 'dark' ? (
            <Moon size={18} className="text-indigo-400" />
          ) : theme === 'light' ? (
            <Sun size={18} className="text-amber-500" />
          ) : (
            <Monitor size={18} className="text-slate-500 dark:text-slate-400" />
          )}
        </button>

        {/* Local-first status badge */}
        <div
          className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60"
          title={storageUsedFormatted ? `${storageUsedFormatted} stored locally in browser` : '100% private local vault'}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Vault</span>
        </div>

        {/* Keyboard shortcuts helper */}
        <button
          type="button"
          onClick={onOpenKeyboardShortcuts}
          aria-label="Keyboard Shortcuts"
          className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Keyboard shortcuts (⌘/ or ?)"
        >
          <HelpCircle size={18} />
        </button>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onNewIssue}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl transition-all shadow-xs active:scale-98"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>New Issue</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 bg-white/20 rounded text-[11px] font-mono font-medium ml-1">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  )
}
