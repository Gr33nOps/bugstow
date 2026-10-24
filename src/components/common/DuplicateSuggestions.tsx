export function DuplicateSuggestions({ issues }: { issues: Array<{ id: string; title: string; description: string }> }) {
  if (!issues.length) return null
  return <aside aria-label="Similar issues" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
    <strong>Similar issues already exist</strong>
    <ul className="mt-1 list-disc space-y-1 pl-5">{issues.map(issue => <li key={issue.id}><span className="font-medium">{issue.title}</span>{issue.description && <span className="block max-w-full truncate text-xs opacity-75">{issue.description}</span>}</li>)}</ul>
    <p className="mt-2 text-xs">You can still create this issue.</p>
  </aside>
}
