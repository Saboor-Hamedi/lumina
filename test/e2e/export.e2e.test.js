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

test('exportHTML returns a full HTML document via IPC', async () => {
  const html = await invokeIPC(page, 'exportHTML', {
    title: 'E2E Note',
    content: '# Hello E2E'
  })

  expect(html).toContain('<!DOCTYPE html>')
  expect(html).toContain('<title>E2E Note</title>')
  expect(html).toContain('<h1>Hello E2E</h1>')
})

test('exportHTML converts markdown content', async () => {
  const html = await invokeIPC(page, 'exportHTML', {
    title: 'Note',
    content: '**bold** and `code`'
  })

  expect(html).toContain('<strong>bold</strong>')
  expect(html).toContain('<code>code</code>')
})

test('exportHTML converts wikilinks', async () => {
  const html = await invokeIPC(page, 'exportHTML', {
    title: 'Note',
    content: 'See [[Target Note]]'
  })

  expect(html).toContain('<a href="#">Target Note</a>')
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
  await invokeIPC(page, 'exportHTML', { title: 'Note', content: 'body' })
  await expect(page.getByRole('button', { name: 'New', exact: true })).toBeVisible({
    timeout: 20_000
  })
})
