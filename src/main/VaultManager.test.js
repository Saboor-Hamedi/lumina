import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import VaultManager from './VaultManager.js'
import matter from 'gray-matter'

describe('VaultManager', () => {
  let testVaultPath
  let originalVaultPath

  beforeEach(async () => {
    // Create a temporary test vault
    testVaultPath = path.join(os.tmpdir(), `lumina-test-${Date.now()}`)
    await fs.mkdir(testVaultPath, { recursive: true })
    await fs.mkdir(path.join(testVaultPath, 'assets'), { recursive: true })

    // Store original vault path
    originalVaultPath = VaultManager.vaultPath

    // Initialize with test vault
    await VaultManager.init(testVaultPath, os.tmpdir())
  })

  afterEach(async () => {
    // Cleanup test vault
    try {
      await fs.rm(testVaultPath, { recursive: true, force: true })
    } catch (err) {
      // Ignore cleanup errors
    }

    // Restore original vault path
    VaultManager.vaultPath = originalVaultPath
    VaultManager.snippets.clear()
  })

  describe('init', () => {
    it('creates vault directory if it does not exist', async () => {
      const newVaultPath = path.join(os.tmpdir(), `lumina-new-${Date.now()}`)
      
      await VaultManager.init(newVaultPath, os.tmpdir())

      const exists = await fs.access(newVaultPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)

      // Cleanup
      await fs.rm(newVaultPath, { recursive: true, force: true })
    })

    it('creates assets directory', async () => {
      const assetsPath = path.join(testVaultPath, 'assets')
      const exists = await fs.access(assetsPath).then(() => true).catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe('scanVault', () => {
    it('scans and loads markdown files', async () => {
      const testFile = path.join(testVaultPath, 'test.md')
      const content = matter.stringify('Test content', {
        id: 'test-1',
        title: 'Test Note',
        language: 'markdown'
      })
      await fs.writeFile(testFile, content)

      const snippets = await VaultManager.scanVault()

      expect(snippets).toHaveLength(1)
      expect(snippets[0].id).toBe('test-1')
      expect(snippets[0].title).toBe('Test Note')
      expect(snippets[0].code.trim()).toBe('Test content')
    })

    it('skips empty files', async () => {
      const emptyFile = path.join(testVaultPath, 'empty.md')
      await fs.writeFile(emptyFile, '')

      const snippets = await VaultManager.scanVault()

      expect(snippets).toHaveLength(0)
    })

    it('handles files without frontmatter', async () => {
      const testFile = path.join(testVaultPath, 'no-frontmatter.md')
      await fs.writeFile(testFile, 'Just plain content')

      const snippets = await VaultManager.scanVault()

      expect(snippets).toHaveLength(1)
      expect(snippets[0].id).toBe('no-frontmatter')
      expect(snippets[0].title).toBe('no-frontmatter')
      expect(snippets[0].code).toBe('Just plain content')
    })

    it('uses file mtime as timestamp if not in frontmatter', async () => {
      const testFile = path.join(testVaultPath, 'timestamp.md')
      await fs.writeFile(testFile, 'Content')
      const stats = await fs.stat(testFile)

      const snippets = await VaultManager.scanVault()

      expect(snippets[0].timestamp).toBeCloseTo(stats.mtimeMs, -3) // Within 1 second
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
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      expect(exists).toBe(true)

      const content = await fs.readFile(filePath, 'utf-8')
      const parsed = matter(content)
      expect(parsed.data.id).toBe('save-test')
      expect(parsed.content.trim()).toBe('Test content')
    })

    it('handles renaming by deleting old file', async () => {
      // Create initial snippet
      const oldSnippet = {
        id: 'rename-test',
        title: 'Old Title',
        code: 'Content',
        language: 'markdown',
        tags: '',
        fileName: 'Old Title.md'
      }
      await VaultManager.saveSnippet(oldSnippet)

      // Rename it
      const newSnippet = {
        ...oldSnippet,
        title: 'New Title'
      }
      await VaultManager.saveSnippet(newSnippet)

      // Old file should not exist
      const oldPath = path.join(testVaultPath, 'Old Title.md')
      const oldExists = await fs.access(oldPath).then(() => true).catch(() => false)
      expect(oldExists).toBe(false)

      // New file should exist
      const newPath = path.join(testVaultPath, 'New Title.md')
      const newExists = await fs.access(newPath).then(() => true).catch(() => false)
      expect(newExists).toBe(true)
    })

    it('prevents filename collisions', async () => {
      const snippet1 = {
        id: 'collision-1',
        title: 'Same Title',
        code: 'Content 1',
        language: 'markdown',
        tags: ''
      }
      const snippet2 = {
        id: 'collision-2',
        title: 'Same Title',
        code: 'Content 2',
        language: 'markdown',
        tags: ''
      }

      await VaultManager.saveSnippet(snippet1)
      await VaultManager.saveSnippet(snippet2)

      // Check that both files exist (second should have ID suffix)
      const files = await fs.readdir(testVaultPath)
      const mdFiles = files.filter(f => f.endsWith('.md'))
      expect(mdFiles.length).toBe(2)
      
      // One should be "Same Title.md", the other should have a suffix
      const hasOriginal = mdFiles.some(f => f === 'Same Title.md')
      const hasSuffixed = mdFiles.some(f => f.startsWith('Same Title-') && f !== 'Same Title.md')
      expect(hasOriginal || hasSuffixed).toBe(true)
    })

    it('sanitizes filename', async () => {
      const snippet = {
        id: 'sanitize-test',
        title: 'Test<>:"/\\|?*',
        code: 'Content',
        language: 'markdown',
        tags: ''
      }

      await VaultManager.saveSnippet(snippet)

      const files = await fs.readdir(testVaultPath)
      const mdFiles = files.filter(f => f.endsWith('.md'))
      expect(mdFiles.length).toBeGreaterThan(0)
      expect(mdFiles[0]).not.toMatch(/[<>:"/\\|?*]/)
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

      expect(result).toBe(true)
      const filePath = path.join(testVaultPath, 'Delete Test.md')
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      expect(exists).toBe(false)
    })

    it('removes snippet from internal state even if file missing', async () => {
      // Add snippet to state without file
      VaultManager.snippets.set('missing-file', {
        id: 'missing-file',
        title: 'Missing',
        fileName: 'Missing.md'
      })

      const result = await VaultManager.deleteSnippet('missing-file')

      expect(result).toBe(true)
      expect(VaultManager.snippets.has('missing-file')).toBe(false)
    })
  })

  describe('getSnippets', () => {
    it('returns sorted snippets by timestamp', async () => {
      const snippet1 = {
        id: '1',
        title: 'First',
        code: 'Content',
        language: 'markdown',
        tags: '',
        timestamp: Date.now() - 2000
      }
      const snippet2 = {
        id: '2',
        title: 'Second',
        code: 'Content',
        language: 'markdown',
        tags: '',
        timestamp: Date.now() - 1000
      }

      await VaultManager.saveSnippet(snippet1)
      await VaultManager.saveSnippet(snippet2)
      await VaultManager.scanVault()

      const snippets = VaultManager.getSnippets()

      expect(snippets[0].id).toBe('2') // Most recent first
      expect(snippets[1].id).toBe('1')
    })

    it('filters out invalid snippets', async () => {
      // Manually add invalid snippet
      VaultManager.snippets.set('invalid', { id: null })

      const snippets = VaultManager.getSnippets()

      expect(snippets.every(s => s && s.id)).toBe(true)
    })
  })
})
