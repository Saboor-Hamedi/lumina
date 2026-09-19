import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import OverwriteModal from '../../../../../src/renderer/src/features/modals/OverwriteModal'

describe('OverwriteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <OverwriteModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title, message, and action buttons when open', () => {
    render(
      <OverwriteModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Custom Conflict Title"
        message="Custom Conflict Message"
        confirmText="Overwrite Content"
        cancelText="Discard"
      />
    )

    expect(screen.getByTestId('overwrite-modal')).toBeInTheDocument()
    expect(screen.getByText('Custom Conflict Title')).toBeInTheDocument()
    expect(screen.getByText('Custom Conflict Message')).toBeInTheDocument()
    expect(screen.getByTestId('overwrite-confirm-btn')).toHaveTextContent('Overwrite Content')
    expect(screen.getByTestId('overwrite-cancel-btn')).toHaveTextContent('Discard')
  })

  it('calls onConfirm and onClose when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()

    render(
      <OverwriteModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />
    )

    fireEvent.click(screen.getByTestId('overwrite-confirm-btn'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when cancel button is clicked', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()

    render(
      <OverwriteModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />
    )

    fireEvent.click(screen.getByTestId('overwrite-cancel-btn'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('closes on Escape key press', () => {
    const onClose = vi.fn()

    render(
      <OverwriteModal isOpen={true} onClose={onClose} onConfirm={vi.fn()} />
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
