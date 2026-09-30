import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { migrateBackupToTeam, selectProjectBackup } from '../services/teamMigration'
import type { BackupData } from '../types'

// A stand-in for the team server's API, recording what the copy sends.
type Call = { method: string; path: string; body: Record<string, unknown> | null }
let calls: Call[] = []
let teamProjects: Array<{ id: string; name: string }> = []
const githubAlreadyHere = new Set<string>()

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  calls = []
  teamProjects = [{ id: 'tp-web', name: 'Website' }]
  githubAlreadyHere.clear()
  githubAlreadyHere.add('https://github.com/acme/web/issues/1')
  let n = 0
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const method = init.method || 'GET'
    const path = url.replace(/^\/api\//, '')
    const body = init.body ? JSON.parse(String(init.body)) : null
    calls.push({ method, path, body })
    if (method === 'GET' && path.startsWith('projects')) return json(200, { projects: teamProjects })
    if (method === 'POST' && path.startsWith('projects')) return json(201, { project: { id: `tp-${++n}`, name: body.name } })
    if (method === 'POST' && path.startsWith('issues')) {
      if (body.githubUrl && githubAlreadyHere.has(body.githubUrl)) return json(200, { issue: { id: 'old' }, existing: true })
      return json(201, { issue: { id: `ti-${++n}` } })
    }
    if (method === 'POST' && path.startsWith('screenshots')) return json(201, { id: `s-${++n}` })
    return json(404, { error: 'unexpected ' + method + ' ' + path })
  })
})
afterEach(() => vi.unstubAllGlobals())

const at = '2026-09-01T00:00:00.000Z'
const local: BackupData = {
  version: 1,
  createdAt: at,
  appVersion: '2.6.0',
  settings: null as unknown as BackupData['settings'],
  projects: [
    { id: 'p1', name: 'website ', color: '#f00', createdAt: at, updatedAt: at },
    { id: 'p2', name: 'PaperWarden', color: '#0f0', createdAt: at, updatedAt: at },
  ] as BackupData['projects'],
  issues: [
    { id: 'i1', projectId: 'p2', title: 'Done already', description: '', type: 'bug', status: 'fixed', screenshotId: null, screenshotIds: ['s1'], createdAt: at, updatedAt: at },
    { id: 'i2', projectId: 'p1', title: 'From GitHub, already in the team', description: '', type: 'bug', status: 'open', screenshotId: null, githubUrl: 'https://github.com/acme/web/issues/1', githubNumber: 1, createdAt: at, updatedAt: at },
    { id: 'i3', projectId: null, title: 'From GitHub, new', description: 'x', type: 'idea', status: 'open', screenshotId: null, githubUrl: 'https://github.com/acme/web/issues/2', githubNumber: 2, createdAt: at, updatedAt: at },
  ] as BackupData['issues'],
  screenshots: [{ id: 's1', mimeType: 'image/png', filename: 'a.png', createdAt: at, dataUrl: 'data:image/png;base64,AAAA' }],
}

describe('copying Local into a team workspace', () => {
  it('selects one project with only its issues and screenshots', () => {
    const selected = selectProjectBackup(local, 'p2')

    expect(selected.projects.map(project => project.id)).toEqual(['p2'])
    expect(selected.issues.map(issue => issue.id)).toEqual(['i1'])
    expect(selected.screenshots.map(screenshot => screenshot.id)).toEqual(['s1'])
  })

  it('reuses projects with the same name, keeps status and GitHub links, skips GitHub issues already there', async () => {
    const r = await migrateBackupToTeam(local, 'team-1')
    expect(r).toEqual({ projects: 1, issues: 2, screenshots: 1, alreadyThere: 1 })

    const created = calls.filter(c => c.method === 'POST' && c.path.startsWith('projects'))
    expect(created.map(c => c.body?.name)).toEqual(['PaperWarden'])

    const issues = calls.filter(c => c.method === 'POST' && c.path.startsWith('issues')).map(c => c.body!)
    expect(issues[0]).toMatchObject({ title: 'Done already', status: 'fixed', projectId: 'tp-1' })
    expect(issues[1]).toMatchObject({ projectId: 'tp-web', githubUrl: 'https://github.com/acme/web/issues/1' })
    expect(issues[2]).toMatchObject({ status: 'open', projectId: null, githubNumber: 2 })

    // Only the newly copied issue's screenshot is uploaded.
    expect(calls.filter(c => c.path.startsWith('screenshots'))).toHaveLength(1)
  })
})
