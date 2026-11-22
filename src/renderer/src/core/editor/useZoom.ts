import React, { useEffect, useCallback, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { useSettingsStore } from '../store/SettingStore'
import { useFontSettings } from '../hooks/useFontSettings'

import type { UseZoomOptions, UseZoomReturn } from './types'

export const useZoom = ({
  containerRef,
  realViewRef,
  minSize = 8,
  maxSize = 32,
  step = 1,
  defaultSize = 16,
  isActive = true
}: UseZoomOptions = {}): UseZoomReturn => {
  const [zoomBadge, setZoomBadge] = useState<string | null>(null)
  const badgeTimerRef = useRef<NodeJS.Timeout | null>(null)

  const settingsFontSize = useSettingsStore((state: any) => state.settings?.fontSize)
  const updateSetting = useSettingsStore((state: any) => state.updateSetting)
  const { editorFontSize, updateEditorFontSize } = useFontSettings() as any

  const currentSize = settingsFontSize ?? editorFontSize ?? defaultSize

  const sizeRef = useRef<number>(currentSize)
  useEffect(() => {
    sizeRef.current = currentSize
  }, [currentSize])

  const isActiveRef = useRef<boolean>(isActive)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const saveDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const wheelAccumulatorRef = useRef<number>(0)
  const lastWheelTimeRef = useRef<number>(0)

  const setZoom = useCallback(
    (newSize: number) => {
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
      root.style.setProperty('--atomic-editor-body-size', `${clamped}px`)

      if (containerRef?.current) {
        containerRef.current.style.setProperty('--font-size-editor', `${clamped}px`)
        containerRef.current.style.setProperty('--editor-font-size', `${clamped / 16}rem`)
        containerRef.current.style.setProperty('--atomic-editor-body-size', `${clamped}px`)
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
    const handleWheel = (e: WheelEvent) => {
      if (!isActiveRef.current) return
      if (e.ctrlKey || e.metaKey) {
        const target = e.target as HTMLElement | null
        // If zooming inside graph (InlineGraph, embedded graph, or canvas), let the graph handle its own zoom
        if (target && typeof target.closest === 'function' && target.closest('.inline-graph-container, .nexus-embedded-graph, .graph-container, canvas')) {
          return
        }

        const container = containerRef?.current
        if (container && (container === target || container.contains(target))) {
          e.preventDefault()
          e.stopPropagation()

          if (e.deltaY === 0) return

          const effectiveStep = e.altKey ? step * 2 : step
          const isTrackpadPinch = e.deltaMode === 0 && Math.abs(e.deltaY) < 40
          if (isTrackpadPinch) {
            // Smooth 2-finger trackpad pinch emits small fractional deltaY values
            const now = performance.now()
            const delta = -e.deltaY
            if (
              now - lastWheelTimeRef.current > 250 ||
              (wheelAccumulatorRef.current !== 0 &&
                Math.sign(wheelAccumulatorRef.current) !== Math.sign(delta))
            ) {
              wheelAccumulatorRef.current = 0
            }
            lastWheelTimeRef.current = now
            wheelAccumulatorRef.current += delta
            const threshold = 10
            if (Math.abs(wheelAccumulatorRef.current) >= threshold) {
              const rawSteps = Math.trunc(wheelAccumulatorRef.current / threshold)
              wheelAccumulatorRef.current -= rawSteps * threshold
              const clampedSteps = Math.max(-2, Math.min(2, rawSteps))
              setZoom(sizeRef.current + clampedSteps * effectiveStep)
            }
          } else {
            wheelAccumulatorRef.current = 0
            lastWheelTimeRef.current = 0
            const direction = e.deltaY > 0 ? -1 : 1
            setZoom(sizeRef.current + direction * effectiveStep)
          }
        }
      }
    }

    window.addEventListener('wheel', handleWheel as EventListener, { capture: true, passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheel as EventListener, { capture: true })
    }
  }, [containerRef, setZoom, step])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
