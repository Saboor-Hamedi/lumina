import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import NoteDetails from '../../../../../src/renderer/src/features/Inspector/NoteDetails'

vi.mock('../../../../../src/renderer/src/core/store/workspaceStore', () => ({
  useVaultStore: (selector) =>
    selector({
      pinnedTabIds: []
    })
}))

vi.mock('../../../../../src/renderer/src/core/store/useSettingsStore', () => ({
  useSettingsStore: {
    getState: () => ({
      settings: { vaultPath: 'Default Workspace' }
    })
  }
}))

describe('NoteDetails Component', () => {
  const mockSnippet = {
    id: 'note-uuid-5678',
    title: 'Lumina Architecture',
    folderId: 'docs',
    timestamp: 1725264000000,
    language: 'markdown',
    code: 'This note describes the system architecture and state flow.',
    customIcon: null,
    tags: ['lumina', 'architecture']
  }

  it('renders properties and statistics correctly', () => {
    render(<NoteDetails snippet={mockSnippet} />)
    expect(screen.getByText('note-uuid-5678')).toBeDefined()
    expect(screen.getByText('Lumina Architecture')).toBeDefined()
    expect(screen.getByText('9')).toBeDefined()
  })

  it('copies note ID to clipboard on click', () => {
    const writeTextMock = vi.fn()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    })

    render(<NoteDetails snippet={mockSnippet} />)
    const idRow = screen.getByText('note-uuid-5678')
    fireEvent.click(idRow)

    expect(writeTextMock).toHaveBeenCalledWith('note-uuid-5678')
  })
})
