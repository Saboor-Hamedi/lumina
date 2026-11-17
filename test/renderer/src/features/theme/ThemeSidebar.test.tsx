import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Theme from '../../../../../src/renderer/src/features/theme/Theme'

describe('Theme.tsx (Embedded Sidebar)', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.setAttribute('data-theme', 'dark')
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('renders 50 curated themes with count badge and search input', () => {
    render(<Theme isEmbedded={true} isOpen={true} onClose={onClose} />)
    expect(screen.getByPlaceholderText('Search themes...')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('Parchment')).toBeInTheDocument()
  })

  it('filters themes by tone tabs (All / Dark / Light) and search query', () => {
    render(<Theme isEmbedded={true} isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Light' }))
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Parchment')).toBeInTheDocument()
    expect(screen.queryByText('Nord Frost')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'All' }))
    fireEvent.change(screen.getByPlaceholderText('Search themes...'), {
      target: { value: 'Nord' }
    })
    expect(screen.getByText('Nord Frost')).toBeInTheDocument()
    expect(screen.queryByText('Parchment')).not.toBeInTheDocument()
  })

  it('moves highlight on ArrowDown and applies on Enter without closing sidebar', () => {
    render(<Theme isEmbedded={true} isOpen={true} onClose={onClose} />)

    // First item is 'dark'; ArrowDown moves highlight to second item ('parchment')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // Enter applies the highlighted theme and stays in Themes sidebar
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('parchment')
    expect(onClose).not.toHaveBeenCalled()
  })
})
