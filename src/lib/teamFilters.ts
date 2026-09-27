interface SearchableIssue {
  title: string
  description: string | null
  status: string
  type: string
  project_id: string | null
}
export function filterTeamIssues<T extends SearchableIssue>(
  issues: T[],
  filters: { query: string; project: string; status: string; type: string },
): T[] {
  const query = filters.query.trim().toLowerCase()
  return issues.filter(
    (issue) =>
      (filters.status === "all" || issue.status === filters.status) &&
      (filters.type === "all" || issue.type === filters.type) &&
      (filters.project === "all" || issue.project_id === filters.project) &&
      (!query ||
        `${issue.title} ${issue.description || ""}`
          .toLowerCase()
          .includes(query)),
  )
}
