import { test, expect } from '@playwright/test'
import { createNotebook, clearNotebookDrafts } from './helpers'

test.describe('Notebook Bulk Select & Built-in Notebooks', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await clearNotebookDrafts(page)
    // Restore all hidden built-in notebooks
    await page.request.post('http://localhost:3000/api/builtin-notebooks/restore-all')
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
  })

  test('built-in notebooks appear in list with badges', async ({ page }) => {
    // Built-in notebooks should render if registries exist
    const badges = page.locator('.notebook-system-badge')
    const badgeCount = await badges.count()
    // At least one system badge (sample or debug) if registries have entries
    if (badgeCount > 0) {
      await expect(badges.first()).toBeVisible()
    }
  })

  test('checkboxes visible on notebook cards', async ({ page }) => {
    // Create a user notebook so we have at least one card
    await createNotebook(page)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    const cards = page.locator('.notebook-list-card:not(.notebook-list-new)')
    await expect(cards.first()).toBeVisible({ timeout: 5_000 })

    const checkboxes = page.locator('.notebook-card-bulk-checkbox')
    await expect(checkboxes.first()).toBeVisible()
  })

  test('checking a card shows bulk action bar', async ({ page }) => {
    await createNotebook(page)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    // Bulk bar should not be visible initially
    await expect(page.locator('.notebook-bulk-bar')).not.toBeVisible()

    // Check the first checkbox
    const checkbox = page.locator('.notebook-card-bulk-checkbox').first()
    await checkbox.click()

    // Bulk bar should appear
    await expect(page.locator('.notebook-bulk-bar')).toBeVisible()
    await expect(page.locator('.sidebar-bulk-count')).toContainText('selected')
  })

  test('select all and deselect all work', async ({ page }) => {
    // Create two notebooks
    await createNotebook(page)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await createNotebook(page)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    // Check one to show the bar
    const checkbox = page.locator('.notebook-card-bulk-checkbox').first()
    await checkbox.click()
    await expect(page.locator('.notebook-bulk-bar')).toBeVisible()

    // Click Select All
    await page.locator('.sidebar-bulk-select-all-btn').click()
    const allCheckboxes = page.locator('.notebook-card-bulk-checkbox')
    const count = await allCheckboxes.count()
    for (let i = 0; i < count; i++) {
      await expect(allCheckboxes.nth(i)).toBeChecked()
    }

    // Click Deselect All
    await page.locator('.sidebar-bulk-select-all-btn').click()
    // Bulk bar should disappear
    await expect(page.locator('.notebook-bulk-bar')).not.toBeVisible()
  })

  test('clear button deselects all', async ({ page }) => {
    await createNotebook(page)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    const checkbox = page.locator('.notebook-card-bulk-checkbox').first()
    await checkbox.click()
    await expect(page.locator('.notebook-bulk-bar')).toBeVisible()

    await page.locator('.sidebar-bulk-clear-btn').click()
    await expect(page.locator('.notebook-bulk-bar')).not.toBeVisible()
  })

  test('bulk delete removes user notebooks', async ({ page }) => {
    await createNotebook(page)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    // Count cards before
    const cardsBefore = await page.locator('.notebook-list-card:not(.notebook-list-new)').count()

    // Find the first non-system card checkbox
    // User cards don't have .notebook-system-badge
    const userCards = page.locator('.notebook-list-card:not(.notebook-list-new):not(:has(.notebook-system-badge))')
    const userCardCount = await userCards.count()
    if (userCardCount === 0) return // skip if only system notebooks

    // Check the first user card
    const firstUserCheckbox = userCards.first().locator('.notebook-card-bulk-checkbox')
    await firstUserCheckbox.click()

    // Accept confirm dialog
    page.on('dialog', d => d.accept())
    await page.locator('.sidebar-bulk-delete-btn').click()
    await page.waitForTimeout(500)

    // Should have one fewer card
    const cardsAfter = await page.locator('.notebook-list-card:not(.notebook-list-new)').count()
    expect(cardsAfter).toBeLessThan(cardsBefore)
  })

  test('hiding system notebook shows restore button', async ({ page }) => {
    const badges = page.locator('.notebook-system-badge')
    const badgeCount = await badges.count()
    if (badgeCount === 0) {
      test.skip()
      return
    }

    // Hide via the card action button
    const systemCard = page.locator('.notebook-list-card:has(.notebook-system-badge)').first()
    await systemCard.hover()
    const hideBtn = systemCard.locator('.notebook-list-card-hide')
    await hideBtn.click()
    await page.waitForTimeout(300)

    // Restore button should appear
    await expect(page.locator('.notebook-restore-btn')).toBeVisible()
  })

  test('restore button brings back hidden notebooks', async ({ page }) => {
    const badges = page.locator('.notebook-system-badge')
    const badgeCount = await badges.count()
    if (badgeCount === 0) {
      test.skip()
      return
    }

    const countBefore = badgeCount

    // Hide one system notebook
    const systemCard = page.locator('.notebook-list-card:has(.notebook-system-badge)').first()
    await systemCard.hover()
    await systemCard.locator('.notebook-list-card-hide').click()
    await page.waitForTimeout(300)

    // Click restore
    await page.locator('.notebook-restore-btn').click()
    await page.waitForTimeout(500)

    // Count should be restored
    const countAfter = await page.locator('.notebook-system-badge').count()
    expect(countAfter).toBe(countBefore)
  })
})
