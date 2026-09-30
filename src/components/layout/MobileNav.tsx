import React from 'react'
import { Menu, Plus, ArrowLeft, Inbox, FolderOpen, CheckCircle2, Settings } from 'lucide-react'
import type { Tab } from '../../types'
import { BugstowLogoIcon, BRAND_PRIMARY } from '../common/Icon'

interface MobileHeaderProps {
  currentTab: Tab
  hasBack?: boolean
  onBack?: () => void
  onOpenNewIssue?: () => void
  onToggleMenu?: () => void
}

export function MobileHeader({
  currentTab,
  hasBack,
  onBack,
  onOpenNewIssue,
  onToggleMenu,
}: MobileHeaderProps) {
  return (
    <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 transition-colors">
      {/* Left button */}
      {hasBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:bg-slate-200 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label="Menu"
          className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 active:bg-slate-200 transition-colors"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Center logo */}
      <div className="flex items-center gap-2">
        <BugstowLogoIcon size={24} color={BRAND_PRIMARY} />
        <span className="font-semibold text-base text-slate-900 dark:text-white tracking-tight">BugsTow</span>
      </div>

      {/* Right + Capture button */}
      {onOpenNewIssue ? (
        <button
          type="button"
          onClick={onOpenNewIssue}
          aria-label="New issue"
          className="w-10 h-10 rounded-full bg-brand active:bg-brand-hover text-white flex items-center justify-center shadow-md transition-transform active:scale-95"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      ) : (
        <div className="w-10 h-10" />
      )}
    </header>
  )
}

interface MobileBottomNavProps {
  currentTab: Tab
  onSelectTab: (tab: Tab) => void
  inboxCount?: number
  fixedCount?: number
}

export function MobileBottomNav({ currentTab, onSelectTab, inboxCount, fixedCount }: MobileBottomNavProps) {
  const tabs = [
    { id: 'inbox' as Tab, label: 'Open', icon: Inbox, count: inboxCount },
    { id: 'projects' as Tab, label: 'Projects', icon: FolderOpen },
    { id: 'fixed' as Tab, label: 'Completed', icon: CheckCircle2, count: fixedCount },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ]

  return (
    <nav className="flex md:hidden border-t border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky bottom-0 z-30 pb-safe transition-colors">
      {tabs.map(tab => {
        const isActive = currentTab === tab.id
        const IconComponent = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-colors ${
              isActive
                ? 'text-brand dark:text-indigo-400 font-semibold'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative">
              <IconComponent size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              {tab.count !== undefined && tab.count > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-brand text-white text-xs font-semibold flex items-center justify-center">
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </div>
            <span className="text-xs tracking-tight">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
