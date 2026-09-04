import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFolderTool } from '../../../../../../src/renderer/src/features/AI/tools/createFolder'
import { createFileTool } from '../../../../../../src/renderer/src/features/AI/tools/createFile'
import { moveFileTool } from '../../../../../../src/renderer/src/features/AI/tools/moveFile'
import { deleteFileTool } from '../../../../../../src/renderer/src/features/AI/tools/deleteFile'
import { renameFileTool } from '../../../../../../src/renderer/src/features/AI/tools/renameFile'
import { deleteFolderTool } from '../../../../../../src/renderer/src/features/AI/tools/deleteFolder'
import { renameFolderTool } from '../../../../../../src/renderer/src/features/AI/tools/renameFolder'
import { useVaultStore } from '../../../../../../src/renderer/src/core/store/workspaceStore'

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

    useVaultStore.setState({
      snippets: [
        { id: 'note-1', title: 'Thermodynamics', code: '# Heat', folderId: '', fileName: 'Thermodynamics.md' },
        { id: 'note-2', title: 'Calculus', code: '# Integrals', folderId: 'Math', fileName: 'Calculus.md' }
      ],
      selectedSnippet: { id: 'note-1', title: 'Thermodynamics', code: '# Heat', folderId: '', fileName: 'Thermodynamics.md' },
      folders: ['Math'],
      activeTabId: 'note-1',
      openTabs: ['note-1'],
      loadVault: vi.fn().mockResolvedValue(true),
      deleteSnippet: vi.fn().mockResolvedValue(true),
      closeTab: vi.fn()
    })
  })

  it('createFolderTool creates a folder and triggers vault reload', async () => {
    const res = await createFolderTool.execute({ path: 'Science/Physics' })
    expect(res.success).toBe(true)
    expect(res.path).toBe('Science/Physics')
    expect(window.api.createFolder).toHaveBeenCalledWith('Science/Physics')
    expect(useVaultStore.getState().loadVault).toHaveBeenCalled()
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

  it('moveFileTool resolves "current" to the active open snippet', async () => {
    const res = await moveFileTool.execute({
      title: 'current',
      folder: 'Archive'
    })

    expect(res.success).toBe(true)
    expect(res.title).toBe('Thermodynamics')
    expect(res.folder).toBe('Archive')
    expect(window.api.createFolder).toHaveBeenCalledWith('Archive')
  })

  it('deleteFileTool deletes the active note and closes its tab', async () => {
    const res = await deleteFileTool.execute({ title: 'current' })
    expect(res.success).toBe(true)
    expect(res.title).toBe('Thermodynamics')
    expect(useVaultStore.getState().deleteSnippet).toHaveBeenCalledWith('note-1', true)
    expect(useVaultStore.getState().closeTab).toHaveBeenCalledWith('note-1')
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

  it('renameFolderTool renames a folder via API', async () => {
    const res = await renameFolderTool.execute({ oldPath: 'Math', newPath: 'Mathematics' })
    expect(res.success).toBe(true)
    expect(window.api.renameFolder).toHaveBeenCalledWith('Math', 'Mathematics')
  })
})
