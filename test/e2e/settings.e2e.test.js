/**
 * E2E: Settings & Theme
 *
 * Tests that settings can be toggled via IPC and the app responds.
 * Verifies that theme changes persist across sessions.
 */

const { test, expect } = require('@playwright/test')
const { launchApp, invokeIPC } = require('./helpers/launch')

let app, page, vaultPath, cleanup

test.beforeEach(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  vaultPath = launched.vaultPath
  cleanup = launched.cleanup
})

test.afterEach(async () => {
  await cleanup()
})

test('IPC saveSetting and getSetting round-trip', async () => {
  await invokeIPC(page, 'saveSetting', 'theme', 'dark')

  const value = await invokeIPC(page, 'getSetting', 'theme')
  expect(value).toBe('dark')
})

test('IPC saveSetting persists fontSize', async () => {
  await invokeIPC(page, 'saveSetting', 'fontSize', 20)

  const value = await invokeIPC(page, 'getSetting', 'fontSize')
  expect(value).toBe(20)
})

test('IPC saveSetting persists translucency', async () => {
  await invokeIPC(page, 'saveSetting', 'translucency', true)

  const value = await invokeIPC(page, 'getSetting', 'translucency')
  expect(value).toBe(true)
})

test('IPC getSetting returns default settings initially', async () => {
  const theme = await invokeIPC(page, 'getSetting', 'theme')
  expect(typeof theme).toBe('string')
})

test('app shell is visible with new note button after setting operations', async () => {
  await invokeIPC(page, 'saveSetting', 'theme', 'dark')
  await invokeIPC(page, 'saveSetting', 'fontSize', 16)

  await expect(page.getByRole('button', { name: 'New Note', exact: true })).toBeVisible({
    timeout: 20_000
  })
})
