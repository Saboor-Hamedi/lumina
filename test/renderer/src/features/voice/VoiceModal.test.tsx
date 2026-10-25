import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import VoiceModal from '../../../../../src/renderer/src/features/voice/VoiceModal'

describe('VoiceModal.tsx', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    isRecording: false,
    isTranscribing: false,
    formattedDuration: '00:05',
    audioLevel: 0.5,
    onStartRecording: vi.fn(),
    onStopRecording: vi.fn(),
    onClearError: vi.fn()
  }

  it('renders null when isOpen is false', () => {
    const { container } = render(<VoiceModal {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders voice title, ready timer, and mic toggle button', () => {
    render(<VoiceModal {...defaultProps} />)
    expect(screen.getByText('Voice')).toBeInTheDocument()
    expect(screen.getByText('Detection')).toBeInTheDocument()
    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('triggers onStartRecording when mic button is clicked', () => {
    const onStartRecording = vi.fn()
    render(<VoiceModal {...defaultProps} onStartRecording={onStartRecording} />)

    const micBtn = screen.getByRole('button', { name: 'Start recording' })
    fireEvent.click(micBtn)
    expect(onStartRecording).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<VoiceModal {...defaultProps} onClose={onClose} />)

    const closeBtn = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape key press', () => {
    const onClose = vi.fn()
    render(<VoiceModal {...defaultProps} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
