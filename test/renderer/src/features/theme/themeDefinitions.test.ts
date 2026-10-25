import { describe, it, expect } from 'vitest'
import { THEMES, getTheme, getThemeIds, applyTheme } from '../../../../../src/renderer/src/features/theme/hooks/themeDefinitions'
import { parchment } from '../../../../../src/renderer/src/features/theme/hooks/themes/parchment'

describe('Theme Definitions & Parchment', () => {
  it('loads the parchment theme with full manuscript palette', () => {
    const theme = getTheme('parchment')
    expect(theme).toBeDefined()
    expect(theme.name).toBe('Parchment')
    expect(theme.colors['--bg-app']).toBe('#f5eedc')
    expect(theme.colors['--text-main']).toBe('#2b2116')
    expect(theme.colors['--text-accent']).toBe('#9c4310')
  })

  it('contains all 64 themes with valid color keys', () => {
    const ids = getThemeIds()
    expect(ids.length).toBeGreaterThanOrEqual(60)

    for (const id of ids) {
      const theme = THEMES[id]
      expect(theme).toBeDefined()
      expect(theme.colors['--bg-app']).toBeTruthy()
      expect(theme.colors['--text-main']).toBeTruthy()
      expect(theme.colors['--text-accent']).toBeTruthy()
      expect(theme.colors['--border-dim']).toBeTruthy()
    }
  })

  it('applies parchment theme variables and dynamic hover tokens to document root', () => {
    applyTheme('parchment')
    const root = document.documentElement

    expect(root.getAttribute('data-theme')).toBe('parchment')
    expect(root.style.getPropertyValue('--bg-app')).toBe('#f5eedc')
    expect(root.style.getPropertyValue('--text-main')).toBe('#2b2116')
    expect(root.style.getPropertyValue('--bg-hover')).toContain('color-mix')
  })

  it('resets custom accent override when selecting a theme with resetCustomAccent', () => {
    const root = document.documentElement

    // Simulate user setting a custom accent in AccentColor.tsx
    localStorage.setItem(
      'theme-colors',
      JSON.stringify({ themeAccentColor: '#10b981' })
    )

    // applyTheme without reset retains custom accent
    applyTheme('parchment', false)
    expect(root.style.getPropertyValue('--text-accent')).toBe('#10b981')

    // Selecting a theme with resetCustomAccent resets to that theme's default accent
    applyTheme('parchment', true)
    expect(root.style.getPropertyValue('--text-accent')).toBe('#9c4310')

    const saved = JSON.parse(localStorage.getItem('theme-colors') || '{}')
    expect(saved.themeAccentColor).toBeUndefined()
  })
})
