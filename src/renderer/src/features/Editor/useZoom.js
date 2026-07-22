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
  step = 2,
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

  /**
   * Sets and persists the new font size
   */
  const setZoom = useCallback(
    (newSize) => {
      const clamped = Math.max(minSize, Math.min(maxSize, Math.round(newSize)))
      if (clamped === sizeRef.current) return

      sizeRef.current = clamped

      // 1. Update and persist in useSettingsStore (settings.json 'fontSize' + CSS var --font-size-editor)
      if (typeof updateSetting === 'function') {
        updateSetting('fontSize', clamped)
      }

      // 2. Update and persist in useFontSettings (settings.json 'cursor.editorFontSize' + localStorage + CSS var --editor-font-size)
      if (typeof updateEditorFontSize === 'function') {
        updateEditorFontSize(clamped)
      }
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

  // Handle Ctrl/Cmd + Mouse Wheel over the editor container
  useEffect(() => {
    const element = containerRef?.current
    if (!element) return

    let lastWheelTime = 0
    const WHEEL_THROTTLE_MS = 40 // Throttle slightly for smooth trackpad / high-DPI wheel scrolling

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        e.stopPropagation()

        const now = Date.now()
        if (now - lastWheelTime < WHEEL_THROTTLE_MS) return
        lastWheelTime = now

        if (e.deltaY < -2) {
          zoomIn(step)
        } else if (e.deltaY > 2) {
          zoomOut(step)
        }
      }
    }

    // Must be attached with { passive: false } so e.preventDefault() works cleanly
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      element.removeEventListener('wheel', handleWheel)
    }
  }, [containerRef, zoomIn, zoomOut, step])

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

    // Use capture phase to intercept before browser or electron window zoom
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
