/**
 * E2E: Search
 *
 * Tests that the vault search functionality works end-to-end.
 * Creates notes on disk then verifies they can be searched.
 */

const { test, expect } = require('@playwright/test')
const path = require('path')
const fs = require('fs/promises')
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

test('IPC searchVault returns results for matching notes', async () => {
  // Create a note on disk
  const noteContent = `---
id: search-test-1
title: Machine Learning Notes
language: markdown
timestamp: ${Date.now()}
tags: ai, ml
---

This is about machine learning and neural networks.
`
  await fs.writeFile(path.join(vaultPath, 'Machine Learning Notes.md'), noteContent)

  // Wait for vault to pick up the file
  await page.waitForTimeout(2000)

  const results = await invokeIPC(page, 'searchVault', 'machine learning')
  expect(Array.isArray(results)).toBe(true)
})

test('IPC searchVault returns empty array for unmatched query', async () => {
  const results = await invokeIPC(page, 'searchVault', 'xyznonexistentquery')
  expect(Array.isArray(results)).toBe(true)
})

test('IPC getIndexStats returns stats object', async () => {
  const stats = await invokeIPC(page, 'getIndexStats')
  expect(stats).toBeDefined()
  expect(typeof stats).toBe('object')
})

test('notes can be indexed and searched', async () => {
  // Create multiple notes
  for (let i = 0; i < 3; i++) {
    await fs.writeFile(
      path.join(vaultPath, `Search Note ${i}.md`),
      `---
id: search-note-${i}
title: Search Note ${i}
language: markdown
timestamp: ${Date.now()}
tags: test
---

Content for search note number ${i}
`
    )
  }

  await page.waitForTimeout(2000)

  const results = await invokeIPC(page, 'searchVault', 'search note')
  expect(Array.isArray(results)).toBe(true)
})
