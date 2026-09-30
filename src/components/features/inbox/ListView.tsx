import React, { useState, useMemo, useEffect } from "react"
import { Search } from "lucide-react"
import type { Issue, Project, IssueType } from "../../../types"
import { IssueRow } from "./IssueRow"
import { EmptyState } from "./EmptyState"

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

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Search by title or description
      if (search.trim()) {
        const query = search.toLowerCase()
        const matchTitle = issue.title.toLowerCase().includes(query)
        const matchDesc = issue.description.toLowerCase().includes(query)
        if (!matchTitle && !matchDesc) return false
      }

      // Filter by type
      if (typeFilter !== "all" && issue.type !== typeFilter) {
        return false
      }

      // Filter by project
      if (projectFilter !== "all") {
        if (projectFilter === "unassigned") {
          if (issue.projectId !== null) return false
        } else if (issue.projectId !== projectFilter) {
          return false
        }
      }

      return true
    })
  }, [issues, search, typeFilter, projectFilter])

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
      </div>
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
                onClearProjectFilter?.()
              }}
              className="mt-3 text-sm font-medium text-brand dark:text-brand-light"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <IssueRow
              key={issue.id}
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
          ))
        )}
      </div>
    </section>
  )
}
