import { useEffect, useRef } from 'react'

export interface UseZenWindowDragOptions {
  enabled: boolean
}

/**
 * useZenWindowDrag Hook
 *
 * Implements Alt + Left Mouse Drag window movement for Zen Mode.
 *
 * Safeguards:
 * 1. Only activates when Zen Mode is enabled.
 * 2. Requires e.altKey && e.button === 0 (left mouse button).
 * 3. Never moves window on normal clicks, editor typing, or text selection without Alt.
 * 4. Explicitly ignores interactive controls (buttons, inputs, textareas, selects, resizers, links).
 * 5. Safely communicates via window.api.moveWindow(deltaX, deltaY).
 */
export function useZenWindowDrag({ enabled }: UseZenWindowDragOptions): void {
  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!enabled) {
      isDraggingRef.current = false
      return
    }

    const handleMouseDown = (e: MouseEvent) => {
      // Must be left button (0) and Alt key held
      if (e.button !== 0 || !e.altKey) return

      const target = e.target as HTMLElement | null
      if (!target) return

      // Do not drag if user has selected text
      const selection = window.getSelection?.()
      if (selection && selection.toString().trim().length > 0) return

      // Restrict dragging: do not drag from interactive inputs, controls, resizers, or scrollbars
      const isInteractive = target.closest(
        'button, input, textarea, select, [role="button"], a, [contenteditable="true"], .sidebar-resizer, .terminal-resizer, .floating-window-controls, .cm-tooltip, .cm-cursor'
      )
      if (isInteractive) return

      isDraggingRef.current = true
      lastPosRef.current = { x: e.screenX, y: e.screenY }

      e.preventDefault()
      e.stopPropagation()
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return

      // If Alt was released or left button is no longer down, terminate drag
      if (!e.altKey || (e.buttons & 1) === 0) {
        isDraggingRef.current = false
        return
      }

      const deltaX = e.screenX - lastPosRef.current.x
      const deltaY = e.screenY - lastPosRef.current.y

      lastPosRef.current = { x: e.screenX, y: e.screenY }

      if (deltaX !== 0 || deltaY !== 0) {
        const api = (window as any).api
        if (api && typeof api.moveWindow === 'function') {
          api.moveWindow(deltaX, deltaY)
        }
      }
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
    }

    const handleBlur = () => {
      isDraggingRef.current = false
    }

    window.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('mousemove', handleMouseMove, true)
    window.addEventListener('mouseup', handleMouseUp, true)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('mousemove', handleMouseMove, true)
      window.removeEventListener('mouseup', handleMouseUp, true)
      window.removeEventListener('blur', handleBlur)
      isDraggingRef.current = false
    }
  }, [enabled])
}

export default useZenWindowDrag
