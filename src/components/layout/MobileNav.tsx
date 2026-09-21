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
    <header className="flex md:hidden items-center justify-between px-4 py-3.5 border-b border-gray-100 bg-white sticky top-0 z-30">
      {/* Left button */}
      {hasBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 active:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
      ) : (
        <button
          type="button"
          onClick={onToggleMenu}
          aria-label="Menu"
          className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 active:bg-gray-100 transition-colors"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Center logo */}
      <div className="flex items-center gap-1.5">
        <BugstowLogoIcon size={24} color={BRAND_PRIMARY} />
      </div>

      {/* Right + Capture button */}
      {onOpenNewIssue ? (
        <button
          type="button"
          onClick={onOpenNewIssue}
          aria-label="Capture Issue"
          className="w-10 h-10 rounded-full bg-[#5B50F6] active:bg-[#4E44E6] text-white flex items-center justify-center shadow-md transition-transform active:scale-95"
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
    { id: 'inbox' as Tab, label: 'Inbox', icon: Inbox, count: inboxCount },
    { id: 'projects' as Tab, label: 'Projects', icon: FolderOpen },
    { id: 'fixed' as Tab, label: 'Fixed', icon: CheckCircle2, count: fixedCount },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ]

  return (
    <nav className="flex md:hidden border-t border-gray-100 bg-white sticky bottom-0 z-30 pb-safe">
      {tabs.map(tab => {
        const isActive = currentTab === tab.id
        const IconComponent = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative transition-colors"
            style={{ color: isActive ? BRAND_PRIMARY : '#9CA3AF' }}
          >
            <div className="relative">
              <IconComponent size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              {tab.count !== undefined && tab.count > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-[#5B50F6] text-white text-[9px] font-bold flex items-center justify-center">
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium tracking-tight">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
