import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import IconPicker from '../../../../../src/renderer/src/features/Icons/IconPicker'
import { EMOJI_INDEX } from '../../../../../src/renderer/src/features/Icons/icons'

describe('IconPicker.jsx Modal', () => {
  const defaultProps = () => ({
    isOpen: true,
    onClose: vi.fn(),
    currentIcon: 'Folder',
    onSelect: vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<IconPicker {...defaultProps()} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders modal header with breadcrumb and icon count', () => {
    render(<IconPicker {...defaultProps()} />)
    expect(screen.getByText('Workspace Icons')).toBeInTheDocument()
    expect(screen.getByText('Choose Icon')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${EMOJI_INDEX.length} icons`))).toBeInTheDocument()
  })

  it('renders search input and stats bar', () => {
    render(<IconPicker {...defaultProps()} />)
    const searchInput = screen.getByPlaceholderText(/Search icons/)
    expect(searchInput).toBeInTheDocument()

    // Stats bar showing count
    expect(screen.getByText(/Showing 193 of 193/)).toBeInTheDocument()
  })

  it('filters icons when search query is entered', () => {
    render(<IconPicker {...defaultProps()} />)
    const searchInput = screen.getByPlaceholderText(/Search icons/)
    fireEvent.change(searchInput, { target: { value: 'atom' } })

    // Atom icon swatch should be present in results
    expect(screen.getByTitle(/Atom/i)).toBeInTheDocument()
  })

  it('calls onSelect when an icon is clicked', () => {
    const props = defaultProps()
    render(<IconPicker {...props} />)

    const searchInput = screen.getByPlaceholderText(/Search icons/)
    fireEvent.change(searchInput, { target: { value: 'atom' } })

    const atomBtn = screen.getByTitle(/Atom/i)
    fireEvent.click(atomBtn)

    expect(props.onSelect).toHaveBeenCalledWith('Atom')
  })

  it('calls onClose when close button is clicked', () => {
    const props = defaultProps()
    render(<IconPicker {...props} />)
    const closeBtn = screen.getByLabelText('Close Icons (Esc)')
    fireEvent.click(closeBtn)

    expect(props.onClose).toHaveBeenCalled()
  })
})
