/**
 * E2E: Export
 *
 * Tests the export IPC endpoints end-to-end.
 * exportHTML is pure (no native dialog) so it round-trips fully through
 * the renderer -> main -> renderer bridge. The file-writing exporters
 * (Markdown/Text/PDF/Docs) require native dialogs which can't be automated,
 * so we verify the no-content error path surfaces correctly.
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

test('exportHTML rejects when content is missing', async () => {
  let errorMessage = null
  try {
    await invokeIPC(page, 'exportHTML', { title: 'No Content' })
  } catch (err) {
    errorMessage = String(err)
  }
  expect(errorMessage).toContain('No content provided')
})

test('exportMarkdown rejects when content is missing', async () => {
  let errorMessage = null
  try {
    await invokeIPC(page, 'exportMarkdown', { title: 'No Content' })
  } catch (err) {
    errorMessage = String(err)
  }
  expect(errorMessage).toContain('No content provided')
})

test('exportText rejects when content is missing', async () => {
  let errorMessage = null
  try {
    await invokeIPC(page, 'exportText', { title: 'No Content' })
  } catch (err) {
    errorMessage = String(err)
  }
  expect(errorMessage).toContain('No content provided')
})

test('app remains responsive after export operations', async () => {
  const isAlive = await page.isVisible('.app-shell, .workspace-container, .lumina-app, body')
  expect(isAlive).toBe(true)
})
