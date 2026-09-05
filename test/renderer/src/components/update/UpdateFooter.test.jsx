import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UpdateFooter from '../../../../../src/renderer/src/components/update/UpdateFooter'

describe('UpdateFooter', () => {
  it('renders footer info when idle', () => {
    render(<UpdateFooter status="idle" progress={null} currentVersion="1.0.0" onClose={vi.fn()} />)

    expect(screen.getByLabelText('Update Preferences')).toBeInTheDocument()
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    expect(screen.getByText(/Just now/)).toBeInTheDocument()
  })

  it('opens settings pane and can go back with Done', () => {
    render(<UpdateFooter status="idle" progress={null} currentVersion="1.0.0" onClose={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Update Preferences'))

    expect(screen.getByText('Download updates automatically')).toBeInTheDocument()
    expect(screen.getByText('Install updates on quit')).toBeInTheDocument()
    expect(screen.getByText('Notify me about pre-releases')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(screen.queryByText('Download updates automatically')).toBeNull()
  })
})
