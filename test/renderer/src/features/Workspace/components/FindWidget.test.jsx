import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import FindWidget from '../../../../../../src/renderer/src/features/Workspace/components/FindWidget'

describe('FindWidget.jsx', () => {
  const mockEditorView = {
    state: {
      doc: {
        toString: () => 'The quick brown fox jumps over the lazy dog.',
        length: 44
      },
      selection: {
        main: { from: 0, to: 0 }
      }
    },
    dispatch: vi.fn(),
    focus: vi.fn()
  }

  it('renders search input with role="searchbox" and accessibility labels', () => {
    const onClose = vi.fn()
    render(<FindWidget editorView={mockEditorView} onClose={onClose} />)

    const searchInput = screen.getByRole('searchbox')
    expect(searchInput).toBeDefined()
    expect(searchInput.getAttribute('placeholder')).toBe('Find')

    expect(screen.getByLabelText('Match Case (Alt+C)')).toBeDefined()
    expect(screen.getByLabelText('Match Whole Word (Alt+W)')).toBeDefined()
    expect(screen.getByLabelText('Use Regular Expression (Alt+R)')).toBeDefined()
    expect(screen.getByLabelText('Close (Escape)')).toBeDefined()
  })

  it('toggles match case, whole word, and regex states on click', () => {
    const onClose = vi.fn()
    render(<FindWidget editorView={mockEditorView} onClose={onClose} />)

    const matchCaseBtn = screen.getByLabelText('Match Case (Alt+C)')
    expect(matchCaseBtn.className).not.toContain('active')

    fireEvent.click(matchCaseBtn)
    expect(matchCaseBtn.className).toContain('active')

    const regexBtn = screen.getByLabelText('Use Regular Expression (Alt+R)')
    fireEvent.click(regexBtn)
    expect(regexBtn.className).toContain('active')
  })

  it('toggles replace row when toggle button is clicked', () => {
    const onClose = vi.fn()
    render(<FindWidget editorView={mockEditorView} onClose={onClose} />)

    expect(screen.queryByPlaceholderText('Replace')).toBeNull()

    const toggleBtn = screen.getByLabelText('Toggle Replace (Ctrl+H)')
    fireEvent.click(toggleBtn)

    expect(screen.getByPlaceholderText('Replace')).toBeDefined()
    expect(screen.getByLabelText('Replace (Enter)')).toBeDefined()
    expect(screen.getByLabelText('Replace All (Ctrl+Alt+Enter)')).toBeDefined()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<FindWidget editorView={mockEditorView} onClose={onClose} />)

    const closeBtn = screen.getByLabelText('Close (Escape)')
    fireEvent.click(closeBtn)

    expect(onClose).toHaveBeenCalled()
  })
})
