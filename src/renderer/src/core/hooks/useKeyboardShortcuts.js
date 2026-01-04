import { useEffect, useRef } from 'react'

/**
 * Robust Global Stack-Based Escape Handler (Engineering Std #5)
 * Handles modals, palettes, and overlays in correct LIFO order.
 */
const escapeHandlers = []

const handleGlobalKeyDown = (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    if (escapeHandlers.length > 0) {
      const topHandler = escapeHandlers[escapeHandlers.length - 1]
      const handled = topHandler(e)
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }
}

// Single singleton listener
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
}

export const useKeyboardShortcuts = (shortcuts) => {
  const shortcutsRef = useRef(shortcuts)

  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  useEffect(() => {
    if (!shortcuts.onEscape) return

    // Define a stable wrapper that always points to the LATEST closure
    const wrappedHandler = (e) => {
      if (shortcutsRef.current.onEscape) {
        return shortcutsRef.current.onEscape(e) ?? true
      }
      return false
    }

    // Push to global stack
    escapeHandlers.push(wrappedHandler)

    return () => {
      const index = escapeHandlers.indexOf(wrappedHandler)
      if (index !== -1) {
        escapeHandlers.splice(index, 1)
      }
    }
  }, [!!shortcuts.onEscape]) // Only re-bind if the presence of the handler toggles

  // Non-Escape Shortcuts (Save, etc.)
  useEffect(() => {
    const handleOtherKeys = (e) => {
      const isCmd = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      // Save: Ctrl+S
      if (isCmd && key === 's' && shortcutsRef.current.onSave) {
        e.preventDefault()
        shortcutsRef.current.onSave()
      }

      // Toggle Palette: Ctrl+P only
      if (isCmd && key === 'p' && shortcutsRef.current.onTogglePalette) {
        e.preventDefault()
        shortcutsRef.current.onTogglePalette()
      }

      // Toggle Inspector: Ctrl+I (Strictly no Shift)
      if (isCmd && !e.shiftKey && key === 'i' && shortcutsRef.current.onToggleInspector) {
        e.preventDefault()
        shortcutsRef.current.onToggleInspector()
      }

      // Toggle Preview: Ctrl+\ or Ctrl+Shift+V
      const isBackslash = e.key === '\\' || e.key === '|'
      const triggerPreview = (isCmd && isBackslash) || (isCmd && e.shiftKey && key === 'v')

      if (triggerPreview) {
        if (shortcutsRef.current.onTogglePreview) {
          e.preventDefault()
          shortcutsRef.current.onTogglePreview()
        }
      }
    }

    window.addEventListener('keydown', handleOtherKeys)
    return () => window.removeEventListener('keydown', handleOtherKeys)
  }, [])
}
