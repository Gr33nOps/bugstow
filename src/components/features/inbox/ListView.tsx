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
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
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
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Sticky Sub-Header & Controls Bar */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mobile search & project selector */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Mobile Search input (on desktop it's in AppHeader) */}
          <div className="relative md:hidden flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-[12px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#5B50F6] text-slate-800"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Project selector dropdown */}
          <div className="relative">
            <select
              value={projectFilter}
              onChange={e => {
                setProjectFilter(e.target.value)
                if (e.target.value === 'all' && onClearProjectFilter) {
                  onClearProjectFilter()
                }
              }}
              className="appearance-none pl-3 pr-7 py-1 text-[12px] font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg text-slate-700 focus:outline-none focus:border-[#5B50F6] transition-colors cursor-pointer"
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
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          {/* Active project tag if filtered */}
          {activeProjectObj && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#EEF0FF] text-[#5B50F6]">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: activeProjectObj.color }}
              />
              <span>{activeProjectObj.name}</span>
              {onClearProjectFilter && (
                <button
                  type="button"
                  onClick={onClearProjectFilter}
                  className="hover:text-[#251D98] text-[#5B50F6] ml-0.5"
                >
                  <X size={11} />
                </button>
              )}
            </span>
          )}

          {/* Type pills on mobile */}
          <div className="flex lg:hidden items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg">
            {typePills.map(pill => {
              const active = typeFilter === pill.value
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setTypeFilter(pill.value)}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all ${
                    active
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {pill.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Count and status */}
        <div className="text-[12px] text-slate-400 whitespace-nowrap">
          Showing <span className="font-semibold text-slate-700">{filteredIssues.length}</span> of {issues.length}
        </div>
      </div>

      {/* Issues list scroll area */}
      <div className="flex-1 overflow-y-auto">
        {filteredIssues.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-[13px]">
            No issues match your current filters.{' '}
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setTypeFilter('all')
                setProjectFilter('all')
                if (onClearProjectFilter) onClearProjectFilter()
              }}
              className="text-[#5B50F6] font-semibold hover:underline"
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
