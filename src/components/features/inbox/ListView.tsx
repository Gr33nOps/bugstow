import React, { useState, useMemo, useEffect } from 'react'
import { Plus, Search, ChevronDown, Filter, X, SlidersHorizontal } from 'lucide-react'
import type { Issue, Project, IssueType } from '../../../types'
import { IssueRow } from './IssueRow'
import { EmptyState } from './EmptyState'
import { BRAND_PRIMARY } from '../../common/Icon'

interface ListViewProps {
  title: string
  subtitle: string
  issues: Issue[]
  projects: Project[]
  screenshotUrls: Record<string, string>
  selectedIssueId?: string | null
  onSelectIssue: (issue: Issue) => void
  onNewIssue: () => void
  onToggleFixed: (issue: Issue) => void
  onCopyPrompt: (issue: Issue) => void
  onDeleteIssue: (issue: Issue) => void
  emptyHeading?: string
  emptySub?: string
  showCaptureOnEmpty?: boolean
  activeProjectFilter?: string | null
  onClearProjectFilter?: () => void
  searchQuery?: string
  onSearchChange?: (q: string) => void
  typeFilter?: IssueType | 'all'
  onTypeFilterChange?: (t: IssueType | 'all') => void
}

export function ListView({
  title,
  subtitle,
  issues,
  projects,
  screenshotUrls,
  selectedIssueId,
  onSelectIssue,
  onNewIssue,
  onToggleFixed,
  onCopyPrompt,
  onDeleteIssue,
  emptyHeading = 'Nothing to fix. Yet.',
  emptySub = 'Capture bugs, feedback or ideas while you build.',
  showCaptureOnEmpty = true,
  activeProjectFilter,
  onClearProjectFilter,
  searchQuery: externalSearch,
  onSearchChange: externalOnSearchChange,
  typeFilter: externalTypeFilter,
  onTypeFilterChange: externalOnTypeFilterChange,
}: ListViewProps) {
  // Local fallback states if not controlled by parent
  const [internalSearch, setInternalSearch] = useState('')
  const [internalTypeFilter, setInternalTypeFilter] = useState<IssueType | 'all'>('all')
  const [projectFilter, setProjectFilter] = useState<string>(activeProjectFilter || 'all')

  const search = externalSearch !== undefined ? externalSearch : internalSearch
  const setSearch = externalOnSearchChange || setInternalSearch
  const typeFilter = externalTypeFilter !== undefined ? externalTypeFilter : internalTypeFilter
  const setTypeFilter = externalOnTypeFilterChange || setInternalTypeFilter

  useEffect(() => {
    if (activeProjectFilter !== undefined) {
      setProjectFilter(activeProjectFilter || 'all')
    }
  }, [activeProjectFilter])

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // Search by title or description
      if (search.trim()) {
        const query = search.toLowerCase()
        const matchTitle = issue.title.toLowerCase().includes(query)
        const matchDesc = issue.description.toLowerCase().includes(query)
        if (!matchTitle && !matchDesc) return false
      }

      // Filter by type
      if (typeFilter !== 'all' && issue.type !== typeFilter) {
        return false
      }

      // Filter by project
      if (projectFilter !== 'all') {
        if (projectFilter === 'unassigned') {
          if (issue.projectId !== null) return false
        } else if (issue.projectId !== projectFilter) {
          return false
        }
      }

      return true
    })
  }, [issues, search, typeFilter, projectFilter])

  const typePills: Array<{ value: IssueType | 'all'; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'bug', label: 'Bug' },
    { value: 'uiux', label: 'UI/UX' },
    { value: 'idea', label: 'Idea' },
  ]

  const activeProjectObj = projects.find(p => p.id === projectFilter)

  if (issues.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
        <EmptyState
          heading={emptyHeading}
          subheading={emptySub}
          actionLabel="Capture Issue"
          onAction={showCaptureOnEmpty ? onNewIssue : undefined}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900 transition-colors">
      {/* Sticky Sub-Header & Controls Bar */}
      <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Project selector & mobile controls */}
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          {/* Mobile Search input */}
          <div className="relative md:hidden flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#5B50F6] text-slate-900 dark:text-slate-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Project selector dropdown */}
          <div className="relative min-w-0 max-w-[16rem]">
            <select
              aria-label="Filter by project"
              value={projectFilter}
              onChange={e => {
                setProjectFilter(e.target.value)
                if (e.target.value === 'all' && onClearProjectFilter) {
                  onClearProjectFilter()
                }
              }}
              className="w-full truncate appearance-none pl-3.5 pr-8 py-1.5 text-sm font-medium bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#5B50F6] transition-colors cursor-pointer"
            >
              <option value="all">All Projects</option>
              <option value="unassigned">Unassigned</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          {/* Active project tag if filtered */}
          {activeProjectObj && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[#EEF0FF] dark:bg-[#5B50F6]/20 text-[#5B50F6] dark:text-[#7C74FF]">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: activeProjectObj.color }}
              />
              <span>{activeProjectObj.name}</span>
              {onClearProjectFilter && (
                <button
                  type="button"
                  onClick={onClearProjectFilter}
                  className="hover:text-[#251D98] text-[#5B50F6] ml-1"
                >
                  <X size={12} />
                </button>
              )}
            </span>
          )}

          {/* Type pills on mobile */}
          <div className="flex lg:hidden items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {typePills.map(pill => {
              const active = typeFilter === pill.value
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setTypeFilter(pill.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    active
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {pill.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Count indicator */}
        <div className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
          Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredIssues.length}</span> of {issues.length}
        </div>
      </div>

      {/* Issues list scroll area (a size container: rows adapt to its width) */}
      <div className="flex-1 overflow-y-auto @container">
        {filteredIssues.length === 0 ? (
          <div className="p-16 text-center text-slate-400 dark:text-slate-500 text-sm">
            No issues match your current filters.{' '}
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setTypeFilter('all')
                setProjectFilter('all')
                if (onClearProjectFilter) onClearProjectFilter()
              }}
              className="text-[#5B50F6] dark:text-[#7C74FF] font-semibold hover:underline ml-1"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredIssues.map(issue => (
            <IssueRow
              key={issue.id}
              issue={issue}
              project={projects.find(p => p.id === issue.projectId)}
              screenshotUrl={
                issue.screenshotId ? screenshotUrls[issue.screenshotId] : undefined
              }
              selected={selectedIssueId === issue.id}
              onClick={() => onSelectIssue(issue)}
              onToggleFixed={e => {
                e.stopPropagation()
                onToggleFixed(issue)
              }}
              onCopyPrompt={e => {
                e.stopPropagation()
                onCopyPrompt(issue)
              }}
              onDelete={e => {
                e.stopPropagation()
                onDeleteIssue(issue)
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
