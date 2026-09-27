import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NoteOutline from '../../../../../src/renderer/src/features/Inspector/NoteOutline'

describe('NoteOutline Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when note is null', () => {
    render(<NoteOutline note={null} />)
    expect(screen.getByText('Select a note to inspect outline')).toBeInTheDocument()
  })

  it('renders no headings state when note has no markdown headings', async () => {
    const mockNote = {
      id: 'note-no-headings',
      title: 'Simple Note',
      code: 'Plain paragraph text without any heading syntax.'
    }

    render(<NoteOutline note={mockNote} />)

    await waitFor(() => {
      expect(screen.getByText('No headings found in this note')).toBeInTheDocument()
    })
  })

  it('extracts and renders heading hierarchy correctly', async () => {
    const mockNote = {
      id: 'note-with-headings',
      title: 'Architecture Overview',
      code: '# Main Header\nSome intro.\n## Sub Section A\nDetails.\n### Deep Point 1\nMore details.\n## Sub Section B'
    }

    render(<NoteOutline note={mockNote} />)

    await waitFor(() => {
      expect(screen.getByText('Main Header')).toBeInTheDocument()
      expect(screen.getByText('Sub Section A')).toBeInTheDocument()
      expect(screen.getByText('Deep Point 1')).toBeInTheDocument()
      expect(screen.getByText('Sub Section B')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument() // Count badge
    })
  })

  it('filters headings when search input is used', async () => {
    const mockNote = {
      id: 'note-with-headings',
      title: 'Architecture Overview',
      code: '# Introduction\n## System Architecture\n### Storage Engine\n## Conclusion'
    }

    const { container } = render(<NoteOutline note={mockNote} />)

    await waitFor(() => {
      expect(screen.getByText('System Architecture')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Filter outline...')
    fireEvent.change(searchInput, { target: { value: 'storage' } })

    expect(container.textContent).toContain('Storage Engine')
    expect(container.textContent).not.toContain('Introduction')
  })

  it('dispatches editor-scroll-to-line event on click', async () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent')

    const mockNote = {
      id: 'note-with-headings',
      title: 'Architecture Overview',
      code: '# First Line\n## Second Header'
    }

    render(<NoteOutline note={mockNote} />)

    await waitFor(() => {
      expect(screen.getByText('Second Header')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Second Header'))

    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'editor-scroll-to-line',
        detail: { line: 2 }
      })
    )
  })
})
