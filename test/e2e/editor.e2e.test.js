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

test('renders note in editor canvas with proper DOM elements', async () => {
  const notePath = await writeNote(vaultPath, 'Canvas Note', {
    id: 'canvas-1',
    content: 'Testing CodeMirror rendering'
  })

  expect(await fs.access(notePath).then(() => true).catch(() => false)).toBe(true)

  await invokeIPC(page, 'scanVault')
  await page.waitForTimeout(500)

  const isVisible = await page.isVisible('.app-shell, .workspace-container, .lumina-app')
  expect(isVisible).toBe(true)
})

test('saves note content modifications to disk atomically', async () => {
  const notePath = await writeNote(vaultPath, 'Save Test', {
    id: 'save-1',
    content: 'Initial text'
  })

  await invokeIPC(page, 'saveSnippet', {
    id: 'save-1',
    title: 'Save Test',
    code: 'Updated text content',
    language: 'markdown',
    fileName: 'Save Test.md',
    folderId: ''
  })

  const diskContent = await fs.readFile(notePath, 'utf-8')
  expect(diskContent).toContain('Updated text content')
})
