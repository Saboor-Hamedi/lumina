import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import ModalHeader from '../../../../../src/renderer/src/features/modals/ModalHeader'

describe('ModalHeader.tsx', () => {
  it('renders title and subtitle', () => {
    render(<ModalHeader title="Custom Modal" subtitle="Subtitle Info" />)
    expect(screen.getByText('Custom Modal')).toBeInTheDocument()
    expect(screen.getByText('Subtitle Info')).toBeInTheDocument()
  })

  it('renders left and right slots', () => {
    render(
      <ModalHeader
        left={<span data-testid="left-slot">Left</span>}
        right={<span data-testid="right-slot">Right</span>}
      />
    )
    expect(screen.getByTestId('left-slot')).toBeInTheDocument()
    expect(screen.getByTestId('right-slot')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<ModalHeader title="Header" onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
