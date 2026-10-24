import type { IssueDetails, IssuePriority, IssueSeverity, IssueStatus } from '../../types'

export const STATUS_LABELS: Record<IssueStatus, string> = {
  open: 'Open', in_progress: 'In Progress', blocked: 'Blocked', fixed: 'Fixed',
}
export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
}
const DETAIL_FIELDS: Array<[keyof IssueDetails, string, boolean]> = [
  ['stepsToReproduce', 'Steps to reproduce', true],
  ['expectedBehavior', 'Expected behavior', true],
  ['actualBehavior', 'Actual behavior', true],
  ['environment', 'Environment details', true],
  ['browserOs', 'Browser and operating system', false],
  ['appVersion', 'Application version', false],
  ['additionalNotes', 'Additional notes', true],
]
const inputClass = 'mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

export function PriorityBadge({ priority = 'medium' }: { priority?: IssuePriority }) {
  const color = priority === 'critical' ? 'text-rose-700 dark:text-rose-300' : priority === 'high' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'
  return <span className={`rounded border border-current px-1.5 py-0.5 text-xs font-semibold ${color}`} aria-label={`${PRIORITY_LABELS[priority]} priority`}>{PRIORITY_LABELS[priority]}</span>
}

export function IssueReportFields({ priority, onPriorityChange, severity, onSeverityChange, details, onDetailsChange, bug = true }: {
  priority: IssuePriority
  onPriorityChange: (value: IssuePriority) => void
  severity: IssueSeverity | null
  onSeverityChange: (value: IssueSeverity | null) => void
  details: IssueDetails
  onDetailsChange: (value: IssueDetails) => void
  bug?: boolean
}) {
  return <>
    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Priority
      <select aria-label="Priority" className={inputClass} value={priority} onChange={e => onPriorityChange(e.target.value as IssuePriority)}>
        {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <details className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
      <summary className="cursor-pointer text-sm font-medium">More report details (optional)</summary>
      <div className="mt-3 grid gap-3">
        {bug && <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Severity
          <select aria-label="Severity" className={inputClass} value={severity || ''} onChange={e => onSeverityChange((e.target.value || null) as IssueSeverity | null)}>
            <option value="">Not set</option><option value="critical">Critical</option><option value="major">Major</option><option value="minor">Minor</option>
          </select>
        </label>}
        {DETAIL_FIELDS.map(([key, label, multiline]) => <label key={key} className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}
          {multiline ? <textarea className={inputClass} rows={2} maxLength={4000} value={details[key] || ''} onChange={e => onDetailsChange({ ...details, [key]: e.target.value })} />
            : <input className={inputClass} maxLength={4000} value={details[key] || ''} onChange={e => onDetailsChange({ ...details, [key]: e.target.value })} />}
        </label>)}
      </div>
    </details>
  </>
}

export function IssueReportSummary({ severity, details }: { severity?: IssueSeverity | null; details?: IssueDetails }) {
  const entries = DETAIL_FIELDS.filter(([key]) => details?.[key]?.trim())
  if (!severity && entries.length === 0) return null
  return <section className="space-y-2"><h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report details</h2>
    {severity && <p className="text-sm"><strong>Severity:</strong> {severity[0].toUpperCase() + severity.slice(1)}</p>}
    {entries.map(([key, label]) => <div key={key}><h3 className="text-xs font-semibold text-slate-500">{label}</h3><p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{details?.[key]}</p></div>)}
  </section>
}
