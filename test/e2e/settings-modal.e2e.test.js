/**
 * E2E: Settings Modal
 *
 * Launches the real Electron app and verifies the Settings modal:
 * - opens via Ctrl+, (onToggleSettings shortcut)
 * - shows the three friendly tabs (Look & Feel / AI Assistant / Advanced)
 * - switches tabs and renders each section
 * - closing via Escape removes the modal
 * - settings round-trip through the real IPC layer
 */

const { test, expect } = require('@playwright/test')
const { launchApp, invokeIPC } = require('./helpers/launch')

let page, cleanup

test.beforeEach(async () => {
  const launched = await launchApp()
  page = launched.page
  cleanup = launched.cleanup
})

test.afterEach(async () => {
  await cleanup()
})

// All modal queries are scoped to the settings modal container to avoid
// clashing with the Welcome page cards and other UI that share labels.
const modal = () => page.locator('.settings-container')

async function openSettings() {
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }))
  })
  await expect(modal()).toBeVisible({ timeout: 20_000 })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('opens the Settings modal with Ctrl+,', async () => {
  await openSettings()
  await expect(modal().getByRole('banner').getByText('Settings')).toBeVisible()
})

test('shows the three friendly tabs', async () => {
  await openSettings()
  await expect(modal().getByRole('button', { name: 'Look & Feel' })).toBeVisible()
  await expect(modal().getByRole('button', { name: 'AI Assistant' })).toBeVisible()
  await expect(modal().getByRole('button', { name: 'Advanced' })).toBeVisible()
})

test('Look & Feel tab renders the appearance section', async () => {
  await openSettings()
  await modal().getByRole('button', { name: 'Look & Feel' }).click()
  await expect(modal().getByRole('heading', { name: 'Appearance' })).toBeVisible()
  await expect(modal().getByRole('button', { name: 'Theme Gallery' })).toBeVisible()
})

test('switches to the AI Assistant tab', async () => {
  await openSettings()
  await modal().getByRole('button', { name: 'AI Assistant' }).click()
  await expect(modal().getByText('Active Intelligence Provider')).toBeVisible()
  await expect(modal().getByText('Primary AI Brain')).toBeVisible()
})

test('AI Assistant shows the friendly provider labels', async () => {
  await openSettings()
  await modal().getByRole('button', { name: 'AI Assistant' }).click()
  const select = modal().locator('select')
  await expect(select.locator('option', { hasText: 'DeepSeek (Default)' })).toHaveCount(1)
  await expect(select.locator('option', { hasText: 'OpenAI (GPT-4o)' })).toHaveCount(1)
  await expect(select.locator('option', { hasText: 'Ollama (Local / Offline)' })).toHaveCount(1)
})

test('Advanced tab renders updates and workspace sections', async () => {
  await openSettings()
  await modal().getByRole('button', { name: 'Advanced' }).click()
  await expect(modal().getByText('App Updates')).toBeVisible()
  await expect(modal().getByText('Workspace Configuration')).toBeVisible()
})

test('Advanced tab shows the workspace location', async () => {
  await openSettings()
  await modal().getByRole('button', { name: 'Advanced' }).click()
  await expect(modal().getByText('Workspace Location')).toBeVisible()
  await expect(modal().getByRole('button', { name: 'Open in Explorer' })).toBeVisible()
  await expect(modal().getByRole('button', { name: 'Change Location' })).toBeVisible()
})

test('closes the modal with Escape', async () => {
  await openSettings()
  await page.keyboard.press('Escape')
  await expect(modal()).not.toBeVisible()
})

test('settings round-trip through the real IPC layer', async () => {
  await invokeIPC(page, 'saveSetting', 'fontSize', 22)
  await invokeIPC(page, 'saveSetting', 'theme', 'dark')

  const fontSize = await invokeIPC(page, 'getSetting', 'fontSize')
  expect(fontSize).toBe(22)
  const theme = await invokeIPC(page, 'getSetting', 'theme')
  expect(theme).toBe('dark')
})
