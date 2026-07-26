import { useEffect, useCallback, useRef } from 'react'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useFontSettings } from '../../core/hooks/useFontSettings'

/**
 * useZoom Hook
 *
 * Standalone zoom management hook specifically designed for the editor.
 * Handles zooming via:
 * - Ctrl/Cmd + Mouse Wheel over the editor container
 * - Ctrl/Cmd + Plus (=/+), Minus (-), and Zero (0) keyboard shortcuts when the editor is active
 *
 * Synchronizes the font size with useSettingsStore (`fontSize`) and useFontSettings (`editorFontSize`),
 * persisting updates directly to `settings.json` and applying CSS variables (`--font-size-editor`, `--editor-font-size`).
 *
 * @param {Object} options
 * @param {React.RefObject} options.containerRef - Ref wrapping the editor DOM container for wheel events
 * @param {number} [options.minSize=10] - Minimum font size in pixels
 * @param {number} [options.maxSize=48] - Maximum font size in pixels
 * @param {number} [options.step=1] - Zoom increment step for wheel scrolling
 * @param {number} [options.defaultSize=16] - Default font size for reset
 * @param {boolean} [options.isActive=true] - Whether this editor instance is currently active
 * @returns {Object} { fontSize, zoomIn, zoomOut, resetZoom, setZoom }
 */
export const useZoom = ({
  containerRef,
  minSize = 10,
  maxSize = 96,
  step = 1,
  defaultSize = 16,
  isActive = true
} = {}) => {
  const settingsFontSize = useSettingsStore((state) => state.settings?.fontSize)
  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const { editorFontSize, updateEditorFontSize } = useFontSettings()

  const currentSize = settingsFontSize ?? editorFontSize ?? defaultSize

  // Stable ref for current size to avoid re-binding event listeners on every zoom step
  const sizeRef = useRef(currentSize)
  useEffect(() => {
    sizeRef.current = currentSize
  }, [currentSize])

  // Stable ref for active status
  const isActiveRef = useRef(isActive)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const saveDebounceRef = useRef(null)

  /**
   * Sets live visual font size immediately and debounces store/disk saves for buttery smooth zooming
   */
  const setZoom = useCallback(
    (newSize) => {
      const clamped = Math.max(minSize, Math.min(maxSize, Math.round(newSize)))
      if (clamped === sizeRef.current) return

      sizeRef.current = clamped

      // 1. Instant 60/120 FPS visual update without store re-renders or disk latency
      const root = document.documentElement
      root.style.setProperty('--font-size-editor', `${clamped}px`)
      root.style.setProperty('--editor-font-size', `${clamped / 16}rem`)

      // 2. Debounce store updates & disk saves (settings.json / localStorage) by 350ms to prevent stutter during rapid wheel scrolling
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current)
      }
      saveDebounceRef.current = setTimeout(() => {
        if (typeof updateSetting === 'function') {
          updateSetting('fontSize', clamped)
        }
        if (typeof updateEditorFontSize === 'function') {
          updateEditorFontSize(clamped)
        }
      }, 350)
    },
    [minSize, maxSize, updateSetting, updateEditorFontSize]
  )

  const zoomIn = useCallback(
    (delta = step) => {
      setZoom(sizeRef.current + delta)
    },
    [setZoom, step]
  )

  const zoomOut = useCallback(
    (delta = step) => {
      setZoom(sizeRef.current - delta)
    },
    [setZoom, step]
  )

  const resetZoom = useCallback(() => {
    setZoom(defaultSize)
  }, [setZoom, defaultSize])

  // Handle Ctrl/Cmd + Mouse Wheel over the editor container with VS Code-style smooth accumulation
  useEffect(() => {
    const element = containerRef?.current
    if (!element) return

    const PIXELS_PER_STEP = 35 // Smooth accumulator threshold for trackpad gestures & notched scroll wheels
    let wheelAccumulator = 0
    let lastWheelTime = 0

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()

        const now = Date.now()
        // Reset accumulator if scrolling paused for over 300ms
        if (now - lastWheelTime > 300) {
          wheelAccumulator = 0
        }
        lastWheelTime = now

        wheelAccumulator += e.deltaY

        if (Math.abs(wheelAccumulator) >= PIXELS_PER_STEP) {
          const deltaSteps = -Math.trunc(wheelAccumulator / PIXELS_PER_STEP)
          if (deltaSteps !== 0) {
            wheelAccumulator += deltaSteps * PIXELS_PER_STEP
            setZoom(sizeRef.current + deltaSteps * step)
          }
        }
      }
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef, setZoom, step])

  // Handle Keyboard Shortcuts (Ctrl+= / Ctrl++, Ctrl+-, Ctrl+0) when editor is active
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isActiveRef.current) return

      const isCmd = e.ctrlKey || e.metaKey
      if (!isCmd || e.altKey) return

      const key = e.key

      // Zoom In: Ctrl + '=' or Ctrl + '+' or NumpadAdd
      if (key === '=' || key === '+' || key === 'Add') {
        e.preventDefault()
        e.stopPropagation()
        zoomIn(step * 2) // Snappy 2px step for keyboard shortcuts
      }
      // Zoom Out: Ctrl + '-' or Ctrl + '_' or NumpadSubtract
      else if (key === '-' || key === '_' || key === 'Subtract') {
        e.preventDefault()
        e.stopPropagation()
        zoomOut(step * 2)
      }
      // Reset Zoom: Ctrl + '0' or Numpad0
      else if (key === '0' || key === 'Insert') {
        if (key === '0') {
          e.preventDefault()
          e.stopPropagation()
          resetZoom()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [zoomIn, zoomOut, resetZoom, step])

  return {
    fontSize: currentSize,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom
  }
}
