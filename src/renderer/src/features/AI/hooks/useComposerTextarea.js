import { useEffect, useRef } from 'react'

/**
 * Hook for managing Composer textarea resizing, focus shortcuts, and lifecycle.
 */
export const useComposerTextarea = ({ input, isSidebar, isLoading }) => {
  const textareaRef = useRef(null)
  const prevIsLoading = useRef(isLoading)

  // Auto-resize textarea based on content
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return

    if (!input || !input.trim()) {
      const minH = 48
      el.style.height = `${minH}px`
      el.style.overflowY = 'hidden'
      return
    }

    el.style.height = '0px'
    const minH = 48
    const maxH = isSidebar ? 150 : 180
    const newHeight = Math.min(Math.max(el.scrollHeight, minH), maxH)
    el.style.height = `${newHeight}px`
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden'
  }, [input, isSidebar])

  // Restore focus when AI finishes generating
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
    const handleFocusShortcut = (e) => {
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

    // Autofocus on mount
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
