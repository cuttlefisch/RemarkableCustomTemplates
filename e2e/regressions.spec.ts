import { test, expect } from '@playwright/test'
import { waitForSidebarLoaded, createCustomTemplate, cleanupCustomTemplates, assertNoCustomTemplates, createNotebook, addPageGroup, clearNotebookDrafts } from './helpers'

const PREFIX = 'E2E Regr'

test.describe('Regression tests', () => {
  test.describe('Copy then edit (filename mismatch fix)', () => {
    test.beforeEach(async ({ page }) => {
      page.on('dialog', (d) => d.accept())
      await page.goto('/')
      await waitForSidebarLoaded(page)
    })

    test.afterEach(async ({ request }) => {
      // Clean up both prefixed templates and any "(Copy)" artifacts
      await cleanupCustomTemplates(request, PREFIX)
      await cleanupCustomTemplates(request, '(Copy)')
      await assertNoCustomTemplates(request, PREFIX)
    })

    test('copied template can be loaded after copy', async ({ page }) => {
      // Create a custom template, then copy it
      const name = `${PREFIX} CopyLoad ${Date.now()}`
      await createCustomTemplate(page, name)

      // Select the new template
      const entry = page.locator('.template-btn', { hasText: name })
      await entry.click()
      await expect(page.locator('.preview-meta')).toBeVisible({ timeout: 5_000 })

      // Copy it
      const copyBtn = page.locator('button', { hasText: 'Copy' })
      await expect(copyBtn).toBeVisible()
      await copyBtn.click()
      await expect(copyBtn).toHaveText('Copy', { timeout: 10_000 })

      // The copy should be selected and preview should load without errors
      await expect(page.locator('.preview-meta')).toBeVisible({ timeout: 5_000 })
      // No error message should be shown
      const errorBanner = page.locator('.error-message, .sidebar-error')
      const errorCount = await errorBanner.count()
      for (let i = 0; i < errorCount; i++) {
        await expect(errorBanner.nth(i)).not.toContainText('No template file found')
      }
    })

    test('copied template can open JSON editor and apply changes', async ({ page }) => {
      // Create and copy a custom template
      const name = `${PREFIX} CopyEdit ${Date.now()}`
      await createCustomTemplate(page, name)

      // Close the auto-opened editor from creation
      const closeEditorBtn = page.locator('button', { hasText: 'Close Editor' })
      if (await closeEditorBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await closeEditorBtn.click()
        await page.waitForTimeout(300)
      }

      // Select the template
      const entry = page.locator('.template-btn', { hasText: name })
      await entry.click()
      await expect(page.locator('.preview-meta')).toBeVisible({ timeout: 5_000 })

      // Copy it
      const copyBtn = page.locator('button', { hasText: 'Copy' })
      await copyBtn.click()
      await expect(copyBtn).toHaveText('Copy', { timeout: 10_000 })

      // Open JSON editor on the copy
      const editBtn = page.locator('button', { hasText: 'Edit JSON' })
      await expect(editBtn).toBeVisible({ timeout: 5_000 })
      await editBtn.click()

      const editor = page.locator('.json-editor, .monaco-editor')
      await expect(editor.first()).toBeVisible({ timeout: 10_000 })

      // Hit Apply — should succeed without "No template file found"
      const applyBtn = page.locator('button', { hasText: 'Apply' })
      await expect(applyBtn).toBeVisible({ timeout: 5_000 })
      await applyBtn.click()
      await page.waitForTimeout(1_000)

      // Verify no error
      const pageContent = await page.content()
      expect(pageContent).not.toContain('No template file found')
    })

    test('copied template survives invert + apply', async ({ page }) => {
      // This is the exact repro from the bug report
      const name = `${PREFIX} CopyInvert ${Date.now()}`
      await createCustomTemplate(page, name)

      // Close the auto-opened editor from creation
      const closeEditorBtn = page.locator('button', { hasText: 'Close Editor' })
      if (await closeEditorBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await closeEditorBtn.click()
        await page.waitForTimeout(300)
      }

      const entry = page.locator('.template-btn', { hasText: name })
      await entry.click()
      await expect(page.locator('.preview-meta')).toBeVisible({ timeout: 5_000 })

      // Copy
      const copyBtn = page.locator('button', { hasText: 'Copy' })
      await copyBtn.click()
      await expect(copyBtn).toHaveText('Copy', { timeout: 10_000 })

      // Open editor
      const editBtn = page.locator('button', { hasText: 'Edit JSON' })
      await expect(editBtn).toBeVisible({ timeout: 5_000 })
      await editBtn.click()
      await expect(page.locator('.json-editor, .monaco-editor').first()).toBeVisible({ timeout: 10_000 })

      // Hit Invert (if available)
      const invertBtn = page.locator('button', { hasText: /Invert/i })
      if (await invertBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await invertBtn.click()
        await page.waitForTimeout(500)

        // Hit Apply
        const applyBtn = page.locator('button', { hasText: 'Apply' })
        await applyBtn.click()
        await page.waitForTimeout(1_000)

        // No error should appear
        const pageContent = await page.content()
        expect(pageContent).not.toContain('No template file found')
      }
    })
  })

  test.describe('Select All / Deselect All', () => {
    test.beforeEach(async ({ page }) => {
      page.on('dialog', (d) => d.accept())
      await page.goto('/')
      await waitForSidebarLoaded(page)
    })

    test('Select All button appears in bulk bar and selects all visible', async ({ page }) => {
      // Check one template to trigger bulk bar
      const checkboxes = page.locator('.bulk-checkbox')
      await checkboxes.first().click()

      const bulkBar = page.locator('.sidebar-bulk-bar')
      await expect(bulkBar).toBeVisible()

      // Click Select All
      const selectAllBtn = bulkBar.locator('button', { hasText: /Select All/i })
      await expect(selectAllBtn).toBeVisible()
      await selectAllBtn.click()

      // All visible templates should be checked
      const templateCount = await page.locator('.template-btn').count()
      const checkedCount = await page.locator('.bulk-checkbox:checked').count()
      expect(checkedCount).toBe(templateCount)

      // Count in bar should match
      await expect(bulkBar).toContainText(`${templateCount} selected`)
    })

    test('Deselect All clears selection and hides bar', async ({ page }) => {
      // Check all first
      const checkboxes = page.locator('.bulk-checkbox')
      await checkboxes.first().click()

      const bulkBar = page.locator('.sidebar-bulk-bar')
      await expect(bulkBar).toBeVisible()

      const selectAllBtn = bulkBar.locator('button', { hasText: /Select All/i })
      await selectAllBtn.click()

      // Button should now say "Deselect All"
      await expect(bulkBar.locator('button', { hasText: /Deselect All/i })).toBeVisible()

      // Click Deselect All
      await bulkBar.locator('button', { hasText: /Deselect All/i }).click()

      // Bar should be hidden
      await expect(bulkBar).toBeHidden()
      const checkedCount = await page.locator('.bulk-checkbox:checked').count()
      expect(checkedCount).toBe(0)
    })
  })

  test.describe('Delete template closes drawing editor', () => {
    test.beforeEach(async ({ page }) => {
      page.on('dialog', (d) => d.accept())
      await page.goto('/')
      await waitForSidebarLoaded(page)
    })

    test.afterEach(async ({ request }) => {
      await cleanupCustomTemplates(request, PREFIX)
      await assertNoCustomTemplates(request, PREFIX)
    })

    test('deleting a template while draw editor is open closes the editor', async ({ page }) => {
      const name = `${PREFIX} DrawDel ${Date.now()}`
      await createCustomTemplate(page, name)

      // Close the auto-opened JSON editor
      const closeEditorBtn = page.locator('button', { hasText: 'Close Editor' })
      if (await closeEditorBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await closeEditorBtn.click()
        await page.waitForTimeout(300)
      }

      // Open the drawing editor
      const drawBtn = page.locator('button', { hasText: 'Draw' })
      await expect(drawBtn).toBeVisible({ timeout: 5_000 })
      await drawBtn.click()
      const toolbar = page.locator('.drawing-toolbar')
      await expect(toolbar).toBeVisible({ timeout: 10_000 })

      // Delete the template (the Delete button is in the preview action bar)
      const deleteBtn = page.locator('button', { hasText: 'Delete' })
      await expect(deleteBtn).toBeVisible({ timeout: 5_000 })
      await deleteBtn.click()
      await page.waitForTimeout(500)

      // Drawing toolbar should be gone
      await expect(toolbar).toBeHidden({ timeout: 5_000 })

      // Template should be removed from sidebar
      await expect(page.locator('.template-btn', { hasText: name })).toBeHidden({ timeout: 5_000 })
    })

    test('deleting a template while JSON editor is open closes the editor', async ({ page }) => {
      const name = `${PREFIX} JsonDel ${Date.now()}`
      await createCustomTemplate(page, name)

      // JSON editor auto-opens on create — verify it's visible
      const editor = page.locator('.json-editor, .monaco-editor')
      await expect(editor.first()).toBeVisible({ timeout: 10_000 })

      // Delete the template
      const deleteBtn = page.locator('button', { hasText: 'Delete' })
      await expect(deleteBtn).toBeVisible({ timeout: 5_000 })
      await deleteBtn.click()
      await page.waitForTimeout(500)

      // Editor panel should be gone
      await expect(editor.first()).toBeHidden({ timeout: 5_000 })

      // Template should be removed from sidebar
      await expect(page.locator('.template-btn', { hasText: name })).toBeHidden({ timeout: 5_000 })
    })
  })

  test.describe('Notebook duplicate stays on list', () => {
    test('duplicating a notebook does not auto-navigate to editor', async ({ page }) => {
      await clearNotebookDrafts(page)
      await createNotebook(page)
      await addPageGroup(page, 0)

      // Go back to list
      await page.goto('/notebook')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const cards = page.locator('.notebook-list-card:not(.notebook-list-new)')
      await expect(cards.first()).toBeVisible({ timeout: 5_000 })

      const countBefore = await cards.count()

      // Click the fork/duplicate button on the first card
      const firstCard = cards.first()
      await firstCard.hover()
      const forkBtn = firstCard.locator('.notebook-list-card-action').first()
      await expect(forkBtn).toBeVisible({ timeout: 3_000 })
      await forkBtn.click()
      await page.waitForTimeout(500)

      // Should still be on the list view (not navigated to editor)
      const listGrid = page.locator('.notebook-list-grid')
      await expect(listGrid).toBeVisible()

      // Should have one more card
      const countAfter = await cards.count()
      expect(countAfter).toBe(countBefore + 1)
    })
  })
})
