import { test, expect, request } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'

const repoRoot = resolve(import.meta.dirname, '..')
const serverRoot = join(repoRoot, 'server')
const username = 'boardtester'
const password = `Test-${randomBytes(16).toString('hex')}`
let child: ChildProcess
let base = ''
let teamId = ''

async function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer()
    server.once('error', fail)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return fail(new Error('No test port'))
      server.close(() => done(address.port))
    })
  })
}

test.beforeAll(async () => {
  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  const token = randomBytes(24).toString('hex')
  const dataDir = mkdtempSync(join(tmpdir(), 'bugstow-e2e-team-'))
  child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: serverRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      BUGSTOW_BASE_URL: base,
      BUGSTOW_DATA_DIR: dataDir,
      BUGSTOW_PUBLIC_DIR: join(repoRoot, 'dist'),
      BUGSTOW_AUTH_SECRET: randomBytes(32).toString('hex'),
      BUGSTOW_SETUP_TOKEN: token,
      BUGSTOW_BACKUP_ENABLED: 'false',
      BUGSTOW_OFFLINE: 'true',
    },
  })
  let ready = false
  child.stdout?.resume()
  child.stderr?.resume()
  for (let attempt = 0; attempt < 200; attempt++) {
    if (child.exitCode !== null) throw new Error(`Team server exited: ${child.exitCode}`)
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!ready) throw new Error('Team server did not become healthy')
  const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } })
  const signup = await api.post('/api/auth/sign-up/email', { data: { email: `${username}@bugstow.invalid`, name: username, password }, headers: { 'x-bugstow-setup-token': token } })
  expect(signup.ok()).toBeTruthy()
  const team = await api.post('/api/teams', { data: { name: 'E2E workspace' } })
  expect(team.status()).toBe(201)
  teamId = (await team.json()).team.id
  await api.dispose()
})

test.afterAll(() => { child?.kill() })

test('Team issue link, comments, board, and fix references work after refresh', async ({ page }) => {
  await page.goto(base)
  await page.getByRole('button', { name: 'Sign in to Team' }).click()
  await page.getByRole('textbox', { name: 'Username' }).fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('E2E workspace').first()).toBeVisible()

  await page.getByRole('button', { name: /Change theme/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: /Change theme/ }).click()
  await page.getByText('Actions', { exact: true }).click()
  await page.getByRole('button', { name: 'Account menu' }).click()
  await expect(page.getByRole('button', { name: 'Export to GitHub', exact: true })).not.toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Sign out', { exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: /E2E workspace/ }).click()
  await page.getByText('Actions', { exact: true }).click()
  await expect(page.getByRole('button', { name: /E2E workspace/ })).toHaveCount(1)
  await page.keyboard.press('Escape')
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await expect.poll(() => page.locator('header').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByText('Actions', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Export to GitHub', exact: true })).toBeVisible()
  await page.screenshot({ animations: 'disabled', path: test.info().outputPath('team-mobile-actions.png') })
  await page.getByText('Actions', { exact: true }).click()
  await page.setViewportSize({ width: 1280, height: 720 })

  await page.getByRole('button', { name: 'New issue' }).first().click()
  const captureDialog = page.getByRole('dialog', { name: 'Workspace dialog' })
  await captureDialog.getByRole('button', { name: 'Add screenshots', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect.poll(() => captureDialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(captureDialog).toHaveCount(0)
  await page.getByRole('button', { name: 'New issue' }).first().click()
  await page.locator('#new-team-issue-title').fill('Team browser issue')
  await page.getByRole('combobox', { name: 'Priority' }).selectOption('high')
  await page.getByText('More report details (optional)').click()
  await page.getByRole('combobox', { name: 'Severity' }).selectOption('major')
  await page.getByRole('textbox', { name: 'Steps to reproduce' }).fill('Open the Team board')
  await page.getByRole('button', { name: 'Create issue' }).click()
  await page.getByRole('checkbox', { name: 'Select Team browser issue' }).check()
  await page.getByRole('searchbox', { name: 'Search issues' }).fill('no matching issue')
  await expect(page.getByText('1 selected', { exact: true })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search issues' }).fill('')
  await page.getByRole('button', { name: /Team browser issue/ }).click()
  await expect(page).toHaveURL(new RegExp(`team=${teamId}.*issue=`))
  await expect(page.getByText('Open the Team board')).toBeVisible()
  for (const width of [390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.getByRole('button', { name: 'Edit issue', exact: true })).toBeInViewport()
    const row = page.getByRole('checkbox', { name: 'Select Team browser issue' })
    if (await row.isVisible()) expect((await page.locator('.issue-master-pane').boundingBox())!.width).toBeGreaterThanOrEqual(320)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`team-detail-${width}.png`) })
  }
  await page.setViewportSize({ width: 1280, height: 720 })


  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Delete this issue?' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Delete this issue?' })).not.toBeVisible()
  await expect(page.getByRole('heading', { name: 'Team browser issue' })).toBeVisible()
  await page.getByLabel('Add a comment').fill('Investigating the cause')
  await page.getByRole('button', { name: 'Post comment' }).click()
  await expect(page.getByText('Investigating the cause')).toBeVisible()

  await page.getByText('Add GitHub fix reference').click()
  await page.getByRole('textbox', { name: 'GitHub fix URL' }).fill('https://github.com/acme/app/pull/12')
  await page.getByRole('button', { name: 'Add link' }).click()
  await expect(page.getByRole('link', { name: 'https://github.com/acme/app/pull/12' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Team browser issue' })).toBeVisible()
  await expect(page.getByText('Investigating the cause')).toBeVisible()
  await expect(page.getByRole('link', { name: 'https://github.com/acme/app/pull/12' })).toBeVisible()

  await page.getByRole('button', { name: 'Board view' }).click()
  await page.getByRole('combobox', { name: 'Status for Team browser issue' }).selectOption('in_progress')
  await expect(page.getByRole('combobox', { name: 'Status for Team browser issue' })).toHaveValue('in_progress')

  await page.getByRole('button', { name: /Change theme/ }).click()
  await page.screenshot({ animations: 'disabled', path: test.info().outputPath('team-board-dark.png') })
  await page.getByRole('button', { name: 'List view', exact: true }).click()
  await page.screenshot({ animations: 'disabled', path: test.info().outputPath('team-list-dark.png') })
  await page.getByRole('button', { name: /Change theme/ }).click()
  await page.getByText('More filters and sorting').click()
  await page.screenshot({ animations: 'disabled', path: test.info().outputPath('team-filters-light.png') })
  const nonce = 'b'.repeat(32)
  await page.goto(`${base}/?capture=${nonce}`)
  await expect(page.getByText('E2E workspace').first()).toBeVisible()
  await page.evaluate(value => window.postMessage({ type: 'bugstow-capture', nonce: value, title: 'Captured Team draft', pageUrl: 'https://example.com/team', selectedText: 'Selected context' }, window.location.origin), nonce)
  await expect(page.getByRole('dialog', { name: 'Workspace dialog' })).toBeVisible()
  await expect(page.locator('#new-team-issue-title')).toHaveValue('Captured Team draft')
  await expect(page.locator('#new-team-issue-description')).toHaveValue(/Selected context/)
})

test('Team screen audit: authentication, administration and dialogs', async ({ page, browser }) => {
  test.setTimeout(90000)
  page.setDefaultTimeout(8000)
  const shot = async (name: string) => {
    for (const theme of ['light', 'dark'] as const) for (const width of [390, 1440]) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: width === 390 ? 667 : 900 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ animations: 'disabled', path: test.info().outputPath(`${name}-${theme}-${width}.png`) })
    }
  }
  await page.goto(base)
  await shot('mode-picker')
  await page.getByRole('button', { name: 'Sign in to Team' }).click()
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible()
  await shot('sign-in')
  await page.getByRole('textbox', { name: 'Username' }).fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('E2E workspace').first()).toBeVisible()
  await page.getByRole('button', { name: 'New project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Project name' }).fill('Audit project')
  await shot('new-project')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Audit project', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'More for Audit project' }).click()
  await page.getByRole('menuitem', { name: 'Move to workspace' }).click()
  await shot('move-project')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'New issue' }).first().click()
  await shot('new-issue')
  await page.getByText('More report details (optional)').click()
  await shot('new-issue-expanded')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'People & invitations', exact: true }).click()
  await shot('people')
  await page.getByRole('button', { name: 'Create invite link' }).click()
  await expect(page.getByLabel('Invite link', { exact: true })).toBeVisible()
  const inviteUrl = await page.getByLabel('Invite link', { exact: true }).inputValue()
  await shot('invite-link')
  const guest = await browser.newContext({ viewport: { width: 390, height: 667 } })
  const guestPage = await guest.newPage()
  await guestPage.goto(inviteUrl)
  await expect(guestPage.getByRole('heading', { name: /Join/ })).toBeVisible()
  await guestPage.screenshot({ animations: 'disabled', path: test.info().outputPath('join-team.png') })
  await guestPage.getByRole('textbox', { name: 'Username' }).fill('auditguest')
  await guestPage.getByLabel(/^Password/).fill(password)
  await guestPage.getByRole('button', { name: /Join E2E/ }).click()
  await expect(guestPage.getByText('E2E workspace').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'People & invitations', exact: true }).click()
  await page.getByRole('button', { name: 'Reset password for auditguest' }).click()
  await shot('reset-password')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'People in E2E workspace' })).toBeVisible()
  await page.getByRole('button', { name: 'Reset password for auditguest' }).click()
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()
  const temporaryPassword = await page.locator('code.select-all').textContent()
  await expect(page.getByText('They were signed out everywhere', { exact: false })).toBeVisible()
  await shot('reset-password-result')
  await guestPage.reload()
  await guestPage.getByRole('textbox', { name: 'Username' }).fill('auditguest')
  await guestPage.getByLabel(/^Password/).fill(temporaryPassword!.trim())
  await guestPage.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(guestPage.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await guestPage.screenshot({ animations: 'disabled', path: test.info().outputPath('forced-password-change.png') })
  await guest.close()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  for (const [button, name] of [['Copy Local issues','copy-local'], ['Change password','change-password'], ['Backups','backups']]) {
    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('button', { name: button, exact: true }).filter({ visible: true }).last().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(name)
    await page.keyboard.press('Escape')
  }
  await page.getByRole('button', { name: 'Import from GitHub', exact: true }).filter({ visible: true }).first().click()
  await shot('github-import-offline')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /E2E workspace/ }).click()
  await shot('workspace-menu')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^Trash/ }).filter({ visible: true }).first().click()
  await shot('trash')
})
