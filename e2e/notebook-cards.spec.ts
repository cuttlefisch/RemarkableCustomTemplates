import { test, expect } from '@playwright/test'
import { createNotebook, addPageGroup } from './helpers'

test.describe('Notebook Card Display', () => {
  test('empty notebook shows fallback icon', async ({ page }) => {
    await createNotebook(page)

    // Go back to list
    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const cards = page.locator('.notebook-list-card:not(.notebook-list-new)')
    await expect(cards.first()).toBeVisible({ timeout: 5_000 })
    await expect(cards.first().locator('.notebook-list-card-icon')).toBeVisible()
  })

  test('notebook with pages shows paper stack or icon', async ({ page }) => {
    await createNotebook(page)
    await addPageGroup(page, 0)

    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const cards = page.locator('.notebook-list-card:not(.notebook-list-new)')
    await expect(cards.first()).toBeVisible({ timeout: 5_000 })

    // Should show either paper stack (if iconData exists) or at least the preview area
    const preview = cards.first().locator('.notebook-list-card-preview')
    await expect(preview).toBeVisible()

    // Card should show page count > 0
    const chipText = await cards.first().locator('.notebook-list-chip').first().innerText()
    expect(chipText).toMatch(/\d+ pg/)
  })

  test('card preview area has reasonable height', async ({ page }) => {
    await createNotebook(page)
    await addPageGroup(page, 0)

    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const preview = page.locator('.notebook-list-card-preview').first()
    await expect(preview).toBeVisible({ timeout: 5_000 })

    const box = await preview.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(100)
  })

  test('card footer shows page and group counts', async ({ page }) => {
    await createNotebook(page)
    await addPageGroup(page, 0)
    await addPageGroup(page, 1)

    await page.goto('/notebook')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const card = page.locator('.notebook-list-card:not(.notebook-list-new)').first()
    await expect(card).toBeVisible({ timeout: 5_000 })

    const chips = card.locator('.notebook-list-chip')
    expect(await chips.count()).toBeGreaterThanOrEqual(2)

    // Chips show "N pg" and "N grp" format
    const chipTexts: string[] = []
    const count = await chips.count()
    for (let i = 0; i < count; i++) {
      chipTexts.push(await chips.nth(i).innerText())
    }
    const joined = chipTexts.join(' ')
    expect(joined).toMatch(/pg/)
    expect(joined).toMatch(/grp/)
  })
})
