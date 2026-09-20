import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { LuminaIndexBadge } from '../../../../../../src/renderer/src/features/AI/components/LuminaIndexBadge'
import * as chatLinkModule from '../../../../../../src/renderer/src/features/AI/components/LuminaChatLink'

describe('LuminaIndexBadge Component', () => {
  it('renders streaming / querying state with scanner beam', () => {
    render(<LuminaIndexBadge isStreaming={true} />)

    expect(screen.getByText('Querying Workspace Index...')).toBeInTheDocument()
    const card = document.querySelector('.lumina-index-card')
    expect(card).toHaveClass('querying')
  })

  it('renders completed query results and filter pills', () => {
    const payload = JSON.stringify({
      totalWorkspaceNotes: 10,
      totalMatched: 2,
      filters: {
        tag: 'research',
        folder: 'Science'
      },
      notes: [
        {
          id: 'n1',
          title: 'Quantum Computing',
          folder: 'Science',
          tags: ['research', 'physics'],
          outgoingLinks: ['Quantum Algorithms'],
          backlinksCount: 3
        },
        {
          id: 'n2',
          title: 'Quantum Algorithms',
          folder: 'Science',
          tags: ['research'],
          outgoingLinks: [],
          backlinksCount: 1
        }
      ],
      isQuerying: false
    })

    render(<LuminaIndexBadge content={payload} isStreaming={false} />)

    expect(screen.getByText('Workspace Index Query')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/notes matched/)).toBeInTheDocument()
    expect(screen.getByText('#research')).toBeInTheDocument()
    expect(screen.getByText('Science')).toBeInTheDocument()
  })

  it('expands drawer on header click and allows clicking notes to open', () => {
    const openSpy = vi.spyOn(chatLinkModule, 'openNoteInEditor').mockImplementation(() => {})

    const payload = JSON.stringify({
      totalWorkspaceNotes: 5,
      totalMatched: 1,
      filters: { query: 'algorithms' },
      notes: [
        {
          id: 'n1',
          title: 'Quantum Algorithms',
          folder: 'Science',
          tags: ['quantum'],
          outgoingLinks: ['Linear Algebra'],
          backlinksCount: 2
        }
      ],
      isQuerying: false
    })

    render(<LuminaIndexBadge content={payload} isStreaming={false} />)

    // Initially collapsed
    expect(screen.queryByText('Quantum Algorithms')).not.toBeInTheDocument()

    // Click header to expand
    const header = document.querySelector('.lumina-index-header')
    expect(header).toBeTruthy()
    fireEvent.click(header!)

    // Now note row is visible
    expect(screen.getByText('Quantum Algorithms')).toBeInTheDocument()

    // Click note row
    const noteRow = document.querySelector('.lumina-index-note-row')
    expect(noteRow).toBeTruthy()
    fireEvent.click(noteRow!)

    expect(openSpy).toHaveBeenCalledWith('Quantum Algorithms')
    openSpy.mockRestore()
  })

  it('falls back safely when input is plain text or empty', () => {
    render(<LuminaIndexBadge content="Found **3** matching notes out of 10 total" />)

    expect(screen.getByText('Workspace Index Query')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
