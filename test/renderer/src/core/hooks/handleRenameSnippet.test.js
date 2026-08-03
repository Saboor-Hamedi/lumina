import { describe, it, expect, vi } from 'vitest'
import { handleRenameSnippet } from '../../../../../src/renderer/src/core/hooks/handleRenameSnippet'

describe('handleRenameSnippet', () => {
  it('shows error toast when no item in renameModal', async () => {
    const showToast = vi.fn()
    const setRenameModal = vi.fn()

    await handleRenameSnippet({
      renameModal: { isOpen: true, item: null, newName: 'Test' },
      saveSnippet: vi.fn(),
      setSelectedSnippet: vi.fn(),
      setRenameModal,
      setIsCreatingSnippet: vi.fn(),
      showToast
    })

    expect(showToast).toHaveBeenCalledWith('❌ Cannot rename: No note selected.', 'error')
    expect(setRenameModal).toHaveBeenCalledWith({ isOpen: false, item: null })
  })

  it('shows toast when title unchanged', async () => {
    const showToast = vi.fn()
    const setRenameModal = vi.fn()
    const setIsCreatingSnippet = vi.fn()

    await handleRenameSnippet({
      renameModal: {
        isOpen: true,
        item: { id: '1', title: 'Same Title', language: 'markdown' },
        newName: 'Same Title'
      },
      saveSnippet: vi.fn(),
      setSelectedSnippet: vi.fn(),
      setRenameModal,
      setIsCreatingSnippet,
      showToast
    })

    expect(showToast).toHaveBeenCalledWith('No changes', 'info')
    expect(setIsCreatingSnippet).toHaveBeenCalledWith(false)
  })

  it('updates language based on file extension', async () => {
    const saveSnippet = vi.fn()
    const setSelectedSnippet = vi.fn()
    const setRenameModal = vi.fn()
    const setIsCreatingSnippet = vi.fn()

    await handleRenameSnippet({
      renameModal: {
        isOpen: true,
        item: { id: '1', title: 'Old Name', language: 'markdown' },
        newName: 'script.js'
      },
      saveSnippet,
      setSelectedSnippet,
      setRenameModal,
      setIsCreatingSnippet,
      showToast: vi.fn()
    })

    expect(setSelectedSnippet).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'script.js', language: 'javascript' })
    )
    expect(saveSnippet).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'script.js', language: 'javascript' })
    )
  })

  it('defaults to Untitled when newName and item title are empty', async () => {
    const saveSnippet = vi.fn()
    const setSelectedSnippet = vi.fn()

    await handleRenameSnippet({
      renameModal: {
        isOpen: true,
        item: { id: '1', title: '', language: 'markdown' },
        newName: ''
      },
      saveSnippet,
      setSelectedSnippet,
      setRenameModal: vi.fn(),
      setIsCreatingSnippet: vi.fn(),
      showToast: vi.fn()
    })

    expect(saveSnippet).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Untitled' })
    )
  })

  it('reverts optimistic update on save failure', async () => {
    const saveSnippet = vi.fn().mockRejectedValue(new Error('Save failed'))
    const setSelectedSnippet = vi.fn()
    const originalItem = { id: '1', title: 'Original', language: 'markdown' }

    await handleRenameSnippet({
      renameModal: {
        isOpen: true,
        item: originalItem,
        newName: 'New Name'
      },
      saveSnippet,
      setSelectedSnippet,
      setRenameModal: vi.fn(),
      setIsCreatingSnippet: vi.fn(),
      showToast: vi.fn()
    })

    // Should revert to original
    expect(setSelectedSnippet).toHaveBeenLastCalledWith(originalItem)
  })

  it('handles missing showToast gracefully', async () => {
    const saveSnippet = vi.fn()

    await handleRenameSnippet({
      renameModal: {
        isOpen: true,
        item: { id: '1', title: 'Old', language: 'markdown' },
        newName: 'New Name'
      },
      saveSnippet,
      setSelectedSnippet: vi.fn(),
      setRenameModal: vi.fn(),
      setIsCreatingSnippet: vi.fn()
    })

    expect(saveSnippet).toHaveBeenCalled()
  })
})
