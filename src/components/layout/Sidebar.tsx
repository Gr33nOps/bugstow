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
      <aside className="w-18 shrink-0 bg-[#F9FAFB] dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col items-center py-5 select-none h-full justify-between transition-colors">
        <div className="flex flex-col items-center gap-5 w-full">
          {/* Logo */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('inbox')
              onSelectProjectFilter(null)
            }}
            className="p-2.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Bugstow Inbox"
          >
            <BugstowLogoIcon size={26} color={BRAND_PRIMARY} />
          </button>

          {/* Quick Capture */}
          <button
            type="button"
            onClick={onNewIssue}
            className="w-11 h-11 rounded-xl bg-[#5B50F6] hover:bg-[#4E44E6] text-white flex items-center justify-center shadow-xs transition-transform active:scale-95"
            title="New Issue (⌘K)"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>

          <div className="w-8 h-px bg-slate-200 dark:bg-slate-800" />

          {/* Icon Tabs */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('inbox')
              onSelectProjectFilter(null)
            }}
            className={`p-3 rounded-xl transition-colors relative ${
              currentTab === 'inbox' && !activeProjectFilterId
                ? 'bg-[#EEF0FF] dark:bg-[#5B50F6]/20 text-[#5B50F6] dark:text-[#7C74FF]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={`Inbox (${inboxCount})`}
          >
            <Inbox size={21} />
            {inboxCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#5B50F6]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('projects')}
            className={`p-3 rounded-xl transition-colors ${
              currentTab === 'projects'
                ? 'bg-[#EEF0FF] dark:bg-[#5B50F6]/20 text-[#5B50F6] dark:text-[#7C74FF]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Projects"
          >
            <FolderOpen size={21} />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('fixed')}
            className={`p-3 rounded-xl transition-colors ${
              currentTab === 'fixed'
                ? 'bg-[#EEF0FF] dark:bg-[#5B50F6]/20 text-[#5B50F6] dark:text-[#7C74FF]'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={`Fixed (${fixedCount})`}
          >
            <CheckCircle2 size={21} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => onSelectTab('settings')}
            className={`p-3 rounded-xl transition-colors ${
              currentTab === 'settings'
                ? 'bg-[#EEF0FF] dark:bg-[#5B50F6]/20 text-[#5B50F6] dark:text-[#7C74FF]'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Settings & Backup"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-68 shrink-0 bg-[#F9FAFB] dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col h-full select-none justify-between transition-colors">
      {/* Top section: Brand & Navigation */}
      <div className="flex flex-col overflow-hidden">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <button
            type="button"
            onClick={() => {
              onSelectTab('inbox')
              onSelectProjectFilter(null)
            }}
            className="flex items-center gap-2.5 text-left group"
          >
            <BugstowLogoIcon size={24} color={BRAND_PRIMARY} />
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">bugstow.</span>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                local
              </span>
            </div>
          </button>
        </div>

        {/* Action Button: Capture Issue */}
        <div className="px-4 mb-4">
          <button
            type="button"
            onClick={onNewIssue}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl transition-all shadow-xs active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <Plus size={18} strokeWidth={2.5} />
              <span>Capture Issue</span>
            </div>
            <kbd className="px-2 py-0.5 rounded-md bg-white/20 text-xs font-mono text-white/90">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="px-3 flex flex-col gap-1 overflow-y-auto">
          {/* Inbox */}
          <button
            type="button"
            onClick={() => {
              onSelectTab('inbox')
              onSelectProjectFilter(null)
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              currentTab === 'inbox' && !activeProjectFilterId
                ? 'bg-[#EEF0FF] dark:bg-[#5B50F6]/20 text-[#5B50F6] dark:text-[#7C74FF] font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Inbox
              size={19}
              className={currentTab === 'inbox' && !activeProjectFilterId ? 'text-[#5B50F6] dark:text-[#7C74FF]' : 'text-slate-400 dark:text-slate-500'}
            />
            <span className="flex-1">Inbox</span>
            {inboxCount > 0 && (
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                  currentTab === 'inbox' && !activeProjectFilterId
                    ? 'bg-[#5B50F6] text-white'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
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
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
              currentTab === 'fixed'
                ? 'bg-[#EEF0FF] dark:bg-[#5B50F6]/20 text-[#5B50F6] dark:text-[#7C74FF] font-semibold'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CheckCircle2
              size={19}
              className={currentTab === 'fixed' ? 'text-[#5B50F6] dark:text-[#7C74FF]' : 'text-slate-400 dark:text-slate-500'}
            />
            <span className="flex-1">Fixed Issues</span>
            {fixedCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {fixedCount}
              </span>
            )}
          </button>

          {/* Projects Group with Expandable Subtree */}
          <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center justify-between px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <button
                type="button"
                onClick={() => setProjectsExpanded(prev => !prev)}
                className="flex items-center gap-1.5 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              >
                {projectsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <span>Projects</span>
                <span className="font-normal text-slate-400 dark:text-slate-500">({projects.length})</span>
              </button>

              <div className="flex items-center gap-1.5">
                {onCreateProject && (
                  <button
                    type="button"
                    onClick={onCreateProject}
                    className="p-1 rounded-md hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    title="Add new project"
                  >
                    <Plus size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelectTab('projects')}
                  className="hover:text-slate-700 dark:hover:text-slate-300 text-xs font-medium lowercase transition-colors"
                  title="Manage all projects"
                >
                  view all
                </button>
              </div>
            </div>

            {projectsExpanded && (
              <div className="flex flex-col gap-0.5 pl-2 mt-1">
                {projects.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                    No projects created yet
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
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left ${
                          isFiltered
                            ? 'bg-[#EEF0FF] dark:bg-[#5B50F6]/20 text-[#5B50F6] dark:text-[#7C74FF] font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
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
      <div className="p-3.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-col gap-2 bg-[#F9FAFB] dark:bg-slate-900">
        {/* Settings button */}
        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
            currentTab === 'settings'
              ? 'bg-[#EEF0FF] dark:bg-[#5B50F6]/20 text-[#5B50F6] dark:text-[#7C74FF] font-semibold'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <SettingsIcon
            size={19}
            className={currentTab === 'settings' ? 'text-[#5B50F6] dark:text-[#7C74FF]' : 'text-slate-400 dark:text-slate-500'}
          />
          <span className="flex-1">Settings & Backup</span>
        </button>

        {/* Local Vault Card */}
        <div className="px-3.5 py-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Local Vault</span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">100% Private</span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug">
            {storageEstimateText || 'All data stays on this device.'}
          </p>
        </div>
      </div>
    </aside>
  )
}
