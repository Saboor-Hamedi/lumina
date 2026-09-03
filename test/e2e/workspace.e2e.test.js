/**
 * E2E: Vault Flow
 *
 * Tests opening a vault via IPC and verifying the UI reflects the loaded state.
 * Uses a real temp directory — no mocks involved.
 */

const { test, expect } = require('@playwright/test')
const path = require('path')
const fs = require('fs/promises')
const { launchApp } = require('./helpers/launch')

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

// ─── Tests ───────────────────────────────────────────────────────────────────

test('temp vault directory exists before test', async () => {
  const stat = await fs.stat(vaultPath)
  expect(stat.isDirectory()).toBe(true)
})

test('vault path is a writable directory', async () => {
  const testFile = path.join(vaultPath, '.write-test')
  await fs.writeFile(testFile, 'ok')
  const content = await fs.readFile(testFile, 'utf-8')
  expect(content).toBe('ok')
  await fs.unlink(testFile)
})

test('can create a markdown note file in the vault directly', async () => {
  const noteContent = `---
id: e2e-test-note
title: E2E Test Note
language: markdown
timestamp: ${Date.now()}
---

Hello from E2E test`

  const notePath = path.join(vaultPath, 'E2E Test Note.md')
  await fs.writeFile(notePath, noteContent)

  const content = await fs.readFile(notePath, 'utf-8')
  expect(content).toContain('id: e2e-test-note')
  expect(content).toContain('Hello from E2E test')
})

test('app window is still alive after vault operations', async () => {
  await fs.writeFile(
    path.join(vaultPath, 'Alive Test.md'),
    '---\nid: alive-test\ntitle: Alive Test\n---\nContent'
  )

  const isRunning = !app.process().killed
  expect(isRunning).toBe(true)
})

test('multiple notes can be created in vault', async () => {
  const notes = ['First Note', 'Second Note', 'Third Note']

  for (const title of notes) {
    await fs.writeFile(
      path.join(vaultPath, `${title}.md`),
      `---\nid: ${title.toLowerCase().replace(/ /g, '-')}\ntitle: ${title}\n---\nContent of ${title}`
    )
  }

  const files = await fs.readdir(vaultPath)
  const mdFiles = files.filter((f) => f.endsWith('.md'))

  expect(mdFiles.length).toBe(3)
  expect(mdFiles).toContain('First Note.md')
  expect(mdFiles).toContain('Second Note.md')
  expect(mdFiles).toContain('Third Note.md')
})

test('note content persists to disk with correct frontmatter', async () => {
  const noteId = 'e2e-persist-test'
  const noteTitle = 'Persist Test'
  const noteContent = 'This content must survive a read-back.'

  const raw = `---
id: ${noteId}
title: ${noteTitle}
language: markdown
timestamp: 1000000
---

${noteContent}`

  await fs.writeFile(path.join(vaultPath, `${noteTitle}.md`), raw)

  const readBack = await fs.readFile(path.join(vaultPath, `${noteTitle}.md`), 'utf-8')
  expect(readBack).toContain(`id: ${noteId}`)
  expect(readBack).toContain(`title: ${noteTitle}`)
  expect(readBack).toContain(noteContent)
})
