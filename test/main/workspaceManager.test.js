
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
    VaultManager.snippets = new Map()
    VaultManager.folders = new Set()
    if (VaultManager.watcher) {
      VaultManager.watcher.on('error', () => {})
    }
  })

  afterEach(async () => {
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

    it('protects oversized text files from full startup reads', async () => {
      const oversizedContent = Buffer.alloc(5 * 1024 * 1024 + 1, 'x')
      await fs.writeFile(path.join(testVaultPath, 'Large Note.md'), oversizedContent)

      const { snippets } = await VaultManager.scanVault()
      const largeSnippet = snippets.find((snippet) => snippet.fileName === 'Large Note.md')

      expect(largeSnippet).toEqual(expect.objectContaining({
        title: 'Large Note',
        code: '',
        size: oversizedContent.length,
        isOversized: true
      }))
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

    it('deletes folder containing .gitignore and other files', async () => {
      const subFolder = path.join(testVaultPath, 'my-folder')
      await fs.mkdir(subFolder, { recursive: true })
      await fs.writeFile(path.join(subFolder, '.gitignore'), 'dist/', 'utf-8')
      await fs.writeFile(path.join(subFolder, 'notes.md'), '# Notes', 'utf-8')

      await VaultManager.scanVault()
      expect(VaultManager.folders.has('my-folder')).toBe(true)

      await VaultManager.deleteFolder('my-folder')
      const folderExists = await fs.access(subFolder).then(() => true).catch(() => false)
      expect(folderExists).toBe(false)
      expect(VaultManager.folders.has('my-folder')).toBe(false)
    })

    it('bulk deletes selected files and folders', async () => {
      const folderPath = path.join(testVaultPath, 'bulk-folder')
      await fs.mkdir(folderPath, { recursive: true })
      await fs.writeFile(path.join(folderPath, 'file1.md'), 'F1', 'utf-8')

      const directFile = path.join(testVaultPath, 'direct.md')
      await fs.writeFile(directFile, 'F2', 'utf-8')

      await VaultManager.scanVault()

      const mdSnippet = Array.from(VaultManager.snippets.values()).find((s) => s.fileName === 'direct.md')

      await VaultManager.bulkDelete({
        folderIds: ['bulk-folder'],
        snippetIds: [mdSnippet.id]
      })

      const folderExists = await fs.access(folderPath).then(() => true).catch(() => false)
      const fileExists = await fs.access(directFile).then(() => true).catch(() => false)

      expect(folderExists).toBe(false)
      expect(fileExists).toBe(false)
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
      const { snippets } = await VaultManager.getSnippets()
      expect(snippets[0].id).toBe('2')
      expect(snippets[1].id).toBe('1')
    })

    it('filters out invalid snippets', async () => {
      VaultManager.snippets.set('invalid', null)
      VaultManager.snippets.set('valid', { id: 'valid', timestamp: 1000 })
      const { snippets } = await VaultManager.getSnippets()
      expect(snippets.every((s) => s && s.id)).toBe(true)
    })
  })

  describe('assets', () => {
    it('saves image and reads it back via readAsset', async () => {
      const buffer = Buffer.from('fake-png-data')
      const relativePath = await VaultManager.saveImage(buffer, 'test-image.png')
      expect(relativePath).toContain('.lumina/assets/test-image-')
      expect(relativePath.endsWith('.png')).toBe(true)

      const asset = await VaultManager.readAsset(relativePath)
      expect(asset).toBeDefined()
      expect(asset.mimeType).toBe('image/png')
      expect(asset.dataUrl).toContain('data:image/png;base64,')
      expect(asset.buffer.toString()).toBe('fake-png-data')
    })

    it('scans PDF files and reads them back via readAsset', async () => {
      const pdfPath = path.join(testVaultPath, 'manual.pdf')
      await fs.writeFile(pdfPath, '%PDF-1.4 fake pdf data')

      const scanResult = await VaultManager.scanWorkspace()
      const pdfSnippet = scanResult.snippets.find((s) => s.fileName === 'manual.pdf')
      expect(pdfSnippet).toBeDefined()
      expect(pdfSnippet.type).toBe('pdf')
      expect(pdfSnippet.language).toBe('pdf')
      expect(pdfSnippet.ext).toBe('.pdf')

      const asset = await VaultManager.readAsset('manual.pdf')
      expect(asset).toBeDefined()
      expect(asset.mimeType).toBe('application/pdf')
      expect(asset.dataUrl).toContain('data:application/pdf;base64,')
      expect(asset.buffer.toString()).toBe('%PDF-1.4 fake pdf data')
    })
  })
})
