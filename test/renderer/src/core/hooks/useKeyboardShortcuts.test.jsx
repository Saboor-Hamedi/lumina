import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcuts } from '../../../../../src/renderer/src/core/hooks/useKeyboardShortcuts'

describe('useKeyboardShortcuts', () => {
  let keydownHandlers

  beforeEach(() => {
    vi.clearAllMocks()
    keydownHandlers = []

    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'keydown') {
        keydownHandlers.push(handler)
      }
    })
    vi.spyOn(window, 'removeEventListener').mockImplementation((event, handler) => {
      if (event === 'keydown') {
        keydownHandlers = keydownHandlers.filter((h) => h !== handler)
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    keydownHandlers = []
  })

  function triggerKey(key, options = {}) {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: options.ctrl || false,
      metaKey: options.meta || false,
      shiftKey: options.shift || false,
      repeat: options.repeat || false,
      bubbles: true,
      cancelable: true
    })
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    Object.defineProperties(event, {
      preventDefault: { value: preventDefault },
      stopPropagation: { value: stopPropagation }
    })

    for (const handler of keydownHandlers) {
      handler(event)
    }

    return { preventDefault, stopPropagation }
  }

  it('calls onSave on Ctrl+S', () => {
    const onSave = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onSave }))

    triggerKey('s', { ctrl: true })
    expect(onSave).toHaveBeenCalled()
  })

  it('calls onSave on Meta+S', () => {
    const onSave = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onSave }))

    triggerKey('s', { meta: true })
    expect(onSave).toHaveBeenCalled()
  })

  it('calls onNew on Ctrl+N', () => {
    const onNew = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onNew }))

    triggerKey('n', { ctrl: true })
    expect(onNew).toHaveBeenCalled()
  })

  it('calls onTogglePalette on Ctrl+P', () => {
    const onTogglePalette = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onTogglePalette }))

    triggerKey('p', { ctrl: true })
    expect(onTogglePalette).toHaveBeenCalled()
  })

  it('calls onToggleCommandPalette on Ctrl+Space', () => {
    const onToggleCommandPalette = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onToggleCommandPalette }))

    triggerKey(' ', { ctrl: true })
    expect(onToggleCommandPalette).toHaveBeenCalled()
  })

  it('calls onToggleTheme on Ctrl+T', () => {
    const onToggleTheme = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onToggleTheme }))

    triggerKey('t', { ctrl: true })
    expect(onToggleTheme).toHaveBeenCalled()
  })

  it('calls onToggleSettings on Ctrl+,', () => {
    const onToggleSettings = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onToggleSettings }))

    triggerKey(',', { ctrl: true })
    expect(onToggleSettings).toHaveBeenCalled()
  })

  it('calls onDelete on Ctrl+Shift+D', () => {
    const onDelete = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onDelete }))

    triggerKey('d', { ctrl: true, shift: true })
    expect(onDelete).toHaveBeenCalled()
  })

  it('calls onToggleInspector on Ctrl+I', () => {
    const onToggleInspector = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onToggleInspector }))

    triggerKey('i', { ctrl: true })
    expect(onToggleInspector).toHaveBeenCalled()
  })

  it('calls onToggleGraph on Ctrl+G', () => {
    const onToggleGraph = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onToggleGraph }))

    triggerKey('g', { ctrl: true })
    expect(onToggleGraph).toHaveBeenCalled()
  })

  it('calls onCloseTab on Ctrl+W', () => {
    const onCloseTab = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onCloseTab }))

    triggerKey('w', { ctrl: true })
    expect(onCloseTab).toHaveBeenCalled()
  })

  it('calls onCloseWindow on Ctrl+Shift+W', () => {
    const onCloseWindow = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onCloseWindow }))

    triggerKey('w', { ctrl: true, shift: true })
    expect(onCloseWindow).toHaveBeenCalled()
  })

  it('calls onToggleSidebar on Ctrl+B', () => {
    const onToggleSidebar = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onToggleSidebar }))

    triggerKey('b', { ctrl: true })
    expect(onToggleSidebar).toHaveBeenCalled()
  })

  it('calls onInlineAI on Ctrl+K', () => {
    const onInlineAI = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onInlineAI }))

    triggerKey('k', { ctrl: true })
    expect(onInlineAI).toHaveBeenCalled()
  })

  it('calls onGlobalSearch on Ctrl+Shift+F', () => {
    const onGlobalSearch = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onGlobalSearch }))

    triggerKey('f', { ctrl: true, shift: true })
    expect(onGlobalSearch).toHaveBeenCalled()
  })

  it('calls onTogglePreview on Ctrl+\\', () => {
    const onTogglePreview = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onTogglePreview }))

    triggerKey('\\', { ctrl: true })
    expect(onTogglePreview).toHaveBeenCalled()
  })

  it('ignores keyboard repeat events', () => {
    const onSave = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onSave }))

    triggerKey('s', { ctrl: true, repeat: true })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not call handler when shortcut not registered', () => {
    const onSave = vi.fn()
    renderHook(() => useKeyboardShortcuts({}))

    triggerKey('s', { ctrl: true })
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onNextTab on Ctrl+Tab', () => {
    const onNextTab = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onNextTab }))

    triggerKey('Tab', { ctrl: true })
    expect(onNextTab).toHaveBeenCalled()
  })

  it('calls onPreviousTab on Ctrl+Shift+Tab', () => {
    const onPreviousTab = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onPreviousTab }))

    triggerKey('Tab', { ctrl: true, shift: true })
    expect(onPreviousTab).toHaveBeenCalled()
  })
})
