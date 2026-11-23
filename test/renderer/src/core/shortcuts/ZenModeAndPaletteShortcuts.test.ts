/**
 * @file ZenModeAndPaletteShortcuts.test.ts
 * @description Unit tests for Command Palette and Zen Mode shortcut mapping and conflict prevention.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import {
  matchesShortcut,
  DEFAULT_SHORTCUTS,
  useKeyboardShortcuts,
  hasOpenEscapeConsumer
} from '../../../../../src/renderer/src/core/shortcuts'
import { useSettingStore } from '../../../../../src/renderer/src/core/store/SettingStore'

function keyEvent(
  key: string,
  {
    ctrl,
    meta,
    shift,
    alt,
    code,
    repeat,
    isComposing
  }: {
    ctrl?: boolean
    meta?: boolean
    shift?: boolean
    alt?: boolean
    code?: string
    repeat?: boolean
    isComposing?: boolean
  } = {}
) {
  const ev = new KeyboardEvent('keydown', {
    key,
    code: code || '',
    ctrlKey: Boolean(ctrl),
    metaKey: Boolean(meta),
    shiftKey: Boolean(shift),
    altKey: Boolean(alt),
    repeat: Boolean(repeat),
    isComposing: Boolean(isComposing),
    bubbles: true,
    cancelable: true
  })
  return ev
}

describe('Zen Mode and Command Palette Shortcuts', () => {
  it('registers zenMode shortcut as Ctrl + . in DEFAULT_SHORTCUTS', () => {
    const zenDef = DEFAULT_SHORTCUTS.find((s) => s.id === 'zenMode')
    expect(zenDef).toBeDefined()
    expect(zenDef?.defaultKey).toBe('Ctrl + .')
  })

  it('registers commandPalette shortcut as Ctrl + Shift + P in DEFAULT_SHORTCUTS', () => {
    const paletteDef = DEFAULT_SHORTCUTS.find((s) => s.id === 'commandPalette')
    expect(paletteDef).toBeDefined()
    expect(paletteDef?.defaultKey).toBe('Ctrl + Shift + P')
  })

  it('matches Ctrl + . specifically and does NOT match Ctrl + Shift + .', () => {
    const zenDef = DEFAULT_SHORTCUTS.find((s) => s.id === 'zenMode')!
    const breadcrumbDef = DEFAULT_SHORTCUTS.find((s) => s.id === 'focusBreadcrumbs')!

    const zenEvent = keyEvent('.', { ctrl: true, code: 'Period' })
    const breadcrumbEvent = keyEvent('.', { ctrl: true, shift: true, code: 'Period' })

    // Zen Mode matches Ctrl + .
    expect(matchesShortcut(zenEvent, zenDef.defaultKey)).toBe(true)
    // Focus Breadcrumbs matches Ctrl + Shift + .
    expect(matchesShortcut(breadcrumbEvent, breadcrumbDef.defaultKey)).toBe(true)

    // Zen Event does not trigger focusBreadcrumbs
    expect(matchesShortcut(zenEvent, breadcrumbDef.defaultKey)).toBe(false)
    // Breadcrumb Event does not trigger zenMode
    expect(matchesShortcut(breadcrumbEvent, zenDef.defaultKey)).toBe(false)
  })

  it('matches Ctrl + Shift + P for commandPalette', () => {
    const paletteDef = DEFAULT_SHORTCUTS.find((s) => s.id === 'commandPalette')!

    const paletteEvent = keyEvent('p', { ctrl: true, shift: true, code: 'KeyP' })
    expect(matchesShortcut(paletteEvent, paletteDef.defaultKey)).toBe(true)

    const normalP = keyEvent('p', { ctrl: true, code: 'KeyP' })
    // Ctrl + P (quick open / search) does not trigger command palette if shift is required
    expect(matchesShortcut(normalP, paletteDef.defaultKey)).toBe(false)
  })
})

describe('Zen Mode Escape Exit Behavior', () => {
  const initialSettingsSnapshot = structuredClone(useSettingStore.getState().settings)
  const initialActions = {
    enterZenMode: useSettingStore.getState().enterZenMode,
    exitZenMode: useSettingStore.getState().exitZenMode
  }

  function setZenEnabled(enabled: boolean) {
    const cur = useSettingStore.getState().settings
    useSettingStore.setState({
      settings: {
        ...cur,
        zenMode: { ...cur.zenMode, enabled }
      }
    })
  }

  function dispatchEscapeOn(target: EventTarget = window, opts: { repeat?: boolean; isComposing?: boolean; ctrl?: boolean; shift?: boolean } = {}) {
    const ev = keyEvent('Escape', { code: 'Escape', ...opts })
    target.dispatchEvent(ev)
    return ev
  }

  beforeEach(() => {
    ;(window as any).api = {
      getSetting: vi.fn().mockResolvedValue({}),
      saveSetting: vi.fn().mockResolvedValue(true),
      saveSettings: vi.fn().mockResolvedValue(true),
      onSettingsChanged: vi.fn()
    }
    delete (window as any).__isRecordingShortcut
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-zen-mode')
    useSettingStore.setState({
      settings: structuredClone(initialSettingsSnapshot),
      enterZenMode: initialActions.enterZenMode,
      exitZenMode: initialActions.exitZenMode
    })
  })

  afterEach(() => {
    cleanup()
    delete (window as any).__isRecordingShortcut
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('data-zen-mode')
    vi.restoreAllMocks()
  })

  it('exits Zen Mode on Escape when nothing else is open, including inside .cm-content editor', async () => {
    setZenEnabled(true)
    const exitSpy = vi.spyOn(useSettingStore.getState(), 'exitZenMode')

    // Case A: window target with nothing open
    dispatchEscapeOn(window)
    expect(exitSpy).toHaveBeenCalledTimes(1)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(false)

    // Case B: focused inside CodeMirror .cm-content surface
    setZenEnabled(true)
    const cmContent = document.createElement('div')
    cmContent.className = 'cm-content'
    cmContent.setAttribute('contenteditable', 'true')
    cmContent.tabIndex = 0
    document.body.appendChild(cmContent)
    cmContent.focus()

    dispatchEscapeOn(cmContent)
    expect(exitSpy).toHaveBeenCalledTimes(2)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(false)
  })

  it('does NOT enter Zen Mode or call exitZenMode when Zen Mode is disabled', () => {
    setZenEnabled(false)
    const enterSpy = vi.spyOn(useSettingStore.getState(), 'enterZenMode')
    const exitSpy = vi.spyOn(useSettingStore.getState(), 'exitZenMode')

    dispatchEscapeOn(window)

    expect(enterSpy).not.toHaveBeenCalled()
    expect(exitSpy).not.toHaveBeenCalled()
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(false)
  })

  it('closes an open registered onEscape modal first and exits Zen Mode only on the second Escape', () => {
    setZenEnabled(true)
    let isModalOpen = true
    const onEscape = vi.fn(() => {
      if (!isModalOpen) return false
      isModalOpen = false
      return true
    })

    const { rerender, unmount } = renderHook(
      ({ open }) =>
        useKeyboardShortcuts({
          onEscape: open ? onEscape : undefined
        }),
      { initialProps: { open: true } }
    )

    // First Escape closes only the modal; Zen Mode remains ON
    dispatchEscapeOn(window)
    expect(onEscape).toHaveBeenCalledTimes(1)
    expect(isModalOpen).toBe(false)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)

    // Unmount / unregister modal handler, then second Escape exits Zen Mode
    rerender({ open: false })
    unmount()
    dispatchEscapeOn(window)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(false)
  })

  it('does NOT exit Zen Mode when DOM overlays/menus/lightboxes/hover cards are open (even with late bubble listeners omitting preventDefault)', () => {
    const selectors: Array<{ tag?: string; className?: string; role?: string }> = [
      { className: 'context-menu' },
      { className: 'setting-dropdown-menu' },
      { className: 'calender-dropdown-menu' },
      { role: 'dialog' },
      { className: 'vs-find-part' },
      { className: 'editor-slash-palette' },
      { className: 'cm-tooltip-autocomplete' },
      { className: 'inline-lumina-modal' },
      { className: 'voice-capsule-container' },
      { className: 'cm-image-widget-wrapper is-source-mode' },
      { className: 'image-lightbox-overlay show' },
      { className: 'cm-wiki-hover' }
    ]

    for (const spec of selectors) {
      document.body.innerHTML = ''
      setZenEnabled(true)
      const exitSpy = vi.spyOn(useSettingStore.getState(), 'exitZenMode')

      const el = document.createElement(spec.tag || 'div')
      if (spec.className) el.className = spec.className
      if (spec.role) el.setAttribute('role', spec.role)
      document.body.appendChild(el)

      expect(hasOpenEscapeConsumer()).toBe(true)
      dispatchEscapeOn(window)

      expect(exitSpy).not.toHaveBeenCalled()
      expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)
      exitSpy.mockRestore()
    }

    // Late window bubble listener that closes overlay synchronously without calling preventDefault()
    document.body.innerHTML = ''
    setZenEnabled(true)
    const menu = document.createElement('div')
    menu.className = 'context-menu'
    document.body.appendChild(menu)

    const lateMenuListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        menu.remove()
      }
    }
    window.addEventListener('keydown', lateMenuListener, false)
    try {
      dispatchEscapeOn(window)
      expect(document.querySelector('.context-menu')).toBeNull()
      expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)
    } finally {
      window.removeEventListener('keydown', lateMenuListener, false)
    }

    // Next Escape with menu now gone should exit Zen Mode cleanly
    dispatchEscapeOn(window)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(false)
  })

  it('ignores hidden overlays (display: none or aria-hidden="true") and exits Zen Mode', () => {
    setZenEnabled(true)

    const hiddenDialog = document.createElement('div')
    hiddenDialog.setAttribute('role', 'dialog')
    hiddenDialog.style.display = 'none'
    document.body.appendChild(hiddenDialog)

    const ariaHiddenMenu = document.createElement('div')
    ariaHiddenMenu.className = 'context-menu'
    ariaHiddenMenu.setAttribute('aria-hidden', 'true')
    document.body.appendChild(ariaHiddenMenu)

    expect(hasOpenEscapeConsumer()).toBe(false)
    dispatchEscapeOn(window)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(false)
  })

  it('does NOT exit Zen Mode in terminal, inputs, table cell editor, shortcut recording, composing, repeat, or modified Escape', () => {
    // 1. Terminal focus (.xterm)
    setZenEnabled(true)
    const xterm = document.createElement('div')
    xterm.className = 'xterm'
    const termTextarea = document.createElement('textarea')
    termTextarea.className = 'xterm-helper-textarea'
    xterm.appendChild(termTextarea)
    document.body.appendChild(xterm)
    termTextarea.focus()
    dispatchEscapeOn(termTextarea)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)

    // 2. Non-editor <input> and <textarea>
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    dispatchEscapeOn(input)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()
    dispatchEscapeOn(textarea)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)

    // 3. Atomic table cell source editor inside .cm-content
    const cmContent = document.createElement('div')
    cmContent.className = 'cm-content'
    cmContent.setAttribute('contenteditable', 'true')
    const tableWrap = document.createElement('div')
    tableWrap.className = 'cm-atomic-table'
    const cellSource = document.createElement('div')
    cellSource.className = 'cm-atomic-table-cell-source'
    cellSource.setAttribute('contenteditable', 'true')
    cellSource.tabIndex = 0
    tableWrap.appendChild(cellSource)
    cmContent.appendChild(tableWrap)
    document.body.appendChild(cmContent)
    cellSource.focus()
    dispatchEscapeOn(cellSource)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)

    // Blur table cell before non-element checks
    cellSource.blur()
    document.body.innerHTML = ''

    // 4. Shortcut recording active
    ;(window as any).__isRecordingShortcut = true
    dispatchEscapeOn(window)
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)
    delete (window as any).__isRecordingShortcut

    // 5. IME composition / repeat / modifiers
    dispatchEscapeOn(window, { isComposing: true })
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)

    dispatchEscapeOn(window, { repeat: true })
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)

    dispatchEscapeOn(window, { ctrl: true })
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)

    dispatchEscapeOn(window, { shift: true })
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)
  })
})
