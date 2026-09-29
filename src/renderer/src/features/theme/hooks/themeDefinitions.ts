/**
 * Centralized Theme Definitions
 * 26 meticulously crafted, ergonomic themes with balanced contrast,
 * readable typography, and harmonious palettes for long-session comfort.
 */

export type ThemeColorKey =
  | '--bg-app'
  | '--bg-sidebar'
  | '--bg-activitybar'
  | '--bg-panel'
  | '--bg-editor'
  | '--bg-active'
  | '--bg-card'
  | '--text-main'
  | '--text-muted'
  | '--text-faint'
  | '--text-accent'
  | '--text-accent-rgb'
  | '--border-dim'
  | '--border-subtle'
  | '--border-main'
  | '--border-card'
  | '--scroll-thumb'
  | '--scroll-track'
  | '--icon-primary'
  | '--icon-secondary'
  | '--icon-tertiary'
  | '--icon-danger'
  | '--icon-love'
  | '--caret-width'
  | '--caret-color'
  | '--shadow-soft'
  | '--glow-accent'

export type ThemeColors = Partial<Record<ThemeColorKey, string>> & Record<
  | '--bg-app'
  | '--bg-sidebar'
  | '--bg-activitybar'
  | '--bg-panel'
  | '--bg-editor'
  | '--bg-active'
  | '--bg-card'
  | '--text-main'
  | '--text-muted'
  | '--text-faint'
  | '--text-accent'
  | '--text-accent-rgb'
  | '--border-dim'
  | '--border-subtle'
  | '--border-main'
  | '--border-card'
  | '--scroll-thumb'
  | '--scroll-track'
  | '--icon-primary'
  | '--icon-secondary'
  | '--icon-tertiary'
  | '--icon-danger'
  | '--icon-love'
  | '--caret-width'
  | '--caret-color',
  string
>

export interface ThemeDefinition {
  id: string
  name: string
  description: string
  colors: ThemeColors
}

import { THEMES } from './themeLists'
export { THEMES }

export type ThemeId = keyof typeof THEMES | (string & {})


/**
 * Get theme by ID
 */
export const getTheme = (themeId?: string): ThemeDefinition => {
  if (!themeId) return THEMES.dark
  if (THEMES[themeId]) return THEMES[themeId]
  const found = Object.values(THEMES).find((t) => t.id === themeId)
  if (found) return found
  const camel = themeId.replace(/_([a-z])/g, (_, g) => g.toUpperCase())
  return THEMES[camel] || Object.values(THEMES).find((t) => t.id === camel) || THEMES.dark
}

/**
 * Get all theme IDs
 */
export const getThemeIds = (): string[] => {
  return Object.keys(THEMES)
}

/**
 * Convert hex color to rgb string
 */
const hexToRgb = (hex: string): string | null => {
  if (!hex) return null
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : null
}

/**
 * Apply theme to document
 * Applies all theme colors including caret styling
 * Caret color matches theme accent unless user has set a custom color
 *
 * @param themeId - Theme identifier
 */
export const applyTheme = (themeId: string): void => {
  const theme = getTheme(themeId)
  const root = document.documentElement

  // Check if user has custom caret color (from useFontSettings)
  let customCaretColor: string | null = null
  let customCaretWidth: string | null = null
  let customThemeAccentColor: string | null = null

  try {
    const savedColors = localStorage.getItem('theme-colors')
    if (savedColors) {
      const parsed = JSON.parse(savedColors)
      if (parsed.caretColor && typeof parsed.caretColor === 'string' && parsed.caretColor.trim() !== '') {
        customCaretColor = parsed.caretColor
      }
      if (parsed.caretWidth && parsed.caretWidth !== '2px') {
        customCaretWidth = parsed.caretWidth
      }
      if (parsed.themeAccentColor && typeof parsed.themeAccentColor === 'string' && parsed.themeAccentColor.trim() !== '') {
        customThemeAccentColor = parsed.themeAccentColor
      }
    }
  } catch (e) {
    // Ignore parse errors, use theme defaults
  }

  // Apply new theme variables directly (setProperty automatically overrides previous values)
  const computedColors: Record<string, string> = {}
  Object.entries(theme.colors).forEach(([varName, value]) => {
    let finalVal = value
    if (varName === '--caret-color' && customCaretColor) {
      finalVal = customCaretColor
    } else if (varName === '--caret-width' && customCaretWidth) {
      finalVal = customCaretWidth
    } else if (varName === '--text-accent' && customThemeAccentColor) {
      finalVal = customThemeAccentColor
    } else if (varName === '--text-accent-rgb' && customThemeAccentColor) {
      const rgb = hexToRgb(customThemeAccentColor)
      finalVal = rgb || value
    }
    root.style.setProperty(varName, finalVal)
    computedColors[varName] = finalVal
  })

  // Set data attribute
  root.setAttribute('data-theme', themeId)

  // Persist to localStorage (strictly theme-id only)
  localStorage.setItem('theme-id', themeId)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { themeId, colors: computedColors } }))
  }
}