import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSettingsStore } from '../../../core/store/useSettingsStore'

const STORAGE_KEY = 'lumina_window_opacity'
const MIN_SLIDER = 70
const MAX_SLIDER = 100
const MIN_WINDOW_OPACITY = 0.92
const MAX_WINDOW_OPACITY = 1.0

const sliderToOpacity = (sliderVal) => {
  const clamped = Math.max(MIN_SLIDER, Math.min(MAX_SLIDER, Number(sliderVal) || 100))
  const ratio = (clamped - MIN_SLIDER) / (MAX_SLIDER - MIN_SLIDER)
  const opacity = MIN_WINDOW_OPACITY + ratio * (MAX_WINDOW_OPACITY - MIN_WINDOW_OPACITY)
  return Math.round(opacity * 1000) / 1000
}

const opacityToSlider = (opacityVal) => {
  const num = Number(opacityVal)
  if (isNaN(num) || num >= 1.0) return 100
  if (num <= MIN_WINDOW_OPACITY) return MIN_SLIDER
  const ratio = (num - MIN_WINDOW_OPACITY) / (MAX_WINDOW_OPACITY - MIN_WINDOW_OPACITY)
  return Math.max(MIN_SLIDER, Math.min(MAX_SLIDER, Math.round(MIN_SLIDER + ratio * (MAX_SLIDER - MIN_SLIDER))))
}

export function useOpacity() {
  const storeOpacity = useSettingsStore((s) => s.settings?.windowOpacity)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const [sliderVal, setSliderVal] = useState(() => {
    if (typeof storeOpacity === 'number') {
      return opacityToSlider(storeOpacity)
    }
    if (typeof localStorage !== 'undefined') {
      const saved = parseFloat(localStorage.getItem(STORAGE_KEY))
      if (!isNaN(saved)) {
        return opacityToSlider(saved)
      }
    }
    return 100
  })

  const persistTimerRef = useRef(null)
  const rafIdRef = useRef(null)
  const pendingIpcValRef = useRef(null)

  const applySliderValue = useCallback((val, persist = true) => {
    let num = typeof val === 'number' ? val : parseInt(val, 10)
    if (isNaN(num)) num = 100
    const clampedSlider = Math.max(MIN_SLIDER, Math.min(MAX_SLIDER, num))
    const nativeOpacity = sliderToOpacity(clampedSlider)

    setSliderVal(clampedSlider)

    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--app-opacity', String(nativeOpacity))
    }

    if (window.api?.setWindowOpacity) {
      pendingIpcValRef.current = nativeOpacity
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null
          if (pendingIpcValRef.current !== null && window.api?.setWindowOpacity) {
            window.api.setWindowOpacity(pendingIpcValRef.current).catch(() => {})
          }
        })
      }
    }

    if (persist) {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current)
      }
      persistTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, String(nativeOpacity))
        } catch {}
        updateSetting('windowOpacity', nativeOpacity)
      }, 150)
    }
  }, [updateSetting])

  useEffect(() => {
    const initialOpacity = sliderToOpacity(sliderVal)
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--app-opacity', String(initialOpacity))
    }

    if (window.api?.getWindowOpacity) {
      window.api.getWindowOpacity().then((val) => {
        if (typeof val === 'number') {
          const sVal = opacityToSlider(val)
          setSliderVal(sVal)
          const actual = sliderToOpacity(sVal)
          document.documentElement.style.setProperty('--app-opacity', String(actual))
        }
      }).catch(() => {})
    }
  }, [])

  const resetOpacity = useCallback(() => {
    applySliderValue(100, true)
  }, [applySliderValue])

  return useMemo(() => ({
    opacity: sliderToOpacity(sliderVal),
    percentage: sliderVal,
    setOpacity: applySliderValue,
    resetOpacity,
    isTransparent: sliderVal < 100
  }), [sliderVal, applySliderValue, resetOpacity])
}

export default useOpacity
