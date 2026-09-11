import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Breadcrumbs } from '../../../../../src/renderer/src/features/Breadcrumbs/Breadcrumbs'

const mockSnippet = { id: 's1', title: 'documentation', folderId: 'f1' }

vi.mock('../../../../../src/renderer/src/features/Breadcrumbs/BreadcrumbDropdown', () => ({
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

vi.mock('../../../../../src/renderer/src/core/store/workspaceStore', () => ({
  useVaultStore: (selector) =>
    selector({
      folders: [{ id: 'f1', name: 'src', parentId: null }],
      snippets: [mockSnippet],
      selectedSnippet: mockSnippet,
      setSelectedSnippet: vi.fn()
    })
}))

describe('Breadcrumbs Component', () => {
  it('renders Workspace root, folder, and note title', () => {
    render(<Breadcrumbs snippet={mockSnippet} />)
    expect(screen.getByText('Workspace')).toBeDefined()
    expect(screen.getByText('src')).toBeDefined()
    expect(screen.getByText('documentation')).toBeDefined()
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

  it('closes BreadcrumbDropdown when onClose is called', () => {
    render(<Breadcrumbs snippet={mockSnippet} />)
    fireEvent.click(screen.getByText('src').closest('button'))
    expect(screen.getByTestId('bc-dropdown')).toBeDefined()
    fireEvent.click(screen.getByText('close'))
    expect(screen.queryByTestId('bc-dropdown')).toBeNull()
  })

  it('handles extremely long titles (80 words) with proper title text class', () => {
    const longTitle = Array(80).fill('word').join(' ')
    const longSnippet = { id: 's1', title: longTitle, folderId: 'f1' }

    const { container } = render(<Breadcrumbs snippet={longSnippet} />)
    const titleSpan = container.querySelector('.breadcrumb-title-text')
    expect(titleSpan).toBeDefined()
    expect(titleSpan.textContent).toBe(longTitle)
  })
})
