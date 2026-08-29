import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../../../../../src/renderer/src/core/hooks/useTheme'
import { THEMES } from '../../../../../src/renderer/src/core/themes/themeDefinitions'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.cssText = ''
    document.documentElement.removeAttribute('data-theme')
  })

  it('initializes with default theme when no localStorage value', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(result.current.themeData).toEqual(THEMES.dark)
  })

  it('initializes with localStorage value if present', () => {
    localStorage.setItem('theme-id', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(result.current.themeData).toEqual(THEMES.light)
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

  it('falls back to dark theme if invalid theme provided', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('invalid_theme')
    })

    expect(result.current.theme).toBe('dark')
    expect(localStorage.getItem('theme-id')).toBe('dark')
  })

  it('sets data-theme attribute', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('applies CSS variables correctly', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dracula')
    })

    // It should have applied the dracula background color
    expect(document.documentElement.style.getPropertyValue('--bg-app')).toBe(
      THEMES.dracula.colors['--bg-app']
    )
  })
})
