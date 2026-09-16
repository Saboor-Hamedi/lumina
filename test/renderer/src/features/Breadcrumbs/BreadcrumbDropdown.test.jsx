import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import BreadcrumbDropdown from '../../../../../src/renderer/src/features/Breadcrumbs/components/BreadcrumbDropdown'

const mockFolders = [
  { id: 'f1', name: 'src', parentId: null },
  { id: 'f2', name: 'components', parentId: 'f1' },
  { id: 'f3', name: 'utils', parentId: 'f1' }
]

const mockSnippets = [
  { id: 's1', title: 'README', folderId: 'f1' },
  { id: 's2', title: 'Button', folderId: 'f2' }
]

const mockSetSelectedSnippet = vi.fn()
const mockSaveSnippet = vi.fn().mockResolvedValue({})

vi.mock('../../../../../src/renderer/src/core/store/workspaceStore', () => ({
  useWorkspaceStore: (selector) =>
    selector({
      folders: mockFolders,
      snippets: mockSnippets,
      setSelectedSnippet: mockSetSelectedSnippet,
      saveSnippet: mockSaveSnippet
    })
}))

const anchorRect = {
  left: 100,
  top: 20,
  bottom: 40,
  right: 180,
  width: 80,
  height: 20
}

describe('BreadcrumbDropdown', () => {
  beforeEach(() => {
    mockSetSelectedSnippet.mockClear()
    mockSaveSnippet.mockClear()
  })

  it('renders root-level folders and notes when parentFolderId is null', () => {
    render(<BreadcrumbDropdown parentFolderId={null} anchorRect={anchorRect} onClose={vi.fn()} />)
    expect(screen.getByText('src')).toBeDefined()
    expect(screen.queryByText('components')).toBeNull()
    expect(screen.queryByText('README')).toBeNull()
  })

  it('renders children of the given folder', () => {
    render(<BreadcrumbDropdown parentFolderId="f1" anchorRect={anchorRect} onClose={vi.fn()} />)
    expect(screen.getByText('components')).toBeDefined()
    expect(screen.getByText('utils')).toBeDefined()
    expect(screen.getByText('README')).toBeDefined()
    expect(screen.queryByText('Button')).toBeNull()
  })

  it('drills into a subfolder on click', () => {
    render(<BreadcrumbDropdown parentFolderId="f1" anchorRect={anchorRect} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('components'))
    expect(screen.getByText('Button')).toBeDefined()
  })

  it('drills back out via the back button', () => {
    render(<BreadcrumbDropdown parentFolderId="f1" anchorRect={anchorRect} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('components'))
    expect(screen.getByText('Button')).toBeDefined()
    fireEvent.click(screen.getByLabelText('Navigate to parent folder'))
    expect(screen.getByText('README')).toBeDefined()
    expect(screen.queryByText('Button')).toBeNull()
  })

  it('filters items via the search input', () => {
    render(<BreadcrumbDropdown parentFolderId="f1" anchorRect={anchorRect} onClose={vi.fn()} />)
    const searchInput = screen.getByPlaceholderText('Filter files & folders...')
    fireEvent.change(searchInput, { target: { value: 'uti' } })
    expect(screen.getByText('utils')).toBeDefined()
    expect(screen.queryByText('components')).toBeNull()
    expect(screen.queryByText('README')).toBeNull()
  })

  it('calls setSelectedSnippet and onClose when a note is clicked', () => {
    const onClose = vi.fn()
    render(<BreadcrumbDropdown parentFolderId="f1" anchorRect={anchorRect} onClose={onClose} />)
    fireEvent.click(screen.getByText('README'))
    expect(mockSetSelectedSnippet).toHaveBeenCalledWith(mockSnippets[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('creates new note in folder when plus button is clicked', async () => {
    const onClose = vi.fn()
    render(<BreadcrumbDropdown parentFolderId="f1" anchorRect={anchorRect} onClose={onClose} />)
    const plusBtn = screen.getByLabelText('New note in components')
    await act(async () => {
      fireEvent.click(plusBtn)
    })
    expect(mockSaveSnippet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Untitled',
        folderId: 'f2'
      })
    )
    expect(mockSetSelectedSnippet).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('shows empty folder message when folder has no children', () => {
    render(<BreadcrumbDropdown parentFolderId="f3" anchorRect={anchorRect} onClose={vi.fn()} />)
    expect(screen.getByText('Empty folder')).toBeDefined()
  })

  it('keeps dropdown open when searching and user presses Enter on a note', () => {
    const onClose = vi.fn()
    render(<BreadcrumbDropdown parentFolderId="f1" anchorRect={anchorRect} onClose={onClose} />)
    const searchInput = screen.getByPlaceholderText('Filter files & folders...')
    fireEvent.change(searchInput, { target: { value: 'READ' } })
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(mockSetSelectedSnippet).toHaveBeenCalledWith(mockSnippets[0])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<BreadcrumbDropdown parentFolderId="f1" anchorRect={anchorRect} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
