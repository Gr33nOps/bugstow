import React from 'react'
import { Inbox, FolderOpen, CheckCircle2, Settings, Shield } from 'lucide-react'
import type { Tab } from '../../types'
import { BugstowLogoIcon, BRAND_PRIMARY, BRAND_BG_TINT } from '../common/Icon'

interface SidebarProps {
  currentTab: Tab
  onSelectTab: (tab: Tab) => void
  inboxCount: number
  fixedCount: number
}

export function Sidebar({ currentTab, onSelectTab, inboxCount, fixedCount }: SidebarProps) {
  const navItems = [
    { id: 'inbox' as Tab, label: 'Inbox', icon: Inbox, count: inboxCount },
    { id: 'projects' as Tab, label: 'Projects', icon: FolderOpen },
    { id: 'fixed' as Tab, label: 'Fixed', icon: CheckCircle2, count: fixedCount },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ]

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-100 flex flex-col h-full py-5 select-none">
      {/* macOS window control dots */}
      <div className="flex items-center gap-2 px-5 mb-5">
        <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/40 inline-block" />
        <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/40 inline-block" />
        <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/40 inline-block" />
      </div>

      {/* Brand logo & wordmark */}
      <div className="flex items-center gap-2 px-5 mb-6">
        <BugstowLogoIcon size={22} color={BRAND_PRIMARY} />
        <span className="text-[17px] font-bold text-gray-900 tracking-tight">bugstow</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 flex flex-col gap-1">
        {navItems.map(item => {
          const isActive = currentTab === item.id
          const IconComponent = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium transition-all text-left ${
                isActive
                  ? 'bg-[#EEF0FF] text-[#5B50F6] font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <IconComponent
                size={18}
                className={isActive ? 'text-[#5B50F6]' : 'text-gray-400'}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className="flex-1">{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-[#5B50F6] text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer privacy card matching Figma */}
      <div className="mx-3 mt-auto p-3.5 rounded-2xl border border-gray-100 bg-gray-50/70">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={14} className="text-gray-500" />
          <p className="text-[12px] font-semibold text-gray-700">Your data stays local</p>
        </div>
        <p className="text-[11px] text-gray-400 leading-snug">Private. Secure. Yours.</p>
      </div>
    </aside>
  )
}
