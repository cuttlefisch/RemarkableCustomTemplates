import { test, expect } from '@playwright/test'

test.describe('Viewport sizes', () => {
  test('1920x1080 full desktop: sidebar and preview both visible', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.template-btn').first()).toBeVisible({ timeout: 10_000 })

    // Select a template to show the preview pane
    await page.locator('.template-btn').first().click()
    await expect(page.locator('.preview-meta')).toBeVisible({ timeout: 5_000 })
  })

  test('1280x720 laptop: sidebar visible with template items', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/')
    await expect(page.locator('.sidebar')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.template-btn').first()).toBeVisible({ timeout: 10_000 })

    const count = await page.locator('.template-btn').count()
    expect(count).toBeGreaterThan(0)
  })

  test('1400x300 ultra-wide short: sidebar list visible and scrollable', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 300 })
    await page.goto('/')
    await expect(page.locator('.sidebar').first()).toBeVisible({ timeout: 10_000 })

    const sidebarList = page.locator('.sidebar-list')
    await expect(sidebarList).toBeVisible({ timeout: 10_000 })

    // Sidebar list should contain template items
    await expect(page.locator('.template-btn').first()).toBeVisible({ timeout: 10_000 })
    const itemCount = await page.locator('.template-btn').count()
    expect(itemCount).toBeGreaterThan(0)

    // Sidebar list should have minimum height for usability
    const box = await sidebarList.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(120)
  })

  test('800x600 small desktop: no elements overflow the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 })
    await page.goto('/')
    await expect(page.locator('.template-btn').first()).toBeVisible({ timeout: 10_000 })

    // Check that the nav bar and sidebar fit within the viewport
    const overflowing = await page.evaluate(() => {
      const elements = document.querySelectorAll('.nav-bar, .sidebar, .preview-panel')
      for (const el of elements) {
        const rect = el.getBoundingClientRect()
        if (rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
          return el.className
        }
      }
      return null
    })
    expect(overflowing).toBeNull()
  })
})
