import { PriorityBadge } from './IssueReportFields'
import { useState } from 'react'
import type { IssueStatus, IssuePriority } from '../../types'
import { BOARD_COLUMNS, groupBoardIssues } from '../../lib/kanban'

interface BoardIssue { id: string; title: string; status: IssueStatus; priority?: IssuePriority; projectName?: string | null }

export function KanbanBoard<T extends BoardIssue>({ issues, onOpen, onStatusChange }: {
  issues: T[]
  onOpen: (issue: T) => void
  onStatusChange: (issue: T, status: IssueStatus) => Promise<void>
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const groups = groupBoardIssues(issues)
  const move = async (issue: T, status: IssueStatus) => {
    if (issue.status === status || busyId) return
    setBusyId(issue.id)
    setError('')
    try { await onStatusChange(issue, status) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not move issue') }
    finally { setBusyId(null) }
  }
  return <section aria-label="Issue board" className="issue-board flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 p-4 dark:bg-slate-950">
    <p className="mb-3 text-xs text-slate-500">Drag a card to change its status, or use its status menu with a keyboard.</p>
    {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
    <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2 snap-x">
      {BOARD_COLUMNS.map(column => <div key={column.status} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); const issue = issues.find(item => item.id === id); if (issue) void move(issue, column.status) }} data-status={column.status} className="board-column flex min-h-0 min-w-[220px] flex-1 snap-start flex-col rounded-2xl">
        <h2 className="flex items-center gap-2 px-3 py-4 text-sm font-semibold"><span className="status-dot" />{column.label} <span className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-xs tabular-nums dark:bg-slate-800">{groups[column.status].length}</span></h2>
        <div className="min-h-24 space-y-3 overflow-y-auto p-2">
          {groups[column.status].length === 0 && <div className="board-empty">No issues here<span>Drop a card here to move it</span></div>}
          {groups[column.status].slice(0, 200).map(issue => <article key={issue.id} draggable onDragStart={event => event.dataTransfer.setData('text/plain', issue.id)} className="board-card rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-700 dark:bg-slate-900">
            <button type="button" onClick={() => onOpen(issue)} className="w-full line-clamp-3 break-words text-left text-sm font-medium leading-relaxed hover:text-brand dark:hover:text-brand-light">{issue.title}</button>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">{issue.priority && <PriorityBadge priority={issue.priority} />}{issue.projectName && <span className="truncate">{issue.projectName}</span>}</div>
            <select aria-label={`Status for ${issue.title}`} value={issue.status} disabled={busyId === issue.id} onChange={event => void move(issue, event.target.value as IssueStatus)} className="mt-2 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900">{BOARD_COLUMNS.map(option => <option key={option.status} value={option.status}>{option.label}</option>)}</select>
          </article>)}
          {groups[column.status].length > 200 && <p className="p-2 text-xs text-slate-500">Showing 200 of {groups[column.status].length}. Search or filter to see more.</p>}
        </div>
      </div>)}
    </div>
  </section>
}
