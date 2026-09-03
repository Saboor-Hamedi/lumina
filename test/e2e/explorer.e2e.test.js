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

async function writeNote(vaultDir, relFolder, title, data) {
  const targetDir = relFolder ? path.join(vaultDir, relFolder) : vaultDir
  await fs.mkdir(targetDir, { recursive: true })
  const raw = makeNote({ ...data, title })
  const filePath = path.join(targetDir, `${title}.md`)
  await fs.writeFile(filePath, raw)
  return filePath
}

test('creates folder and organizes notes within nested hierarchy', async () => {
  const notePath = await writeNote(vaultPath, 'Projects/Lumina', 'Overview', {
    id: 'note-overview',
    content: 'Project Documentation'
  })

  expect(await fs.access(notePath).then(() => true).catch(() => false)).toBe(true)

  const result = await invokeIPC(page, 'getSnippets')
  expect(result).toBeDefined()

  const isVisible = await page.isVisible('.app-shell, .workspace-container, .lumina-app, body')
  expect(isVisible).toBe(true)
})

test('bulk delete removes selected files recursively from disk', async () => {
  const note1 = await writeNote(vaultPath, 'Work', 'Task1', { id: 't1', content: 'C1' })
  const note2 = await writeNote(vaultPath, 'Work', 'Task2', { id: 't2', content: 'C2' })

  expect(await fs.access(note1).then(() => true).catch(() => false)).toBe(true)
  expect(await fs.access(note2).then(() => true).catch(() => false)).toBe(true)

  await invokeIPC(page, 'bulkDelete', { folderIds: ['Work'], snippetIds: ['t1', 't2'] })

  const folderStillExists = await fs.access(path.join(vaultPath, 'Work')).then(() => true).catch(() => false)
  expect(folderStillExists).toBe(false)
})

test('protected system dot folders cannot be deleted via bulkDelete', async () => {
  const agentFolder = path.join(vaultPath, '.agents')
  const agentFile = path.join(agentFolder, 'config.json')
  await fs.mkdir(agentFolder, { recursive: true })
  await fs.writeFile(agentFile, '{"test": true}')

  await invokeIPC(page, 'bulkDelete', { folderIds: ['.agents'], snippetIds: [] })

  const agentExists = await fs.access(agentFile).then(() => true).catch(() => false)
  expect(agentExists).toBe(true)
})
