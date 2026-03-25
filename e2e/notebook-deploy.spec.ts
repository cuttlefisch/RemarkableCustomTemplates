import { test, expect } from '@playwright/test'
import { clearNotebookDrafts, createNotebook, addPageGroup } from './helpers'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const DEVICE_ID = 'e2e-nb-device'

/** Build an NDJSON response body. */
function ndjsonBody(events: Record<string, unknown>[]): string {
  return events.map(e => JSON.stringify(e)).join('\n') + '\n'
}

/** Mock device list so deploy button is enabled. */
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

test.describe('Notebook Deploy', () => {
  test.beforeEach(async ({ page }) => {
    await clearNotebookDrafts(page)
  })

  test.afterEach(async ({ request }) => {
    // Clean up any notebook drafts
    await request.delete(`${BASE_URL}/api/notebook-drafts`)
  })

  test('shows deploy button with beta badge', async ({ page }) => {
    await setupDeviceMocks(page)
    await page.goto('/notebook')
    await createNotebook(page)
    await addPageGroup(page)

    // Deploy button should be visible with Beta badge
    const deployBtn = page.locator('.notebook-toolbar-btn', { hasText: 'Deploy' })
    await expect(deployBtn).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.beta-badge')).toBeVisible()
  })

  test('deploys notebook when no conflict', async ({ page }) => {
    await setupDeviceMocks(page)

    // check-notebook returns not exists
    await page.route(`**/api/devices/${DEVICE_ID}/check-notebook`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ exists: false }) }),
    )

    // deploy-notebook returns success
    await page.route(`**/api/devices/${DEVICE_ID}/deploy-notebook`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson',
        body: ndjsonBody([
          { type: 'progress', phase: 'Connecting...', current: 1, total: 3 },
          { type: 'progress', phase: 'Pushing files...', current: 2, total: 3 },
          { type: 'done', ok: true, steps: ['Connected', 'Pushed 5 files', 'Restarted UI'], notebookUuid: 'abc-123' },
        ]),
      }),
    )

    await page.goto('/notebook')
    await createNotebook(page)
    await addPageGroup(page)

    // Click deploy
    await page.locator('.notebook-toolbar-btn', { hasText: 'Deploy' }).click()

    // Should show success status
    await expect(page.locator('.device-status, .device-op-result').first()).toBeVisible({ timeout: 10_000 })
  })

  test('shows conflict dialog when notebook exists and is pristine', async ({ page }) => {
    await setupDeviceMocks(page)

    await page.route(`**/api/devices/${DEVICE_ID}/check-notebook`, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ exists: true, uuid: 'existing-uuid', pristine: true, pageCount: 5, visibleName: 'My Notebook' }),
      }),
    )

    await page.goto('/notebook')
    await createNotebook(page)
    await addPageGroup(page)

    await page.locator('.notebook-toolbar-btn', { hasText: 'Deploy' }).click()

    // Conflict dialog should appear
    await expect(page.locator('.notebook-confirm-dialog')).toBeVisible({ timeout: 5_000 })
    // "Update in place" button (not "Overwrite (destroy data)" since pristine)
    await expect(page.locator('.notebook-confirm-btn.danger', { hasText: 'Update in place' })).toBeVisible()
  })

  test('shows destroy warning when notebook exists and is modified', async ({ page }) => {
    await setupDeviceMocks(page)

    await page.route(`**/api/devices/${DEVICE_ID}/check-notebook`, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ exists: true, uuid: 'existing-uuid', pristine: false, pageCount: 5, visibleName: 'My Notebook' }),
      }),
    )

    await page.goto('/notebook')
    await createNotebook(page)
    await addPageGroup(page)

    await page.locator('.notebook-toolbar-btn', { hasText: 'Deploy' }).click()

    // Conflict dialog should appear with warning
    await expect(page.locator('.notebook-confirm-dialog')).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('.notebook-confirm-warning')).toBeVisible()
    await expect(page.locator('.notebook-confirm-btn.danger', { hasText: /overwrite/i })).toBeVisible()
  })

  test('deploy as new notebook with rename', async ({ page }) => {
    await setupDeviceMocks(page)

    await page.route(`**/api/devices/${DEVICE_ID}/check-notebook`, route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ exists: true, uuid: 'existing-uuid', pristine: true, pageCount: 3, visibleName: 'My Notebook' }),
      }),
    )

    let deployPayload: Record<string, unknown> | null = null
    await page.route(`**/api/devices/${DEVICE_ID}/deploy-notebook`, async route => {
      deployPayload = route.request().postDataJSON() as Record<string, unknown>
      await route.fulfill({
        status: 200, contentType: 'application/x-ndjson',
        body: ndjsonBody([{ type: 'done', ok: true, steps: ['Deployed'], notebookUuid: 'new-uuid' }]),
      })
    })

    await page.goto('/notebook')
    await createNotebook(page)
    await addPageGroup(page)

    await page.locator('.notebook-toolbar-btn', { hasText: 'Deploy' }).click()
    await expect(page.locator('.notebook-confirm-dialog')).toBeVisible({ timeout: 5_000 })

    // Click "Deploy as New Notebook"
    await page.locator('.notebook-confirm-btn', { hasText: 'Deploy as New' }).click()

    // Wait for deploy to complete
    await expect(page.locator('.device-status, .device-op-result').first()).toBeVisible({ timeout: 10_000 })

    // Verify deploy was called without reuseUuid (new notebook)
    expect(deployPayload).toBeTruthy()
    expect(deployPayload!.reuseUuid).toBeFalsy()
  })

  test('shows error when deploy fails', async ({ page }) => {
    await setupDeviceMocks(page)

    await page.route(`**/api/devices/${DEVICE_ID}/check-notebook`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ exists: false }) }),
    )

    await page.route(`**/api/devices/${DEVICE_ID}/deploy-notebook`, route =>
      route.fulfill({
        status: 200, contentType: 'application/x-ndjson',
        body: ndjsonBody([
          { type: 'progress', phase: 'Connecting...', current: 1, total: 3 },
          { type: 'error', error: 'SFTP connection lost', hint: 'Check device WiFi', rawError: 'ECONNRESET' },
        ]),
      }),
    )

    await page.goto('/notebook')
    await createNotebook(page)
    await addPageGroup(page)

    await page.locator('.notebook-toolbar-btn', { hasText: 'Deploy' }).click()

    // Error should display
    await expect(page.locator('.device-error, .device-op-result.error').first()).toBeVisible({ timeout: 10_000 })
  })
})
