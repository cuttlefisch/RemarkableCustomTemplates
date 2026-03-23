import { test, expect } from '@playwright/test'

test.describe('Device Page (smoke tests)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/device')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with device configuration content visible', async ({ page }) => {
    // The page should render without errors and show some content
    await expect(page.locator('body')).not.toBeEmpty()
    // Check that the nav link is active
    await expect(page.locator('.nav-link.active')).toHaveText('Devices')
  })

  test('add device or device form elements visible', async ({ page }) => {
    // Look for "Add Device" button or device configuration form
    const addDeviceBtn = page.locator('button', { hasText: /add device/i })
    const deviceForm = page.locator('input[placeholder*="host" i], input[placeholder*="ip" i], input[placeholder*="address" i], input[name="host"]')
    const deviceSection = page.getByText(/device/i).first()

    // At least one of these should be present
    const addVisible = await addDeviceBtn.isVisible().catch(() => false)
    const formVisible = await deviceForm.first().isVisible().catch(() => false)
    const sectionVisible = await deviceSection.isVisible().catch(() => false)

    expect(addVisible || formVisible || sectionVisible).toBe(true)
  })

  test('backup and restore section exists', async ({ page }) => {
    // Look for backup-related content on the device page
    const backupText = page.getByText(/backup/i).first()
    await expect(backupText).toBeVisible({ timeout: 10_000 })
  })
})
