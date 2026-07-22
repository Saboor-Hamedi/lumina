import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import IndexingStatus from '../../../../src/renderer/src/components/IndexingStatus'

describe('IndexingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete global.window.api?.onIndexProgress
  })

  it('renders nothing when no stats', () => {
    const { container } = render(<IndexingStatus />)
    expect(container.firstChild).toBeNull()
  })

  it('subscribes to onIndexProgress on mount', () => {
    const onIndexProgress = vi.fn()
    global.window.api.onIndexProgress = onIndexProgress

    render(<IndexingStatus />)
    expect(onIndexProgress).toHaveBeenCalled()
  })

  it('renders indexing progress when stats received', () => {
    const onIndexProgress = vi.fn((cb) => {
      cb({ progress: 50, stage: 'indexing', indexed: 5, total: 10 })
    })
    global.window.api.onIndexProgress = onIndexProgress

    render(<IndexingStatus />)
    expect(screen.getByText('Indexing')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('shows completed state at 100%', () => {
    const onIndexProgress = vi.fn((cb) => {
      cb({ progress: 100, stage: 'completed', indexed: 10, total: 10 })
    })
    global.window.api.onIndexProgress = onIndexProgress

    render(<IndexingStatus />)
    expect(screen.getByText('Indexed')).toBeInTheDocument()
  })

  it('shows up-to-date stage as complete', () => {
    const onIndexProgress = vi.fn((cb) => {
      cb({ progress: 100, stage: 'up-to-date', indexed: 10, total: 10 })
    })
    global.window.api.onIndexProgress = onIndexProgress

    render(<IndexingStatus />)
    expect(screen.getByText('Indexed')).toBeInTheDocument()
  })

  it('auto-hides after 1 second when complete', () => {
    const onIndexProgress = vi.fn((cb) => {
      cb({ progress: 100, stage: 'completed', indexed: 10, total: 10 })
    })
    global.window.api.onIndexProgress = onIndexProgress

    render(<IndexingStatus />)
    expect(screen.getByText('Indexed')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1001)
    })

    expect(screen.queryByText('Indexed')).not.toBeInTheDocument()
  })

  it('displays scanning stage message', () => {
    const onIndexProgress = vi.fn((cb) => {
      cb({ progress: 0, stage: 'scanning', found: 15 })
    })
    global.window.api.onIndexProgress = onIndexProgress

    render(<IndexingStatus />)
    expect(screen.getByText(/Scanning 15 files/)).toBeInTheDocument()
  })

  it('displays processing message during indexing', () => {
    const onIndexProgress = vi.fn((cb) => {
      cb({ progress: 40, stage: 'indexing', indexed: 4, total: 10 })
    })
    global.window.api.onIndexProgress = onIndexProgress

    render(<IndexingStatus />)
    expect(screen.getByText(/Processed 4 of 10 files/)).toBeInTheDocument()
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    const onIndexProgress = vi.fn(() => unsubscribe)
    global.window.api.onIndexProgress = onIndexProgress

    const { unmount } = render(<IndexingStatus />)
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
