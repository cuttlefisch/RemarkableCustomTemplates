import { test, expect } from '@playwright/test'
import { createNotebook, addPageGroup, clearNotebookDrafts } from './helpers'

test.describe('Notebook Builder', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await clearNotebookDrafts(page)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with "New Notebook" card visible', async ({ page }) => {
    await expect(page.locator('.notebook-list-new')).toBeVisible({ timeout: 10_000 })
  })

  test('create notebook and return to list shows card', async ({ page }) => {
    await page.locator('.notebook-list-new').click()
    await page.waitForTimeout(300)

    // Navigate back via URL (back button class is .notebook-toolbar-back)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Should see at least one notebook card
    const cards = page.locator('.notebook-list-card:not(.notebook-list-new)')
    await expect(cards.first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.notebook-list-card-name').first()).toContainText('Notebook')
  })

  test('create second notebook shows "Notebook 2"', async ({ page }) => {
    // Create first notebook
    await createNotebook(page)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    // Create second notebook
    await page.locator('.notebook-list-new').click()
    await page.waitForTimeout(300)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    const cardNames = page.locator('.notebook-list-card-name')
    const count = await cardNames.count()
    const names: string[] = []
    for (let i = 0; i < count; i++) {
      names.push(await cardNames.nth(i).innerText())
    }
    expect(names).toContain('Notebook 2')
  })

  test('add page groups shows count in header', async ({ page }) => {
    await createNotebook(page)

    await addPageGroup(page, 0)
    await addPageGroup(page, 0)

    await expect(page.getByText('PAGE GROUPS (2)')).toBeVisible({ timeout: 5_000 })
  })

  test('delete notebook with confirmation', async ({ page }) => {
    await createNotebook(page)
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const cards = page.locator('.notebook-list-card:not(.notebook-list-new)')
    await expect(cards.first()).toBeVisible({ timeout: 5_000 })

    page.on('dialog', (d) => d.accept())

    await cards.first().hover()
    const deleteBtn = page.locator('.notebook-list-card-delete').first()
    await expect(deleteBtn).toBeVisible({ timeout: 3_000 })
    await deleteBtn.click()
    await page.waitForTimeout(500)

    await expect(page.locator('.notebook-list-card:not(.notebook-list-new)')).toHaveCount(0, { timeout: 5_000 })
  })

  test('back button from editor returns to list', async ({ page }) => {
    await createNotebook(page)

    const backBtn = page.locator('.notebook-toolbar-back')
    await expect(backBtn).toBeVisible({ timeout: 5_000 })
    await backBtn.click()
    await page.waitForTimeout(300)

    await expect(page.locator('.notebook-list-new')).toBeVisible({ timeout: 5_000 })
  })
})
