import { useState, useEffect, useCallback, useMemo } from 'react'
import { flushSync } from 'react-dom'
import {
  applyTheme as applyThemeUtil,
  flushThemeSideEffects,
  getTheme,
  THEMES,
  ThemeDefinition
} from './themeDefinitions'
import { useSettingStore } from '../../../core/store/SettingStore'

export interface ThemeChangeOrigin {
  x: number
  y: number
}

export interface UseThemeReturn {
  theme: string
  setTheme: (themeId: string, origin?: ThemeChangeOrigin) => void
  themeData: ThemeDefinition
  allThemes: ThemeDefinition[]
}

// Static theme list reference (computed once at module load, zero allocation on renders)
const ALL_THEMES_ARRAY = Array.from(new Set(Object.values(THEMES)))

let saveThemeTimer: ReturnType<typeof setTimeout> | null = null
const themeListeners = new Set<(themeId: string) => void>()

const notifyThemeListeners = (themeId: string) => {
  themeListeners.forEach((listener) => listener(themeId))
}

/**
 * useTheme Hook
 * Manages theme selection and application with synchronized state across all consumers.
 */
export const useTheme = (): UseThemeReturn => {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    if (typeof document !== 'undefined') {
      return (
        document.documentElement.getAttribute('data-theme') ||
        localStorage.getItem('theme-id') ||
        'dark'
      )
    }
    return localStorage.getItem('theme-id') || 'dark'
  })

  // Subscribe to shared theme changes across TitleBar toggle, Theme sidebar & external events
  useEffect(() => {
    themeListeners.add(setCurrentTheme)
    const handleExternalChange = (e: Event) => {
      const id = (e as CustomEvent)?.detail?.themeId
      if (typeof id === 'string' && id) {
        setCurrentTheme(id)
      }
    }
    window.addEventListener('theme-changed', handleExternalChange)
    return () => {
      themeListeners.delete(setCurrentTheme)
      window.removeEventListener('theme-changed', handleExternalChange)
    }
  }, [])

  // Apply theme on mount only if not already applied to documentElement
  useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') !== currentTheme) {
      applyThemeUtil(currentTheme)
    }
  }, [])

  /**
   * Change theme and apply all colors with a GPU-composited radial reveal
   * spreading outward from the click origin.
   */
  const setTheme = useCallback((themeId: string, origin?: ThemeChangeOrigin): void => {
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

    const apply = (deferSideEffects: boolean) => {
      localStorage.setItem('theme-id', target)
      applyThemeUtil(target, true, deferSideEffects)
      notifyThemeListeners(target)
    }

    const persistTheme = () => {
      flushThemeSideEffects()
      try {
        useSettingStore.getState().updateSetting('theme', target).catch(() => {})
        const api = (window as any).api
        if (api?.saveTheme) {
          api.saveTheme(target).catch(() => {})
        }
        api?.getSetting?.('cursor')
          .then((currCursor: any) => {
            if (currCursor && typeof currCursor === 'object' && currCursor.themeAccentColor) {
              delete currCursor.themeAccentColor
              api.saveSetting('cursor', currCursor).catch(() => {})
            }
          })
          .catch(() => {})
      } catch {
        // Ignore if store is inaccessible
      }
    }

    if (saveThemeTimer) {
      clearTimeout(saveThemeTimer)
      saveThemeTimer = null
    }

    const hasViewTransition =
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      typeof (document as any).startViewTransition === 'function'

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (hasViewTransition && !prefersReducedMotion) {
      try {
        // Unified origin for every theme switch (titlebar toggle, sidebar, keyboard)
        const x = window.innerWidth - 110
        const y = 16
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        )

        const transition = (document as any).startViewTransition(() => {
          flushSync(() => {
            apply(true)
          })
        })

        if (transition?.ready && typeof transition.ready.then === 'function') {
          transition.ready.then(() => {
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${endRadius}px at ${x}px ${y}px)`
                ]
              },
              {
                duration: 420,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                pseudoElement: '::view-transition-new(root)'
              }
            )
          })
        }

        if (transition?.finished && typeof transition.finished.then === 'function') {
          transition.finished.then(persistTheme, persistTheme)
        } else {
          saveThemeTimer = setTimeout(persistTheme, 460)
        }
      } catch {
        apply(false)
        saveThemeTimer = setTimeout(persistTheme, 100)
      }
    } else if (!prefersReducedMotion) {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.add('theme-fallback-fade')
        apply(false)
        window.setTimeout(() => {
          document.documentElement.classList.remove('theme-fallback-fade')
        }, 220)
      } else {
        apply(false)
      }
      saveThemeTimer = setTimeout(persistTheme, 240)
    } else {
      apply(false)
      persistTheme()
    }
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
