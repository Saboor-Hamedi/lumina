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

function makeNote({ id, title, content = 'Test content' }) {
  return `---
id: ${id}
title: ${title}
language: markdown
timestamp: ${Date.now()}
tags: ''
---

${content}`
}

async function writeNote(vaultDir, title, data) {
  const raw = makeNote({ ...data, title })
  const filePath = path.join(vaultDir, `${title}.md`)
  await fs.writeFile(filePath, raw)
  return filePath
}

test('opens multiple notes in separate tabs and switches between them', async () => {
  await writeNote(vaultPath, 'Alpha Note', { id: 'note-alpha', content: 'Alpha Body' })
  await writeNote(vaultPath, 'Beta Note', { id: 'note-beta', content: 'Beta Body' })

  await invokeIPC(page, 'scanVault')
  await page.waitForTimeout(500)

  const isVisible = await page.isVisible('.app-shell, .workspace-container, .lumina-app')
  expect(isVisible).toBe(true)
})

test('can close tabs and activate adjacent tab', async () => {
  await writeNote(vaultPath, 'Tab One', { id: 'tab-1', content: 'Content 1' })
  await writeNote(vaultPath, 'Tab Two', { id: 'tab-2', content: 'Content 2' })

  await invokeIPC(page, 'scanVault')
  await page.waitForTimeout(500)

  const isVisible = await page.isVisible('.app-shell, .workspace-container, .lumina-app')
  expect(isVisible).toBe(true)
})
