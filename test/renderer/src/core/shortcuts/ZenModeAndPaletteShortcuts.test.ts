/**
 * @file ZenModeAndPaletteShortcuts.test.ts
 * @description Unit tests for Command Palette and Zen Mode shortcut mapping and conflict prevention.
 */

import { describe, it, expect } from 'vitest'
import { matchesShortcut, DEFAULT_SHORTCUTS } from '../../../../../src/renderer/src/core/shortcuts'

function keyEvent(key: string, { ctrl, meta, shift, alt, code }: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean; code?: string } = {}) {
  return new KeyboardEvent('keydown', {
    key,
    code: code || '',
    ctrlKey: Boolean(ctrl),
    metaKey: Boolean(meta),
    shiftKey: Boolean(shift),
    altKey: Boolean(alt),
    bubbles: true,
    cancelable: true
  })
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
