import React, { useState, useMemo, useEffect } from "react"
import { Search } from "lucide-react"
import type { Issue, Project, IssueType, IssuePriority, IssueStatus } from "../../../types"
import { IssueRow } from "./IssueRow"
import { EmptyState } from "./EmptyState"
import { filterAndSortIssues, type WorkflowFilters } from '../../../lib/issueWorkflow'

interface ListViewProps {
  title: string
  subtitle: string
  issues: Issue[]
  projects: Project[]
  screenshotUrls: Record<string, string>
  selectedIssueId?: string | null
  onSelectIssue: (issue: Issue) => void
  onNewIssue: () => void
  onImportGithub?: () => void
  onToggleFixed: (issue: Issue) => void
  onCopyPrompt: (issue: Issue) => void
  onDeleteIssue: (issue: Issue) => void
  onBulkUpdate?: (ids: string[], changes: Partial<Pick<Issue, 'priority' | 'status' | 'projectId'>> & { trash?: boolean }) => Promise<void>
  emptyHeading?: string
  emptySub?: string
  showCaptureOnEmpty?: boolean
  activeProjectFilter?: string | null
  onClearProjectFilter?: () => void
  searchQuery?: string
  onSearchChange?: (q: string) => void
  typeFilter?: IssueType | "all"
  onTypeFilterChange?: (t: IssueType | "all") => void
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
  onImportGithub,
  onToggleFixed,
  onCopyPrompt,
  onDeleteIssue,
  onBulkUpdate,
  emptyHeading = "Nothing to fix. Yet.",
  emptySub = "Capture bugs, feedback or ideas while you build.",
  showCaptureOnEmpty = true,
  activeProjectFilter,
  onClearProjectFilter,
  searchQuery: externalSearch,
  onSearchChange: externalOnSearchChange,
  typeFilter: externalTypeFilter,
  onTypeFilterChange: externalOnTypeFilterChange,
}: ListViewProps) {
  // Local fallback states if not controlled by parent
  const [internalSearch, setInternalSearch] = useState("")
  const [internalTypeFilter, setInternalTypeFilter] =
    useState<IssueType | "all">("all")
  const [projectFilter, setProjectFilter] = useState<string>(
    activeProjectFilter || "all",
  )
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [sort, setSort] = useState<WorkflowFilters['sort']>('created')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [updatedFrom, setUpdatedFrom] = useState('')
  const [updatedTo, setUpdatedTo] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState('status')
  const [bulkValue, setBulkValue] = useState('fixed')

  const search = externalSearch !== undefined ? externalSearch : internalSearch
  const setSearch = externalOnSearchChange || setInternalSearch
  const typeFilter =
    externalTypeFilter !== undefined ? externalTypeFilter : internalTypeFilter
  const setTypeFilter = externalOnTypeFilterChange || setInternalTypeFilter

  useEffect(() => {
    if (activeProjectFilter !== undefined) {
      setProjectFilter(activeProjectFilter || "all")
    }
  }, [activeProjectFilter])

  const filteredIssues = useMemo(() => filterAndSortIssues(issues, {
    query: search, type: typeFilter, project: projectFilter, status: statusFilter,
    priority: priorityFilter, severity: severityFilter, sort, direction, createdFrom, createdTo, updatedFrom, updatedTo,
  }), [issues, search, typeFilter, projectFilter, statusFilter, priorityFilter, severityFilter, sort, direction, createdFrom, createdTo, updatedFrom, updatedTo])

  const typePills: Array<{ value: IssueType | "all"; label: string }> = [
    { value: "all", label: "All" },
    { value: "bug", label: "Bug" },
    { value: "uiux", label: "UI/UX" },
    { value: "idea", label: "Idea" },
  ]

  return (
    <section
      aria-label={title}
      className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900"
    >
      <div className="page-heading shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="page-title text-slate-900 dark:text-white">{title}</h1>
          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {issues.length}
          </span>
        </div>
        <p className="page-description">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-5 sm:px-7 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 min-w-40">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="search"
            aria-label="Search issues"
            placeholder="Search issues…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
          />
        </div>
        <select
          aria-label="Filter by project"
          value={projectFilter}
          onChange={(e) => {
            setProjectFilter(e.target.value)
            if (e.target.value === "all") onClearProjectFilter?.()
          }}
          className="max-w-44 px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
        >
          <option value="all">All projects</option>
          <option value="unassigned">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {title !== 'Completed' && <select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
          <option value="all">All active statuses</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="blocked">Blocked</option>
        </select>}
        <details className="w-full text-sm"><summary className="cursor-pointer text-slate-600 dark:text-slate-300">More filters and sorting</summary><div className="mt-3 flex flex-wrap gap-2">
        <select aria-label="Filter by priority" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
          <option value="all">All priorities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <select aria-label="Filter by severity" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
          <option value="all">All severities</option><option value="critical">Critical</option><option value="major">Major</option><option value="minor">Minor</option>
        </select>
        <select aria-label="Sort issues" value={sort} onChange={e => setSort(e.target.value as WorkflowFilters['sort'])} className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200">
          <option value="created">Created</option><option value="updated">Updated</option><option value="priority">Priority</option><option value="severity">Severity</option><option value="status">Status</option><option value="type">Type</option><option value="project">Project</option><option value="title">Title</option>
        </select>
        <button type="button" aria-label="Reverse sort order" onClick={() => setDirection(value => value === 'asc' ? 'desc' : 'asc')} className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">{direction === 'desc' ? 'Descending' : 'Ascending'}</button>
        <select
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as IssueType | "all")}
          className="px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
        >
          {typePills.map((p) => (
            <option key={p.value} value={p.value}>
              {p.value === "all" ? "All types" : p.label}
            </option>
          ))}
        </select>
        <label>Created from<input type="date" value={createdFrom} onChange={event => setCreatedFrom(event.target.value)} className="ml-2 rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></label>
        <label>Created to<input type="date" value={createdTo} onChange={event => setCreatedTo(event.target.value)} className="ml-2 rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></label>
        <label>Updated from<input type="date" value={updatedFrom} onChange={event => setUpdatedFrom(event.target.value)} className="ml-2 rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></label>
        <label>Updated to<input type="date" value={updatedTo} onChange={event => setUpdatedTo(event.target.value)} className="ml-2 rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" /></label>
        </div></details>
      </div>
      {onBulkUpdate && filteredIssues.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-2 text-sm dark:border-slate-700">
        <button type="button" onClick={() => setSelectedIds(filteredIssues.map(issue => issue.id))} className="underline">Select all {filteredIssues.length} filtered</button>
        {selectedIds.length > 0 && <><strong>{selectedIds.length} selected</strong><button type="button" onClick={() => setSelectedIds([])} className="underline">Clear</button>
          <select aria-label="Bulk action" value={bulkAction} onChange={event => { setBulkAction(event.target.value); setBulkValue(event.target.value === 'priority' ? 'medium' : event.target.value === 'status' ? 'fixed' : '') }} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"><option value="status">Change status</option><option value="priority">Change priority</option><option value="projectId">Move to project</option><option value="trash">Move to Trash</option></select>
          {bulkAction === 'status' && <select aria-label="New status" value={bulkValue} onChange={event => setBulkValue(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"><option value="open">Open</option><option value="in_progress">In Progress</option><option value="blocked">Blocked</option><option value="fixed">Fixed</option></select>}
          {bulkAction === 'priority' && <select aria-label="New priority" value={bulkValue} onChange={event => setBulkValue(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>}
          {bulkAction === 'projectId' && <select aria-label="Destination project" value={bulkValue} onChange={event => setBulkValue(event.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"><option value="">Unassigned</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}
          <button type="button" className="rounded bg-brand px-3 py-1.5 font-semibold text-white" onClick={async () => { if (bulkAction === 'trash' && !window.confirm(`Move ${selectedIds.length} issues to Trash?`)) return; try { await onBulkUpdate(selectedIds, bulkAction === 'trash' ? { trash: true } : bulkAction === 'priority' ? { priority: bulkValue as IssuePriority } : bulkAction === 'status' ? { status: bulkValue as IssueStatus } : { projectId: bulkValue || null }); setSelectedIds([]) } catch { /* parent shows the error */ } }}>Apply</button>
        </>}
      </div>}
      <div className="flex-1 min-h-0 overflow-y-auto @container flex flex-col">
        {issues.length === 0 ? (
          <EmptyState
            heading={emptyHeading}
            subheading={emptySub}
            actionLabel="New issue"
            onAction={showCaptureOnEmpty ? onNewIssue : undefined}
            onImportGithub={showCaptureOnEmpty ? onImportGithub : undefined}
          />
        ) : filteredIssues.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No issues match your search.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setTypeFilter("all")
                setProjectFilter("all")
                setStatusFilter('all')
                setPriorityFilter('all')
                setSeverityFilter('all')
                setCreatedFrom(''); setCreatedTo(''); setUpdatedFrom(''); setUpdatedTo('')
                onClearProjectFilter?.()
              }}
              className="mt-3 text-sm font-medium text-brand dark:text-brand-light"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div key={issue.id} className="flex items-center">
              {onBulkUpdate && <input type="checkbox" aria-label={`Select ${issue.title}`} checked={selectedIds.includes(issue.id)} onChange={event => setSelectedIds(current => event.target.checked ? [...current, issue.id] : current.filter(id => id !== issue.id))} className="ml-3" />}
            <IssueRow
              issue={issue}
              project={projects.find((p) => p.id === issue.projectId)}
              screenshotUrl={
                issue.screenshotId
                  ? screenshotUrls[issue.screenshotId]
                  : undefined
              }
              selected={selectedIssueId === issue.id}
              onClick={() => onSelectIssue(issue)}
              onToggleFixed={(e) => {
                e.stopPropagation()
                onToggleFixed(issue)
              }}
              onCopyPrompt={(e) => {
                e.stopPropagation()
                onCopyPrompt(issue)
              }}
              onDelete={(e) => {
                e.stopPropagation()
                onDeleteIssue(issue)
              }}
            />
            </div>
          ))
        )}
      </div>
    </section>
  )
}
