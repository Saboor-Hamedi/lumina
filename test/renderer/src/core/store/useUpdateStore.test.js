import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUpdateStore } from '../../../../../src/renderer/src/core/store/useUpdateStore'

// Mock window.api
let updateCallback = null
global.window = {
  ...global.window,
  api: {
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    onUpdateStatus: vi.fn((cb) => {
      updateCallback = cb
    })
  }
}

describe('useUpdateStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateCallback = null
    useUpdateStore.setState({
      status: 'idle',
      progress: null,
      error: null,
      updateInfo: null
    })
    // Initialize to register the callback
    useUpdateStore.getState().init()
  })

  it('should initialize with idle status', () => {
    const { result } = renderHook(() => useUpdateStore())
    expect(result.current.status).toBe('idle')
    expect(result.current.progress).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should handle checking event', () => {
    const { result } = renderHook(() => useUpdateStore())

    act(() => {
      updateCallback({ status: 'checking', data: null })
    })

    expect(result.current.status).toBe('checking')
  })

  it('should handle available event', () => {
    const { result } = renderHook(() => useUpdateStore())
    const updateInfo = { version: '1.0.1' }

    act(() => {
      updateCallback({ status: 'available', data: updateInfo })
    })

    expect(result.current.status).toBe('available')
    expect(result.current.updateInfo).toEqual(updateInfo)
  })

  it('should handle downloading event', () => {
    const { result } = renderHook(() => useUpdateStore())
    const progress = { percent: 50 }

    act(() => {
      updateCallback({ status: 'downloading', data: progress })
    })

    expect(result.current.status).toBe('downloading')
    expect(result.current.progress).toEqual(progress)
  })

  it('should handle ready event', () => {
    const { result } = renderHook(() => useUpdateStore())
    const updateInfo = { version: '1.0.1' }

    act(() => {
      updateCallback({ status: 'ready', data: updateInfo })
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.updateInfo).toEqual(updateInfo)
  })

  it('should handle error event', () => {
    const { result } = renderHook(() => useUpdateStore())
    const error = new Error('Failed to update')

    act(() => {
      updateCallback({ status: 'error', data: error })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toEqual(error)
  })

  it('should provide check function', async () => {
    const { result } = renderHook(() => useUpdateStore())

    await act(async () => {
      await result.current.check()
    })

    expect(window.api.checkForUpdates).toHaveBeenCalled()
    expect(result.current.status).toBe('checking')
  })

  it('should provide download function', async () => {
    const { result } = renderHook(() => useUpdateStore())

    await act(async () => {
      await result.current.download()
    })

    expect(window.api.downloadUpdate).toHaveBeenCalled()
    expect(result.current.status).toBe('downloading')
  })

  it('should provide install function', async () => {
    const { result } = renderHook(() => useUpdateStore())

    await act(async () => {
      await result.current.install()
    })

    expect(window.api.quitAndInstall).toHaveBeenCalled()
  })
})
