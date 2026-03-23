import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Wait for the template sidebar to finish loading */
export async function waitForSidebarLoaded(page: Page) {
  await expect(page.locator('.template-btn').first()).toBeVisible({ timeout: 10_000 })
}

/** Select the first template in the sidebar list */
export async function selectFirstTemplate(page: Page) {
  await waitForSidebarLoaded(page)
  await page.locator('.template-btn').first().click()
  await expect(page.locator('.preview-meta')).toBeVisible({ timeout: 5_000 })
}

/** Copy the currently selected template and wait for completion */
export async function copySelectedTemplate(page: Page) {
  const copyBtn = page.locator('button', { hasText: 'Copy' })
  await expect(copyBtn).toBeVisible()
  await copyBtn.click()
  await expect(copyBtn).toHaveText('Copy', { timeout: 10_000 })
}

/** Clear all notebook drafts (for E2E test isolation) */
export async function clearNotebookDrafts(page: Page) {
  await page.request.delete('http://localhost:3000/api/notebook-drafts')
}

/** Create a new notebook and return to list view */
export async function createNotebook(page: Page) {
  await page.goto('/notebook')
  await page.waitForLoadState('networkidle')
  const newBtn = page.locator('.notebook-list-new')
  await expect(newBtn).toBeVisible({ timeout: 5_000 })
  await newBtn.click()
  await page.waitForTimeout(300)
}

/** Add a template page group to the current notebook editor */
export async function addPageGroup(page: Page, index = 0) {
  const pickerItems = page.locator('.notebook-picker-item')
  await expect(pickerItems.first()).toBeVisible({ timeout: 5_000 })
  await pickerItems.nth(index).click()
  await page.waitForTimeout(300)
}
