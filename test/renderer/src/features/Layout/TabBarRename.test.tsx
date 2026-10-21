import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TabBar from '../../../../../src/renderer/src/features/Layout/TabBar'
import { useWorkspaceStore } from '../../../../../src/renderer/src/core/store/workspaceStore'

describe('TabBar Renaming & Double-Click', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const testNotes = [
      { id: 'note-1', title: 'First Note', code: '', tags: '' },
      { id: 'note-2', title: 'Second Note', code: '', tags: '' }
    ]
    useWorkspaceStore.setState({
      notes: testNotes,
      snippets: testNotes,
      openTabs: ['note-1', 'note-2'],
      activeTabId: 'note-1',
      pinnedTabIds: []
    } as any)
  })

  it('dispatches open-rename-modal on tab double click', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    render(<TabBar />)

    const tab = screen.getByText('First Note')
    fireEvent.doubleClick(tab)

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'open-rename-modal',
        detail: expect.objectContaining({
          note: expect.objectContaining({ id: 'note-1', title: 'First Note' })
        })
      })
    )
  })

  it('shows Rename Note in context menu and dispatches event when clicked', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    render(<TabBar />)

    const tab = screen.getByText('Second Note')
    fireEvent.contextMenu(tab)

    const renameOption = screen.getByText('Rename Note')
    expect(renameOption).toBeInTheDocument()

    fireEvent.click(renameOption)
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'open-rename-modal',
        detail: expect.objectContaining({
          note: expect.objectContaining({ id: 'note-2', title: 'Second Note' })
        })
      })
    )
  })
})
