import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUpdateStore } from './useUpdateStore'

// Mock window.api
global.window = {
  ...global.window,
  api: {
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    installUpdate: vi.fn()
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}

describe('useUpdateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUpdateStore.setState({
      status: 'idle',
      progress: null,
      error: null,
      updateInfo: null
    })
  })

  it('should initialize with idle status', () => {
    const { result } = renderHook(() => useUpdateStore())

    expect(result.current.status).toBe('idle')
    expect(result.current.progress).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should handle update:checking event', () => {
    const { result } = renderHook(() => useUpdateStore())

    act(() => {
      const event = new CustomEvent('update:checking')
      window.dispatchEvent(event)
    })

    expect(result.current.status).toBe('checking')
  })

  it('should handle update:available event', () => {
    const { result } = renderHook(() => useUpdateStore())
    const updateInfo = { version: '1.0.1' }

    act(() => {
      const event = new CustomEvent('update:available', { detail: updateInfo })
      window.dispatchEvent(event)
    })

    expect(result.current.status).toBe('available')
    expect(result.current.updateInfo).toEqual(updateInfo)
  })

  it('should handle update:not-available event', () => {
    const { result } = renderHook(() => useUpdateStore())

    act(() => {
      const event = new CustomEvent('update:not-available')
      window.dispatchEvent(event)
    })

    expect(result.current.status).toBe('not-available')
  })

  it('should handle update:downloading event with progress', () => {
    const { result } = renderHook(() => useUpdateStore())
    const progress = { percent: 50 }

    act(() => {
      const event = new CustomEvent('update:downloading', { detail: progress })
      window.dispatchEvent(event)
    })

    expect(result.current.status).toBe('downloading')
    expect(result.current.progress).toEqual(progress)
  })

  it('should handle update:ready event', () => {
    const { result } = renderHook(() => useUpdateStore())
    const updateInfo = { version: '1.0.1' }

    act(() => {
      const event = new CustomEvent('update:ready', { detail: updateInfo })
      window.dispatchEvent(event)
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.updateInfo).toEqual(updateInfo)
  })

  it('should handle update:error event', () => {
    const { result } = renderHook(() => useUpdateStore())
    const error = 'Update failed'

    act(() => {
      const event = new CustomEvent('update:error', { detail: error })
      window.dispatchEvent(event)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe(error)
  })

  it('should provide checkForUpdates function', () => {
    const { result } = renderHook(() => useUpdateStore())

    act(() => {
      result.current.checkForUpdates()
    })

    expect(window.api.checkForUpdates).toHaveBeenCalled()
  })

  it('should provide downloadUpdate function', () => {
    const { result } = renderHook(() => useUpdateStore())

    act(() => {
      result.current.downloadUpdate()
    })

    expect(window.api.downloadUpdate).toHaveBeenCalled()
  })

  it('should provide installUpdate function', () => {
    const { result } = renderHook(() => useUpdateStore())

    act(() => {
      result.current.installUpdate()
    })

    expect(window.api.installUpdate).toHaveBeenCalled()
  })
})
