import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import PromptModal from '../../../../../src/renderer/src/features/modals/PromptModal'

describe('PromptModal.tsx', () => {
  it('returns null when isOpen is false', () => {
    const { container } = render(
      <PromptModal
        isOpen={false}
        title="Confirm"
        message="Are you sure?"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders title, message, and action buttons when open', () => {
    const onConfirm = vi.fn()
    const onDiscard = vi.fn()
    const onClose = vi.fn()

    render(
      <PromptModal
        isOpen={true}
        title="Unsaved Changes"
        message="Do you want to save before closing?"
        confirmLabel="Save"
        discardLabel="Discard"
        cancelLabel="Cancel"
        onClose={onClose}
        onConfirm={onConfirm}
        onDiscard={onDiscard}
      />
    )

    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument()
    expect(screen.getByText('Do you want to save before closing?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape key press', () => {
    const onClose = vi.fn()
    render(
      <PromptModal
        isOpen={true}
        title="Title"
        message="Message"
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
