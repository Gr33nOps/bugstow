import { expect, test } from '@playwright/test'

test('Detail layout preserves readable panes while resizing and board remains scrollable', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()
  await page.getByRole('button', { name: /New issue/ }).first().click()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Responsive layout regression')
  await page.getByRole('button', { name: 'Create issue' }).click()
  await expect(page.getByRole('button', { name: 'Edit issue' })).toBeVisible()
  for (const width of [390, 760, 767, 768, 1024, 1280, 1600]) {
    await page.setViewportSize({ width, height: 720 })
    const search = page.getByRole('searchbox', { name: 'Search issues' })
    if (await search.isVisible()) {
      const pane = page.getByRole('region', { name: 'Open issues', exact: true })
      expect((await pane.boundingBox())!.width).toBeGreaterThanOrEqual(320)
    }
    if (!(await page.locator('.issue-master-pane').isVisible())) {
      expect((await page.locator('.issue-detail-pane').boundingBox())!.width).toBeGreaterThanOrEqual((await page.locator('.issue-workspace').boundingBox())!.width - 2)
    }
    await expect(page.getByRole('button', { name: 'Edit issue' })).toBeInViewport()
    await page.screenshot({ path: test.info().outputPath(`detail-${width}.png`) })
  }
  await page.getByRole('button', { name: 'Close details' }).click()
  await page.getByRole('checkbox', { name: 'Select Responsive layout regression' }).check()
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit issue' })).not.toBeVisible()
  await page.screenshot({ path: test.info().outputPath('bulk-selection.png') })
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.getByRole('button', { name: 'Board view' }).click()
  await page.setViewportSize({ width: 768, height: 600 })
  const board = page.getByRole('region', { name: 'Issue board' })
  await expect(board).toBeVisible()
  const rect = await board.boundingBox()
  expect(rect!.height).toBeGreaterThan(150)
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(600)
  await board.getByRole('heading', { name: 'Fixed', exact: false }).scrollIntoViewIfNeeded()
  await expect(board.getByRole('heading', { name: 'Fixed', exact: false })).toBeInViewport()
  await page.screenshot({ path: test.info().outputPath('board-tablet.png') })
})


test('Local header actions remain available with a collapsed sidebar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()
  await page.getByRole('button', { name: 'Collapse sidebar' }).click()
  const header = page.locator('header').filter({ visible: true })
  await header.getByText('Actions', { exact: true }).click()
  await header.getByRole('button', { name: 'Import from GitHub', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await header.getByText('Actions', { exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(header.getByRole('button', { name: 'Import from GitHub', exact: true })).not.toBeVisible()
})

test('Opening and closing an issue preserves filters', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()
  await page.getByRole('button', { name: /New issue/ }).first().click()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Keep my filters')
  await page.getByRole('button', { name: 'Create issue' }).click()
  await page.getByRole('button', { name: 'Close details' }).click()
  await page.getByText('More filters and sorting').click()
  await page.getByRole('combobox', { name: 'Filter by priority' }).selectOption('medium')
  await page.getByRole('button', { name: /Keep my filters/ }).click()
  await expect(page.getByRole('combobox', { name: 'Filter by priority' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Filter by priority' })).toHaveValue('medium')
  await page.getByRole('button', { name: 'Close details' }).click()
  await expect(page.getByRole('combobox', { name: 'Filter by priority' })).toHaveValue('medium')
})


test('Issue action menu takes keyboard focus and Escape closes only the menu', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start with Local' }).click()
  await page.getByRole('button', { name: /New issue/ }).first().click()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Menu keyboard test')
  await page.getByRole('button', { name: 'Create issue' }).click()
  const trigger = page.getByRole('button', { name: 'More actions', exact: true })
  await trigger.click()
  await expect(page.getByRole('menuitem', { name: 'Copy with prompt' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Mark completed' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).not.toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(page.getByRole('button', { name: 'Edit issue' })).toBeVisible()
})
