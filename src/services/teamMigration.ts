import type { BackupData } from '../types'
import { createCloudProject, createCloudIssue, uploadScreenshot } from './teamApi'

export interface MigrationResult {
  projects: number
  issues: number
  screenshots: number
}

function parseDataUrl(dataUrl: string): { base64: string; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (!match) return null
  return { mimeType: match[1], base64: match[2] }
}

/**
 * Copy a personal backup (from Settings → Export Backup) into a team.
 *
 * This is additive: it creates new projects, issues, and screenshots on the
 * team server. It never reads or deletes the personal browser data — the user
 * keeps their local copy untouched. Project references are remapped to the
 * newly created team projects.
 */
export async function migrateBackupToTeam(
  backup: BackupData,
  teamId: string,
  onProgress?: (message: string) => void
): Promise<MigrationResult> {
  const projectMap = new Map<string, string>()

  for (const p of backup.projects) {
    onProgress?.(`Creating project “${p.name}”…`)
    const created = await createCloudProject(teamId, p.name, p.color, p.description || undefined)
    projectMap.set(p.id, created.id)
  }

  const screenshotById = new Map(backup.screenshots.map(s => [s.id, s]))
  let issueCount = 0
  let screenshotCount = 0

  for (const issue of backup.issues) {
    onProgress?.(`Importing issue “${issue.title}”…`)
    const projectId = issue.projectId ? projectMap.get(issue.projectId) ?? null : null
    const created = await createCloudIssue(teamId, {
      title: issue.title,
      description: issue.description,
      type: issue.type,
      projectId,
      assigneeId: null,
    })
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

  return { projects: projectMap.size, issues: issueCount, screenshots: screenshotCount }
}
