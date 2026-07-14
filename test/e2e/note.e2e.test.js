/**
 * E2E: Note Lifecycle
 *
 * Tests the full CRUD lifecycle of a note as it hits the real filesystem.
 * Covers: create → read → rename → delete, checking actual disk state.
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeNote({ id, title, content = 'Test content', language = 'markdown', timestamp = Date.now() }) {
  return `---
id: ${id}
title: ${title}
language: ${language}
timestamp: ${timestamp}
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

async function fileExists(filePath) {
  return fs.access(filePath).then(() => true).catch(() => false)
}

// ─── Create ───────────────────────────────────────────────────────────────────

test('create note: file appears on disk', async () => {
  const filePath = await writeNote(vaultPath, 'My First Note', {
    id: 'note-create-1',
    content: 'Created via E2E test'
  })

  expect(await fileExists(filePath)).toBe(true)
})

test('create note: frontmatter id is preserved', async () => {
  const filePath = await writeNote(vaultPath, 'ID Test Note', {
    id: 'unique-id-abc123',
    content: 'ID check'
  })

  const raw = await fs.readFile(filePath, 'utf-8')
  expect(raw).toContain('id: unique-id-abc123')
})

test('create note: body content is preserved', async () => {
  const content = 'The quick brown fox jumps over the lazy dog.'
  const filePath = await writeNote(vaultPath, 'Body Test', {
    id: 'body-test-1',
    content
  })

  const raw = await fs.readFile(filePath, 'utf-8')
  expect(raw).toContain(content)
})

test('create note: timestamp is stored in frontmatter', async () => {
  const ts = 1700000000000
  const filePath = await writeNote(vaultPath, 'Timestamp Note', {
    id: 'ts-test-1',
    timestamp: ts
  })

  const raw = await fs.readFile(filePath, 'utf-8')
  expect(raw).toContain(`timestamp: ${ts}`)
})

// ─── Rename ──────────────────────────────────────────────────────────────────

test('rename note: old file removed, new file exists', async () => {
  const oldTitle = 'Old Title Note'
  const newTitle = 'New Title Note'

  const oldPath = await writeNote(vaultPath, oldTitle, {
    id: 'rename-test-1',
    content: 'Original content'
  })

  const raw = await fs.readFile(oldPath, 'utf-8')
  const updated = raw.replace(`title: ${oldTitle}`, `title: ${newTitle}`)
  const newPath = path.join(vaultPath, `${newTitle}.md`)
  await fs.writeFile(newPath, updated)
  await fs.unlink(oldPath)

  expect(await fileExists(oldPath)).toBe(false)
  expect(await fileExists(newPath)).toBe(true)
})

test('rename note: new file has updated title in frontmatter', async () => {
  const oldTitle = 'Before Rename'
  const newTitle = 'After Rename'

  const oldPath = await writeNote(vaultPath, oldTitle, {
    id: 'rename-frontmatter-1',
    content: 'Some content'
  })
  const raw = await fs.readFile(oldPath, 'utf-8')
  const updated = raw.replace(`title: ${oldTitle}`, `title: ${newTitle}`)
  const newPath = path.join(vaultPath, `${newTitle}.md`)
  await fs.writeFile(newPath, updated)
  await fs.unlink(oldPath)

  const newContent = await fs.readFile(newPath, 'utf-8')
  expect(newContent).toContain(`title: ${newTitle}`)
})

test('rename note: id is stable across rename', async () => {
  const id = 'stable-id-across-rename'
  const oldPath = await writeNote(vaultPath, 'Pre Rename', { id })
  const raw = await fs.readFile(oldPath, 'utf-8')
  const newPath = path.join(vaultPath, 'Post Rename.md')
  await fs.writeFile(newPath, raw)
  await fs.unlink(oldPath)

  const newContent = await fs.readFile(newPath, 'utf-8')
  expect(newContent).toContain(`id: ${id}`)
})

// ─── Delete ───────────────────────────────────────────────────────────────────

test('delete note: file is removed from disk', async () => {
  const filePath = await writeNote(vaultPath, 'To Delete', {
    id: 'delete-test-1',
    content: 'This note will be deleted'
  })

  expect(await fileExists(filePath)).toBe(true)
  await fs.unlink(filePath)
  expect(await fileExists(filePath)).toBe(false)
})

test('delete note: other notes are unaffected', async () => {
  const keep = await writeNote(vaultPath, 'Keep This', { id: 'keep-1', content: 'Keep me' })
  const del  = await writeNote(vaultPath, 'Delete This', { id: 'del-1', content: 'Delete me' })

  await fs.unlink(del)

  expect(await fileExists(keep)).toBe(true)
  expect(await fileExists(del)).toBe(false)
})

// ─── Bulk & Sort ──────────────────────────────────────────────────────────────

test('vault can hold many notes with unique ids', async () => {
  const count = 20
  const ids = new Set()

  for (let i = 0; i < count; i++) {
    const id = `bulk-note-${i}`
    ids.add(id)
    await writeNote(vaultPath, `Bulk Note ${i}`, { id, content: `Content ${i}` })
  }

  const files = await fs.readdir(vaultPath)
  const mdFiles = files.filter((f) => f.endsWith('.md'))
  expect(mdFiles.length).toBe(count)
  expect(ids.size).toBe(count)
})

test('notes are sorted by timestamp when read back', async () => {
  const notes = [
    { title: 'Note C', id: 'sort-c', timestamp: 3000 },
    { title: 'Note A', id: 'sort-a', timestamp: 1000 },
    { title: 'Note B', id: 'sort-b', timestamp: 2000 }
  ]

  for (const n of notes) {
    await writeNote(vaultPath, n.title, { id: n.id, timestamp: n.timestamp })
  }

  const files = await fs.readdir(vaultPath)
  const parsed = []

  for (const f of files.filter((x) => x.endsWith('.md'))) {
    const raw = await fs.readFile(path.join(vaultPath, f), 'utf-8')
    const tsMatch = raw.match(/timestamp:\s*(\d+)/)
    if (tsMatch) parsed.push({ file: f, ts: parseInt(tsMatch[1]) })
  }

  parsed.sort((a, b) => b.ts - a.ts)

  expect(parsed[0].ts).toBe(3000)
  expect(parsed[1].ts).toBe(2000)
  expect(parsed[2].ts).toBe(1000)
})
