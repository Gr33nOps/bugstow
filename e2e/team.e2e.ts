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

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await expect.poll(() => page.locator('header').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByText('Actions', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Export to GitHub', exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('team-mobile-actions.png') })
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

  const nonce = 'b'.repeat(32)
  await page.goto(`${base}/?capture=${nonce}`)
  await expect(page.getByText('E2E workspace').first()).toBeVisible()
  await page.evaluate(value => window.postMessage({ type: 'bugstow-capture', nonce: value, title: 'Captured Team draft', pageUrl: 'https://example.com/team', selectedText: 'Selected context' }, window.location.origin), nonce)
  await expect(page.getByRole('dialog', { name: 'Workspace dialog' })).toBeVisible()
  await expect(page.locator('#new-team-issue-title')).toHaveValue('Captured Team draft')
  await expect(page.locator('#new-team-issue-description')).toHaveValue(/Selected context/)
})
