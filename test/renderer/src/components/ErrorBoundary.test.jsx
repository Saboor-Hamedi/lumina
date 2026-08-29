import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from '../../../../src/renderer/src/components/ErrorBoundary'

const GoodChild = () => <div>All good</div>
const BadChild = () => {
  throw new Error('Test error')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders fallback UI on error', () => {
    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('renders Try Again and Reload App buttons on error', () => {
    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>
    )
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Reload App')).toBeInTheDocument()
  })

  it('calls custom fallback when provided', () => {
    const fallback = vi.fn(() => <div>Custom fallback</div>)

    render(
      <ErrorBoundary fallback={fallback}>
        <BadChild />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    expect(fallback).toHaveBeenCalled()
  })

  it('calls onReset when Try Again is clicked', async () => {
    const onReset = vi.fn()
    const user = userEvent.setup()

    render(
      <ErrorBoundary onReset={onReset}>
        <BadChild />
      </ErrorBoundary>
    )

    await user.click(screen.getByText('Try Again'))

    await new Promise((r) => setTimeout(r, 200))
    expect(onReset).toHaveBeenCalled()
  })

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Error Details/)).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })

  it('calls window.api.logError when available', () => {
    const logError = vi.fn().mockResolvedValue(true)
    global.window.api = { ...global.window.api, logError }

    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>
    )

    expect(logError).toHaveBeenCalled()
  })
})
