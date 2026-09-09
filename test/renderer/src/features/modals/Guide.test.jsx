import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Guide from '../../../../../src/renderer/src/features/modals/Guide'

describe('Guide.jsx Modal', () => {
  const defaultProps = () => ({
    isOpen: true,
    onClose: vi.fn(),
    onOpenDocs: vi.fn(),
    onLoadStarterNotes: vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when isOpen is false', () => {
    const { container } = render(<Guide {...defaultProps()} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders guide modal title and initial step badge', () => {
    render(<Guide {...defaultProps()} />)
    expect(screen.getByText('Lumina Guide')).toBeInTheDocument()

    // Step counter is rendered as a plain <span> with text "Step N of M"
    const stepCounter = screen.getByText(/Step 1 of/)
    expect(stepCounter).toBeInTheDocument()
  })

  it('navigates to next step when Next button is clicked', () => {
    render(<Guide {...defaultProps()} />)
    const nextBtn = screen.getByRole('button', { name: 'Next' })
    fireEvent.click(nextBtn)

    expect(screen.getByText(/Step 2 of/)).toBeInTheDocument()
  })

  it('navigates backwards when Previous button is clicked', () => {
    render(<Guide {...defaultProps()} />)
    const nextBtn = screen.getByRole('button', { name: 'Next' })
    fireEvent.click(nextBtn)

    const prevBtn = screen.getByRole('button', { name: 'Previous' })
    fireEvent.click(prevBtn)

    expect(screen.getByText(/Step 1 of/)).toBeInTheDocument()
  })

  it('jumps to specific step when a navigation dot is clicked', () => {
    render(<Guide {...defaultProps()} />)
    const step3Dot = screen.getByLabelText('Go to step 3')
    fireEvent.click(step3Dot)

    expect(screen.getByText(/Step 3 of/)).toBeInTheDocument()
  })

  it('calls onOpenDocs and closes when Documentation button is clicked', () => {
    const props = defaultProps()
    render(<Guide {...props} />)

    const docsBtn = screen.getAllByLabelText('Documentation (Ctrl + D)')[0]
    fireEvent.click(docsBtn)

    expect(props.onOpenDocs).toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalled()
  })

  it('closes on Escape key', () => {
    const props = defaultProps()
    render(<Guide {...props} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('closes on close button click', () => {
    const props = defaultProps()
    render(<Guide {...props} />)

    const closeBtn = screen.getByLabelText('Close Guide (Esc)')
    fireEvent.click(closeBtn)
    expect(props.onClose).toHaveBeenCalled()
  })

  it('closes on overlay click', () => {
    const props = defaultProps()
    render(<Guide {...props} />)

    const overlay = document.querySelector('.guide-modal-overlay')
    fireEvent.click(overlay)
    expect(props.onClose).toHaveBeenCalled()
  })
})
