import { useEffect, useCallback, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { useSettingsStore } from '../../../core/store/useSettingsStore'
import { useFontSettings } from '../../../core/hooks/useFontSettings'

export const useZoom = ({
  containerRef,
  realViewRef,
  minSize = 8,
  maxSize = 32,
  step = 1,
  defaultSize = 16,
  isActive = true
} = {}) => {
  const [zoomBadge, setZoomBadge] = useState(null)
  const badgeTimerRef = useRef(null)

  const settingsFontSize = useSettingsStore((state) => state.settings?.fontSize)
  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const { editorFontSize, updateEditorFontSize } = useFontSettings()

  const currentSize = settingsFontSize ?? editorFontSize ?? defaultSize

  const sizeRef = useRef(currentSize)
  useEffect(() => {
    sizeRef.current = currentSize
  }, [currentSize])

  const isActiveRef = useRef(isActive)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const saveDebounceRef = useRef(null)

  const setZoom = useCallback(
    (newSize) => {
      const clamped = Math.max(minSize, Math.min(maxSize, Math.round(newSize)))
      if (clamped === sizeRef.current) return

      sizeRef.current = clamped

      const percent = Math.round((clamped / defaultSize) * 100)
      setZoomBadge(`${percent}%`)

      if (badgeTimerRef.current) {
        clearTimeout(badgeTimerRef.current)
      }
      badgeTimerRef.current = setTimeout(() => {
        setZoomBadge(null)
      }, 1200)

      const root = document.documentElement
      root.style.setProperty('--font-size-editor', `${clamped}px`)
      root.style.setProperty('--editor-font-size', `${clamped / 16}rem`)

      if (containerRef?.current) {
        containerRef.current.style.setProperty('--font-size-editor', `${clamped}px`)
        containerRef.current.style.setProperty('--editor-font-size', `${clamped / 16}rem`)
      }

      if (realViewRef?.current) {
        const view = realViewRef.current
        if (view.dom) {
          view.dom.style.fontSize = `${clamped}px`
        }
        if (view.contentDOM) {
          view.contentDOM.style.fontSize = `${clamped}px`
        }
        view.requestMeasure()
        view.dispatch({})
      }

      requestAnimationFrame(() => {
        if (realViewRef?.current) {
          const view = realViewRef.current
          view.requestMeasure()
          view.dispatch({})
        }
      })

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
        if (realViewRef?.current) {
          const view = realViewRef.current
          view.requestMeasure()
          if (view.state?.selection?.main) {
            view.dispatch({
              effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'nearest' })
            })
          }
        }
      }, 150)
    },
    [minSize, maxSize, updateSetting, updateEditorFontSize, containerRef, realViewRef, defaultSize]
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

  useEffect(() => {
    const handleWheel = (e) => {
      if (!isActiveRef.current) return
      if (e.ctrlKey || e.metaKey) {
        const target = e.target
        const container = containerRef?.current
        if (container && (container === target || container.contains(target))) {
          e.preventDefault()
          e.stopPropagation()

          const direction = e.deltaY > 0 ? -1 : 1
          const delta = direction * (e.altKey ? step * 2 : step)
          setZoom(sizeRef.current + delta)
        }
      }
    }

    window.addEventListener('wheel', handleWheel, { capture: true, passive: false })
    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true, passive: false })
    }
  }, [containerRef, setZoom, step])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isActiveRef.current) return

      const isCmd = e.ctrlKey || e.metaKey
      if (!isCmd || e.altKey) return

      const key = e.key
      const code = e.code

      if (
        key === '=' ||
        key === '+' ||
        code === 'Equal' ||
        code === 'NumpadAdd'
      ) {
        e.preventDefault()
        e.stopPropagation()
        zoomIn(2)
      } else if (
        key === '-' ||
        key === '_' ||
        code === 'Minus' ||
        code === 'NumpadSubtract'
      ) {
        e.preventDefault()
        e.stopPropagation()
        zoomOut(2)
      } else if (
        key === '0' ||
        code === 'Digit0' ||
        code === 'Numpad0'
      ) {
        e.preventDefault()
        e.stopPropagation()
        resetZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [zoomIn, zoomOut, resetZoom])

  return {
    fontSize: currentSize,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    zoomBadge
  }
}
