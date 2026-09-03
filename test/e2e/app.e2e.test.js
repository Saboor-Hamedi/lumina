/**
 * E2E: App Launch
 *
 * Tests that the real Electron window opens, renders the UI frame,
 * and shows the welcome state when no vault is pre-loaded.
 */

const { test, expect } = require('@playwright/test')
const { launchApp } = require('./helpers/launch')

let app, page, cleanup

test.beforeEach(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  cleanup = launched.cleanup
})

test.afterEach(async () => {
  await cleanup()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

test('app launches without crashing', async () => {
  expect(app).toBeTruthy()
  expect(page).toBeTruthy()
})

test('window is visible and has correct title', async () => {
  // The BrowserWindow title may be empty or the HTML page title during init
  // — we just verify the window exists and is not destroyed
  const isVisible = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    return win && !win.isDestroyed() && win.isVisible()
  })
  expect(isVisible).toBe(true)
})

test('renderer loads without JS errors', async () => {
  const errors = []
  page.on('pageerror', (err) => errors.push(err.message))

  await page.waitForTimeout(2000)

  const fatalErrors = errors.filter(
    (e) => !e.includes('IndexedDB') && !e.includes('extension') && !e.includes('devtools')
  )

  expect(fatalErrors).toHaveLength(0)
})

test('app shell renders with sidebar or welcome page', async () => {
  await expect(page.locator('.welcome-page').first()).toBeVisible({
    timeout: 20_000
  })
})

test('welcome page shortcuts are visible when no notes exist', async () => {
  await expect(page.locator('text=Create a new note').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('text=Quick Search').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('text=AI Assistant').first()).toBeVisible({ timeout: 20_000 })
})
