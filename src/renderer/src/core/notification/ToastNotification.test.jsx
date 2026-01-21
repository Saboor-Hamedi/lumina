import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ToastNotification from './ToastNotification'

describe('ToastNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not render when toast is null', () => {
    const { container } = render(<ToastNotification toast={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render success toast with icon', () => {
    const toast = { type: 'success', message: 'Success message' }
    render(<ToastNotification toast={toast} />)

    expect(screen.getByText('Success message')).toBeInTheDocument()
  })

  it('should render error toast with icon', () => {
    const toast = { type: 'error', message: 'Error message' }
    render(<ToastNotification toast={toast} />)

    expect(screen.getByText('Error message')).toBeInTheDocument()
  })

  it('should render info toast with icon', () => {
    const toast = { type: 'info', message: 'Info message' }
    render(<ToastNotification toast={toast} />)

    expect(screen.getByText('Info message')).toBeInTheDocument()
  })

  it('should apply correct CSS class based on type', () => {
    const toast = { type: 'success', message: 'Test' }
    const { container } = render(<ToastNotification toast={toast} />)

    const toastElement = container.querySelector('.toast-notification')
    expect(toastElement).toHaveClass('toast-success')
  })

  it('should handle exit animation', async () => {
    const toast = { type: 'success', message: 'Test' }
    const { rerender } = render(<ToastNotification toast={toast} />)

    expect(screen.getByText('Test')).toBeInTheDocument()

    // Clear toast
    rerender(<ToastNotification toast={null} />)

    // Should start exit animation
    await waitFor(() => {
      const toastElement = document.querySelector('.toast-notification')
      expect(toastElement).toHaveClass('toast-exit')
    })

    // Fast-forward timers
    vi.advanceTimersByTime(300)

    // Should be removed after animation
    await waitFor(() => {
      expect(screen.queryByText('Test')).not.toBeInTheDocument()
    })
  })
})
