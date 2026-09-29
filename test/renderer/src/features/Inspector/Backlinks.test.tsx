import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Backlinks from '../../../../../src/renderer/src/features/Inspector/Backlinks'
import { useWorkspaceStore } from '../../../../../src/renderer/src/core/store/workspaceStore'

describe('Backlinks Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({
      notes: [
        {
          id: 'note-1',
          title: 'Astrophysics',
          fileName: 'Astrophysics.md',
          code: 'Introduction to [[Quantum Physics]] and mechanics.\nAnother line with [[Quantum Physics|QP basics]].'
        },
        {
          id: 'note-2',
          title: 'Philosophy of Mind',
          fileName: 'Philosophy of Mind.md',
          code: 'This note mentions Quantum Physics in plain text without a link.'
        },
        {
          id: 'target-note',
          title: 'Quantum Physics',
          fileName: 'Quantum Physics.md',
          code: 'Main target note content.'
        }
      ]
    })
  })

  it('renders empty state when note is null', () => {
    render(<Backlinks note={null} />)
    expect(screen.getByText('Select a note to inspect backlinks')).toBeInTheDocument()
  })

  it('detects and lists linked mentions and unlinked mentions', async () => {
    const targetNote = {
      id: 'target-note',
      title: 'Quantum Physics',
      fileName: 'Quantum Physics.md'
    }

    const { container } = render(<Backlinks note={targetNote} />)

    // Check section titles
    expect(screen.getByText('Linked Mentions')).toBeInTheDocument()
    expect(screen.getByText('Unlinked Mentions')).toBeInTheDocument()

    // Wait for async backlinks data to load
    await waitFor(() => {
      expect(screen.getByText('2 links')).toBeInTheDocument()
    })

    expect(screen.getByText('Astrophysics')).toBeInTheDocument()
    expect(container.textContent).toContain('Introduction to [[Quantum Physics]] and mechanics.')
    expect(container.textContent).toContain('Another line with [[Quantum Physics|QP basics]].')

    // Note 2 has 1 unlinked mention
    expect(screen.getByText('1 mention')).toBeInTheDocument()
    expect(screen.getByText('Philosophy of Mind')).toBeInTheDocument()
    expect(container.textContent).toContain('This note mentions Quantum Physics in plain text without a link.')
  })

  it('filters backlinks when typing in search input', async () => {
    const targetNote = {
      id: 'target-note',
      title: 'Quantum Physics',
      fileName: 'Quantum Physics.md'
    }

    const { container } = render(<Backlinks note={targetNote} />)

    // Wait for async backlinks data to load
    await waitFor(() => {
      expect(screen.getByText('2 links')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Filter backlinks...')
    fireEvent.change(searchInput, { target: { value: 'basics' } })

    // Only the second mention with "basics" should be visible in linked mentions
    expect(container.textContent).toContain('Another line with [[Quantum Physics|QP basics]].')
    expect(container.textContent).not.toContain('Introduction to [[Quantum Physics]] and mechanics.')
  })

  it('navigates to source note when clicking note title', async () => {
    const setSelectedNoteSpy = vi.fn()
    useWorkspaceStore.setState({ setSelectedNote: setSelectedNoteSpy })

    const targetNote = {
      id: 'target-note',
      title: 'Quantum Physics',
      fileName: 'Quantum Physics.md'
    }

    render(<Backlinks note={targetNote} />)

    // Wait for async backlinks data to load
    const noteTitle = await screen.findByText('Philosophy of Mind')
    fireEvent.click(noteTitle)

    expect(setSelectedNoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'note-2', title: 'Philosophy of Mind' })
    )
  })
})
