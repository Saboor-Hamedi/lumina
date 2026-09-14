import { useState, useEffect, useCallback, useMemo } from 'react'
import { applyTheme as applyThemeUtil, getTheme, THEMES, ThemeDefinition } from './themeDefinitions'

export interface UseThemeReturn {
  theme: string
  setTheme: (themeId: string) => void
  themeData: ThemeDefinition
  allThemes: ThemeDefinition[]
}

// Static theme list reference (computed once at module load, zero allocation on renders)
const ALL_THEMES_ARRAY = Array.from(new Set(Object.values(THEMES)))

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
    let themeObj = THEMES[target] || Object.values(THEMES).find((t) => t.id === target)
    if (!themeObj) {
      const camel = target.replace(/_([a-z])/g, (_, g) => g.toUpperCase())
      themeObj = THEMES[camel] || Object.values(THEMES).find((t) => t.id === camel)
    }
    if (!themeObj) {
      console.warn(`Theme "${target}" not found, using "dark"`)
      target = 'dark'
    } else {
      target = themeObj.id
    }

    setCurrentTheme(target)
    localStorage.setItem('theme-id', target)
    // applyThemeUtil handles caret color from theme definition
    applyThemeUtil(target)
  }, [])

  const themeData = useMemo(() => getTheme(currentTheme), [currentTheme])

  return {
    theme: currentTheme,
    setTheme,
    themeData,
    allThemes: ALL_THEMES_ARRAY
  }
}


export default useTheme
