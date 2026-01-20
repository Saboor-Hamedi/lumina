import { useState, useEffect } from 'react'
import { applyTheme as applyThemeUtil, getTheme, THEMES } from '../themes/themeDefinitions'

/**
 * useTheme Hook
 * Manages theme selection and application
 * Automatically applies caret colors from theme definitions
 */
export const useTheme = () => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('theme-id') || 'dark'
  })

  // Apply theme on mount
  useEffect(() => {
    applyThemeUtil(currentTheme)
  }, [])

  /**
   * Change theme and apply all colors including caret
   * @param {string} themeId - Theme identifier
   */
  const setTheme = (themeId) => {
    if (!THEMES[themeId]) {
      console.warn(`Theme "${themeId}" not found, using "dark"`)
      themeId = 'dark'
    }
    
    setCurrentTheme(themeId)
    // applyThemeUtil handles caret color from theme definition
    applyThemeUtil(themeId)
  }

  return { 
    theme: currentTheme, 
    setTheme,
    themeData: getTheme(currentTheme),
    allThemes: Object.values(THEMES)
  }
}
