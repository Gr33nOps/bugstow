import React, { useState, useMemo } from 'react'
import { Plus, Search, ChevronDown, Filter, X } from 'lucide-react'
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
}

export function ListView({
  title,
  subtitle,
  issues,
  projects,
  screenshotUrls,
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
}: ListViewProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<IssueType | 'all'>('all')
  const [projectFilter, setProjectFilter] = useState<string>(activeProjectFilter || 'all')

  // Keep project filter synced if parent changed it
  React.useEffect(() => {
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
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-bold text-gray-900 tracking-tight">{title}</h1>
            {activeProjectObj && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-gray-100 text-gray-700">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeProjectObj.color }}
                />
                {activeProjectObj.name}
                {onClearProjectFilter && (
                  <button
                    type="button"
                    onClick={onClearProjectFilter}
                    className="hover:text-gray-900 text-gray-400 ml-1"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            )}
          </div>
          <p className="text-[13px] text-gray-400 mt-0.5">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onNewIssue}
          className="hidden md:flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-[#5B50F6] hover:bg-[#4E44E6] active:bg-[#4338CA] rounded-xl transition-all shadow-sm active:scale-98"
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>Capture Issue</span>
        </button>
      </div>

      {/* Filters & Search bar */}
      <div className="flex items-center gap-3 px-6 pb-4 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search issues..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-[13px] bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#5B50F6] focus:ring-2 focus:ring-[#5B50F6]/15 transition-colors placeholder:text-gray-400"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Type pills */}
        <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-100">
          {typePills.map(pill => {
            const isActive = typeFilter === pill.value
            return (
              <button
                key={pill.value}
                type="button"
                onClick={() => setTypeFilter(pill.value)}
                className={`px-3 py-1 text-[12px] font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-xs font-semibold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {pill.label}
              </button>
            )
          })}
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
            className="appearance-none pl-3.5 pr-8 py-1.5 text-[13px] font-medium bg-white border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-[#5B50F6] transition-colors cursor-pointer"
          >
            <option value="all">All Projects</option>
            <option value="unassigned">Unassigned</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filteredIssues.length === 0 ? (
          issues.length === 0 ? (
            <EmptyState
              heading={emptyHeading}
              subheading={emptySub}
              actionLabel="Capture Issue"
              onAction={showCaptureOnEmpty ? onNewIssue : undefined}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-150">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mb-3">
                <Search size={22} />
              </div>
              <p className="text-[15px] font-semibold text-gray-800">No matching issues</p>
              <p className="text-[13px] text-gray-400 mt-1 max-w-xs">
                Try searching for something else or reset your active filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setTypeFilter('all')
                  setProjectFilter('all')
                  if (onClearProjectFilter) onClearProjectFilter()
                }}
                className="mt-4 text-[13px] font-semibold text-[#5B50F6] hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )
        ) : (
          <div className="bg-white border border-gray-200/90 rounded-2xl overflow-hidden shadow-xs">
            {filteredIssues.map(issue => {
              const proj = projects.find(p => p.id === issue.projectId)
              const shotUrl = issue.screenshotId ? screenshotUrls[issue.screenshotId] : undefined
              return (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  project={proj}
                  screenshotUrl={shotUrl}
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
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
