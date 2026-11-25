import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSettingsStore } from '../../../core/store/SettingStore'

const MIN_WINDOW_OPACITY = 0.2
const MAX_WINDOW_OPACITY = 1.0

/**
 * Clamp and round opacity score strictly between 0.2 and 1.0
 */
export const clampOpacity = (val: unknown): number => {
  const num = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(num)) return 1.0
  const clamped = Math.max(MIN_WINDOW_OPACITY, Math.min(MAX_WINDOW_OPACITY, num))
  return Math.round(clamped * 100) / 100
}

/**
 * Convert score 0-1 to percentage (20 - 100)
 */
export const opacityToPercentage = (opacity: number): number => {
  return Math.round(opacity * 100)
}

/**
 * Convert percentage (20 - 100) to score 0-1
 */
export const percentageToOpacity = (percentage: number): number => {
  return clampOpacity(percentage / 100)
}

export interface UseOpacityReturn {
  opacity: number
  percentage: number
  setOpacity: (val: number | string, persist?: boolean) => void
  resetOpacity: () => void
  isTransparent: boolean
}

export function useOpacity(): UseOpacityReturn {
  const storeOpacity = useSettingsStore((s) => s.settings?.windowOpacity)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const [opacity, setOpacityState] = useState<number>(() => {
    if (typeof storeOpacity === 'number') {
      return clampOpacity(storeOpacity > 1 ? storeOpacity / 100 : storeOpacity)
    }
    return 1.0
  })

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastIpcTimeRef = useRef<number>(0)
  const pendingIpcValRef = useRef<number | null>(null)
  const ipcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushNativeOpacity = useCallback((val: number) => {
    if (window.api?.setWindowOpacity) {
      window.api.setWindowOpacity(val).catch(() => {})
      lastIpcTimeRef.current = performance.now()
    }
  }, [])

  // Keep local state in sync if windowOpacity changes externally (e.g. Command Palette or settings load)
  useEffect(() => {
    if (typeof storeOpacity === 'number') {
      const normalized = clampOpacity(storeOpacity > 1 ? storeOpacity / 100 : storeOpacity)
      setOpacityState(normalized)
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--app-opacity', String(normalized))
      }
    }
  }, [storeOpacity])

  const applyOpacityValue = useCallback(
    (val: number | string, persist = true) => {
      let score: number
      const num = typeof val === 'number' ? val : parseFloat(String(val))
      if (isNaN(num)) {
        score = 1.0
      } else if (num > 1.0) {
        score = percentageToOpacity(num)
      } else {
        score = clampOpacity(num)
      }

      setOpacityState(score)

      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--app-opacity', String(score))
      }

      // Throttle native window opacity to ~24ms for smooth 60fps DWM updates
      if (window.api?.setWindowOpacity) {
        pendingIpcValRef.current = score
        const now = performance.now()
        const elapsed = now - lastIpcTimeRef.current

        if (elapsed >= 24) {
          if (ipcTimerRef.current) {
            clearTimeout(ipcTimerRef.current)
            ipcTimerRef.current = null
          }
          flushNativeOpacity(score)
        } else if (!ipcTimerRef.current) {
          ipcTimerRef.current = setTimeout(() => {
            ipcTimerRef.current = null
            if (pendingIpcValRef.current !== null) {
              flushNativeOpacity(pendingIpcValRef.current)
            }
          }, 24 - elapsed)
        }
      }

      if (persist) {
        if (persistTimerRef.current) {
          clearTimeout(persistTimerRef.current)
        }
        persistTimerRef.current = setTimeout(() => {
          updateSetting('windowOpacity', score)
        }, 180)
      }
    },
    [flushNativeOpacity, updateSetting]
  )

  const resetOpacity = useCallback(() => {
    applyOpacityValue(1.0, true)
  }, [applyOpacityValue])

  const percentage = useMemo(() => opacityToPercentage(opacity), [opacity])

  return useMemo(
    () => ({
      opacity,
      percentage,
      setOpacity: applyOpacityValue,
      resetOpacity,
      isTransparent: opacity < 1.0
    }),
    [opacity, percentage, applyOpacityValue, resetOpacity]
  )
}

export default useOpacity
