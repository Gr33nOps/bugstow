import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { getDB, resetDBConnection, closeDB, DB_NAME } from '../storage/db'
import {
  IndexedDbIssueRepository,
  IndexedDbProjectRepository,
  IndexedDbScreenshotRepository,
  IndexedDbSettingsRepository
} from '../repositories/indexedDbRepositories'
import {
  createBackupData,
  exportBackupFile,
  encryptBackup,
  decryptBackup,
  restoreBackupData,
  validateBackupStructure,
  blobToDataUrl,
  dataUrlToBlob
} from '../services/backupService'
import { generateIssuePrompt } from '../services/promptService'
import type { Issue, Project, IssueType } from '../types'

describe('Bugstow Local-First Application Test Suite', () => {
  let issueRepo: IndexedDbIssueRepository
  let projectRepo: IndexedDbProjectRepository
  let screenshotRepo: IndexedDbScreenshotRepository
  let settingsRepo: IndexedDbSettingsRepository

  beforeEach(async () => {
    await closeDB()
    const req = indexedDB.deleteDatabase(DB_NAME)
    await new Promise(resolve => {
      req.onsuccess = resolve
      req.onerror = resolve
      req.onblocked = resolve
    })

    issueRepo = new IndexedDbIssueRepository()
    projectRepo = new IndexedDbProjectRepository()
    screenshotRepo = new IndexedDbScreenshotRepository()
    settingsRepo = new IndexedDbSettingsRepository()
  })

  afterEach(async () => {
    await closeDB()
  })

  // ── Test 1 & 3: Create Issue (Text-Only and with Title) ───────────────────
  it('Test 1 & 3: Creates text-only issue and persists in IndexedDB', async () => {
    const created = await issueRepo.create({
      title: 'Navigation bar misaligned on small devices',
      description: 'The hamburger button touches the viewport edge.',
      projectId: null,
      type: 'uiux',
      status: 'open',
    })

    expect(created.id).toBeDefined()
    expect(created.title).toBe('Navigation bar misaligned on small devices')
    expect(created.screenshotId).toBeNull()
    expect(created.status).toBe('open')

    // Reload from database
    const all = await issueRepo.getAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(created.id)
    expect(all[0].title).toBe('Navigation bar misaligned on small devices')
  })

  // ── Test 2: Screenshot Persistence as Blob ────────────────────────────────
  it('Test 2: Persists screenshot as a Blob and links to issue atomically', async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) // PNG magic bytes
    const blob = new Blob([imageBytes], { type: 'image/png' })

    const created = await issueRepo.create(
      {
        title: 'Broken modal overlay',
        description: 'Overlay is opaque instead of blurred.',
        projectId: null,
        type: 'bug',
        status: 'open',
      },
      blob,
      'modal-bug.png'
    )

    expect(created.screenshotId).toBeTruthy()

    // Fetch screenshot record from database
    const screenshotRecord = await screenshotRepo.getById(created.screenshotId!)
    expect(screenshotRecord).toBeDefined()
    expect(screenshotRecord?.mimeType).toBe('image/png')
    expect(screenshotRecord?.blob).toBeInstanceOf(Blob)
    expect(screenshotRecord?.filename).toBe('modal-bug.png')
  })

  // ── Test 4: Issue Status (Fixed and Reopen) ──────────────────────────────
  it('Test 4: Toggles status to fixed and reopens correctly', async () => {
    const issue = await issueRepo.create({
      title: 'Crash on submit',
      description: '',
      projectId: null,
      type: 'bug',
      status: 'open',
    })

    // Mark as fixed
    const fixed = await issueRepo.update(issue.id, { status: 'fixed' })
    expect(fixed.status).toBe('fixed')

    const fixedList = await issueRepo.getByStatus('fixed')
    expect(fixedList).toHaveLength(1)
    expect(fixedList[0].id).toBe(issue.id)

    const openList = await issueRepo.getByStatus('open')
    expect(openList).toHaveLength(0)

    // Reopen
    const reopened = await issueRepo.update(issue.id, { status: 'open' })
    expect(reopened.status).toBe('open')

    const openAfter = await issueRepo.getByStatus('open')
    expect(openAfter).toHaveLength(1)
  })

  // ── Test 5: Projects Management & Filtering ──────────────────────────────
  it('Test 5: Organizes issues by project and filters accurately', async () => {
    const p1 = await projectRepo.create('Website', '#5B50F6')
    const p2 = await projectRepo.create('Mobile App', '#3B82F6')

    await issueRepo.create({
      title: 'Website bug 1',
      description: '',
      projectId: p1.id,
      type: 'bug',
    })
    await issueRepo.create({
      title: 'Website bug 2',
      description: '',
      projectId: p1.id,
      type: 'bug',
    })
    await issueRepo.create({
      title: 'Mobile app bug',
      description: '',
      projectId: p2.id,
      type: 'bug',
    })

    const p1Issues = await issueRepo.getByProject(p1.id)
    const p2Issues = await issueRepo.getByProject(p2.id)

    expect(p1Issues).toHaveLength(2)
    expect(p2Issues).toHaveLength(1)
    expect(p2Issues[0].title).toBe('Mobile app bug')
  })

  // ── Test 6: Editing Issue and Replacing Screenshot ───────────────────────
  it('Test 6: Edits issue details and replaces screenshot safely', async () => {
    const blob1 = new Blob(['img1'], { type: 'image/png' })
    const blob2 = new Blob(['img2_updated'], { type: 'image/jpeg' })

    const issue = await issueRepo.create(
      {
        title: 'Original Title',
        description: 'Original Desc',
        projectId: null,
        type: 'bug',
      },
      blob1,
      'shot1.png'
    )
    const oldScreenshotId = issue.screenshotId

    // Update issue title and replace screenshot
    const updated = await issueRepo.updateWithScreenshot(
      issue.id,
      { title: 'Updated Title', description: 'Updated Desc' },
      blob2,
      'shot2.jpg'
    )

    expect(updated.title).toBe('Updated Title')
    expect(updated.screenshotId).not.toBe(oldScreenshotId)

    // Verify old screenshot was removed from storage
    const oldShot = await screenshotRepo.getById(oldScreenshotId!)
    expect(oldShot).toBeUndefined()

    // Verify new screenshot was saved
    const newShot = await screenshotRepo.getById(updated.screenshotId!)
    expect(newShot).toBeDefined()
    expect(newShot?.mimeType).toBe('image/jpeg')
  })

  // ── Test 7: Copy as Prompt for Vibe Coding ────────────────────────────────
  it('Test 7: Formats prompts tailored for Bugs and Ideas', () => {
    const bugIssue: Issue = {
      id: 'test-1',
      projectId: 'proj-1',
      title: 'Primary CTA button does not submit form',
      description: 'Clicking submit triggers form validation error even with valid input.',
      type: 'bug',
      status: 'open',
      screenshotId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const project: Project = {
      id: 'proj-1',
      name: 'Billing Portal',
      color: '#5B50F6',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const bugPrompt = generateIssuePrompt(bugIssue, project)
    expect(bugPrompt).toContain('Please investigate and fix the following issue in my project.')
    expect(bugPrompt).toContain('Project: Billing Portal')
    expect(bugPrompt).toContain('Problem: Primary CTA button does not submit form')
    expect(bugPrompt).toContain('Additional context:\nClicking submit triggers form validation error')
    expect(bugPrompt).toContain('Inspect the relevant code, identify the underlying cause, and implement an appropriate fix.')

    const ideaIssue: Issue = {
      ...bugIssue,
      title: 'Add dark mode toggle in navbar',
      description: 'Support automatic OS dark mode detection.',
      type: 'idea',
    }

    const ideaPrompt = generateIssuePrompt(ideaIssue, project)
    expect(ideaPrompt).toContain('Please implement the following idea in my project.')
    expect(ideaPrompt).toContain('Feature: Add dark mode toggle in navbar')
    expect(ideaPrompt).toContain('Inspect the relevant code, understand the requirements, and implement the feature')
  })

  // ── Test 8 & 9: Encrypted Backup Export and Restore ───────────────────────
  it('Test 8 & 9: Exports encrypted backup with AES-GCM and restores data atomically', async () => {
    // 1. Create project, issues, and screenshot
    const proj = await projectRepo.create('SaaS Dashboard', '#5B50F6')
    const blob = new Blob(['screenshot_content_bytes'], { type: 'image/png' })
    const issue = await issueRepo.create(
      {
        title: 'Sidebar collapses unexpectedly',
        description: 'Occurs when clicking outside sidebar on 1024px screens.',
        projectId: proj.id,
        type: 'uiux',
        status: 'open',
      },
      blob,
      'sidebar.png'
    )

    // 2. Generate backup
    const backupData = await createBackupData()
    expect(backupData.projects).toHaveLength(1)
    expect(backupData.issues).toHaveLength(1)
    expect(backupData.screenshots).toHaveLength(1)
    expect(backupData.screenshots[0].dataUrl).toContain('data:image/png;base64,')

    // 3. Encrypt backup with passphrase
    const passphrase = 'MySecretPassphrase123!'
    const encrypted = await encryptBackup(backupData, passphrase)
    expect(encrypted.isEncrypted).toBe(true)
    expect(encrypted.algorithm).toBe('AES-GCM')
    expect(encrypted.ciphertext).toBeDefined()
    expect(encrypted.salt).toBeDefined()
    expect(encrypted.iv).toBeDefined()

    // 4. Decrypt backup
    const decrypted = await decryptBackup(encrypted, passphrase)
    expect(decrypted.projects[0].name).toBe('SaaS Dashboard')
    expect(decrypted.issues[0].title).toBe('Sidebar collapses unexpectedly')

    // 5. Clear current database and restore
    await issueRepo.delete(issue.id)
    await projectRepo.delete(proj.id)
    expect(await issueRepo.getAll()).toHaveLength(0)
    expect(await projectRepo.getAll()).toHaveLength(0)

    // Restore
    await restoreBackupData(decrypted)

    // Verify restored records
    const restoredProjects = await projectRepo.getAll()
    const restoredIssues = await issueRepo.getAll()
    const restoredScreenshots = await screenshotRepo.getAll()

    expect(restoredProjects).toHaveLength(1)
    expect(restoredProjects[0].name).toBe('SaaS Dashboard')
    expect(restoredIssues).toHaveLength(1)
    expect(restoredIssues[0].title).toBe('Sidebar collapses unexpectedly')
    expect(restoredScreenshots).toHaveLength(1)
  })

  // ── Test 10: Invalid Backup Rejection ─────────────────────────────────────
  it('Test 10: Safely rejects corrupted/invalid backup file without affecting database', async () => {
    // Initial data
    await projectRepo.create('Original Project', '#5B50F6')

    const invalidPayload = {
      version: 999, // unsupported version
      somethingInvalid: true,
    }

    const validation = validateBackupStructure(invalidPayload)
    expect(validation.isValid).toBe(false)
    expect(validation.error).toContain('Unsupported backup version')

    // Existing database is intact
    const projects = await projectRepo.getAll()
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe('Original Project')
  })

  // ── Test 11: Incorrect Passphrase Handling ────────────────────────────────
  it('Test 11: Rejects decryption when passphrase is wrong without data corruption', async () => {
    const backupData = await createBackupData()
    const encrypted = await encryptBackup(backupData, 'CorrectPassword')

    await expect(decryptBackup(encrypted, 'WrongPassword')).rejects.toThrow(
      'Incorrect passphrase or corrupted backup file.'
    )
  })

  // ── Test 12: Preserving Issues on Project Deletion ────────────────────────
  it('Test 12: Preserves issues and sets projectId to null when project is deleted', async () => {
    const proj = await projectRepo.create('Client Project', '#10B981')
    const issue = await issueRepo.create({
      title: 'Feedback on design system',
      description: 'Needs more padding.',
      projectId: proj.id,
      type: 'uiux',
    })

    expect(issue.projectId).toBe(proj.id)

    // Delete project
    await projectRepo.delete(proj.id)

    // Project should be deleted
    const deletedProj = await projectRepo.getById(proj.id)
    expect(deletedProj).toBeUndefined()

    // Issue MUST still exist, now unassigned (projectId: null)
    const preservedIssue = await issueRepo.getById(issue.id)
    expect(preservedIssue).toBeDefined()
    expect(preservedIssue?.projectId).toBeNull()
    expect(preservedIssue?.title).toBe('Feedback on design system')
  })

  // ── Test 13: Deletion Cleans Up Screenshots ──────────────────────────────
  it('Test 13: Deleting an issue removes its screenshot record atomically', async () => {
    const blob = new Blob(['image-to-delete'], { type: 'image/png' })
    const issue = await issueRepo.create(
      {
        title: 'Issue to delete',
        description: '',
        projectId: null,
        type: 'bug',
      },
      blob
    )

    const shotId = issue.screenshotId!
    expect(await screenshotRepo.getById(shotId)).toBeDefined()

    // Delete issue
    await issueRepo.delete(issue.id)

    // Screenshot should be cleaned up
    expect(await screenshotRepo.getById(shotId)).toBeUndefined()
    expect(await issueRepo.getById(issue.id)).toBeUndefined()
  })

  // ── Test 14: DataURL <-> Blob Conversion Fidelity ─────────────────────────
  it('Test 14: Preserves binary fidelity in DataURL conversion', async () => {
    const originalText = 'Bugstow binary image simulation test payload'
    const blob = new Blob([originalText], { type: 'text/plain' })

    const dataUrl = await blobToDataUrl(blob)
    const reconstituted = dataUrlToBlob(dataUrl)

    expect(reconstituted.type).toBe('text/plain')
    const text = await reconstituted.text()
    expect(text).toBe(originalText)
  })

  // ── Test 15: Unencrypted Backup Export and Restore ───────────────────────
  it('Test 15: Exports unencrypted backup and restores with exact schema fidelity', async () => {
    const proj = await projectRepo.create('Simple Project', '#3B82F6')
    await issueRepo.create({
      title: 'Unencrypted issue',
      description: 'Plaintext description',
      projectId: proj.id,
      type: 'idea',
    })

    const backupData = await createBackupData()
    expect(backupData.version).toBe(1)
    expect(backupData.projects[0].name).toBe('Simple Project')

    // Reset database
    await closeDB()
    const req = indexedDB.deleteDatabase(DB_NAME)
    await new Promise(resolve => (req.onsuccess = resolve))

    // Restore
    await restoreBackupData(backupData)

    const restoredIssues = await issueRepo.getAll()
    expect(restoredIssues).toHaveLength(1)
    expect(restoredIssues[0].title).toBe('Unencrypted issue')
  })

  // ── Test 16: Storage Error Resilience ────────────────────────────────────
  it('Test 16: Handles failed transaction safely without corrupting state', async () => {
    // Attempting to update a non-existent issue should throw and not corrupt DB
    await expect(issueRepo.update('non-existent-id', { title: 'Ghost' })).rejects.toThrow(
      'Issue with id non-existent-id not found'
    )
  })

  // ── Test 17: Settings Persistence and Backup Reminder Dismissal ──────────
  it('Test 17: Settings update and reminder dismissal persist in IndexedDB', async () => {
    const initial = await settingsRepo.get()
    expect(initial.backupReminderDismissedAt).toBeNull()

    const now = new Date().toISOString()
    const updated = await settingsRepo.update({ backupReminderDismissedAt: now })
    expect(updated.backupReminderDismissedAt).toBe(now)

    const reloaded = await settingsRepo.get()
    expect(reloaded.backupReminderDismissedAt).toBe(now)
  })
})
