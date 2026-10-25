import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmailComposeModal } from '../../../../../src/renderer/src/features/email/components/EmailComposeModal'

describe('EmailComposeModal.tsx', () => {
  const defaultDraft = {
    to: 'user@example.com',
    cc: '',
    bcc: '',
    subject: 'Project Update',
    bodyHtml: 'Hello team,\n\nHere is the update.',
    attachments: []
  }

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    draft: defaultDraft,
    setDraft: vi.fn(),
    onSend: vi.fn(),
    onAddAttachments: vi.fn(),
    onAttachNote: vi.fn(),
    onRemoveAttachment: vi.fn(),
    isSending: false
  }

  it('returns null when isOpen is false', () => {
    const { container } = render(<EmailComposeModal {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders modal header, subject, and action buttons when open', () => {
    render(<EmailComposeModal {...defaultProps} />)

    expect(screen.getByText('Compose')).toBeInTheDocument()
    expect(screen.getByText('Project Update')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close compose' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<EmailComposeModal {...defaultProps} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close compose' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape key press', () => {
    const onClose = vi.fn()
    render(<EmailComposeModal {...defaultProps} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onSend when Send button is clicked', () => {
    const onSend = vi.fn()
    render(<EmailComposeModal {...defaultProps} onSend={onSend} />)

    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
