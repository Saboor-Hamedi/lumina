import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GlobalErrorHandler from '../../../../src/renderer/src/components/GlobalErrorHandler'

const GoodChild = () => <div>All good</div>
const BadChild = () => {
  throw new Error('Test error')
}

describe('GlobalErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children when no error', () => {
    render(
      <GlobalErrorHandler>
        <GoodChild />
      </GlobalErrorHandler>
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders fallback UI on error', () => {
    render(
      <GlobalErrorHandler>
        <BadChild />
      </GlobalErrorHandler>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('renders Try Again and Reload App buttons on error', () => {
    render(
      <GlobalErrorHandler>
        <BadChild />
      </GlobalErrorHandler>
    )
    expect(screen.getByText('Try Again')).toBeInTheDocument()
    expect(screen.getByText('Reload App')).toBeInTheDocument()
  })

  it('calls custom fallback when provided', () => {
    const fallback = vi.fn(() => <div>Custom fallback</div>)

    render(
      <GlobalErrorHandler fallback={fallback}>
        <BadChild />
      </GlobalErrorHandler>
    )

    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    expect(fallback).toHaveBeenCalled()
  })

  it('calls onReset when Try Again is clicked', async () => {
    const onReset = vi.fn()
    const user = userEvent.setup()

    render(
      <GlobalErrorHandler onReset={onReset}>
        <BadChild />
      </GlobalErrorHandler>
    )

    await user.click(screen.getByText('Try Again'))
    await new Promise((r) => setTimeout(r, 200))
    expect(onReset).toHaveBeenCalled()
  })

  it('renders error trace in textarea with copy button', () => {
    render(
      <GlobalErrorHandler>
        <BadChild />
      </GlobalErrorHandler>
    )

    const textarea = screen.getByLabelText('Error details log')
    expect(textarea).toBeInTheDocument()
    expect(textarea.value).toContain('Test error')

    expect(screen.getByTitle('Copy error trace')).toBeInTheDocument()
  })

  it('calls window.api.logError when available', () => {
    const logError = vi.fn().mockResolvedValue(true)
    global.window.api = { ...global.window.api, logError }

    render(
      <GlobalErrorHandler>
        <BadChild />
      </GlobalErrorHandler>
    )

    expect(logError).toHaveBeenCalled()
  })
})
