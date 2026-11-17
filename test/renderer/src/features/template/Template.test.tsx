import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Template from '../../../../../src/renderer/src/features/template/Template'

const sampleTemplates = [
  { id: 'daily-log', title: 'Daily Log.md', code: '# 📅 Daily Log\n\n- [ ] Task 1' },
  { id: 'meeting-notes', title: 'Meeting Notes.md', code: '# 👥 Meeting\n\nNotes' }
]

describe('Template.tsx', () => {
  const defaultProps = () => ({
    isOpen: true,
    onClose: vi.fn(),
    templates: sampleTemplates,
    onSelectTemplate: vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when isOpen is false', () => {
    const { container } = render(<Template {...defaultProps()} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders sidebar header, title, count badge and apply button when open', () => {
    render(<Template {...defaultProps()} />)
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()

    const badge = document.querySelector('.lumina-drawer-badge')
    expect(badge).toBeInTheDocument()
    // Blank Note + 2 sample templates
    expect(badge?.textContent).toBe('3')
    // Blank Note is selected by default
    expect(document.querySelector('.template-sidebar-preview-title')?.textContent).toBe(
      'Blank Note'
    )
  })

  it('calls onSelectTemplate and onClose when Apply button is clicked', () => {
    const props = defaultProps()
    render(<Template {...props} />)

    const applyBtn = screen.getByRole('button', { name: 'Apply' })
    fireEvent.click(applyBtn)

    expect(props.onSelectTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'blank', title: 'Blank Note' })
    )
    expect(props.onClose).toHaveBeenCalled()
  })

  it('navigates templates using arrow keys and applies with Enter', () => {
    const props = defaultProps()
    render(<Template {...props} />)

    // ArrowDown from Blank to Daily Log
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(document.querySelector('.template-sidebar-preview-title')?.textContent).toBe(
      'Daily Log'
    )

    // Enter to apply
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(props.onSelectTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'daily-log', title: 'Daily Log' })
    )
    expect(props.onClose).toHaveBeenCalled()
  })

  it('closes on Escape key press', () => {
    const props = defaultProps()
    render(<Template {...props} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('closes on overlay background click', () => {
    const props = defaultProps()
    render(<Template {...props} />)

    const overlay = document.querySelector('.lumina-side-drawer-overlay')
    expect(overlay).toBeInTheDocument()
    fireEvent.click(overlay!)
    expect(props.onClose).toHaveBeenCalled()
  })

  it('does not close when clicking inside the modal container', () => {
    const props = defaultProps()
    render(<Template {...props} />)

    const container = document.querySelector('.lumina-side-drawer-panel')
    expect(container).toBeInTheDocument()
    fireEvent.click(container!)
    expect(props.onClose).not.toHaveBeenCalled()
  })
})
