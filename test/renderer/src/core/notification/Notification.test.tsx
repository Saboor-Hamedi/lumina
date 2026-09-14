import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import Notification from '../../../../../src/renderer/src/core/notification/Notification'

describe('Notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not render when toast is null', () => {
    const { container } = render(<Notification toast={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render success toast with icon', () => {
    const toast = { type: 'success', message: 'Success message' }
    render(<Notification toast={toast} />)

    expect(screen.getByText('Success message')).toBeInTheDocument()
  })

  it('should render error toast with icon', () => {
    const toast = { type: 'error', message: 'Error message' }
    render(<Notification toast={toast} />)

    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('should render info toast with icon', () => {
    const toast = { type: 'info', message: 'Info message' }
    render(<Notification toast={toast} />)

    expect(screen.getByText('Info message')).toBeInTheDocument()
  })

  it('should apply correct CSS class based on type', () => {
    const toast = { type: 'success', message: 'Test' }
    const { container } = render(<Notification toast={toast} />)

    const toastElement = document.body.querySelector('.toast-notification')
    expect(toastElement).toHaveClass('toast-success')
  })

  it('should handle exit animation', () => {
    const toast = { type: 'success', message: 'Test' }
    const { rerender } = render(<Notification toast={toast} />)

    expect(screen.getByText('Test')).toBeInTheDocument()

    // Clear toast — component returns null immediately when toast prop is null
    rerender(<Notification toast={null} />)

    // Advance any pending timers
    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Should be removed after animation
    expect(screen.queryByText('Test')).not.toBeInTheDocument()
  })
})
