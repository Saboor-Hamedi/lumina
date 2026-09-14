import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import BreadcrumbOutlineDropdown from '../../../../../src/renderer/src/features/Breadcrumbs/components/BreadcrumbOutlineDropdown'

const mockHeadings = [
  { level: 1, text: 'Getting Started', line: 1 },
  { level: 2, text: 'Installation', line: 15 },
  { level: 2, text: 'Configuration', line: 40 },
  { level: 3, text: 'Environment Variables', line: 55 }
]

const anchorRect = {
  left: 150,
  top: 30,
  bottom: 50,
  right: 250,
  width: 100,
  height: 20
}

describe('BreadcrumbOutlineDropdown', () => {
  it('renders all headings with level badges and line numbers', () => {
    render(
      <BreadcrumbOutlineDropdown
        headings={mockHeadings}
        activeHeading={mockHeadings[1]}
        anchorRect={anchorRect}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Getting Started')).toBeDefined()
    expect(screen.getByText('Installation')).toBeDefined()
    expect(screen.getByText('Configuration')).toBeDefined()
    expect(screen.getByText('Environment Variables')).toBeDefined()
    expect(screen.getByText('H1')).toBeDefined()
    expect(screen.getByText('H3')).toBeDefined()
  })

  it('dispatches editor-scroll-to-line and closes when a heading is clicked', () => {
    const onClose = vi.fn()
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    render(
      <BreadcrumbOutlineDropdown
        headings={mockHeadings}
        activeHeading={mockHeadings[0]}
        anchorRect={anchorRect}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByText('Installation'))

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'editor-scroll-to-line',
        detail: { line: 15 }
      })
    )
    expect(onClose).toHaveBeenCalled()
    dispatchSpy.mockRestore()
  })

  it('filters headings when search query is typed if search is available', () => {
    const manyHeadings = [
      ...mockHeadings,
      { level: 2, text: 'Advanced Settings', line: 70 },
      { level: 2, text: 'Troubleshooting', line: 90 }
    ]

    render(
      <BreadcrumbOutlineDropdown
        headings={manyHeadings}
        activeHeading={manyHeadings[0]}
        anchorRect={anchorRect}
        onClose={vi.fn()}
      />
    )

    const searchInput = screen.getByPlaceholderText('Filter headings...')
    fireEvent.change(searchInput, { target: { value: 'install' } })

    expect(screen.getByText('Installation')).toBeDefined()
    expect(screen.queryByText('Advanced Settings')).toBeNull()
  })

  it('closes when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(
      <BreadcrumbOutlineDropdown
        headings={mockHeadings}
        activeHeading={mockHeadings[0]}
        anchorRect={anchorRect}
        onClose={onClose}
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('immediately selects active heading on mount without starting from top', () => {
    render(
      <BreadcrumbOutlineDropdown
        headings={mockHeadings}
        activeHeading={mockHeadings[2]}
        anchorRect={anchorRect}
        onClose={vi.fn()}
      />
    )

    const items = screen.getAllByRole('option')
    expect(items[2].getAttribute('aria-selected')).toBe('true')
    expect(items[2].classList.contains('is-active')).toBe(true)
    expect(items[2].classList.contains('is-current')).toBe(true)
    expect(items[0].getAttribute('aria-selected')).toBe('false')
    expect(items[0].classList.contains('is-active')).toBe(false)
  })
})
