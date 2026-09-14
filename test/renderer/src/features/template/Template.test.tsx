import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Template from '../../../../../src/renderer/src/features/template/Template'

const sampleTemplates = [
  { id: 'daily-log', title: 'Daily Log.md', code: '# 📅 Daily Log\n\n- [ ] Task 1' },
  { id: 'meeting-notes', title: 'Meeting Notes.md', code: '# 👥 Meeting\n\nNotes' }
]

describe('Template.jsx', () => {
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

  it('renders modal header, title, and active pill badge when open', () => {
    render(<Template {...defaultProps()} />)
    expect(screen.getByText('Templates')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Use selected template' })).toBeInTheDocument()

    const activePill = document.querySelector('.template-header-active-pill')
    expect(activePill).toBeInTheDocument()
    // Blank Note is default
    expect(activePill.textContent).toBe('Blank Note')
  })

  it('toggles sidebar when sidebar button is clicked', () => {
    render(<Template {...defaultProps()} />)
    const toggleBtn = screen.getByLabelText('Hide Sidebar')
    fireEvent.click(toggleBtn)

    const sidebar = document.querySelector('.template-sidebar')
    expect(sidebar.className).toContain('closed')
    expect(screen.getByLabelText('Show Sidebar')).toBeInTheDocument()
  })

  it('toggles window maximize state when window button is clicked', () => {
    render(<Template {...defaultProps()} />)
    const maxBtn = screen.getByLabelText('Maximize Window')
    fireEvent.click(maxBtn)

    const container = document.querySelector('.template-modal-container')
    expect(container.className).toContain('maximized')
    expect(screen.getByLabelText('Restore Window')).toBeInTheDocument()
  })

  it('calls onSelectTemplate and onClose when Use Template button is clicked', () => {
    const props = defaultProps()
    render(<Template {...props} />)

    const applyBtn = screen.getByRole('button', { name: 'Use selected template' })
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
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    const activePill = document.querySelector('.template-header-active-pill')
    expect(activePill.textContent).toBe('Daily Log')

    // Enter to apply
    fireEvent.keyDown(document, { key: 'Enter' })
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

    const overlay = document.querySelector('.guide-modal-overlay')
    fireEvent.click(overlay)
    expect(props.onClose).toHaveBeenCalled()
  })

  it('does not close when clicking inside the modal container', () => {
    const props = defaultProps()
    render(<Template {...props} />)

    const container = document.querySelector('.template-modal-container')
    fireEvent.click(container)
    expect(props.onClose).not.toHaveBeenCalled()
  })
})
