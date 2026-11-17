import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Theme from '../../../../../src/renderer/src/features/theme/Theme'
import { THEMES } from '../../../../../src/renderer/src/features/theme/hooks/themeDefinitions'

describe('Theme.jsx Modal', () => {
  const defaultProps = () => ({
    isOpen: true,
    onClose: vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.style.cssText = ''
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<Theme {...defaultProps()} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders theme sidebar header with title and available count', () => {
    render(<Theme {...defaultProps()} />)
    expect(screen.getByText('Themes')).toBeInTheDocument()
    expect(document.querySelector('.lumina-drawer-badge')?.textContent).toBe(
      String(Object.keys(THEMES).length)
    )
  })

  it('renders search input and theme cards', () => {
    render(<Theme {...defaultProps()} />)
    const searchInput = screen.getByPlaceholderText('Search themes...')
    expect(searchInput).toBeInTheDocument()

    // Dracula theme name should be visible
    expect(screen.getByText('Dracula')).toBeInTheDocument()
    expect(screen.getByText('Gruvbox Dark')).toBeInTheDocument()
  })

  it('filters themes based on search query', () => {
    render(<Theme {...defaultProps()} />)
    const searchInput = screen.getByPlaceholderText('Search themes...')
    fireEvent.change(searchInput, { target: { value: 'dracula' } })

    expect(screen.getByText('Dracula')).toBeInTheDocument()
    expect(screen.queryByText('Gruvbox Dark')).not.toBeInTheDocument()
    expect(document.querySelector('.lumina-drawer-badge')?.textContent).toBe('1')
  })

  it('calls onClose when close button is clicked', () => {
    const props = defaultProps()
    render(<Theme {...props} />)
    const closeBtn = screen.getByLabelText('Close')
    fireEvent.click(closeBtn)

    expect(props.onClose).toHaveBeenCalled()
  })

  it('selects a theme when card is clicked and updates document', () => {
    render(<Theme {...defaultProps()} />)
    const draculaCard = screen.getByText('Dracula').closest('.lumina-drawer-item')
    fireEvent.click(draculaCard)

    expect(localStorage.getItem('theme-id')).toBe('dracula')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dracula')
  })
})
