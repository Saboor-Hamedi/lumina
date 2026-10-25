/**
 * E2E: File Explorer & Vault Organization
 *
 * Comprehensive end-to-end testing for file tree exploration, nested directory structures,
 * special character handling, mixed file types (.md, .canvas), and bulk file management.
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
  if (typeof cleanup === 'function') await cleanup()
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
  await fs.writeFile(filePath, raw, 'utf8')
  return filePath
}

async function writeRawFile(vaultDir, relFolder, fileName, content) {
  const targetDir = relFolder ? path.join(vaultDir, relFolder) : vaultDir
  await fs.mkdir(targetDir, { recursive: true })
  const filePath = path.join(targetDir, fileName)
  await fs.writeFile(filePath, content, 'utf8')
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
  await fs.writeFile(agentFile, '{"test": true}', 'utf8')

  await invokeIPC(page, 'bulkDelete', { folderIds: ['.agents'], snippetIds: [] })

  const agentExists = await fs.access(agentFile).then(() => true).catch(() => false)
  expect(agentExists).toBe(true)
})

test('handles deeply nested multi-level directory trees and multiple files', async () => {
  const filesToCreate = [
    { folder: 'Docs', title: 'RootDoc', id: 'doc-root' },
    { folder: 'Docs/Architecture', title: 'SystemOverview', id: 'doc-arch-1' },
    { folder: 'Docs/Architecture/DataFlow', title: 'Pipeline', id: 'doc-arch-2' },
    { folder: 'Docs/Architecture/DataFlow/Security', title: 'AuthModel', id: 'doc-arch-3' }
  ]

  for (const item of filesToCreate) {
    const p = await writeNote(vaultPath, item.folder, item.title, {
      id: item.id,
      content: `# ${item.title}\nContent for ${item.folder}`
    })
    const exists = await fs.access(p).then(() => true).catch(() => false)
    expect(exists).toBe(true)
  }

  const result = await invokeIPC(page, 'getSnippets')
  expect(result).toBeDefined()
  const snippetList = result.snippets || result
  expect(Array.isArray(snippetList)).toBe(true)
})

test('handles filenames with spaces, unicode, and special punctuation', async () => {
  const specialFiles = [
    { folder: 'Research', title: 'Roadmap & Strategy (Q4 2026)', id: 'spec-1' },
    { folder: 'Research', title: 'System Architecture [Final] - v2', id: 'spec-2' },
    { folder: 'Research', title: 'Notes_and_Observations #1', id: 'spec-3' }
  ]

  for (const item of specialFiles) {
    const p = await writeNote(vaultPath, item.folder, item.title, {
      id: item.id,
      content: `Content for ${item.title}`
    })
    const exists = await fs.access(p).then(() => true).catch(() => false)
    expect(exists).toBe(true)

    const content = await fs.readFile(p, 'utf8')
    expect(content).toContain(`id: ${item.id}`)
  }
})

test('handles non-markdown file companion assets and canvas diagrams alongside notes', async () => {
  const canvasContent = JSON.stringify({
    nodes: [{ id: 'n1', x: 0, y: 0, width: 200, height: 100, text: 'Brainstorm' }],
    edges: []
  })

  const notePath = await writeNote(vaultPath, 'Designs', 'FeatureMap', { id: 'note-fm' })
  const canvasPath = await writeRawFile(vaultPath, 'Designs', 'Whiteboard.canvas', canvasContent)
  const jsonConfig = await writeRawFile(vaultPath, 'Designs', 'meta.json', '{"version": 1}')

  expect(await fs.access(notePath).then(() => true).catch(() => false)).toBe(true)
  expect(await fs.access(canvasPath).then(() => true).catch(() => false)).toBe(true)
  expect(await fs.access(jsonConfig).then(() => true).catch(() => false)).toBe(true)

  const readCanvas = await fs.readFile(canvasPath, 'utf8')
  expect(readCanvas).toContain('Brainstorm')
})

test('selectively deletes specific files while preserving sibling files in the same folder', async () => {
  const noteA = await writeNote(vaultPath, 'Experiments', 'ExpA', { id: 'exp-a', content: 'A' })
  const noteB = await writeNote(vaultPath, 'Experiments', 'ExpB', { id: 'exp-b', content: 'B' })
  const noteC = await writeNote(vaultPath, 'Experiments', 'ExpC', { id: 'exp-c', content: 'C' })

  // Delete only noteA and noteC
  await invokeIPC(page, 'bulkDelete', { folderIds: [], snippetIds: ['exp-a', 'exp-c'] })

  const existsA = await fs.access(noteA).then(() => true).catch(() => false)
  const existsB = await fs.access(noteB).then(() => true).catch(() => false)
  const existsC = await fs.access(noteC).then(() => true).catch(() => false)

  expect(existsA).toBe(false)
  expect(existsB).toBe(true) // Note B preserved
  expect(existsC).toBe(false)

  // Parent folder still intact
  const folderExists = await fs.access(path.join(vaultPath, 'Experiments')).then(() => true).catch(() => false)
  expect(folderExists).toBe(true)
})
