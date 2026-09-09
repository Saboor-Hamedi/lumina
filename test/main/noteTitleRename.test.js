/**
 * Unit Tests: Note Title → Filename Sync & Drive Backup Name Resolution
 *
 * Covers:
 * 1. WorkspaceOperations.saveSnippet — automatic file rename when title changes
 * 2. Drive filename resolution logic (extracted pure function matching luminaNonZipBackup.js)
 * 3. resolveFilePaths title-based fallback when stale filePath doesn't exist on disk
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'

// ─── Mock electron ──────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) }
}))

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fileExists(p) {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false)
}

function buildFrontmatter({ id, title, code = '', language = 'markdown', timestamp = 1000 }) {
  return `---\nid: ${id}\ntitle: ${title}\nlanguage: ${language}\ntimestamp: ${timestamp}\ntags: ''\n---\n\n${code}`
}

// ─── Section 1: WorkspaceOperations.saveSnippet ─────────────────────────────

describe('WorkspaceOperations.saveSnippet — file renaming on title change', () => {
  let tmpDir
  let WorkspaceOperations

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-ops-test-'))
    const mod = await import('../../src/main/workspace/workspaceOperations.js')
    WorkspaceOperations = mod.WorkspaceOperations
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('saves a new snippet with filename derived from title, ignoring placeholder fileName', async () => {
    const snippetsMap = new Map()
    const snippet = {
      id: 'new-1',
      title: 'lumina',
      fileName: 'New Note.md',
      code: 'hello world',
      language: 'markdown',
      tags: ''
    }

    const result = await WorkspaceOperations.saveSnippet(
      tmpDir,
      snippetsMap,
      new Set(),
      snippet,
      null
    )

    expect(result.fileName).toBe('lumina.md')
    expect(await fileExists(path.join(tmpDir, 'lumina.md'))).toBe(true)
    expect(await fileExists(path.join(tmpDir, 'New Note.md'))).toBe(false)
  })

  it('renames disk file when title changes from oldSnippet.title', async () => {
    const snippetsMap = new Map()
    await fs.writeFile(
      path.join(tmpDir, 'Old Title.md'),
      buildFrontmatter({ id: 'ren-1', title: 'Old Title', code: 'content' })
    )

    const oldSnippet = {
      id: 'ren-1',
      title: 'Old Title',
      fileName: 'Old Title.md',
      code: 'content',
      language: 'markdown',
      tags: ''
    }
    snippetsMap.set('ren-1', oldSnippet)

    const newSnippet = { ...oldSnippet, title: 'New Title' }

    const result = await WorkspaceOperations.saveSnippet(
      tmpDir, snippetsMap, new Set(), newSnippet, oldSnippet
    )

    expect(result.fileName).toBe('New Title.md')
    expect(await fileExists(path.join(tmpDir, 'New Title.md'))).toBe(true)
    expect(await fileExists(path.join(tmpDir, 'Old Title.md'))).toBe(false)
  })

  it('renames "New Note.md" → "lumina.md" when user sets title to "lumina"', async () => {
    const snippetsMap = new Map()
    await fs.writeFile(
      path.join(tmpDir, 'New Note.md'),
      buildFrontmatter({ id: 'lumina-1', title: 'New Note', code: '' })
    )

    const oldSnippet = {
      id: 'lumina-1',
      title: 'New Note',
      fileName: 'New Note.md',
      code: '',
      language: 'markdown',
      tags: ''
    }
    snippetsMap.set('lumina-1', oldSnippet)

    const updatedSnippet = { ...oldSnippet, title: 'lumina', fileName: 'New Note.md' }

    const result = await WorkspaceOperations.saveSnippet(
      tmpDir, snippetsMap, new Set(), updatedSnippet, oldSnippet
    )

    expect(result.fileName).toBe('lumina.md')
    expect(await fileExists(path.join(tmpDir, 'lumina.md'))).toBe(true)
    expect(await fileExists(path.join(tmpDir, 'New Note.md'))).toBe(false)
  })

  it('does NOT rename file when title is unchanged between saves', async () => {
    const snippetsMap = new Map()
    await fs.writeFile(
      path.join(tmpDir, 'Stable Note.md'),
      buildFrontmatter({ id: 'stable-1', title: 'Stable Note', code: 'v1' })
    )

    const oldSnippet = {
      id: 'stable-1',
      title: 'Stable Note',
      fileName: 'Stable Note.md',
      code: 'v1',
      language: 'markdown',
      tags: ''
    }
    snippetsMap.set('stable-1', oldSnippet)

    const snippet = { ...oldSnippet, code: 'v2' }

    const result = await WorkspaceOperations.saveSnippet(
      tmpDir, snippetsMap, new Set(), snippet, oldSnippet
    )

    expect(result.fileName).toBe('Stable Note.md')
    expect(await fileExists(path.join(tmpDir, 'Stable Note.md'))).toBe(true)
  })

  it('sanitizes reserved characters in title when deriving filename', async () => {
    const snippetsMap = new Map()
    await fs.writeFile(
      path.join(tmpDir, 'New Note.md'),
      buildFrontmatter({ id: 'san-1', title: 'New Note', code: '' })
    )

    const oldSnippet = {
      id: 'san-1',
      title: 'New Note',
      fileName: 'New Note.md',
      code: '',
      language: 'markdown',
      tags: ''
    }
    snippetsMap.set('san-1', oldSnippet)

    const updatedSnippet = { ...oldSnippet, title: 'My Note: Draft <v2>' }

    const result = await WorkspaceOperations.saveSnippet(
      tmpDir, snippetsMap, new Set(), updatedSnippet, oldSnippet
    )

    expect(result.fileName).not.toContain(':')
    expect(result.fileName).not.toContain('<')
    expect(result.fileName).not.toContain('>')
    expect(result.fileName.endsWith('.md')).toBe(true)
  })

  it('handles collision: appends ID suffix when renamed file conflicts with existing note', async () => {
    const snippetsMap = new Map()

    // Existing note that "conflicts" with the rename target
    const conflictSnippet = {
      id: 'conflict-existing',
      title: 'Target Name',
      fileName: 'Target Name.md',
      code: '',
      language: 'markdown',
      tags: ''
    }
    await fs.writeFile(
      path.join(tmpDir, 'Target Name.md'),
      buildFrontmatter({ id: 'conflict-existing', title: 'Target Name', code: '' })
    )
    snippetsMap.set('conflict-existing', conflictSnippet)

    await fs.writeFile(
      path.join(tmpDir, 'Old Name.md'),
      buildFrontmatter({ id: 'rename-col', title: 'Old Name', code: '' })
    )
    const oldSnippet = {
      id: 'rename-col',
      title: 'Old Name',
      fileName: 'Old Name.md',
      code: '',
      language: 'markdown',
      tags: ''
    }
    snippetsMap.set('rename-col', oldSnippet)

    const updatedSnippet = { ...oldSnippet, title: 'Target Name' }

    const result = await WorkspaceOperations.saveSnippet(
      tmpDir, snippetsMap, new Set(), updatedSnippet, oldSnippet
    )

    // Should have a deduplicated filename (appends partial ID)
    expect(result.fileName).not.toBe('Target Name.md')
    expect(result.fileName.endsWith('.md')).toBe(true)
    expect(await fileExists(path.join(tmpDir, result.fileName))).toBe(true)
  })

  it('content is preserved correctly after rename', async () => {
    const snippetsMap = new Map()
    const originalContent = '# Hello from lumina\n\nThis is important content.'

    await fs.writeFile(
      path.join(tmpDir, 'New Note.md'),
      buildFrontmatter({ id: 'content-1', title: 'New Note', code: originalContent })
    )
    const oldSnippet = {
      id: 'content-1',
      title: 'New Note',
      fileName: 'New Note.md',
      code: originalContent,
      language: 'markdown',
      tags: ''
    }
    snippetsMap.set('content-1', oldSnippet)

    const updatedSnippet = { ...oldSnippet, title: 'lumina' }

    await WorkspaceOperations.saveSnippet(
      tmpDir, snippetsMap, new Set(), updatedSnippet, oldSnippet
    )

    const savedContent = await fs.readFile(path.join(tmpDir, 'lumina.md'), 'utf-8')
    expect(savedContent).toContain(originalContent)
    expect(savedContent).toContain('id: content-1')
    expect(savedContent).toContain('title: lumina')
  })
})

// ─── Section 2: Drive filename resolution (pure function) ───────────────────

describe('Drive backup: Drive fileName resolution from note title', () => {
  /**
   * Mirrors the exact filename derivation logic in
   * luminaNonZipBackup.js → backupSingleFile()
   */
  function resolveDriveFileName(diskFileName, fileInputTitle) {
    let fileName = diskFileName

    if (fileInputTitle) {
      const cleanTitle = String(fileInputTitle)
        .trim()
        .replace(/[<>:"/\\|?*]/g, '')

      if (cleanTitle) {
        const ext = path.extname(fileName) || '.md'
        const baseName = path.basename(fileName, ext)

        if (
          baseName.toLowerCase() === 'new note' ||
          baseName.toLowerCase() === 'untitled' ||
          baseName.toLowerCase() !== cleanTitle.toLowerCase()
        ) {
          fileName = cleanTitle.endsWith(ext) ? cleanTitle : `${cleanTitle}${ext}`
        }
      }
    }

    return fileName
  }

  it('uses title "lumina" instead of disk filename "New Note.md"', () => {
    expect(resolveDriveFileName('New Note.md', 'lumina')).toBe('lumina.md')
  })

  it('preserves filename when title and disk name already match', () => {
    expect(resolveDriveFileName('my note.md', 'my note')).toBe('my note.md')
  })

  it('replaces "Untitled.md" with the actual title', () => {
    expect(resolveDriveFileName('Untitled.md', 'Meeting Notes')).toBe('Meeting Notes.md')
  })

  it('handles "New Note.md" with any new title', () => {
    expect(resolveDriveFileName('New Note.md', 'Project Plan')).toBe('Project Plan.md')
  })

  it('works for notes in nested folders — compares basename only', () => {
    const diskBase = path.basename('work/projects/New Note.md')
    expect(resolveDriveFileName(diskBase, 'nested note')).toBe('nested note.md')
  })

  it('strips reserved characters from title in Drive filename', () => {
    const result = resolveDriveFileName('New Note.md', 'Draft: My <Note>')
    expect(result).not.toContain(':')
    expect(result).not.toContain('<')
    expect(result).not.toContain('>')
    expect(result.endsWith('.md')).toBe(true)
  })

  it('keeps disk filename when title is empty string', () => {
    expect(resolveDriveFileName('Some Note.md', '')).toBe('Some Note.md')
  })

  it('keeps disk filename when title is null', () => {
    expect(resolveDriveFileName('Some Note.md', null)).toBe('Some Note.md')
  })

  it('keeps disk filename when title is undefined', () => {
    expect(resolveDriveFileName('Some Note.md', undefined)).toBe('Some Note.md')
  })

  it('does not modify correct title-matching filename', () => {
    expect(resolveDriveFileName('correct-name.md', 'correct-name')).toBe('correct-name.md')
  })

  it('keeps disk filename when title resolves to empty after sanitization', () => {
    // All characters are reserved — after strip, cleanTitle is empty
    expect(resolveDriveFileName('New Note.md', ':<>?*')).toBe('New Note.md')
  })

  it('handles title that already has .md extension', () => {
    const result = resolveDriveFileName('New Note.md', 'my-note.md')
    expect(result).toBe('my-note.md')
    expect(result.endsWith('.md')).toBe(true)
  })

  it('is case-insensitive when comparing title to disk base', () => {
    // "LUMINA" title vs "lumina.md" on disk — they match, no rename
    expect(resolveDriveFileName('lumina.md', 'LUMINA')).toBe('lumina.md')
  })
})

// ─── Section 3: resolveFilePaths title-based fallback ───────────────────────

describe('Drive backup: resolveFilePaths title fallback when filePath is stale', () => {
  let tmpDir

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-rp-test-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  /**
   * Inline mirror of resolveFilePaths from luminaNonZipBackup.js
   * so we can test the fallback logic without a real Drive connection.
   */
  function resolveFilePaths(fileInput, vaultPath) {
    let fullPath = null
    let relativePath = null

    if (typeof fileInput === 'string') {
      if (path.isAbsolute(fileInput)) {
        fullPath = fileInput
        relativePath = path.relative(vaultPath, fullPath)
      } else {
        relativePath = fileInput
        fullPath = path.resolve(vaultPath, relativePath)
      }
    } else if (fileInput && typeof fileInput === 'object') {
      if (fileInput.filePath && fsSync.existsSync(fileInput.filePath)) {
        fullPath = fileInput.filePath
        relativePath = path.relative(vaultPath, fullPath)
      } else if (fileInput.relativePath) {
        relativePath = fileInput.relativePath
        fullPath = path.resolve(vaultPath, relativePath)
      } else {
        const folder = (fileInput.folderId || '').replace(/\\/g, '/')
        const name = fileInput.fileName || `${fileInput.title || 'Untitled'}.md`
        relativePath = path.join(folder, name)
        fullPath = path.resolve(vaultPath, relativePath)
      }

      // Fallback: if fullPath doesn't exist, try title-based candidate
      if ((!fullPath || !fsSync.existsSync(fullPath)) && fileInput.title) {
        const folder = (fileInput.folderId || '').replace(/\\/g, '/')
        const cleanTitle = String(fileInput.title)
          .trim()
          .replace(/[<>:"/\\|?*]/g, '')
        const candidatePath = path.resolve(vaultPath, path.join(folder, `${cleanTitle}.md`))
        if (fsSync.existsSync(candidatePath)) {
          fullPath = candidatePath
          relativePath = path.relative(vaultPath, fullPath)
        }
      }
    }

    if (!fullPath || !fsSync.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath || 'unknown'}`)
    }

    return { fullPath, relativePath: relativePath.replace(/\\/g, '/') }
  }

  it('falls back to title-based path when filePath points to stale "New Note.md"', async () => {
    const actualFile = path.join(tmpDir, 'lumina.md')
    await fs.writeFile(actualFile, '# lumina content')

    const fileInput = {
      filePath: path.join(tmpDir, 'New Note.md'), // stale — does not exist
      title: 'lumina',
      folderId: '',
      fileName: 'New Note.md'
    }

    const { fullPath, relativePath } = resolveFilePaths(fileInput, tmpDir)

    expect(fullPath).toBe(actualFile)
    expect(relativePath).toBe('lumina.md')
    expect(fsSync.existsSync(fullPath)).toBe(true)
  })

  it('uses filePath directly when it points to an existing file', async () => {
    const actualFile = path.join(tmpDir, 'valid.md')
    await fs.writeFile(actualFile, '# valid')

    const fileInput = {
      filePath: actualFile,
      title: 'valid',
      folderId: '',
      fileName: 'valid.md'
    }

    const { fullPath, relativePath } = resolveFilePaths(fileInput, tmpDir)

    expect(fullPath).toBe(actualFile)
    expect(relativePath).toBe('valid.md')
  })

  it('resolves correctly when title-based file is inside a subfolder', async () => {
    const subDir = path.join(tmpDir, 'work')
    await fs.mkdir(subDir, { recursive: true })
    const actualFile = path.join(subDir, 'project plan.md')
    await fs.writeFile(actualFile, '# Project Plan')

    const fileInput = {
      filePath: path.join(subDir, 'New Note.md'), // stale
      title: 'project plan',
      folderId: 'work',
      fileName: 'New Note.md'
    }

    const { fullPath, relativePath } = resolveFilePaths(fileInput, tmpDir)

    expect(fullPath).toBe(actualFile)
    expect(relativePath).toBe('work/project plan.md')
  })

  it('throws when neither filePath nor title-based path exists', async () => {
    const fileInput = {
      filePath: path.join(tmpDir, 'ghost.md'),
      title: 'also-ghost',
      folderId: '',
      fileName: 'ghost.md'
    }

    expect(() => resolveFilePaths(fileInput, tmpDir)).toThrow('File not found')
  })

  it('resolves string absolute path correctly', async () => {
    const actualFile = path.join(tmpDir, 'direct.md')
    await fs.writeFile(actualFile, '# direct')

    const { fullPath, relativePath } = resolveFilePaths(actualFile, tmpDir)

    expect(fullPath).toBe(actualFile)
    expect(relativePath).toBe('direct.md')
  })
})
