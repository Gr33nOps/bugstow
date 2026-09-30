import type { BackupData } from '../types'
import { createProject, copyIssueIn, listProjects, uploadScreenshot } from './teamApi'

export interface MigrationResult {
  /** Projects created in the team (projects with the same name are reused). */
  projects: number
  issues: number
  screenshots: number
  /** GitHub issues that were already in the team and were left as they are. */
  alreadyThere: number
}

function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!match) return null
  return { mimeType: match[1], base64: match[2] }
}

/**
 * Copy Local data (read straight from this browser, or from a backup file)
 * into a team workspace.
 *
 * It only adds to the team. Local data is never changed or deleted. Projects
 * are matched by name, so a project that already exists in the team is reused
 * instead of duplicated. Issues keep their type, completed/open status and
 * GitHub link; a GitHub issue that is already in the team isn't copied again.
 */
export async function migrateBackupToTeam(
  backup: BackupData,
  teamId: string,
  onProgress?: (message: string) => void
): Promise<MigrationResult> {
  const byName = new Map((await listProjects(teamId)).map(p => [p.name.trim().toLowerCase(), p.id]))
  const projectMap = new Map<string, string>()
  let projectsCreated = 0

  for (const p of backup.projects) {
    const key = p.name.trim().toLowerCase()
    let id = byName.get(key)
    if (!id) {
      onProgress?.(`Creating project “${p.name}”…`)
      id = (await createProject(teamId, p.name, p.color, p.description || undefined)).id
      byName.set(key, id)
      projectsCreated++
    }
    projectMap.set(p.id, id)
  }

  const screenshotById = new Map(backup.screenshots.map(s => [s.id, s]))
  let issueCount = 0
  let screenshotCount = 0
  let alreadyThere = 0

  for (const issue of backup.issues) {
    onProgress?.(`Copying “${issue.title}”…`)
    const projectId = issue.projectId ? projectMap.get(issue.projectId) ?? null : null
    const { issue: created, existing } = await copyIssueIn(teamId, {
      title: issue.title,
      description: issue.description,
      type: issue.type,
      status: issue.status === 'fixed' ? 'fixed' : 'open',
      projectId,
      githubUrl: issue.githubUrl,
      githubNumber: issue.githubNumber,
    })
    if (existing) {
      alreadyThere++
      continue
    }
    issueCount++

    const ids =
      issue.screenshotIds && issue.screenshotIds.length > 0
        ? issue.screenshotIds
        : issue.screenshotId
          ? [issue.screenshotId]
          : []
    for (const sid of ids) {
      const shot = screenshotById.get(sid)
      if (!shot) continue
      const parsed = parseDataUrl(shot.dataUrl)
      if (!parsed) continue
      await uploadScreenshot(created.id, parsed.base64, parsed.mimeType, shot.filename)
      screenshotCount++
    }
  }

  return { projects: projectsCreated, issues: issueCount, screenshots: screenshotCount, alreadyThere }
}
