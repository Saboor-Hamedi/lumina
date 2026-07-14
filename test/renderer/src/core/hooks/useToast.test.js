import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '../../../../../src/renderer/src/core/hooks/useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should initialize with null toast', () => {
    const { result } = renderHook(() => useToast())

    expect(result.current.toast).toBeNull()
    expect(typeof result.current.showToast).toBe('function')
  })

  it('should show toast with message', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Test message', 'success')
    })

    expect(result.current.toast).toEqual({
      message: 'Test message',
      type: 'success'
    })
  })

  it('should default to info type when not specified', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Test message')
    })

    expect(result.current.toast?.type).toBe('info')
  })

  it('should auto-dismiss toast after timeout', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Test message', 'success')
    })

    expect(result.current.toast).not.toBeNull()

    // Fast-forward time past the 3s auto-dismiss
    act(() => {
      vi.advanceTimersByTime(3001)
    })

    expect(result.current.toast).toBeNull()
  })

  it('should replace existing toast when new one is shown', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('First message', 'success')
    })

    expect(result.current.toast?.message).toBe('First message')

    act(() => {
      result.current.showToast('Second message', 'error')
    })

    expect(result.current.toast?.message).toBe('Second message')
    expect(result.current.toast?.type).toBe('error')
  })

  it('should clear toast when dismissed', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Test message', 'success')
    })

    expect(result.current.toast).not.toBeNull()

    // Use clearToast (exposed API) to properly clear
    act(() => {
      result.current.clearToast()
    })

    expect(result.current.toast).toBeNull()
  })
})
