import { useEffect, useLayoutEffect, useRef, RefObject } from 'react'

export interface UseComposerTextareaProps {
  input: string
  isSidebar?: boolean
  isLoading: boolean
}

/**
 * Hook for managing Composer textarea resizing, focus shortcuts, and lifecycle.
 * Automatically expands height with content up to maximum bounded heights,
 * restores focus when generation completes, and registers global focus shortcuts.
 */
export const useComposerTextarea = ({
  input,
  isSidebar = false,
  isLoading
}: UseComposerTextareaProps): RefObject<HTMLTextAreaElement | null> => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const prevIsLoading = useRef<boolean>(isLoading)

  // Auto-resize textarea dynamically based on scrollHeight bounds
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return

    const minH = isSidebar ? 84 : 52
    const maxH = isSidebar ? 260 : 220

    if (!input || !input.trim()) {
      el.style.height = `${minH}px`
      el.style.overflowY = 'hidden'
      return
    }

    el.style.height = `${minH}px`
    const newHeight = Math.min(Math.max(el.scrollHeight, minH), maxH)
    el.style.height = `${newHeight}px`
    const shouldScroll = el.scrollHeight > maxH
    el.style.overflowY = shouldScroll ? 'auto' : 'hidden'

    // Automatically follow incoming text down when voice note or long text is inserted
    if (shouldScroll) {
      el.scrollTop = el.scrollHeight
    }
  }, [input, isSidebar])

  // Restore focus to input when AI finishes generating
  useEffect(() => {
    if (prevIsLoading.current === true && isLoading === false) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 10)
    }
    prevIsLoading.current = isLoading
  }, [isLoading])

  // Global focus shortcut (Ctrl+Shift+\) & custom focus event
  useEffect(() => {
    const handleFocusShortcut = (e: KeyboardEvent) => {
      const key = e.key && e.key.toLowerCase()
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (key === '\\' || key === '|' || e.code === 'Backslash')
      ) {
        e.preventDefault()
        if (textareaRef.current) {
          textareaRef.current.focus()
          const len = textareaRef.current.value.length
          textareaRef.current.setSelectionRange(len, len)
        }
      }
    }

    const handleCustomFocus = () => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const len = textareaRef.current.value.length
        textareaRef.current.setSelectionRange(len, len)
      }
    }

    window.addEventListener('keydown', handleFocusShortcut, { capture: true })
    window.addEventListener('focus-ai-composer', handleCustomFocus)

    // Autofocus on initial mount
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }, 80)

    return () => {
      window.removeEventListener('keydown', handleFocusShortcut, { capture: true })
      window.removeEventListener('focus-ai-composer', handleCustomFocus)
      clearTimeout(timer)
    }
  }, [])

  return textareaRef
}
