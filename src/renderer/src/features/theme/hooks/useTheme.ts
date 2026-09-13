import { useState, useEffect, useCallback } from 'react'
import { applyTheme as applyThemeUtil, getTheme, THEMES, ThemeDefinition } from './themeDefinitions'

export interface UseThemeReturn {
  theme: string
  setTheme: (themeId: string) => void
  themeData: ThemeDefinition
  allThemes: ThemeDefinition[]
}

/**
 * useTheme Hook
 * Manages theme selection and application
 * Automatically applies caret colors from theme definitions
 */
export const useTheme = (): UseThemeReturn => {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem('theme-id') || 'dark'
  })

  // Apply theme on mount
  useEffect(() => {
    applyThemeUtil(currentTheme)
  }, [])

  /**
   * Change theme and apply all colors including caret
   * @param themeId - Theme identifier
   */
  const setTheme = useCallback((themeId: string): void => {
    let target = themeId
    if (!THEMES[target]) {
      console.warn(`Theme "${target}" not found, using "dark"`)
      target = 'dark'
    }

    setCurrentTheme(target)
    localStorage.setItem('theme-id', target)
    // applyThemeUtil handles caret color from theme definition
    applyThemeUtil(target)
  }, [])

  return {
    theme: currentTheme,
    setTheme,
    themeData: getTheme(currentTheme),
    allThemes: Object.values(THEMES)
  }
}

export default useTheme
