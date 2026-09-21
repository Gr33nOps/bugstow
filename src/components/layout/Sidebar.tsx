import React, { useState } from 'react'
import {
  Inbox,
  FolderOpen,
  CheckCircle2,
  Settings as SettingsIcon,
  Shield,
  Plus,
  ChevronRight,
  ChevronDown,
  Circle,
  HardDrive,
  Keyboard,
  Sparkles,
  Command,
} from 'lucide-react'
import type { Tab, Project } from '../../types'
import { BugstowLogoIcon, BRAND_PRIMARY } from '../common/Icon'

interface SidebarProps {
  currentTab: Tab
  onSelectTab: (tab: Tab) => void
  inboxCount: number
  fixedCount: number
  projects: Project[]
  activeProjectFilterId?: string | null
  onSelectProjectFilter: (projectId: string | null) => void
  onNewIssue: () => void
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
  onCreateProject,
  collapsed = false,
  onToggleCollapse,
  storageEstimateText,
}: SidebarProps) {
  const [projectsExpanded, setProjectsExpanded] = useState(true)

  if (collapsed) {
    return (
      <aside className="w-16 shrink-0 bg-[#F9FAFB] border-r border-slate-200/80 flex flex-col items-center py-4 select-none h-full justify-between">
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Logo */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('inbox')
              onSelectProjectFilter(null)
            }}
            className="p-2 rounded-xl hover:bg-slate-200/60 transition-colors"
            title="Bugstow Inbox"
          >
            <BugstowLogoIcon size={24} color={BRAND_PRIMARY} />
          </button>

          {/* Quick Capture */}
          <button
            type="button"
            onClick={onNewIssue}
            className="w-10 h-10 rounded-xl bg-[#5B50F6] hover:bg-[#4E44E6] text-white flex items-center justify-center shadow-xs transition-transform active:scale-95"
            title="New Issue (⌘K)"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>

          <div className="w-8 h-px bg-slate-200" />

          {/* Icon Tabs */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('inbox')
              onSelectProjectFilter(null)
            }}
            className={`p-2.5 rounded-xl transition-colors relative ${
              currentTab === 'inbox' && !activeProjectFilterId
                ? 'bg-[#EEF0FF] text-[#5B50F6]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={`Inbox (${inboxCount})`}
          >
            <Inbox size={20} />
            {inboxCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#5B50F6]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('projects')}
            className={`p-2.5 rounded-xl transition-colors ${
              currentTab === 'projects'
                ? 'bg-[#EEF0FF] text-[#5B50F6]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Projects"
          >
            <FolderOpen size={20} />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('fixed')}
            className={`p-2.5 rounded-xl transition-colors ${
              currentTab === 'fixed'
                ? 'bg-[#EEF0FF] text-[#5B50F6]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title={`Fixed (${fixedCount})`}
          >
            <CheckCircle2 size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className={`p-2.5 rounded-xl transition-colors ${
              currentTab === 'settings'
                ? 'bg-[#EEF0FF] text-[#5B50F6]'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Settings & Backup"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-64 shrink-0 bg-[#F9FAFB] border-r border-slate-200/80 flex flex-col h-full select-none justify-between">
      {/* Top section: Brand & Navigation */}
      <div className="flex flex-col overflow-hidden">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <button
            type="button"
            onClick={() => {
              onSelectTab('inbox')
              onSelectProjectFilter(null)
            }}
            className="flex items-center gap-2 text-left group"
          >
            <BugstowLogoIcon size={22} color={BRAND_PRIMARY} />
            <div className="flex items-center gap-1.5">
              <span className="text-[16px] font-bold text-slate-900 tracking-tight">bugstow.</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                local
              </span>
            </div>
          </button>
        </div>

        {/* Action Button: Capture Issue */}
        <div className="px-3.5 mb-3">
          <button
            type="button"
            onClick={onNewIssue}
            className="w-full flex items-center justify-between px-3 py-2 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl transition-all shadow-xs active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <Plus size={16} strokeWidth={2.5} />
              <span>Capture Issue</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-mono text-white/90">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="px-3 flex flex-col gap-0.5 overflow-y-auto">
          {/* Inbox */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('inbox')
              onSelectProjectFilter(null)
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors text-left ${
              currentTab === 'inbox' && !activeProjectFilterId
                ? 'bg-[#EEF0FF] text-[#5B50F6] font-semibold'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <Inbox
              size={17}
              className={currentTab === 'inbox' && !activeProjectFilterId ? 'text-[#5B50F6]' : 'text-slate-400'}
            />
            <span className="flex-1">Inbox</span>
            {inboxCount > 0 && (
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  currentTab === 'inbox' && !activeProjectFilterId
                    ? 'bg-[#5B50F6] text-white'
                    : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {inboxCount}
              </span>
            )}
          </button>

          {/* Fixed */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('fixed')
              onSelectProjectFilter(null)
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors text-left ${
              currentTab === 'fixed'
                ? 'bg-[#EEF0FF] text-[#5B50F6] font-semibold'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            <CheckCircle2
              size={17}
              className={currentTab === 'fixed' ? 'text-[#5B50F6]' : 'text-slate-400'}
            />
            <span className="flex-1">Fixed</span>
            {fixedCount > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600">
                {fixedCount}
              </span>
            )}
          </button>

          {/* Projects Group with Expandable Subtree */}
          <div className="mt-4 pt-3 border-t border-slate-200/70">
            <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <button
                type="button"
                onClick={() => setProjectsExpanded(prev => !prev)}
                className="flex items-center gap-1 hover:text-slate-700 transition-colors"
              >
                {projectsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>Projects</span>
                <span className="font-normal text-slate-400">({projects.length})</span>
              </button>

              <div className="flex items-center gap-1">
                {onCreateProject && (
                  <button
                    type="button"
                    onClick={onCreateProject}
                    className="p-1 rounded hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                    title="Add new project"
                  >
                    <Plus size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelectTab('projects')}
                  className="hover:text-slate-700 text-[10px] font-medium lowercase transition-colors"
                  title="Manage all projects"
                >
                  view all
                </button>
              </div>
            </div>

            {projectsExpanded && (
              <div className="flex flex-col gap-0.5 pl-2 mt-1">
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-slate-400 italic">
                    No projects yet
                  </div>
                ) : (
                  projects.map(proj => {
                    const isFiltered = activeProjectFilterId === proj.id
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => {
                          onSelectTab('inbox')
                          onSelectProjectFilter(isFiltered ? null : proj.id)
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors text-left ${
                          isFiltered
                            ? 'bg-[#EEF0FF] text-[#5B50F6] font-semibold'
                            : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: proj.color }}
                        />
                        <span className="truncate flex-1">{proj.name}</span>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Bottom section: Settings & Local Storage Status */}
      <div className="p-3 border-t border-slate-200/80 flex flex-col gap-1.5 bg-[#F9FAFB]">
        {/* Settings button */}
        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors text-left ${
            currentTab === 'settings'
              ? 'bg-[#EEF0FF] text-[#5B50F6] font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <SettingsIcon
            size={17}
            className={currentTab === 'settings' ? 'text-[#5B50F6]' : 'text-slate-400'}
          />
          <span className="flex-1">Settings & Backup</span>
        </button>

        {/* Local Vault Card */}
        <div className="px-3 py-2.5 rounded-xl bg-white border border-slate-200/70 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-slate-700">Local Vault</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-medium">100% Private</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-tight">
            {storageEstimateText || 'Stored in browser storage. No cloud leaks.'}
          </p>
        </div>
      </div>
    </aside>
  )
}
