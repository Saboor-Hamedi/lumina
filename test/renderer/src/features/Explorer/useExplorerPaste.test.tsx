import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExplorerPaste } from '../../../../../src/renderer/src/features/Explorer/useExplorerPaste'

describe('useExplorerPaste Image Ingestion & Focus Routing', () => {
  let sidebar: HTMLDivElement
  let explorer: HTMLDivElement
  let loadWorkspaceMock: ReturnType<typeof vi.fn>
  let handleSelectMock: ReturnType<typeof vi.fn>
  let clearSelectionMock: ReturnType<typeof vi.fn>
  let toastEvents: CustomEvent[]

  let toastListener: (e: Event) => void

  beforeEach(() => {
    toastEvents = []
    toastListener = (e: Event) => {
      toastEvents.push(e as CustomEvent)
    }
    window.addEventListener('show-toast', toastListener)

    sidebar = document.createElement('div')
    sidebar.className = 'shell-sidebar-left'
    explorer = document.createElement('div')
    explorer.className = 'explorer-embedded-container'
    sidebar.appendChild(explorer)
    document.body.appendChild(sidebar)

    loadWorkspaceMock = vi.fn().mockResolvedValue(undefined)
    handleSelectMock = vi.fn()
    clearSelectionMock = vi.fn()

    ;(window as any).api = {
      saveVaultImage: vi.fn().mockResolvedValue({ relativePath: 'images/pasted.png', fileName: 'pasted.png' }),
      readClipboardImageBuffer: vi.fn().mockResolvedValue(null)
    }
  })

  afterEach(() => {
    window.removeEventListener('show-toast', toastListener)
    if (sidebar.parentNode) document.body.removeChild(sidebar)
    delete (window as any).api
    vi.clearAllMocks()
  })

  it('pastes clipboard image file into target folder when inside explorer', async () => {
    renderHook(() =>
      useExplorerPaste({
        lastClickedFolder: 'Projects/Lumina',
        loadWorkspace: loadWorkspaceMock,
        handleSelect: handleSelectMock,
        selectedNoteIds: new Set(),
        selectedFolderIds: new Set(),
        clearSelection: clearSelectionMock
      })
    )

    const file = new File([new Uint8Array([1, 2, 3])], 'diagram.png', { type: 'image/png' })
    // Ensure arrayBuffer works in test environment
    file.arrayBuffer = async () => new Uint8Array([1, 2, 3]).buffer

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any
    pasteEvent.clipboardData = {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      files: [file]
    }

    await act(async () => {
      explorer.dispatchEvent(pasteEvent)
    })

    expect((window as any).api.saveVaultImage).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'Projects/Lumina',
      'diagram.png'
    )
    expect(loadWorkspaceMock).toHaveBeenCalled()
    expect(toastEvents.length).toBe(1)
    expect(toastEvents[0].detail.message).toBe('Pasted image into "Projects/Lumina"')
    expect(toastEvents[0].detail.type).toBe('success')
  })

  it('uses readClipboardImageBuffer fallback when clipboard files are empty (native copy)', async () => {
    const rawBuffer = new Uint8Array([137, 80, 78, 71]) // PNG magic bytes
    ;(window as any).api.readClipboardImageBuffer = vi.fn().mockResolvedValue(rawBuffer)

    renderHook(() =>
      useExplorerPaste({
        lastClickedFolder: null,
        loadWorkspace: loadWorkspaceMock,
        handleSelect: handleSelectMock,
        selectedNoteIds: new Set(),
        selectedFolderIds: new Set(),
        clearSelection: clearSelectionMock
      })
    )

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any
    pasteEvent.clipboardData = {
      items: [],
      files: []
    }

    await act(async () => {
      explorer.dispatchEvent(pasteEvent)
    })

    expect((window as any).api.readClipboardImageBuffer).toHaveBeenCalled()
    expect((window as any).api.saveVaultImage).toHaveBeenCalledWith(
      rawBuffer,
      '',
      expect.stringMatching(/^Pasted image \d+\.png$/)
    )
    expect(toastEvents.length).toBe(1)
    expect(toastEvents[0].detail.message).toBe('Pasted image into vault')
  })

  it('does NOT paste into explorer when event target is not inside explorer or sidebar', async () => {
    renderHook(() =>
      useExplorerPaste({
        lastClickedFolder: null,
        loadWorkspace: loadWorkspaceMock,
        handleSelect: handleSelectMock,
        selectedNoteIds: new Set(),
        selectedFolderIds: new Set(),
        clearSelection: clearSelectionMock
      })
    )

    const outsideDiv = document.createElement('div')
    outsideDiv.className = 'some-other-container'
    document.body.appendChild(outsideDiv)

    const file = new File([new Uint8Array([1, 2, 3])], 'diagram.png', { type: 'image/png' })
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true }) as any
    pasteEvent.clipboardData = {
      items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
      files: [file]
    }

    await act(async () => {
      outsideDiv.dispatchEvent(pasteEvent)
    })

    expect((window as any).api.saveVaultImage).not.toHaveBeenCalled()
    expect(toastEvents.length).toBe(0)

    document.body.removeChild(outsideDiv)
  })

  it('snapshots multi-selected files (markdown, pdf, image) and executes bulkDelete cleanly', async () => {
    ;(window as any).api.bulkDelete = vi.fn().mockResolvedValue({ success: true, deletedCount: 3 })

    const selectedNotes = new Set(['note-md-1', 'pdf-abc456', 'img-def789'])
    const selectedFolders = new Set(['folder-archive'])

    const { result, rerender } = renderHook(
      ({ noteIds, folderIds }) =>
        useExplorerPaste({
          lastClickedFolder: null,
          loadWorkspace: loadWorkspaceMock,
          handleSelect: handleSelectMock,
          selectedNoteIds: noteIds,
          selectedFolderIds: folderIds,
          clearSelection: clearSelectionMock
        }),
      {
        initialProps: {
          noteIds: selectedNotes,
          folderIds: selectedFolders
        }
      }
    )

    expect(result.current.totalSelectedCount).toBe(4)

    // Open bulk delete modal (which snapshots selection)
    act(() => {
      result.current.setBulkDeleteModalOpen(true)
    })

    expect(result.current.bulkDeleteModalOpen).toBe(true)

    // Even if external interaction attempts to clear the props while modal is open:
    rerender({
      noteIds: new Set(),
      folderIds: new Set()
    })

    // Total count is preserved via snapshot!
    expect(result.current.totalSelectedCount).toBe(4)

    // Confirm deletion
    await act(async () => {
      await result.current.handleConfirmBulkDelete()
    })

    expect((window as any).api.bulkDelete).toHaveBeenCalledWith({
      folderIds: ['folder-archive'],
      snippetIds: ['note-md-1', 'pdf-abc456', 'img-def789']
    })
    expect(clearSelectionMock).toHaveBeenCalled()
    expect(loadWorkspaceMock).toHaveBeenCalled()
    expect(result.current.bulkDeleteModalOpen).toBe(false)
    expect(toastEvents.length).toBe(1)
    expect(toastEvents[0].detail.message).toBe('Deleted 4 items')
  })
})
