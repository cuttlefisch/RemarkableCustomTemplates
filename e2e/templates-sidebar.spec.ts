import { test, expect } from '@playwright/test'
import { waitForSidebarLoaded } from './helpers'

test.describe('Sidebar Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForSidebarLoaded(page)
  })

  test('collapse button hides sidebar content and adds collapsed class', async ({ page }) => {
    const sidebar = page.locator('.sidebar')
    await expect(sidebar).not.toHaveClass(/collapsed/)

    const collapseBtn = page.locator('.sidebar-collapse-btn')
    await expect(collapseBtn).toBeVisible()
    await collapseBtn.click()

    await expect(sidebar).toHaveClass(/collapsed/)
  })

  test('clicking collapse again expands the sidebar', async ({ page }) => {
    const sidebar = page.locator('.sidebar')
    const collapseBtn = page.locator('.sidebar-collapse-btn')

    // Collapse
    await collapseBtn.click()
    await expect(sidebar).toHaveClass(/collapsed/)

    // Expand
    await collapseBtn.click()
    await expect(sidebar).not.toHaveClass(/collapsed/)
  })

  test('list view toggle shows template-btn items', async ({ page }) => {
    const viewBtns = page.locator('.view-mode-btn')
    await expect(viewBtns.first()).toBeVisible()

    // First button is list view
    await viewBtns.first().click()
    await expect(page.locator('.template-btn').first()).toBeVisible()
  })

  test('card view toggle shows card-grid', async ({ page }) => {
    const viewBtns = page.locator('.view-mode-btn')
    await expect(viewBtns.nth(1)).toBeVisible()

    // Second button is card view
    await viewBtns.nth(1).click()
    await expect(page.locator('.sidebar-list .card-grid')).toBeVisible({ timeout: 5_000 })
  })

  test('switching back to list view shows template-btn items', async ({ page }) => {
    const viewBtns = page.locator('.view-mode-btn')

    // Switch to card view
    await viewBtns.nth(1).click()
    await expect(page.locator('.sidebar-list .card-grid')).toBeVisible({ timeout: 5_000 })

    // Switch back to list view
    await viewBtns.first().click()
    await expect(page.locator('.template-btn').first()).toBeVisible({ timeout: 5_000 })
  })

  test('sidebar scrolls at short viewport height', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 300 })
    await page.waitForTimeout(300)

    const sidebarList = page.locator('.sidebar-list')
    await expect(sidebarList).toBeVisible()

    const templateBtns = page.locator('.template-btn')
    const count = await templateBtns.count()
    expect(count).toBeGreaterThan(0)
  })
})
