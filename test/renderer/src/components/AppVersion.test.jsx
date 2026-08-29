import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import AppVersion from '../../../../src/renderer/src/components/AppVersion'

describe('AppVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when no version', () => {
    const { container } = render(<AppVersion />)
    expect(container.firstChild).toBeNull()
  })

  it('renders version from window.api.getVersion', async () => {
    global.window.api.getVersion = vi.fn().mockResolvedValue('1.0.26')

    render(<AppVersion />)

    await vi.waitFor(() => {
      expect(screen.getByText('v1.0.26')).toBeInTheDocument()
    })
  })

  it('handles missing window.api gracefully', () => {
    delete global.window.api.getVersion
    const { container } = render(<AppVersion />)
    expect(container.firstChild).toBeNull()
  })

  it('handles API rejection gracefully', () => {
    global.window.api.getVersion = vi.fn().mockRejectedValue(new Error('fail'))
    const { container } = render(<AppVersion />)
    expect(container.firstChild).toBeNull()
  })
})
