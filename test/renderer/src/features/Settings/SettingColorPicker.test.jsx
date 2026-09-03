import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingColorPicker from '../../../../../src/renderer/src/features/Settings/SettingColorPicker'

describe('SettingColorPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SettingColorPicker isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders modal when isOpen is true with preset palette', () => {
    render(
      <SettingColorPicker
        isOpen={true}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        title="Choose Accent"
      />
    )
    expect(screen.getByText('Choose Accent')).toBeInTheDocument()
    expect(screen.getByText('CURATED PALETTE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })

  it('calls onSelect and onClose when Done is clicked', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(
      <SettingColorPicker
        isOpen={true}
        initialColor="#3b82f6"
        onClose={onClose}
        onSelect={onSelect}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onSelect).toHaveBeenCalledWith('#3b82f6')
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <SettingColorPicker
        isOpen={true}
        onClose={onClose}
        onSelect={vi.fn()}
      />
    )

    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
