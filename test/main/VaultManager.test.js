import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import VaultManager from '../../src/main/workspace/workspaceManager.js'
import matter from 'gray-matter'

vi.mock('electron', () => {
  const electronMock = {
    BrowserWindow: {
      getAllWindows: vi.fn(() => [])
    }
  }
  return {
    default: electronMock,
    ...electronMock
  }
})

describe('VaultManager', () => {
  let testVaultPath
  let originalVaultPath

  beforeEach(async () => {
    if (VaultManager.watcher) {
      await VaultManager.watcher.close()
      VaultManager.watcher = null
    }
    testVaultPath = path.join(os.tmpdir(), `lumina-test-${Date.now()}`)
    await fs.mkdir(testVaultPath, { recursive: true })
    await fs.mkdir(path.join(testVaultPath, 'assets'), { recursive: true })
    originalVaultPath = VaultManager.vaultPath
    await VaultManager.init(testVaultPath, os.tmpdir())
  })

  afterEach(async () => {
    // Close the chokidar watcher before deleting the directory
    if (VaultManager.watcher) {
      await VaultManager.watcher.close()
      VaultManager.watcher = null
    }
    try {
      await fs.rm(testVaultPath, { recursive: true, force: true })
    } catch (err) {}
    VaultManager.vaultPath = originalVaultPath
    VaultManager.snippets.clear()
  })

  describe('init', () => {
    it('creates vault directory if it does not exist', async () => {
      const newVaultPath = path.join(os.tmpdir(), `lumina-new-${Date.now()}`)
      await VaultManager.init(newVaultPath, os.tmpdir())
      const exists = await fs
        .access(newVaultPath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
      if (VaultManager.watcher) {
        await VaultManager.watcher.close()
        VaultManager.watcher = null
      }
      await fs.rm(newVaultPath, { recursive: true, force: true })
    })

    it('creates assets directory', async () => {
      const assetsPath = path.join(testVaultPath, 'assets')
      const exists = await fs
        .access(assetsPath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe('scanVault', () => {
    it('scans and loads markdown files', async () => {
      const content = '---\nid: test-1\ntitle: Test Note\n---\nTest content'
      await fs.writeFile(path.join(testVaultPath, 'Test Note.md'), content)
      const { snippets } = await VaultManager.scanVault()
      expect(snippets).toHaveLength(1)
      expect(snippets[0].id).toBe('test-1')
      expect(snippets[0].title).toBe('Test Note')
      expect(snippets[0].code.trim()).toBe('Test content')
    })
  })

  describe('saveSnippet', () => {
    it('saves snippet to file', async () => {
      const snippet = {
        id: 'save-test',
        title: 'Save Test',
        code: 'Test content',
        language: 'markdown',
        tags: 'test'
      }
      await VaultManager.saveSnippet(snippet)
      const filePath = path.join(testVaultPath, 'Save Test.md')
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe('deleteSnippet', () => {
    it('deletes snippet file', async () => {
      const snippet = {
        id: 'delete-test',
        title: 'Delete Test',
        code: 'Content',
        language: 'markdown',
        tags: '',
        fileName: 'Delete Test.md'
      }
      await VaultManager.saveSnippet(snippet)
      const result = await VaultManager.deleteSnippet('delete-test')
      const filePath = path.join(testVaultPath, 'Delete Test.md')
      expect(result).toBe(filePath)
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)
    })
  })

  describe('getSnippets', () => {
    it('returns sorted snippets by timestamp', async () => {
      await VaultManager.saveSnippet({
        id: '1',
        title: 'First',
        code: 'Content 1',
        language: 'markdown',
        timestamp: 1000
      })
      await VaultManager.saveSnippet({
        id: '2',
        title: 'Second',
        code: 'Content 2',
        language: 'markdown',
        timestamp: 2000
      })
      const { snippets } = VaultManager.getSnippets()
      expect(snippets[0].id).toBe('2')
      expect(snippets[1].id).toBe('1')
    })

    it('filters out invalid snippets', async () => {
      VaultManager.snippets.set('invalid', null)
      VaultManager.snippets.set('valid', { id: 'valid', timestamp: 1000 })
      const { snippets } = VaultManager.getSnippets()
      expect(snippets.every((s) => s && s.id)).toBe(true)
    })
  })
})
