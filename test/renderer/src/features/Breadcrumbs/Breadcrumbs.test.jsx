import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Breadcrumbs } from '../../../../../src/renderer/src/features/Breadcrumbs/Breadcrumbs'

vi.mock('../../../../../src/renderer/src/core/store/workspaceStore', () => ({
  useVaultStore: (selector) =>
    selector({
      folders: [{ id: 'f1', name: 'src', parentId: null }],
      selectedSnippet: { id: 's1', title: 'documentation', folderId: 'f1' }
    })
}))

describe('Breadcrumbs Component', () => {
  it('renders Vault root and note title', () => {
    render(<Breadcrumbs />)
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

    render(<Breadcrumbs />)
    const activeItem = screen.getByText('documentation')
    fireEvent.click(activeItem)

    expect(writeTextMock).toHaveBeenCalledWith('src/documentation')
  })
})
