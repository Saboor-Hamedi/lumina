import { useEffect, useRef, RefObject } from 'react'

export interface UseScopedSelectAllProps {
  containerRef: RefObject<HTMLElement | null>
  isEnabled?: boolean
}

export interface ContainerScopedProps {
  onMouseEnter: () => void
  onMouseLeave: () => void
  onPointerDown: () => void
}

export interface UseScopedSelectAllReturn {
  isMouseInsideRef: RefObject<boolean>
  isActiveRef: RefObject<boolean>
  containerProps: ContainerScopedProps
}

/**
 * Custom hook to scope Ctrl+A / Cmd+A selection to the Lumina container,
 * preventing selection leaks to CodeMirror or the background document.
 */
export const useScopedSelectAll = ({
  containerRef,
  isEnabled = true
}: UseScopedSelectAllProps): UseScopedSelectAllReturn => {
  const isMouseInsideRef = useRef<boolean>(false)
  const isActiveRef = useRef<boolean>(false)

  // Track active state when interacting with container
  useEffect(() => {
    if (!isEnabled) {
      isActiveRef.current = false
      isMouseInsideRef.current = false
      return
    }

    isActiveRef.current = true

    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
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

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 'a') {
        const target = e.target as HTMLElement | null
        const activeEl = document.activeElement as HTMLElement | null

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
              target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT'
                ? (target as HTMLInputElement | HTMLTextAreaElement)
                : (activeEl as HTMLInputElement | HTMLTextAreaElement | null)
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

  const containerProps: ContainerScopedProps = {
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
