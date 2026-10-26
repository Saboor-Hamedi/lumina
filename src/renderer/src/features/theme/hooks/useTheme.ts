import { useState, useEffect, useCallback, useMemo } from 'react'
import { applyTheme as applyThemeUtil, getTheme, THEMES, ThemeDefinition } from './themeDefinitions'
import { useSettingStore } from '../../../core/store/SettingStore'

export interface UseThemeReturn {
  theme: string
  setTheme: (themeId: string) => void
  themeData: ThemeDefinition
  allThemes: ThemeDefinition[]
}

// Static theme list reference (computed once at module load, zero allocation on renders)
const ALL_THEMES_ARRAY = Array.from(new Set(Object.values(THEMES)))

let saveThemeTimer: ReturnType<typeof setTimeout> | null = null

/**
 * useTheme Hook
 * Manages theme selection and application
 * Automatically applies caret colors from theme definitions
 */
export const useTheme = (): UseThemeReturn => {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem('theme-id') || 'dark'
  })

  // Apply theme on mount only if not already applied to documentElement
  useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') !== currentTheme) {
      applyThemeUtil(currentTheme)
    }
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

    const apply = () => {
      setCurrentTheme(target)
      localStorage.setItem('theme-id', target)
      // applyThemeUtil handles caret color from theme definition
      applyThemeUtil(target, true)
    }

    // Hardware-accelerated smooth view transition when supported
    if (
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      typeof (document as any).startViewTransition === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      try {
        ;(document as any).startViewTransition(() => {
          apply()
        })
      } catch {
        apply()
      }
    } else {
      apply()
    }

    // Debounce the setting store update and disk IPC write so rapid switching is buttery smooth
    if (saveThemeTimer) clearTimeout(saveThemeTimer)
    saveThemeTimer = setTimeout(() => {
      try {
        useSettingStore.getState().updateSetting('theme', target).catch(() => {})
        const api = (window as any).api
        if (api?.saveTheme) {
          api.saveTheme(target).catch(() => {})
        }
        api?.getSetting?.('cursor').then((currCursor: any) => {
          if (currCursor && typeof currCursor === 'object' && currCursor.themeAccentColor) {
            delete currCursor.themeAccentColor
            api.saveSetting('cursor', currCursor).catch(() => {})
          }
        }).catch(() => {})
      } catch {
        // Ignore if store is inaccessible
      }
    }, 150)
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
