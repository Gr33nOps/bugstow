import { useState } from 'react'
import type { IssueStatus } from '../../types'
import { BOARD_COLUMNS, groupBoardIssues } from '../../lib/kanban'

interface BoardIssue { id: string; title: string; status: IssueStatus; priority?: string; projectName?: string | null }

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
  return <section aria-label="Issue board" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 p-4 dark:bg-slate-950">
    <p className="mb-3 text-xs text-slate-500">Drag a card to change its status, or use its status menu with a keyboard.</p>
    {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
      {BOARD_COLUMNS.map(column => <div key={column.status} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); const issue = issues.find(item => item.id === id); if (issue) void move(issue, column.status) }} className="flex min-h-0 min-w-[230px] flex-1 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-200 px-3 py-3 text-sm font-semibold dark:border-slate-800">{column.label} <span className="ml-1 text-xs font-normal text-slate-500">{groups[column.status].length}</span></h2>
        <div className="min-h-24 space-y-2 overflow-y-auto p-2">
          {groups[column.status].slice(0, 200).map(issue => <article key={issue.id} draggable onDragStart={event => event.dataTransfer.setData('text/plain', issue.id)} className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-700 dark:bg-slate-800">
            <button type="button" onClick={() => onOpen(issue)} className="block w-full break-words text-left text-sm font-medium hover:underline">{issue.title}</button>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">{issue.priority && <span>{issue.priority}</span>}{issue.projectName && <span className="truncate">{issue.projectName}</span>}</div>
            <select aria-label={`Status for ${issue.title}`} value={issue.status} disabled={busyId === issue.id} onChange={event => void move(issue, event.target.value as IssueStatus)} className="mt-2 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900">{BOARD_COLUMNS.map(option => <option key={option.status} value={option.status}>{option.label}</option>)}</select>
          </article>)}
          {groups[column.status].length > 200 && <p className="p-2 text-xs text-slate-500">Showing 200 of {groups[column.status].length}. Search or filter to see more.</p>}
        </div>
      </div>)}
    </div>
  </section>
}
