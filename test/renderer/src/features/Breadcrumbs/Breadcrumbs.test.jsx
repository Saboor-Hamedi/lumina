import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Breadcrumbs } from '../../../../../src/renderer/src/features/Breadcrumbs/components/Breadcrumbs'

const mockSnippet = {
  id: 's1',
  title: 'documentation',
  folderId: 'f1',
  code: '# Getting Started\nIntro text\n## Configuration\nConfig text'
}

const mockSaveSnippet = vi.fn()

vi.mock('../../../../../src/renderer/src/features/Breadcrumbs/components/BreadcrumbDropdown', () => ({
  default: ({ parentFolderId, currentId, onClose }) => (
    <div
      data-testid="bc-dropdown"
      data-parent={parentFolderId ?? 'root'}
      data-current={currentId ?? ''}
    >
      <button onClick={onClose}>close</button>
    </div>
  )
}))

vi.mock('../../../../../src/renderer/src/features/Breadcrumbs/components/BreadcrumbOutlineDropdown', () => ({
  default: ({ headings, onClose }) => (
    <div data-testid="bc-outline-dropdown" data-count={headings.length}>
      <button onClick={onClose}>close-outline</button>
    </div>
  )
}))

vi.mock('../../../../../src/renderer/src/core/store/workspaceStore', () => ({
  useWorkspaceStore: (selector) =>
    selector({
      folders: [{ id: 'f1', name: 'src', parentId: null }],
      snippets: [mockSnippet],
      notes: [mockSnippet],
      selectedSnippet: mockSnippet,
      selectedNote: mockSnippet,
      setSelectedSnippet: vi.fn(),
      setSelectedNote: vi.fn(),
      saveSnippet: mockSaveSnippet,
      saveNote: mockSaveSnippet
    })
}))

describe('Breadcrumbs Component', () => {
  it('renders Workspace root, folder, note title, and active heading', () => {
    render(<Breadcrumbs snippet={mockSnippet} />)
    expect(screen.getByText('Workspace')).toBeDefined()
    expect(screen.getByText('src')).toBeDefined()
    expect(screen.getByText('documentation')).toBeDefined()
    expect(screen.getByText('Getting Started')).toBeDefined()
  })

  it('copies full path on clicking dedicated copy path button', () => {
    const writeTextMock = vi.fn()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    })

    render(<Breadcrumbs snippet={mockSnippet} />)
    const copyBtn = screen.getByLabelText('Copy note path')
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('src/documentation')
  })

  it('opens BreadcrumbDropdown with root when Workspace is clicked', () => {
    render(<Breadcrumbs snippet={mockSnippet} />)
    fireEvent.click(screen.getByText('Workspace').closest('button'))
    const dropdown = screen.getByTestId('bc-dropdown')
    expect(dropdown).toBeDefined()
    expect(dropdown.getAttribute('data-parent')).toBe('root')
  })

  it('opens BreadcrumbDropdown with folder parent and current id when a folder segment is clicked', () => {
    render(<Breadcrumbs snippet={mockSnippet} />)
    fireEvent.click(screen.getByText('src').closest('button'))
    const dropdown = screen.getByTestId('bc-dropdown')
    expect(dropdown).toBeDefined()
    expect(dropdown.getAttribute('data-current')).toBe('f1')
  })

  it('opens BreadcrumbDropdown with note folder and current note id when active note is clicked', () => {
    render(<Breadcrumbs snippet={mockSnippet} />)
    fireEvent.click(screen.getByText('documentation').closest('button'))
    const dropdown = screen.getByTestId('bc-dropdown')
    expect(dropdown).toBeDefined()
    expect(dropdown.getAttribute('data-parent')).toBe('f1')
    expect(dropdown.getAttribute('data-current')).toBe('s1')
  })

  it('opens BreadcrumbOutlineDropdown when heading segment is clicked', () => {
    render(<Breadcrumbs snippet={mockSnippet} />)
    fireEvent.click(screen.getByText('Getting Started').closest('button'))
    const outline = screen.getByTestId('bc-outline-dropdown')
    expect(outline).toBeDefined()
    expect(outline.getAttribute('data-count')).toBe('2')
  })

  it('moves note on drag and drop onto a folder segment', async () => {
    render(<Breadcrumbs snippet={mockSnippet} />)
    const folderBtn = screen.getByText('src').closest('button')

    const droppedNote = { id: 's2', title: 'Other note', folderId: 'oldFolder' }
    const dataTransfer = {
      types: ['application/lumina-snippet'],
      dropEffect: 'none',
      getData: (type) =>
        type === 'application/lumina-snippet' ? JSON.stringify(droppedNote) : ''
    }

    fireEvent.dragOver(folderBtn, { dataTransfer })
    await act(async () => {
      fireEvent.drop(folderBtn, { dataTransfer })
    })

    expect(mockSaveSnippet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 's2',
        folderId: 'f1'
      })
    )
  })

  it('opens active segment dropdown on focus-breadcrumbs event', () => {
    render(<Breadcrumbs snippet={mockSnippet} />)
    act(() => {
      document.dispatchEvent(new Event('focus-breadcrumbs', { bubbles: true }))
    })
    const dropdown = screen.getByTestId('bc-dropdown')
    expect(dropdown).toBeDefined()
  })

  it('handles extremely long titles (80 words) with proper title text class', () => {
    const longTitle = Array(80).fill('word').join(' ')
    const longSnippet = { id: 's1', title: longTitle, folderId: 'f1', code: '' }

    const { container } = render(<Breadcrumbs snippet={longSnippet} />)
    const titleSpan = container.querySelector('.breadcrumb-title-text')
    expect(titleSpan).toBeDefined()
    expect(titleSpan.textContent).toBe(longTitle)
  })
})
