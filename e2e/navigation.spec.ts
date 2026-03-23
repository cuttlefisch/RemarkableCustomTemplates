import { test, expect } from '@playwright/test'

test.describe('Cross-page navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('nav bar shows 3 tabs', async ({ page }) => {
    const navLinks = page.locator('.nav-bar .nav-link')
    await expect(navLinks).toHaveCount(3)
    await expect(navLinks.nth(0)).toHaveText('Devices')
    await expect(navLinks.nth(1)).toHaveText('Templates')
    await expect(navLinks.nth(2)).toContainText('Notebooks')
  })

  test('click Devices navigates to /device and page content loads', async ({ page }) => {
    await page.locator('.nav-link', { hasText: 'Devices' }).click()
    await expect(page).toHaveURL(/\/device/)
    // Active tab should be highlighted
    await expect(page.locator('.nav-link.active')).toHaveText('Devices')
    // Device page content should load
    await page.waitForLoadState('networkidle')
  })

  test('click Notebooks navigates to /notebook', async ({ page }) => {
    await page.locator('.nav-link', { hasText: 'Notebooks' }).click()
    await expect(page).toHaveURL(/\/notebook/)
    await expect(page.locator('.nav-link.active')).toContainText('Notebooks')
  })

  test('click Templates navigates back to / with sidebar', async ({ page }) => {
    // Navigate away first
    await page.locator('.nav-link', { hasText: 'Devices' }).click()
    await expect(page).toHaveURL(/\/device/)

    // Navigate back to Templates
    await page.locator('.nav-link', { hasText: 'Templates' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('.nav-link.active')).toHaveText('Templates')
    // Sidebar should load with template items
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.template-btn').first()).toBeVisible({ timeout: 10_000 })
  })

  test('browser back button works after navigation', async ({ page }) => {
    // Start on Templates (/)
    await expect(page).toHaveURL(/\/$/)

    // Navigate to Devices
    await page.locator('.nav-link', { hasText: 'Devices' }).click()
    await expect(page).toHaveURL(/\/device/)

    // Navigate to Notebooks
    await page.locator('.nav-link', { hasText: 'Notebooks' }).click()
    await expect(page).toHaveURL(/\/notebook/)

    // Go back to Devices
    await page.goBack()
    await expect(page).toHaveURL(/\/device/)
    await expect(page.locator('.nav-link.active')).toHaveText('Devices')

    // Go back to Templates
    await page.goBack()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('.nav-link.active')).toHaveText('Templates')
  })
})
