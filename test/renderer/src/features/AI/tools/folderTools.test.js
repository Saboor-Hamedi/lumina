import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFolderTool } from '../../../../../../src/renderer/src/features/AI/tools/createFolder'
import { createFileTool } from '../../../../../../src/renderer/src/features/AI/tools/createFile'
import { checkFileTool } from '../../../../../../src/renderer/src/features/AI/tools/checkFile'
import { getReadFileTool } from '../../../../../../src/renderer/src/features/AI/tools/readFile'
import { updateFileTool } from '../../../../../../src/renderer/src/features/AI/tools/updateFile'
import { grepWorkspaceTool } from '../../../../../../src/renderer/src/features/AI/tools/grepWorkspace'
import { moveFileTool } from '../../../../../../src/renderer/src/features/AI/tools/moveFile'
import { deleteFileTool } from '../../../../../../src/renderer/src/features/AI/tools/deleteFile'
import { renameFileTool } from '../../../../../../src/renderer/src/features/AI/tools/renameFile'
import { deleteFolderTool } from '../../../../../../src/renderer/src/features/AI/tools/deleteFolder'
import { renameFolderTool } from '../../../../../../src/renderer/src/features/AI/tools/renameFolder'
import {
  resolveMentions,
  resolveReferencedFiles
} from '../../../../../../src/renderer/src/features/AI/services/prompt/mentionResolver'
import { useWorkspaceStore } from '../../../../../../src/renderer/src/core/store/workspaceStore'

describe('AI Folder & File Movement Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api = {
      createFolder: vi.fn().mockResolvedValue(true),
      deleteFolder: vi.fn().mockResolvedValue(true),
      renameFolder: vi.fn().mockResolvedValue(true),
      saveSnippet: vi.fn().mockImplementation((snippet) => Promise.resolve(snippet)),
      getSetting: vi.fn().mockResolvedValue({}),
      saveSetting: vi.fn().mockResolvedValue(true),
      deleteChunks: vi.fn().mockResolvedValue(true)
    }

    useWorkspaceStore.setState({
      notes: [
        { id: 'note-1', title: 'Thermodynamics', code: '# Heat', folderId: '', fileName: 'Thermodynamics.md' },
        { id: 'note-2', title: 'Calculus', code: '# Integrals', folderId: 'Math', fileName: 'Calculus.md' }
      ],
      snippets: [
        { id: 'note-1', title: 'Thermodynamics', code: '# Heat', folderId: '', fileName: 'Thermodynamics.md' },
        { id: 'note-2', title: 'Calculus', code: '# Integrals', folderId: 'Math', fileName: 'Calculus.md' }
      ],
      selectedNote: { id: 'note-1', title: 'Thermodynamics', code: '# Heat', folderId: '', fileName: 'Thermodynamics.md' },
      selectedSnippet: { id: 'note-1', title: 'Thermodynamics', code: '# Heat', folderId: '', fileName: 'Thermodynamics.md' },
      folders: ['Math'],
      activeTabId: 'note-1',
      openTabs: ['note-1'],
      loadWorkspace: vi.fn().mockResolvedValue(true),
      deleteNote: vi.fn().mockResolvedValue(true),
      deleteSnippet: vi.fn().mockResolvedValue(true),
      saveNote: vi.fn().mockImplementation((note) => {
        window.api.saveSnippet(note)
        return Promise.resolve(note)
      }),
      closeTab: vi.fn()
    })
  })

  it('createFolderTool creates a folder and triggers vault reload', async () => {
    const res = await createFolderTool.execute({ path: 'Science/Physics' })
    expect(res.success).toBe(true)
    expect(res.path).toBe('Science/Physics')
    expect(window.api.createFolder).toHaveBeenCalledWith('Science/Physics')
    expect(useWorkspaceStore.getState().loadWorkspace).toHaveBeenCalled()
  })

  it('createFileTool creates a note with target folder and saves it', async () => {
    const res = await createFileTool.execute({
      title: 'Quantum Mechanics',
      content: '# Quantum\n[[Thermodynamics]]',
      folder: 'Science/Physics'
    })

    expect(res.success).toBe(true)
    expect(res.title).toBe('Quantum Mechanics')
    expect(res.folderId).toBe('Science/Physics')
    expect(window.api.createFolder).toHaveBeenCalledWith('Science/Physics')
    expect(window.api.saveSnippet).toHaveBeenCalled()
  })

  it('createFileTool handles path in title and dispatches events', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const res = await createFileTool.execute({
      title: 'Database/Schema/Intro',
      content: '# Intro',
      folder: ''
    })

    expect(res.success).toBe(true)
    expect(res.title).toBe('Intro')
    expect(res.folderId).toBe('Database/Schema')
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ai-saved-note' })
    )
    dispatchSpy.mockRestore()
  })

  it('createFileTool upserts existing note in the same folder instead of creating duplicates', async () => {
    const res = await createFileTool.execute({
      title: 'Calculus',
      folder: 'Math',
      content: '# Integrals\n\nUpdated content'
    })

    expect(res.success).toBe(true)
    expect(res.id).toBe('note-2')
    expect(res.reusedExisting).toBe(true)
    expect(res.previousContent).toBe('# Integrals')
  })

  it('checkFileTool returns heading outline, wikilinks, backlinks, and line-numbered ranges', async () => {
    useWorkspaceStore.setState({
      notes: [
        {
          id: 'note-1',
          title: 'Thermodynamics',
          code: '# Heat\nIntro to [[Calculus]]\n## First Law\nEnergy conservation\n## Second Law\nEntropy increases',
          folderId: ''
        },
        {
          id: 'note-2',
          title: 'Calculus',
          code: '# Integrals\nUsed in [[Thermodynamics]]',
          folderId: 'Math'
        }
      ]
    })

    const res = await checkFileTool.execute({
      title: 'Thermodynamics',
      startLine: 3,
      endLine: 4,
      includeLineNumbers: true
    })

    expect(res.exists).toBe(true)
    expect(res.lineCount).toBe(6)
    expect(res.outline).toEqual([
      { level: 1, text: 'Heat', startLine: 1, endLine: 6 },
      { level: 2, text: 'First Law', startLine: 3, endLine: 4 },
      { level: 2, text: 'Second Law', startLine: 5, endLine: 6 }
    ])
    expect(res.wikilinks).toContain('Calculus')
    expect(res.backlinks).toContain('Calculus')
    expect(res.content).toBe('3: ## First Law\n4: Energy conservation')
  })

  it('readFileTool supports folder disambiguation and line-numbered slices', async () => {
    const readFileTool = getReadFileTool(false)
    const res = await readFileTool.execute({
      title: 'Math/Calculus',
      startLine: 1,
      endLine: 1,
      includeLineNumbers: true
    })

    expect(res.title).toBe('Calculus')
    expect(res.folder).toBe('Math')
    expect(res.content).toBe('1: # Integrals')
  })

  it('updateFileTool refuses to clobber opening section when search text is not found', async () => {
    useWorkspaceStore.setState({
      notes: [
        {
          id: 'note-1',
          title: 'Thermodynamics',
          code: '# Heat\n\nImportant opening intro that must not be lost.\n\n## First Law\nConservation of energy.',
          folderId: ''
        }
      ],
      selectedNote: {
        id: 'note-1',
        title: 'Thermodynamics',
        code: '# Heat\n\nImportant opening intro that must not be lost.\n\n## First Law\nConservation of energy.',
        folderId: ''
      }
    })

    const res = await updateFileTool.execute({
      title: 'Thermodynamics',
      search: 'NonExistentParagraphTextXYZ',
      replace: 'Replacement text'
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain('not found')
    expect(res.availableHeadings).toContain('## First Law')
    expect(window.api.saveSnippet).not.toHaveBeenCalled()
  })

  it('updateFileTool applies multi-hunk edits and records previousContent for Undo', async () => {
    const initialCode = '# Heat\nLine 2\n## First Law\nOld law text\n## Second Law\nOld entropy text'
    useWorkspaceStore.setState({
      notes: [{ id: 'note-1', title: 'Thermodynamics', code: initialCode, folderId: '' }],
      selectedNote: { id: 'note-1', title: 'Thermodynamics', code: initialCode, folderId: '' }
    })

    const res = await updateFileTool.execute({
      title: 'Thermodynamics',
      edits: [
        { search: 'Old law text', replace: 'New law text' },
        { search: 'Old entropy text', replace: 'New entropy text' }
      ]
    })

    expect(res.success).toBe(true)
    expect(res.previousContent).toBe(initialCode)
    expect(res.newContent).toContain('New law text')
    expect(res.newContent).toContain('New entropy text')
  })

  it('grepWorkspaceTool searches across workspace notes with 1-indexed line numbers', async () => {
    const res = await grepWorkspaceTool.execute({
      query: 'Integrals',
      folder: 'Math'
    })

    expect(res.success).toBe(true)
    expect(res.matchCount).toBe(1)
    expect(res.matches[0]).toMatchObject({
      title: 'Calculus',
      folder: 'Math',
      line: 1,
      text: '# Integrals'
    })
  })

  it('moveFileTool moves a named note into a destination folder', async () => {
    const res = await moveFileTool.execute({
      title: 'Thermodynamics',
      folder: 'Science/Physics'
    })

    expect(res.success).toBe(true)
    expect(res.title).toBe('Thermodynamics')
    expect(res.folder).toBe('Science/Physics')
    expect(window.api.createFolder).toHaveBeenCalledWith('Science/Physics')
  })

  it('moveFileTool resolves "current" to the active open note', async () => {
    const res = await moveFileTool.execute({
      title: 'current',
      folder: 'Archive'
    })

    expect(res.success).toBe(true)
    expect(res.title).toBe('Thermodynamics')
    expect(res.folder).toBe('Archive')
    expect(window.api.createFolder).toHaveBeenCalledWith('Archive')
  })

  it('moveFileTool moves note to root level when folder is empty string', async () => {
    const res = await moveFileTool.execute({
      title: 'Calculus',
      folder: ''
    })

    expect(res.success).toBe(true)
    expect(res.title).toBe('Calculus')
    expect(res.folder).toBe('')
  })

  it('moveFileTool moves all notes from a source folder when title is all', async () => {
    const res = await moveFileTool.execute({
      title: 'all',
      fromFolder: 'Math',
      folder: 'OldMath'
    })

    expect(res.success).toBe(true)
    expect(res.movedCount).toBe(1)
    expect(res.folder).toBe('OldMath')
  })

  it('moveFileTool returns error when note does not exist', async () => {
    const res = await moveFileTool.execute({
      title: 'NonExistentNote12345',
      folder: 'Archive'
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain('not found in workspace')
  })

  it('deleteFileTool deletes the active note and closes its tab', async () => {
    const res = await deleteFileTool.execute({ title: 'current' })
    expect(res.success).toBe(true)
    expect(res.title).toBe('Thermodynamics')
    expect(
      useWorkspaceStore.getState().deleteNote || useWorkspaceStore.getState().deleteSnippet
    ).toHaveBeenCalledWith('note-1', true)
    expect(useWorkspaceStore.getState().closeTab).toHaveBeenCalledWith('note-1')
  })

  it('renameFileTool renames the active note', async () => {
    const res = await renameFileTool.execute({
      oldTitle: 'current',
      newTitle: 'Advanced Thermodynamics'
    })
    expect(res.success).toBe(true)
    expect(res.oldTitle).toBe('Thermodynamics')
    expect(res.newTitle).toBe('Advanced Thermodynamics')
  })

  it('deleteFolderTool deletes a folder via API', async () => {
    const res = await deleteFolderTool.execute({ path: 'Math' })
    expect(res.success).toBe(true)
    expect(window.api.deleteFolder).toHaveBeenCalledWith('Math')
  })

  it('renameFolderTool renames a folder via API and preserves folder colors', async () => {
    useWorkspaceStore.setState({
      folderColors: { Math: '#ef4444', 'Math/Sub': '#3b82f6' }
    })
    const res = await renameFolderTool.execute({ oldPath: 'Math', newPath: 'Mathematics' })
    expect(res.success).toBe(true)
    expect(window.api.renameFolder).toHaveBeenCalledWith('Math', 'Mathematics')
    expect(useWorkspaceStore.getState().folderColors).toEqual({
      Mathematics: '#ef4444',
      'Mathematics/Sub': '#3b82f6'
    })
    expect(window.api.saveSetting).toHaveBeenCalledWith('folderColors', {
      Mathematics: '#ef4444',
      'Mathematics/Sub': '#3b82f6'
    })
  })

  it('resolveMentions expands @folder mentions and typo-tolerant folder names into all files inside the folder', () => {
    const vaultNotes = [
      { id: 'n1', title: '01 action words', folderId: 'entrichment', code: 'Action words list' },
      { id: 'n2', title: '02 transitions', folderId: 'entrichment', code: 'Transitions list' },
      { id: 'n3', title: 'Other note', folderId: 'General', code: 'General note' }
    ]
    const folders = ['entrichment', 'General']

    // Typo-tolerant @enrichment -> entrichment
    const resolvedFromTypo = resolveMentions('read this @enrichment', [], vaultNotes, folders)
    expect(resolvedFromTypo.map((n) => n.title)).toEqual(['01 action words', '02 transitions'])

    // UI-attached folder mention
    const resolvedFromAttached = resolveMentions(
      'summarize this folder',
      [{ id: 'folder:entrichment', title: 'entrichment', folderId: 'entrichment', isFolder: true }],
      vaultNotes,
      folders
    )
    expect(resolvedFromAttached.map((n) => n.title)).toEqual(['01 action words', '02 transitions'])

    // Implicit folder reference ("enrichment folder")
    const referenced = resolveReferencedFiles('read the enrichment folder', vaultNotes, [], folders)
    expect(referenced.map((n) => n.title)).toEqual(['01 action words', '02 transitions'])
  })

  it('readFileTool reads all files inside a folder when passed a folder name', async () => {
    useWorkspaceStore.setState({
      notes: [
        { id: 'n1', title: '01 action words', folderId: 'entrichment', code: 'Verb 1' },
        { id: 'n2', title: '02 transitions', folderId: 'entrichment', code: 'However, therefore' }
      ],
      snippets: [
        { id: 'n1', title: '01 action words', folderId: 'entrichment', code: 'Verb 1' },
        { id: 'n2', title: '02 transitions', folderId: 'entrichment', code: 'However, therefore' }
      ],
      folders: ['entrichment']
    })

    const readTool = getReadFileTool(false)
    const res = await readTool.execute({ title: 'enrichment' })
    expect(res.success).toBe(true)
    expect(res.fileCount).toBe(2)
    expect(res.content).toContain('01 action words')
    expect(res.content).toContain('02 transitions')
  })
})
