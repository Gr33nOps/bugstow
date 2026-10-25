import { expect, test } from '@playwright/test'

test('Local bulk actions exclude issues hidden by a new search', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()
  for (const title of ['Visible bug', 'Other bug']) {
    await page.getByRole('button', { name: /New issue/ }).first().click()
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
    await page.getByRole('button', { name: 'Create issue' }).click()
  }
  await page.getByRole('button', { name: 'Select all 2 filtered' }).click()
  await page.getByRole('searchbox', { name: 'Search issues' }).fill('Visible bug')
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search issues' }).fill('')
  await expect(page.getByText('Other bug', { exact: true }).first()).toBeVisible()
})

test('Local capture keeps keyboard focus inside and restores it on close', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()
  const trigger = page.getByRole('button', { name: /New issue/ }).first()
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'New issue' })
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('Local board search can be changed without returning to the list', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()
  await page.getByRole('button', { name: /New issue/ }).first().click()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Board search issue')
  await page.getByRole('button', { name: 'Create issue' }).click()
  await page.getByRole('button', { name: 'Board view' }).click()
  await page.getByText('More filters and sorting').click()
  await expect(page.getByRole('combobox', { name: 'Filter by priority' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Filter by priority' }).selectOption('critical')
  await expect(page.getByRole('region', { name: 'Issue board' }).getByRole('button', { name: 'Board search issue' })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Filter by priority' }).selectOption('all')
  await page.getByRole('searchbox', { name: 'Search board' }).fill('missing')
  await expect(page.getByRole('region', { name: 'Issue board' }).getByRole('button', { name: 'Board search issue' })).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search board' }).fill('')
  await expect(page.getByRole('region', { name: 'Issue board' }).getByRole('button', { name: 'Board search issue' })).toBeVisible()
})


test('Local list and board fit narrow screens with long issue titles', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()
  for (const title of ['A short issue', 'A much longer issue title that should remain readable without pushing the project and actions beyond the edge of the window']) {
    await page.getByRole('button', { name: /New issue/ }).first().click()
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
    await page.getByRole('button', { name: 'Create issue' }).click()
  }
  await page.getByRole('button', { name: /Change theme/ }).click()
  await page.getByRole('button', { name: /^Close/ }).first().click()
  await page.screenshot({ animations: 'disabled', path: test.info().outputPath('local-list-dark.png') })
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Board view', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Issue board' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ animations: 'disabled', path: test.info().outputPath('local-board-' + width + '.png') })
    await page.getByRole('button', { name: 'List view', exact: true }).click()
  }
})
