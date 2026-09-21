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
} from 'lucide-react'
import type { Tab, Project, IssueType } from '../../types'
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
    <header className="hidden md:flex h-14 shrink-0 items-center justify-between px-5 border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-20 select-none">
      {/* Left: Sidebar toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <div className="h-4 w-px bg-slate-200" />

        <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600 truncate">
          <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
            <TabIcon size={16} className="text-[#5B50F6]" />
            <span>{currentTabMeta.label}</span>
          </div>

          {activeProject && (
            <>
              <ChevronRight size={14} className="text-slate-400" />
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold text-[12px]">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: activeProject.color }}
                />
                <span className="truncate max-w-[140px]">{activeProject.name}</span>
                {onClearProjectFilter && (
                  <button
                    type="button"
                    onClick={onClearProjectFilter}
                    className="text-slate-400 hover:text-slate-700 ml-0.5"
                    title="Clear project filter"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </>
          )}

          {issueCount !== undefined && (
            <span className="text-[11px] font-medium text-slate-400 ml-1">
              ({issueCount})
            </span>
          )}
        </div>
      </div>

      {/* Center: Quick Search Bar (visible on inbox & fixed views) */}
      {(currentTab === 'inbox' || currentTab === 'fixed') && (
        <div className="relative w-80 lg:w-96 max-w-md mx-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search issues or prompts..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-8.5 pr-8 py-1.5 text-[13px] bg-slate-100/70 border border-transparent hover:border-slate-200 focus:bg-white focus:border-[#5B50F6] focus:ring-2 focus:ring-[#5B50F6]/15 rounded-lg transition-all placeholder:text-slate-400 outline-none text-slate-800"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
            >
              <X size={12} />
            </button>
          ) : (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none text-slate-400 text-[10px] font-mono">
              <span>/</span>
            </div>
          )}
        </div>
      )}

      {/* Right: Quick actions & status */}
      <div className="flex items-center gap-2.5">
        {/* Type filter pills (inbox & fixed) */}
        {(currentTab === 'inbox' || currentTab === 'fixed') && (
          <div className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
            {typeOptions.map(opt => {
              const active = typeFilter === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onTypeFilterChange(opt.value)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Local-first status badge */}
        <div
          className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-emerald-50/80 text-emerald-700 border border-emerald-200/60"
          title={storageUsedFormatted ? `${storageUsedFormatted} stored in browser IndexedDB` : '100% on-device storage'}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Local Vault</span>
        </div>

        {/* Keyboard shortcuts helper */}
        <button
          type="button"
          onClick={onOpenKeyboardShortcuts}
          aria-label="Keyboard Shortcuts"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          title="Keyboard shortcuts (⌘/ or ?)"
        >
          <HelpCircle size={16} />
        </button>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onNewIssue}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-lg transition-all shadow-xs active:scale-98"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>New Issue</span>
          <kbd className="hidden sm:inline-block px-1 py-0.2 bg-white/20 rounded text-[10px] font-mono font-medium ml-1">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  )
}
