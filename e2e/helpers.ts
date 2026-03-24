import type { Page, APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Resolve the base URL for API requests.
 * Uses the E2E_BASE_URL env var if set, otherwise falls back to localhost:3000.
 * Playwright's baseURL only applies to page.goto — API helpers need explicit URLs.
 */
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

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
  await page.request.delete(`${BASE_URL}/api/notebook-drafts`)
}

/**
 * Create a custom template via the UI "+ New" flow.
 * Waits for the template to appear in the sidebar before returning.
 */
export async function createCustomTemplate(page: Page, name: string) {
  const newBtn = page.locator('.sidebar-action-btn', { hasText: '+ New' })
  await expect(newBtn).toBeVisible()
  await newBtn.click()

  const nameInput = page.locator('.new-template-name')
  await expect(nameInput).toBeVisible()
  await nameInput.fill(name)

  const createBtn = page.locator('.new-template-create-btn')
  await createBtn.click()

  await expect(page.locator('.template-btn', { hasText: name })).toBeVisible({ timeout: 10_000 })
}

/**
 * Delete all custom templates whose name matches the given prefix via the API.
 * Fetches the custom registry, filters by prefix, and deletes each match.
 * Returns the number of templates deleted.
 */
export async function cleanupCustomTemplates(request: APIRequestContext, prefix: string): Promise<number> {
  const res = await request.get(`${BASE_URL}/templates/custom-registry.json`)
  if (!res.ok()) return 0
  const registry = (await res.json()) as { templates: Array<{ name: string; filename: string }> }
  let deleted = 0
  for (const entry of registry.templates) {
    if (entry.name.startsWith(prefix)) {
      const slug = entry.filename.replace(/^custom\//, '')
      await request.delete(`${BASE_URL}/api/custom-templates/${encodeURIComponent(slug)}`)
      deleted++
    }
  }
  return deleted
}

/**
 * Verify that no custom templates with the given prefix exist in the registry.
 * Throws if any are found — useful as an afterEach sanity check.
 */
export async function assertNoCustomTemplates(request: APIRequestContext, prefix: string) {
  const res = await request.get(`${BASE_URL}/templates/custom-registry.json`)
  if (!res.ok()) return // no registry = no templates
  const registry = (await res.json()) as { templates: Array<{ name: string }> }
  const remaining = registry.templates.filter(e => e.name.startsWith(prefix))
  if (remaining.length > 0) {
    throw new Error(`Cleanup failed: ${remaining.length} custom template(s) still exist with prefix "${prefix}": ${remaining.map(e => e.name).join(', ')}`)
  }
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

/** Restore all hidden built-in notebooks via the API */
export async function restoreAllBuiltinNotebooks(page: Page) {
  await page.request.post(`${BASE_URL}/api/builtin-notebooks/restore-all`)
}
