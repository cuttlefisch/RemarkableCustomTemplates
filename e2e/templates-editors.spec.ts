import { test, expect } from '@playwright/test'
import { waitForSidebarLoaded } from './helpers'

/** Create a custom template and select it so editor buttons are available */
async function createAndSelectCustomTemplate(page: import('@playwright/test').Page) {
  const name = `Editor Test ${Date.now()}`

  const newBtn = page.locator('.sidebar-action-btn', { hasText: '+ New' })
  await expect(newBtn).toBeVisible()
  await newBtn.click()

  const nameInput = page.locator('.new-template-name')
  await expect(nameInput).toBeVisible()
  await nameInput.fill(name)

  const createBtn = page.locator('.new-template-create-btn')
  await createBtn.click()

  // Wait for the template to appear and be selected
  await expect(page.locator('.template-btn', { hasText: name })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.preview-meta')).toBeVisible({ timeout: 5_000 })

  // Creating a new template auto-opens the JSON editor — close it first
  const closeBtn = page.locator('button', { hasText: 'Close Editor' })
  if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(300)
  }

  return name
}

test.describe('Editor Panels', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForSidebarLoaded(page)
  })

  test('custom template shows Edit JSON button', async ({ page }) => {
    await createAndSelectCustomTemplate(page)

    const editJsonBtn = page.locator('button', { hasText: 'Edit JSON' })
    await expect(editJsonBtn).toBeVisible({ timeout: 5_000 })
  })

  test('Edit JSON opens editor panel', async ({ page }) => {
    await createAndSelectCustomTemplate(page)

    const editJsonBtn = page.locator('button', { hasText: 'Edit JSON' })
    await expect(editJsonBtn).toBeVisible({ timeout: 5_000 })
    await editJsonBtn.click()

    // Monaco editor should appear
    const editor = page.locator('.json-editor, .monaco-editor')
    await expect(editor.first()).toBeVisible({ timeout: 10_000 })
  })

  test('Close Editor hides editor panel', async ({ page }) => {
    await createAndSelectCustomTemplate(page)

    // Open editor
    const editJsonBtn = page.locator('button', { hasText: 'Edit JSON' })
    await editJsonBtn.click()
    const editor = page.locator('.json-editor, .monaco-editor')
    await expect(editor.first()).toBeVisible({ timeout: 10_000 })

    // Close editor
    const closeBtn = page.locator('button', { hasText: 'Close Editor' })
    await expect(closeBtn).toBeVisible()
    await closeBtn.click()

    // "Edit JSON" button should reappear
    await expect(editJsonBtn).toBeVisible({ timeout: 5_000 })
  })

  test('custom template shows Draw button', async ({ page }) => {
    await createAndSelectCustomTemplate(page)

    const drawBtn = page.locator('button', { hasText: 'Draw' })
    await expect(drawBtn).toBeVisible({ timeout: 5_000 })
  })

  test('Draw button opens drawing toolbar', async ({ page }) => {
    await createAndSelectCustomTemplate(page)

    const drawBtn = page.locator('button', { hasText: 'Draw' })
    await expect(drawBtn).toBeVisible({ timeout: 5_000 })
    await drawBtn.click()

    // Drawing toolbar should appear
    const toolbar = page.locator('.drawing-toolbar')
    await expect(toolbar).toBeVisible({ timeout: 10_000 })
  })
})
