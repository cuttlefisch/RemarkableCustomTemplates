import { test, expect } from '@playwright/test'

/** Build an NDJSON response body from event objects. */
function ndjsonBody(events: Record<string, unknown>[]): string {
  return events.map(e => JSON.stringify(e)).join('\n') + '\n'
}

const DEVICE_ID = 'e2e-test-device'

/** Mock device list and active device so the page renders card content. */
async function setupDeviceMocks(page: import('@playwright/test').Page) {
  await page.route('**/api/devices', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          devices: [{
            id: DEVICE_ID,
            nickname: 'Test RM2',
            deviceIp: '10.11.99.1',
            sshPort: 22,
            authMethod: 'password',
            deviceModel: 'rm',
            firmwareVersion: '3.26.0.68',
          }],
        }),
      })
    }
    return route.continue()
  })

  await page.route('**/api/devices/active', route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ activeDeviceId: DEVICE_ID }),
      })
    }
    return route.continue()
  })
}

/** Full xovi status response for a device with xovi installed and extensions available. */
function makeXoviStatus(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    xoviInstalled: true,
    qtRebuilderInstalled: true,
    vellumInstalled: true,
    vellumReenableNeeded: false,
    firmwareVersion: '3.26.0.68',
    qmdVersion: '3.26',
    extensions: [
      { id: 'unlockMethodsContent', displayName: 'Unlock Methods Content', filename: 'unlockMethodsContent.qmd', tier: 1, category: 'essential', installed: false, available: true },
      { id: 'createPagesRM2Size', displayName: 'Create Pages (RM2 Size)', filename: 'createPagesRM2Size.qmd', tier: 1, category: 'page-size', exclusiveGroup: 'pageSize', installed: false, available: true },
      { id: 'quicksheetUseTemplate', displayName: 'Quicksheet Use Template', filename: 'quicksheetUseTemplate.qmd', tier: 2, category: 'recommended', installed: false, available: true },
    ],
    unknownFiles: [],
    tracking: null,
    ...overrides,
  }
}

test.describe('Device Xovi Card', () => {
  test('shows xovi status after checking', async ({ page }) => {
    await setupDeviceMocks(page)
    await page.route(`**/api/devices/${DEVICE_ID}/xovi-status`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeXoviStatus()) }),
    )

    await page.goto('/device')
    await page.waitForLoadState('networkidle')

    // Click "Check xovi Status" button
    await page.locator('button', { hasText: 'Check xovi Status' }).click()

    // Verify status badges appear
    await expect(page.locator('.xovi-status-badge.installed').first()).toBeVisible({ timeout: 5_000 })

    // Verify extensions are listed
    await expect(page.locator('.xovi-extension-entry').first()).toBeVisible()
  })

  test('shows error when status check fails', async ({ page }) => {
    await setupDeviceMocks(page)
    await page.route(`**/api/devices/${DEVICE_ID}/xovi-status`, route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'SSH connection failed' }) }),
    )

    await page.goto('/device')
    await page.waitForLoadState('networkidle')
    await page.locator('button', { hasText: 'Check xovi Status' }).click()

    // Error should display
    await expect(page.locator('.device-op-result.error').first()).toBeVisible({ timeout: 5_000 })
  })

  test('shows deploy progress and completion', async ({ page }) => {
    await setupDeviceMocks(page)

    // Status check returns extensions available
    await page.route(`**/api/devices/${DEVICE_ID}/xovi-status`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeXoviStatus()) }),
    )

    // Deploy returns NDJSON stream
    await page.route(`**/api/devices/${DEVICE_ID}/xovi-deploy`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: ndjsonBody([
          { type: 'progress', phase: 'Connecting to device...', current: 1, total: 4 },
          { type: 'progress', phase: 'Pushing extension files...', current: 2, total: 4 },
          { type: 'progress', phase: 'Rebuilding hashtable...', current: 3, total: 4 },
          { type: 'done', ok: true, steps: ['Connected', 'Pushed 1 file', 'Rebuilt hashtable', 'Restarted UI'] },
        ]),
      }),
    )

    await page.goto('/device')
    await page.waitForLoadState('networkidle')

    // Check status first
    await page.locator('button', { hasText: 'Check xovi Status' }).click()
    await expect(page.locator('.xovi-extension-entry').first()).toBeVisible({ timeout: 5_000 })

    // Select an extension
    await page.locator('.xovi-extension-entry input[type="checkbox"]').first().check()

    // Click deploy
    await page.locator('button', { hasText: 'Deploy Selected' }).click()

    // Verify completion (success result or steps displayed)
    await expect(page.locator('.device-op-result').first()).toBeVisible({ timeout: 5_000 })
  })

  test('shows error during deploy', async ({ page }) => {
    await setupDeviceMocks(page)
    await page.route(`**/api/devices/${DEVICE_ID}/xovi-status`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(makeXoviStatus()) }),
    )
    await page.route(`**/api/devices/${DEVICE_ID}/xovi-deploy`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: ndjsonBody([
          { type: 'progress', phase: 'Connecting...', current: 1, total: 3 },
          { type: 'error', error: 'rebuild_hashtable failed', hint: 'Try restarting xochitl manually via SSH' },
        ]),
      }),
    )

    await page.goto('/device')
    await page.waitForLoadState('networkidle')
    await page.locator('button', { hasText: 'Check xovi Status' }).click()
    await expect(page.locator('.xovi-extension-entry').first()).toBeVisible({ timeout: 5_000 })
    await page.locator('.xovi-extension-entry input[type="checkbox"]').first().check()
    await page.locator('button', { hasText: 'Deploy Selected' }).click()

    await expect(page.locator('.device-op-result.error').first()).toBeVisible({ timeout: 5_000 })
  })

  test('shows remove progress', async ({ page }) => {
    await setupDeviceMocks(page)

    // Status with installed extensions
    await page.route(`**/api/devices/${DEVICE_ID}/xovi-status`, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(makeXoviStatus({
          extensions: [
            { id: 'unlockMethodsContent', displayName: 'Unlock Methods Content', filename: 'unlockMethodsContent.qmd', tier: 1, category: 'essential', installed: true, available: true },
          ],
          tracking: { pristineFiles: [], deployedExtensionIds: ['unlockMethodsContent'] },
        })),
      }),
    )

    await page.route(`**/api/devices/${DEVICE_ID}/xovi-remove`, route =>
      route.fulfill({
        status: 200, contentType: 'application/x-ndjson',
        body: ndjsonBody([
          { type: 'progress', phase: 'Removing extensions...', current: 1, total: 2 },
          { type: 'done', ok: true, steps: ['Removed 1 file', 'Restarted UI'] },
        ]),
      }),
    )

    await page.goto('/device')
    await page.waitForLoadState('networkidle')
    await page.locator('button', { hasText: 'Check xovi Status' }).click()
    await expect(page.locator('.xovi-deploy-badge.deployed').first()).toBeVisible({ timeout: 5_000 })

    // Click per-extension remove button
    await page.locator('.xovi-remove-single-btn').first().click()
    // Accept confirmation dialog
    page.on('dialog', d => d.accept())
    await page.locator('.xovi-remove-single-btn').first().click()

    await expect(page.locator('.device-op-result').first()).toBeVisible({ timeout: 5_000 })
  })

  test('shows install xovi flow when xovi missing', async ({ page }) => {
    await setupDeviceMocks(page)
    await page.route(`**/api/devices/${DEVICE_ID}/xovi-status`, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(makeXoviStatus({ xoviInstalled: false, qtRebuilderInstalled: false })),
      }),
    )
    await page.route(`**/api/devices/${DEVICE_ID}/vellum-install-xovi`, route =>
      route.fulfill({
        status: 200, contentType: 'application/x-ndjson',
        body: ndjsonBody([
          { type: 'progress', phase: 'Installing packages...', current: 1, total: 1 },
          { type: 'done', ok: true, message: 'xovi installed successfully' },
        ]),
      }),
    )

    await page.goto('/device')
    await page.waitForLoadState('networkidle')
    await page.locator('button', { hasText: 'Check xovi Status' }).click()
    await expect(page.locator('.xovi-status-badge.missing').first()).toBeVisible({ timeout: 5_000 })

    // Install button should be available
    const installBtn = page.locator('button', { hasText: 'Install xovi' })
    await expect(installBtn).toBeVisible()
    await installBtn.click()

    await expect(page.locator('.device-op-result').first()).toBeVisible({ timeout: 5_000 })
  })
})
