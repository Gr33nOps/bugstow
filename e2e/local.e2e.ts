import { expect, test } from '@playwright/test'

test('Local issue creation, bulk priority, filters, and reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()

  for (const title of ['Keyboard overlap', 'Button alignment']) {
    await page.getByRole('button', { name: /New issue/ }).first().click()
    await page.getByRole('textbox', { name: 'Title' }).fill(title)
    await page.getByRole('button', { name: 'Create issue' }).click()
    await expect(page.getByText(title).first()).toBeVisible()
  }

  await page.getByRole('button', { name: 'Select all 2 filtered' }).click()
  await expect(page.getByText('2 selected')).toBeVisible()
  await page.getByRole('combobox', { name: 'Bulk action' }).selectOption('priority')
  await page.getByRole('combobox', { name: 'New priority' }).selectOption('high')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByText('2 selected')).toHaveCount(0)

  await page.getByText('More filters and sorting').click()
  await page.getByRole('combobox', { name: 'Filter by priority' }).selectOption('high')
  await expect(page.getByText('Keyboard overlap').first()).toBeVisible()
  await expect(page.getByText('Button alignment').first()).toBeVisible()

  await page.reload()
  await expect(page.getByText('Keyboard overlap').first()).toBeVisible()
  await expect(page.getByText('Button alignment').first()).toBeVisible()
  await page.getByRole('button', { name: 'Board view' }).click()
  await expect(page.getByRole('region', { name: 'Issue board' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Status for Keyboard overlap' }).selectOption('blocked')
  await expect(page.getByRole('combobox', { name: 'Status for Keyboard overlap' })).toHaveValue('blocked')
})

test('Local suggestions and fix references stay on device', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()
  await page.getByRole('button', { name: /New issue/ }).first().click()
  await page.getByRole('textbox', { name: 'Title' }).fill('Save button hidden on mobile')
  await page.getByRole('button', { name: 'Create issue' }).click()
  await expect(page.getByText('Save button hidden on mobile').first()).toBeVisible()

  await page.getByRole('button', { name: /New issue/ }).first().click()
  await page.getByRole('textbox', { name: 'Title' }).fill('Mobile save button hidden')
  await expect(page.getByLabel('Similar issues')).toContainText('Save button hidden on mobile')
  await page.getByRole('button', { name: 'Cancel' }).click()

  await page.getByText('Add GitHub fix reference').click()
  await page.getByRole('textbox', { name: 'GitHub fix URL' }).fill('https://github.com/acme/app/pull/12')
  await page.getByRole('button', { name: 'Add link' }).click()
  await expect(page.getByRole('link', { name: 'https://github.com/acme/app/pull/12' })).toBeVisible()
  await page.getByText('Prompt template').click()
  await page.getByRole('combobox', { name: 'Prompt template' }).selectOption('custom')
  await page.getByRole('textbox', { name: /Use \{\{issue\}\}/ }).fill('Investigate {{title}}\n{{issue}}')
  await page.getByRole('button', { name: 'Save template' }).click()
  await expect(page.getByText('Saved in this browser', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByText('Save button hidden on mobile').first().click()
  await expect(page.getByRole('link', { name: 'https://github.com/acme/app/pull/12' })).toBeVisible()
  await page.getByText('Prompt template').click()
  await page.getByRole('combobox', { name: 'Prompt template' }).selectOption('custom')
  await expect(page.getByRole('textbox', { name: /Use \{\{issue\}\}/ })).toHaveValue('Investigate {{title}}\n{{issue}}')
})

test('optional capture opens a reviewable issue draft without saving it', async ({ page }) => {
  const nonce = 'a'.repeat(32)
  await page.goto(`/?capture=${nonce}`)
  await page.getByRole('button', { name: 'Start with Local' }).click()
  await page.evaluate(value => window.postMessage({ type: 'bugstow-capture', nonce: value, title: 'Captured bug', pageUrl: 'https://example.com/problem', selectedText: 'Button missing', screenshotDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQGYR54AAAAASUVORK5CYII=' }, window.location.origin), nonce)
  await expect(page.getByRole('dialog', { name: 'New issue' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Captured bug')
  await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue(/Button missing/)
  await expect(page.getByRole('img', { name: 'Screenshot 1' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Screenshot 2' })).toHaveCount(0)
  await expect(page.getByText('Open issues').first()).toBeVisible()
})

test('mobile issue form keeps advanced details and its save action reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()
  await page.getByRole('button', { name: /New issue/ }).first().click()
  await page.getByRole('textbox', { name: 'Title' }).fill('Mobile form issue')
  await page.getByText('More report details (optional)').click()
  await page.getByRole('textbox', { name: 'Steps to reproduce' }).fill('Tap the save button')
  await page.getByRole('button', { name: 'Create issue' }).click()
  await expect(page.getByRole('heading', { name: 'Mobile form issue' })).toBeVisible()
  await expect(page.getByText('Tap the save button')).toBeVisible()
})
