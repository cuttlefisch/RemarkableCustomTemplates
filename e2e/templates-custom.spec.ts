import { test, expect } from '@playwright/test'
import { waitForSidebarLoaded } from './helpers'

/** Create a custom template via the "+ New" flow and return its name */
async function createCustomTemplate(page: import('@playwright/test').Page, name: string) {
  const newBtn = page.locator('.sidebar-action-btn', { hasText: '+ New' })
  await expect(newBtn).toBeVisible()
  await newBtn.click()

  const nameInput = page.locator('.new-template-name')
  await expect(nameInput).toBeVisible()
  await nameInput.fill(name)

  const createBtn = page.locator('.new-template-create-btn')
  await createBtn.click()

  // Wait for the new template to appear in the sidebar list
  await expect(page.locator('.template-btn', { hasText: name })).toBeVisible({ timeout: 10_000 })
}

test.describe('Custom Template CRUD', () => {
  test.beforeEach(async ({ page }) => {
    // Auto-accept any confirmation dialogs (e.g. delete confirmations)
    page.on('dialog', (d) => d.accept())
    await page.goto('/')
    await waitForSidebarLoaded(page)
  })

  test('create custom template', async ({ page }) => {
    const templateName = `Test Template ${Date.now()}`
    await createCustomTemplate(page, templateName)

    // Verify the template appears in the sidebar list
    const entry = page.locator('.template-btn', { hasText: templateName })
    await expect(entry).toBeVisible()
  })

  test('copy a template', async ({ page }) => {
    // Select the first template
    const firstTemplate = page.locator('.template-btn').first()
    await firstTemplate.click()
    await expect(page.locator('.preview-meta')).toBeVisible({ timeout: 5_000 })

    // Click Copy and wait for it to complete
    const copyBtn = page.locator('button', { hasText: 'Copy' })
    await expect(copyBtn).toBeVisible()
    await copyBtn.click()

    // Wait for "Copying…" state to resolve
    await expect(copyBtn).toHaveText('Copy', { timeout: 10_000 })
    await expect(copyBtn).toBeEnabled()

    // Verify a new "(Copy)" entry exists in the list
    const copyEntry = page.locator('.template-btn', { hasText: '(Copy)' })
    await expect(copyEntry.first()).toBeVisible({ timeout: 5_000 })
  })

  test('delete a custom template', async ({ page }) => {
    // Create a custom template first so we have something to delete
    const templateName = `Delete Me ${Date.now()}`
    await createCustomTemplate(page, templateName)

    // Find the template entry and its delete button
    const entry = page.locator('.template-btn', { hasText: templateName })
    await expect(entry).toBeVisible()

    // Hover to reveal delete button (it's inside the .template-btn)
    await entry.hover()
    const deleteBtn = entry.locator('.template-action-delete')
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 })
    await deleteBtn.click()

    // Template should be removed from the list
    await expect(entry).toBeHidden({ timeout: 10_000 })
  })

  test('checking templates shows bulk action bar with count', async ({ page }) => {
    // Ensure we have at least 2 custom templates
    await createCustomTemplate(page, `Bulk A ${Date.now()}`)
    await createCustomTemplate(page, `Bulk B ${Date.now()}`)

    // Checkboxes always visible — check 2 items
    const checkboxes = page.locator('.bulk-checkbox')
    await expect(checkboxes.first()).toBeVisible()
    await checkboxes.nth(0).click()
    await checkboxes.nth(1).click()

    // Bulk bar should appear with count and delete button
    const bulkBar = page.locator('.sidebar-bulk-bar')
    await expect(bulkBar).toBeVisible({ timeout: 5_000 })
    await expect(bulkBar).toContainText('2 selected')
    await expect(bulkBar.locator('button', { hasText: /Delete/i })).toBeVisible()
  })

  test('clear button deselects all and hides bulk bar', async ({ page }) => {
    // Check a template
    const checkboxes = page.locator('.bulk-checkbox')
    await expect(checkboxes.first()).toBeVisible()
    await checkboxes.nth(0).click()

    const bulkBar = page.locator('.sidebar-bulk-bar')
    await expect(bulkBar).toBeVisible()

    // Click Clear
    await bulkBar.locator('button', { hasText: /Clear/i }).click()

    // Bar should disappear
    await expect(bulkBar).toBeHidden()
  })
})
