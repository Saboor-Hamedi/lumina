import { describe, it, expect, afterEach } from 'vitest'
import { matchesShortcut, DEFAULT_SHORTCUTS, buildShortcutGroups } from '../../../../../src/renderer/src/core/shortcuts'

const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'

const originalUA = window.navigator.userAgent

function setUA(ua) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

function keyEvent(key, { ctrl, meta, shift, alt, code } = {}) {
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

afterEach(() => {
  setUA(originalUA)
})

describe('matchesShortcut modifier semantics', () => {
  describe('on Windows', () => {
    it('matches Ctrl shortcuts with the Control key only', () => {
      setUA(WINDOWS_UA)
      expect(matchesShortcut(keyEvent('.', { ctrl: true, shift: true, code: 'Period' }), 'Ctrl + Shift + .')).toBe(true)
      expect(matchesShortcut(keyEvent('s', { ctrl: true }), 'Ctrl + S')).toBe(true)
    })

    it('does NOT let the Win key satisfy a Ctrl shortcut', () => {
      setUA(WINDOWS_UA)
      expect(matchesShortcut(keyEvent('.', { meta: true, shift: true, code: 'Period' }), 'Ctrl + Shift + .')).toBe(false)
      expect(matchesShortcut(keyEvent('s', { meta: true }), 'Ctrl + S')).toBe(false)
    })

    it('matches Win shortcuts with the meta key only', () => {
      setUA(WINDOWS_UA)
      expect(matchesShortcut(keyEvent('.', { meta: true, shift: true, code: 'Period' }), 'Win + Shift + .')).toBe(true)
      expect(matchesShortcut(keyEvent('.', { ctrl: true, shift: true, code: 'Period' }), 'Win + Shift + .')).toBe(false)
    })

    it('keeps Win+Shift+. and Ctrl+Shift+. distinct (icon vs breadcrumbs)', () => {
      setUA(WINDOWS_UA)
      const winEvent = keyEvent('.', { meta: true, shift: true, code: 'Period' })
      const ctrlEvent = keyEvent('.', { ctrl: true, shift: true, code: 'Period' })

      expect(matchesShortcut(winEvent, 'Ctrl + Shift + .')).toBe(false)
      expect(matchesShortcut(winEvent, 'Win + Shift + .')).toBe(true)
      expect(matchesShortcut(ctrlEvent, 'Ctrl + Shift + .')).toBe(true)
      expect(matchesShortcut(ctrlEvent, 'Win + Shift + .')).toBe(false)
    })
  })

  describe('on macOS', () => {
    it('maps a "Ctrl" shortcut to Command (meta)', () => {
      setUA(MAC_UA)
      expect(matchesShortcut(keyEvent('.', { meta: true, shift: true, code: 'Period' }), 'Ctrl + Shift + .')).toBe(true)
      expect(matchesShortcut(keyEvent('s', { meta: true }), 'Ctrl + S')).toBe(true)
    })

    it('maps a "Win" shortcut to the physical Control key', () => {
      setUA(MAC_UA)
      expect(matchesShortcut(keyEvent('.', { ctrl: true, shift: true, code: 'Period' }), 'Win + Shift + .')).toBe(true)
      expect(matchesShortcut(keyEvent('.', { meta: true, shift: true, code: 'Period' }), 'Win + Shift + .')).toBe(false)
    })
  })
})

describe('changeIcon default binding', () => {
  it('uses Win + Shift + . to match the TabBar context-menu label', () => {
    const def = DEFAULT_SHORTCUTS.find((s) => s.id === 'changeIcon')
    expect(def?.defaultKey).toBe('Win + Shift + .')

    const group = buildShortcutGroups().find((g) => g.title === 'File')
    const item = group?.items.find((i) => i.id === 'changeIcon')
    expect(item?.key).toBe('Win + Shift + .')
  })

  it('does not collide with the breadcrumbs default', () => {
    const breadcrumbs = DEFAULT_SHORTCUTS.find((s) => s.id === 'focusBreadcrumbs')
    expect(breadcrumbs?.defaultKey).toBe('Ctrl + Shift + .')
  })
})
