import { test, expect } from '@playwright/test'
import { waitForSidebarLoaded, createCustomTemplate, cleanupCustomTemplates, assertNoCustomTemplates } from './helpers'

const PREFIX = 'E2E Bulk'

test.describe('Always-visible bulk select', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (d) => d.accept())
    await page.goto('/')
    await waitForSidebarLoaded(page)
  })

  test.afterEach(async ({ request }) => {
    await cleanupCustomTemplates(request, PREFIX)
    await assertNoCustomTemplates(request, PREFIX)
  })

  test('checkboxes are always visible on template items without needing a Select button', async ({ page }) => {
    // Checkboxes should be present on every template item by default
    const checkboxes = page.locator('.bulk-checkbox')
    await expect(checkboxes.first()).toBeVisible({ timeout: 5_000 })

    const templateCount = await page.locator('.template-btn').count()
    const checkboxCount = await checkboxes.count()
    expect(checkboxCount).toBe(templateCount)

    // There should NOT be a dedicated "Select" toggle button
    const selectBtn = page.locator('.sidebar-action-btn', { hasText: /^☐ Select$/ })
    await expect(selectBtn).toHaveCount(0)
  })

  test('checking a template shows the bulk action bar with count', async ({ page }) => {
    // Initially no bulk bar visible
    const bulkBar = page.locator('.sidebar-bulk-bar')
    await expect(bulkBar).toBeHidden()

    // Check one template
    const checkboxes = page.locator('.bulk-checkbox')
    await checkboxes.first().click()

    // Bulk bar should appear showing "1 selected"
    await expect(bulkBar).toBeVisible({ timeout: 3_000 })
    await expect(bulkBar).toContainText('1 selected')
  })

  test('checking multiple templates updates the count', async ({ page }) => {
    const checkboxes = page.locator('.bulk-checkbox')
    await checkboxes.nth(0).click()
    await checkboxes.nth(1).click()
    await checkboxes.nth(2).click()

    const bulkBar = page.locator('.sidebar-bulk-bar')
    await expect(bulkBar).toContainText('3 selected')
  })

  test('unchecking all templates hides the bulk action bar', async ({ page }) => {
    // Target a specific template's checkbox to avoid index shifts from parallel tests
    const firstEntry = page.locator('.template-btn').first()
    const checkbox = firstEntry.locator('.bulk-checkbox')
    await checkbox.click()

    const bulkBar = page.locator('.sidebar-bulk-bar')
    await expect(bulkBar).toBeVisible()

    // Uncheck the same template
    await checkbox.click()

    await expect(bulkBar).toBeHidden()
  })

  test('clear selection button deselects all checkboxes', async ({ page }) => {
    const checkboxes = page.locator('.bulk-checkbox')
    await checkboxes.nth(0).click()
    await checkboxes.nth(1).click()

    const bulkBar = page.locator('.sidebar-bulk-bar')
    await expect(bulkBar).toBeVisible()

    // Click the clear/deselect button
    const clearBtn = bulkBar.locator('button', { hasText: /Clear|Deselect/i })
    await expect(clearBtn).toBeVisible()
    await clearBtn.click()

    // Bar should disappear, no checkboxes checked
    await expect(bulkBar).toBeHidden()
    const checked = page.locator('.bulk-checkbox:checked')
    await expect(checked).toHaveCount(0)
  })

  test('delete action removes custom templates', async ({ page }) => {
    const ts = Date.now()
    await createCustomTemplate(page, `${PREFIX} DelA ${ts}`)
    await createCustomTemplate(page, `${PREFIX} DelB ${ts}`)

    // Find and check both custom templates
    const entryA = page.locator('.template-btn', { hasText: `${PREFIX} DelA ${ts}` })
    const entryB = page.locator('.template-btn', { hasText: `${PREFIX} DelB ${ts}` })
    await entryA.locator('.bulk-checkbox').click()
    await entryB.locator('.bulk-checkbox').click()

    const bulkBar = page.locator('.sidebar-bulk-bar')
    await expect(bulkBar).toContainText('2 selected')

    // Click Delete
    const deleteBtn = bulkBar.locator('button', { hasText: /Delete/i })
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // Both templates should be gone
    await expect(entryA).toBeHidden({ timeout: 10_000 })
    await expect(entryB).toBeHidden({ timeout: 10_000 })
  })

  test('delete action hides sample templates instead of deleting them', async ({ page }) => {
    // Filter to samples only
    const samplesChip = page.locator('.source-chip', { hasText: 'Samples' })
    if (await samplesChip.isVisible().catch(() => false)) {
      await samplesChip.click()
      await page.waitForTimeout(300)
    }

    const templatesBefore = await page.locator('.template-btn').count()
    if (templatesBefore === 0) {
      test.skip()
      return
    }

    // Check the first sample template
    const firstCheckbox = page.locator('.bulk-checkbox').first()
    await firstCheckbox.click()

    const bulkBar = page.locator('.sidebar-bulk-bar')
    const deleteBtn = bulkBar.locator('button', { hasText: /Delete/i })
    await deleteBtn.click()

    // Template count should decrease (sample was hidden, not deleted)
    await page.waitForTimeout(500)
    const templatesAfter = await page.locator('.template-btn').count()
    expect(templatesAfter).toBeLessThan(templatesBefore)
  })

  test('clicking a template row (not checkbox) still selects for preview', async ({ page }) => {
    // Clicking the template name/row (not the checkbox) should select it for preview
    const firstTemplate = page.locator('.template-btn').first()
    await firstTemplate.click()

    // Preview should be visible
    await expect(page.locator('.preview-meta')).toBeVisible({ timeout: 5_000 })

    // The checkbox should NOT be checked (click was on the row, not checkbox)
    const checkbox = firstTemplate.locator('.bulk-checkbox')
    await expect(checkbox).not.toBeChecked()
  })
})
