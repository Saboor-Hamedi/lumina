/**
 * E2E Tests: Note Title Rename — Disk Persistence
 *
 * These tests launch the real Lumina Electron app and verify that:
 * 1. Renaming a note's title correctly renames the file on disk
 * 2. The Drive push button is hidden when the user is not logged in
 * 3. Saving with a new title writes correct frontmatter (title field updated)
 *
 * NOTE: Drive push tests require real Google auth and are skipped here.
 * The Drive filename resolution logic is covered in unit tests (noteTitleRename.test.js).
 */

const { test, expect } = require('@playwright/test')
const { launchApp, invokeIPC } = require('./helpers/launch')
const path = require('path')
const fs = require('fs/promises')

let app, page, vaultPath, cleanup

// ─── Setup / Teardown ────────────────────────────────────────────────────────

test.beforeEach(async () => {
  const launched = await launchApp()
  app = launched.app
  page = launched.page
  vaultPath = launched.vaultPath
  cleanup = launched.cleanup
})

test.afterEach(async () => {
  if (typeof cleanup === 'function') await cleanup()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fileExists(filePath) {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false)
}

/**
 * Write a markdown note directly to vaultPath and reload app state via IPC.
 */
async function writeNoteToVault(vaultPath, title, { id, content = '' } = {}) {
  const noteId = id || `test-${Date.now()}`
  const fileName = `${title}.md`
  const filePath = path.join(vaultPath, fileName)
  const fileContent = [
    '---',
    `id: ${noteId}`,
    `title: ${title}`,
    'language: markdown',
    `timestamp: ${Date.now()}`,
    "tags: ''",
    '---',
    '',
    content
  ].join('\n')

  await fs.writeFile(filePath, fileContent)
  return { filePath, fileName, id: noteId }
}

// ─── Drive push button visibility ───────────────────────────────────────────

test('DrivePushButton is hidden when user is not logged into Google', async () => {
  // Write a note so the editor has something to show
  await writeNoteToVault(vaultPath, 'Test Note', { id: 'drive-vis-1', content: 'hello' })

  // Wait for app to pick up vault changes
  await page.waitForTimeout(1500)

  // The push button should NOT be visible when not logged in
  const pushBtn = page.locator('[data-testid="drive-push-button"]')
  const count = await pushBtn.count()
  // Either absent from DOM or not visible
  if (count > 0) {
    await expect(pushBtn).not.toBeVisible()
  } else {
    expect(count).toBe(0)
  }
})

// ─── Note rename: disk file follows title ────────────────────────────────────

test('renaming a note title via saveSnippet renames the file on disk', async () => {
  // Write initial note directly to vault
  await writeNoteToVault(vaultPath, 'New Note', { id: 'rename-e2e-1', content: 'some content' })

  // Wait for app to scan vault
  await page.waitForTimeout(2000)

  // Invoke saveSnippet via IPC with updated title
  await invokeIPC(page, 'saveSnippet', {
    id: 'rename-e2e-1',
    title: 'My Renamed Note',
    fileName: 'New Note.md',
    code: 'some content',
    language: 'markdown',
    tags: '',
    timestamp: Date.now()
  })

  // Allow fs operations to complete
  await page.waitForTimeout(1000)

  const oldPath = path.join(vaultPath, 'New Note.md')
  const newPath = path.join(vaultPath, 'My Renamed Note.md')

  expect(await fileExists(newPath)).toBe(true)
  expect(await fileExists(oldPath)).toBe(false)
})

test('renaming "New Note" → "lumina" saves file as "lumina.md"', async () => {
  await writeNoteToVault(vaultPath, 'New Note', { id: 'lumina-e2e-1', content: '' })
  await page.waitForTimeout(2000)

  await invokeIPC(page, 'saveSnippet', {
    id: 'lumina-e2e-1',
    title: 'lumina',
    fileName: 'New Note.md',
    code: '',
    language: 'markdown',
    tags: '',
    timestamp: Date.now()
  })

  await page.waitForTimeout(1000)

  expect(await fileExists(path.join(vaultPath, 'lumina.md'))).toBe(true)
  expect(await fileExists(path.join(vaultPath, 'New Note.md'))).toBe(false)
})

test('saved file contains updated title in frontmatter', async () => {
  await writeNoteToVault(vaultPath, 'Old Name', { id: 'fm-e2e-1', content: 'body text' })
  await page.waitForTimeout(2000)

  await invokeIPC(page, 'saveSnippet', {
    id: 'fm-e2e-1',
    title: 'New Name',
    fileName: 'Old Name.md',
    code: 'body text',
    language: 'markdown',
    tags: '',
    timestamp: Date.now()
  })

  await page.waitForTimeout(1000)

  const newPath = path.join(vaultPath, 'New Name.md')
  expect(await fileExists(newPath)).toBe(true)

  const content = await fs.readFile(newPath, 'utf-8')
  expect(content).toContain('title: New Name')
  expect(content).toContain('id: fm-e2e-1')
  expect(content).toContain('body text')
})

test('body content is preserved after title rename', async () => {
  const originalContent = '## Section\n\nThis is important body text.'
  await writeNoteToVault(vaultPath, 'Pre Rename', { id: 'body-e2e-1', content: originalContent })
  await page.waitForTimeout(2000)

  await invokeIPC(page, 'saveSnippet', {
    id: 'body-e2e-1',
    title: 'Post Rename',
    fileName: 'Pre Rename.md',
    code: originalContent,
    language: 'markdown',
    tags: '',
    timestamp: Date.now()
  })

  await page.waitForTimeout(1000)

  const renamedPath = path.join(vaultPath, 'Post Rename.md')
  expect(await fileExists(renamedPath)).toBe(true)

  const content = await fs.readFile(renamedPath, 'utf-8')
  expect(content).toContain(originalContent)
})

test('saving an unmodified title does NOT rename the file', async () => {
  await writeNoteToVault(vaultPath, 'Stable File', { id: 'stable-e2e-1', content: 'v1' })
  await page.waitForTimeout(2000)

  // Save with same title — should NOT rename
  await invokeIPC(page, 'saveSnippet', {
    id: 'stable-e2e-1',
    title: 'Stable File',
    fileName: 'Stable File.md',
    code: 'v2',
    language: 'markdown',
    tags: '',
    timestamp: Date.now()
  })

  await page.waitForTimeout(1000)

  expect(await fileExists(path.join(vaultPath, 'Stable File.md'))).toBe(true)
})

test('note ID is preserved across rename', async () => {
  const noteId = 'stable-id-e2e-99'
  await writeNoteToVault(vaultPath, 'ID Note', { id: noteId, content: '' })
  await page.waitForTimeout(2000)

  await invokeIPC(page, 'saveSnippet', {
    id: noteId,
    title: 'ID Note Renamed',
    fileName: 'ID Note.md',
    code: '',
    language: 'markdown',
    tags: '',
    timestamp: Date.now()
  })

  await page.waitForTimeout(1000)

  const renamedPath = path.join(vaultPath, 'ID Note Renamed.md')
  expect(await fileExists(renamedPath)).toBe(true)

  const content = await fs.readFile(renamedPath, 'utf-8')
  expect(content).toContain(`id: ${noteId}`)
})
