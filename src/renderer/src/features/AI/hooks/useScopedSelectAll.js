import { useEffect, useRef } from 'react'

/**
 * Custom hook to scope Ctrl+A / Cmd+A selection to the Lumina container,
 * preventing selection leaks to CodeMirror or the background document.
 */
export const useScopedSelectAll = ({ containerRef, isEnabled = true }) => {
  const isMouseInsideRef = useRef(false)
  const isActiveRef = useRef(false)

  // Track active state when interacting with container
  useEffect(() => {
    if (!isEnabled) {
      isActiveRef.current = false
      isMouseInsideRef.current = false
      return
    }

    isActiveRef.current = true

    const handlePointerDown = (e) => {
      if (containerRef.current && containerRef.current.contains(e.target)) {
        isActiveRef.current = true
      } else {
        isActiveRef.current = false
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [isEnabled, containerRef])

  // Capture phase keydown listener
  useEffect(() => {
    if (!isEnabled) return

    const handleKeyDownCapture = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 'a') {
        const target = e.target
        const activeEl = document.activeElement

        const isTargetInContainer =
          containerRef.current &&
          (containerRef.current.contains(target) || containerRef.current.contains(activeEl))
        const isHovered = isMouseInsideRef.current
        const isActive = isActiveRef.current

        if (isTargetInContainer || isHovered || isActive) {
          const isEditable =
            (target &&
              (target.tagName === 'TEXTAREA' ||
                target.tagName === 'INPUT' ||
                target.isContentEditable)) ||
            (activeEl &&
              (activeEl.tagName === 'TEXTAREA' ||
                activeEl.tagName === 'INPUT' ||
                activeEl.isContentEditable))

          if (isEditable) {
            const el =
              target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT' ? target : activeEl
            if (el && typeof el.value === 'string' && el.value.length > 0) {
              return
            }
          }

          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()

          const msgContainer =
            containerRef.current?.querySelector('.chat-msg-list') ||
            containerRef.current?.querySelector('.chat-messages')

          if (msgContainer) {
            const selection = window.getSelection()
            if (selection) {
              const range = document.createRange()
              range.selectNodeContents(msgContainer)
              selection.removeAllRanges()
              selection.addRange(range)
            }
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDownCapture, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, true)
    }
  }, [isEnabled, containerRef])

  const containerProps = {
    onMouseEnter: () => {
      isMouseInsideRef.current = true
    },
    onMouseLeave: () => {
      isMouseInsideRef.current = false
    },
    onPointerDown: () => {
      isActiveRef.current = true
    }
  }

  return { isMouseInsideRef, isActiveRef, containerProps }
}
