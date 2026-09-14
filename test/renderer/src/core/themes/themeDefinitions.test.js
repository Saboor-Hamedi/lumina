import { describe, it, expect, vi, beforeEach } from 'vitest'
import { THEMES, getTheme, getThemeIds, applyTheme } from '../../../../../src/renderer/src/features/theme/hooks/themeDefinitions'

describe('themeDefinitions', () => {
  describe('THEMES', () => {
    it('defines at least 10 themes', () => {
      expect(Object.keys(THEMES).length).toBeGreaterThanOrEqual(10)
    })

    it('dark theme is present with expected colors', () => {
      expect(THEMES.dark).toBeDefined()
      expect(THEMES.dark.colors['--bg-app']).toBe(THEMES.dark.colors['--bg-app'])
      expect(THEMES.dark.colors['--text-accent']).toBe(THEMES.dark.colors['--text-accent'])
    })

    it('every theme has id, name, description and colors', () => {
      for (const theme of Object.values(THEMES)) {
        expect(theme.id).toBeTruthy()
        expect(theme.name).toBeTruthy()
        expect(theme.description).toBeTruthy()
        expect(theme.colors).toBeTruthy()
        expect(theme.colors['--bg-app']).toBeTruthy()
        expect(theme.colors['--text-main']).toBeTruthy()
      }
    })
  })

  describe('getTheme', () => {
    it('returns the requested theme', () => {
      expect(getTheme('dracula')).toBe(THEMES.dracula)
    })

    it('falls back to dark theme for unknown id', () => {
      expect(getTheme('nonexistent')).toBe(THEMES.dark)
    })

    it('falls back to dark theme when id is undefined', () => {
      expect(getTheme(undefined)).toBe(THEMES.dark)
    })
  })

  describe('getThemeIds', () => {
    it('returns all theme ids', () => {
      const ids = getThemeIds()
      expect(ids).toContain('dark')
      expect(ids).toContain('dracula')
      expect(ids.length).toBe(Object.keys(THEMES).length)
    })
  })

  describe('applyTheme', () => {
    beforeEach(() => {
      localStorage.clear()
      document.documentElement.style.cssText = ''
      document.documentElement.removeAttribute('data-theme')
    })

    it('applies theme variables to document root', () => {
      applyTheme('dark')
      const root = document.documentElement
      expect(root.style.getPropertyValue('--bg-app')).toBe(THEMES.dark.colors['--bg-app'])
      expect(root.style.getPropertyValue('--text-accent')).toBe(THEMES.dark.colors['--text-accent'])
    })

    it('sets data-theme attribute', () => {
      applyTheme('dracula')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dracula')
    })

    it('persists theme id to localStorage', () => {
      applyTheme('jellyfish')
      expect(localStorage.getItem('theme-id')).toBe('jellyfish')
    })

    it('caches active theme colors to localStorage for anti-fouc on refresh', () => {
      applyTheme('dracula')
      const cached = localStorage.getItem('lumina_active_theme_colors')
      expect(cached).toBeTruthy()
      const parsed = JSON.parse(cached)
      expect(parsed['--bg-activitybar']).toBe(THEMES.dracula.colors['--bg-activitybar'])
      expect(parsed['--bg-app']).toBe(THEMES.dracula.colors['--bg-app'])
    })

    it('applies custom caret color from localStorage', () => {
      localStorage.setItem('theme-colors', JSON.stringify({ caretColor: '#ff0000' }))
      applyTheme('dark')
      expect(document.documentElement.style.getPropertyValue('--caret-color')).toBe('#ff0000')
    })

    it('applies custom caret width from localStorage', () => {
      localStorage.setItem('theme-colors', JSON.stringify({ caretWidth: '4px' }))
      applyTheme('dark')
      expect(document.documentElement.style.getPropertyValue('--caret-width')).toBe('4px')
    })

    it('applies custom accent color and converts to rgb', () => {
      localStorage.setItem('theme-colors', JSON.stringify({ themeAccentColor: '#abcdef' }))
      applyTheme('dark')
      expect(document.documentElement.style.getPropertyValue('--text-accent')).toBe('#abcdef')
      expect(document.documentElement.style.getPropertyValue('--text-accent-rgb')).toBe(
        '171, 205, 239'
      )
    })

    it('handles invalid stored colors gracefully', () => {
      localStorage.setItem('theme-colors', 'not-json')
      expect(() => applyTheme('dark')).not.toThrow()
    })
  })
})
