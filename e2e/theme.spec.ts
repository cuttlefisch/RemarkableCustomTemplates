import { test, expect } from '@playwright/test'

function getPageBg(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-page-bg').trim()
  )
}

test.describe('Theme & Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('theme selector dropdown is visible', async ({ page }) => {
    const selector = page.locator('.theme-switcher select')
    await expect(selector).toBeVisible({ timeout: 5_000 })
  })

  test('change theme to Dracula updates CSS custom property', async ({ page }) => {
    const selector = page.locator('.theme-switcher select')
    await expect(selector).toBeVisible({ timeout: 5_000 })

    const initialBg = await getPageBg(page)
    expect(initialBg).not.toBe('')

    await selector.selectOption({ label: 'Dracula' })
    await page.waitForTimeout(300)

    const newBg = await getPageBg(page)
    expect(newBg).not.toBe(initialBg)
  })

  test('theme persists after page reload', async ({ page }) => {
    const selector = page.locator('.theme-switcher select')
    await expect(selector).toBeVisible({ timeout: 5_000 })

    await selector.selectOption({ label: 'Dracula' })
    await page.waitForTimeout(300)
    const draculaBg = await getPageBg(page)

    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(300)

    const afterReloadBg = await getPageBg(page)
    expect(afterReloadBg).toBe(draculaBg)
  })

  test('change back to a light theme updates colors', async ({ page }) => {
    const selector = page.locator('.theme-switcher select')
    await expect(selector).toBeVisible({ timeout: 5_000 })

    await selector.selectOption({ label: 'Dracula' })
    await page.waitForTimeout(300)
    const darkBg = await getPageBg(page)

    await selector.selectOption({ label: 'GitHub Light' })
    await page.waitForTimeout(300)
    const lightBg = await getPageBg(page)

    expect(lightBg).not.toBe(darkBg)
  })
})
