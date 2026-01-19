import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

describe('useTheme', () => {
  beforeEach(() => {
    // Reset localStorage
    localStorage.clear()
    vi.clearAllMocks()
    
    // Reset document
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.cssText = ''
  })

  it('initializes with default theme when no localStorage value', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('initializes with localStorage value if present', () => {
    localStorage.setItem('theme-id', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('applies theme to document and localStorage', () => {
    const { result } = renderHook(() => useTheme())
    
    act(() => {
      result.current.setTheme('light')
    })

    expect(result.current.theme).toBe('light')
    expect(localStorage.getItem('theme-id')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('clears existing CSS variables when applying theme', () => {
    const { result } = renderHook(() => useTheme())
    
    // Set some CSS variables first
    document.documentElement.style.setProperty('--bg-app', 'red')
    document.documentElement.style.setProperty('--text-main', 'blue')
    
    act(() => {
      result.current.setTheme('dark')
    })

    // Variables should be removed
    expect(document.documentElement.style.getPropertyValue('--bg-app')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--text-main')).toBe('')
  })

  it('applies custom colors when provided', () => {
    const { result } = renderHook(() => useTheme())
    
    const colors = {
      primary: '#ff0000',
      secondary: '#00ff00',
      text: '#0000ff'
    }

    act(() => {
      result.current.setTheme('custom', colors)
    })

    expect(document.documentElement.style.getPropertyValue('--bg-app')).toBe('#ff0000')
    expect(document.documentElement.style.getPropertyValue('--bg-editor')).toBe('#ff0000')
    expect(document.documentElement.style.getPropertyValue('--bg-sidebar')).toBe('#00ff00')
    expect(document.documentElement.style.getPropertyValue('--text-main')).toBe('#0000ff')
  })

  it('sets data-theme attribute', () => {
    const { result } = renderHook(() => useTheme())
    
    act(() => {
      result.current.setTheme('light')
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})
