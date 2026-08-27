import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useContextMenu } from '../../../../../../src/renderer/src/features/Navigation/hooks/useContextMenu'
import { useVaultStore } from '../../../../../../src/renderer/src/core/store/useVaultStore'
import { useSettingsStore } from '../../../../../../src/renderer/src/core/store/useSettingsStore'

describe('useContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useVaultStore.setState({
      snippets: [],
      clipboard: null,
      folderColors: {}
    })
    useSettingsStore.setState({ settings: {} })
  })

  function setup(callbacks = {}, item = {}, type = 'file') {
    return renderHook(() => useContextMenu({ item, type, callbacks }))
  }

  it('returns file options with expected labels', () => {
    const { result } = setup({}, { id: '1', title: 'Note', fileName: 'note.md', folderId: null }, 'file')
    const labels = result.current.map((o) => o.label)
    expect(labels).toContain('Open')
    expect(labels).toContain('Rename')
    expect(labels).toContain('Copy')
    expect(labels).toContain('Cut')
    expect(labels).toContain('Paste')
    expect(labels).toContain('Delete')
    expect(labels).toContain('Background')
    expect(labels).toContain('Close')
  })

  it('Open calls window.api.openFile', () => {
    global.window.api = global.window.api || {}
    const openFile = vi.fn()
    global.window.api.openFile = openFile
    const onClose = vi.fn()
    const { result } = setup({ onClose }, { id: '1', fileName: 'n.md' }, 'file')

    result.current.find((o) => o.label === 'Open').onClick()
    expect(openFile).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('Rename calls onRename callback', () => {
    const onRename = vi.fn()
    const onClose = vi.fn()
    const { result } = setup({ onRename, onClose }, { id: '1' }, 'file')

    result.current.find((o) => o.label === 'Rename').onClick()
    expect(onRename).toHaveBeenCalled()
  })

  it('Copy sets clipboard with copy action', () => {
    const item = { id: '1', title: 'Note', fileName: 'n.md' }
    const onClose = vi.fn()
    const { result } = setup({ onClose }, item, 'file')

    result.current.find((o) => o.label === 'Copy').onClick()
    expect(useVaultStore.getState().clipboard).toEqual({ action: 'copy', item })
    expect(onClose).toHaveBeenCalled()
  })

  it('Cut sets clipboard with cut action', () => {
    const item = { id: '1', title: 'Note', fileName: 'n.md' }
    const onClose = vi.fn()
    const { result } = setup({ onClose }, item, 'file')

    result.current.find((o) => o.label === 'Cut').onClick()
    expect(useVaultStore.getState().clipboard).toEqual({ action: 'cut', item })
  })

  it('Paste is disabled when clipboard is empty', () => {
    const { result } = setup({}, {}, 'file')
    expect(result.current.find((o) => o.label === 'Paste').disabled).toBe(true)
  })

  it('Paste copies a snippet into target folder', async () => {
    const item = { id: '1', title: 'Note', fileName: 'n.md', folderId: null }
    useVaultStore.setState({ clipboard: { action: 'copy', item }, snippets: [] })
    const saveSnippet = vi.fn().mockResolvedValue(undefined)
    useVaultStore.setState({ saveSnippet })
    const onClose = vi.fn()

    const { result } = setup({ onClose }, '2', 'folder')
    await result.current.find((o) => o.label === 'Paste').onClick()

    expect(saveSnippet).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Note (Copy)', folderId: '2' })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('Paste with cut action moves snippet and clears clipboard', async () => {
    const item = { id: '1', title: 'Note', fileName: 'n.md', folderId: null }
    useVaultStore.setState({ clipboard: { action: 'cut', item }, snippets: [] })
    const saveSnippet = vi.fn().mockResolvedValue(undefined)
    useVaultStore.setState({ saveSnippet })
    const onClose = vi.fn()

    const { result } = setup({ onClose }, '2', 'folder')
    await result.current.find((o) => o.label === 'Paste').onClick()

    expect(saveSnippet).toHaveBeenCalledWith(expect.objectContaining({ folderId: '2' }))
    expect(useVaultStore.getState().clipboard).toBeNull()
  })

  it('returns folder options with New Note / New Folder', () => {
    const { result } = setup({}, '2', 'folder')
    const labels = result.current.map((o) => o.label)
    expect(labels).toContain('New Note')
    expect(labels).toContain('New Folder')
    expect(labels).toContain('Rename')
    expect(labels).toContain('Delete')
  })

  it('returns body options (no item) without Rename/Delete for folder', () => {
    const { result } = setup({}, null, 'body')
    const labels = result.current.map((o) => o.label)
    expect(labels).toContain('New Note')
    expect(labels).toContain('New Folder')
    expect(labels).not.toContain('Rename')
    expect(labels).not.toContain('Delete')
  })

  it('Delete calls onDelete for file', () => {
    const onDelete = vi.fn()
    const onClose = vi.fn()
    const { result } = setup({ onDelete, onClose }, { id: '1' }, 'file')

    result.current.find((o) => o.label === 'Delete').onClick()
    expect(onDelete).toHaveBeenCalled()
  })

  it('returns empty array for unknown type', () => {
    const { result } = setup({}, null, 'unknown')
    expect(result.current).toEqual([])
  })

  it('color picker saves snippet color', async () => {
    const item = { id: '1', title: 'Note', fileName: 'n.md', color: null }
    const saveSnippet = vi.fn().mockResolvedValue(undefined)
    useVaultStore.setState({ saveSnippet })
    const { result } = setup({}, item, 'file')

    const bg = result.current.find((o) => o.label === 'Background')
    const blue = bg.children.find((c) => c.label === 'Blue')
    await blue.onClick()
    expect(saveSnippet).toHaveBeenCalledWith({ ...item, color: '#60a5fa' })
  })
})
