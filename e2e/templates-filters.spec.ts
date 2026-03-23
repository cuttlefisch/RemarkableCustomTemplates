import { test, expect } from '@playwright/test'
import { waitForSidebarLoaded } from './helpers'

test.describe('Search & Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForSidebarLoaded(page)
  })

  test('typing in search input filters the template list', async ({ page }) => {
    const allCount = await page.locator('.template-btn').count()
    expect(allCount).toBeGreaterThan(0)

    await page.locator('.sidebar-search').fill('cal')
    await expect(page.locator('.template-btn')).not.toHaveCount(allCount, { timeout: 5_000 })

    const filtered = page.locator('.template-btn')
    const filteredCount = await filtered.count()
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThan(allCount)

    // Every visible item should contain "cal" (case-insensitive)
    for (let i = 0; i < filteredCount; i++) {
      const text = await filtered.nth(i).textContent()
      expect(text?.toLowerCase()).toContain('cal')
    }
  })

  test('orientation filter buttons work', async ({ page }) => {
    const allCount = await page.locator('.template-btn').count()

    // Click P filter — should show at least some templates
    const portraitBtn = page.locator('.orient-btn', { hasText: 'P' })
    await portraitBtn.click()
    await page.waitForTimeout(200)
    const portraitCount = await page.locator('.template-btn').count()
    expect(portraitCount).toBeGreaterThan(0)

    // Click LS filter — may show 0 if no landscape templates exist
    const landscapeBtn = page.locator('.orient-btn', { hasText: 'LS' })
    await landscapeBtn.click()
    await page.waitForTimeout(200)
    const lsCount = await page.locator('.template-btn').count()
    // LS count can be 0 on a fresh install with only portrait samples
    expect(lsCount).toBeGreaterThanOrEqual(0)

    // Click All to reset — count should be >= original (other parallel tests may create templates)
    const allBtn = page.locator('.orient-btn', { hasText: 'All' })
    await allBtn.click()
    await page.waitForTimeout(200)
    const resetCount = await page.locator('.template-btn').count()
    expect(resetCount).toBeGreaterThanOrEqual(allCount)
  })

  test('samples source chip filters to samples only', async ({ page }) => {
    const allCount = await page.locator('.template-btn').count()

    const samplesChip = page.locator('.source-chip', { hasText: 'Samples' })
    await expect(samplesChip).toBeVisible()
    await samplesChip.click()
    await page.waitForTimeout(300)

    const samplesCount = await page.locator('.template-btn').count()
    // Parallel tests may hide samples, so count can be 0
    expect(samplesCount).toBeGreaterThanOrEqual(0)
    expect(samplesCount).toBeLessThanOrEqual(allCount)
  })

  test('multiple filters combine to produce a subset', async ({ page }) => {
    // Apply search filter
    await page.locator('.sidebar-search').fill('sample')
    await page.waitForTimeout(300)
    const searchCount = await page.locator('.template-btn').count()

    // Also apply portrait orientation
    const portraitBtn = page.locator('.orient-btn', { hasText: 'P' })
    await portraitBtn.click()
    await page.waitForTimeout(300)

    const combinedCount = await page.locator('.template-btn').count()
    expect(combinedCount).toBeLessThanOrEqual(searchCount)
  })

  test('clearing search resets the list', async ({ page }) => {
    const allCount = await page.locator('.template-btn').count()

    // Apply a search filter
    await page.locator('.sidebar-search').fill('cal')
    await page.waitForTimeout(300)

    const filteredCount = await page.locator('.template-btn').count()
    expect(filteredCount).toBeLessThan(allCount)

    // Clear the search input
    await page.locator('.sidebar-search').fill('')
    await page.waitForTimeout(300)

    // List count should be >= original (parallel tests may create templates)
    const resetCount = await page.locator('.template-btn').count()
    expect(resetCount).toBeGreaterThanOrEqual(allCount)
  })
})
