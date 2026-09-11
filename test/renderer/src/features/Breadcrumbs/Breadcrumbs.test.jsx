import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Breadcrumbs } from '../../../../../src/renderer/src/features/Breadcrumbs/Breadcrumbs'

const mockSnippet = { id: 's1', title: 'documentation', folderId: 'f1' }

vi.mock('../../../../../src/renderer/src/core/store/workspaceStore', () => ({
  useVaultStore: (selector) =>
    selector({
      folders: [{ id: 'f1', name: 'src', parentId: null }],
      snippets: [mockSnippet],
      selectedSnippet: mockSnippet
    })
}))

describe('Breadcrumbs Component', () => {
  it('renders Vault root and note title', () => {
    render(<Breadcrumbs snippet={mockSnippet} />)
    expect(screen.getByText('Vault')).toBeDefined()
    expect(screen.getByText('src')).toBeDefined()
    expect(screen.getByText('documentation')).toBeDefined()
  })

  it('copies full path on clicking active note title', () => {
    const writeTextMock = vi.fn()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    })

    render(<Breadcrumbs snippet={mockSnippet} />)
    const activeItem = screen.getByText('documentation')
    fireEvent.click(activeItem)

    expect(writeTextMock).toHaveBeenCalledWith('src/documentation')
  })

  it('handles extremely long titles (80 words) with proper title text class and copy path', () => {
    const longTitle = Array(80).fill('word').join(' ')
    const longSnippet = { id: 's1', title: longTitle, folderId: 'f1' }

    const writeTextMock = vi.fn()
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    })

    const { container } = render(<Breadcrumbs snippet={longSnippet} />)
    const titleSpan = container.querySelector('.breadcrumb-title-text')
    expect(titleSpan).toBeDefined()
    expect(titleSpan.textContent).toBe(longTitle)

    fireEvent.click(titleSpan.closest('button'))
    expect(writeTextMock).toHaveBeenCalledWith(`src/${longTitle}`)
  })
})
