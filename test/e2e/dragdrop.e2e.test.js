const { test, expect } = require('@playwright/test')
const path = require('path')
const os = require('os')
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

test('external dot folder imports merge cleanly without creating numbered duplicates', async () => {
  const externalTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-ext-'))
  const extObsidianDir = path.join(externalTempDir, '.obsidian')
  await fs.mkdir(extObsidianDir, { recursive: true })
  await fs.writeFile(path.join(extObsidianDir, 'app.json'), '{"version": 1}')

  const targetObsidianDir = path.join(vaultPath, '.obsidian')
  await fs.mkdir(targetObsidianDir, { recursive: true })
  await fs.writeFile(path.join(targetObsidianDir, 'existing.json'), '{"installed": true}')

  await invokeIPC(page, 'importExternalPaths', [extObsidianDir], '')

  const mergedAppJson = path.join(targetObsidianDir, 'app.json')
  const mergedExistingJson = path.join(targetObsidianDir, 'existing.json')

  expect(await fs.access(mergedAppJson).then(() => true).catch(() => false)).toBe(true)
  expect(await fs.access(mergedExistingJson).then(() => true).catch(() => false)).toBe(true)

  const duplicateDir = path.join(vaultPath, '.obsidian (1)')
  expect(await fs.access(duplicateDir).then(() => true).catch(() => false)).toBe(false)

  try {
    await fs.rm(externalTempDir, { recursive: true, force: true })
  } catch {}
})

test('external files import cleanly into vault root', async () => {
  const externalTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-ext-file-'))
  const extFile = path.join(externalTempDir, 'ImportedNote.md')
  await fs.writeFile(extFile, '# External Content')

  await invokeIPC(page, 'importExternalPaths', [extFile], '')

  const importedPath = path.join(vaultPath, 'ImportedNote.md')
  expect(await fs.access(importedPath).then(() => true).catch(() => false)).toBe(true)

  try {
    await fs.rm(externalTempDir, { recursive: true, force: true })
  } catch {}
})
