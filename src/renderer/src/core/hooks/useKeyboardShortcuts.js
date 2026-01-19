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
      
      // Tab Navigation: Ctrl+Tab (next) / Ctrl+Shift+Tab (previous) - Check first before other shortcuts
      if (isCmd && e.key === 'Tab') {
        if (shortcutsRef.current.onNextTab || shortcutsRef.current.onPreviousTab) {
          e.preventDefault()
          e.stopPropagation()
          if (e.shiftKey && shortcutsRef.current.onPreviousTab) {
            shortcutsRef.current.onPreviousTab()
          } else if (!e.shiftKey && shortcutsRef.current.onNextTab) {
            shortcutsRef.current.onNextTab()
          }
          return
        }
      }

      // Save: Ctrl+S (Strictly no Shift)
      if (isCmd && !e.shiftKey && key === 's' && shortcutsRef.current.onSave) {
        e.preventDefault()
        shortcutsRef.current.onSave()
      }

      // Toggle Palette: Ctrl+P
      if (isCmd && !e.shiftKey && key === 'p' && shortcutsRef.current.onTogglePalette) {
        e.preventDefault()
        shortcutsRef.current.onTogglePalette()
      }

      // Toggle Settings: Ctrl+,
      if (isCmd && key === ',' && shortcutsRef.current.onToggleSettings) {
        e.preventDefault()
        shortcutsRef.current.onToggleSettings()
      }

      // New Snippet: Ctrl+N
      if (isCmd && !e.shiftKey && key === 'n' && shortcutsRef.current.onNew) {
        e.preventDefault()
        shortcutsRef.current.onNew()
      }

      // Delete Snippet: Ctrl+Shift+D
      if (isCmd && e.shiftKey && key === 'd' && shortcutsRef.current.onDelete) {
        e.preventDefault()
        shortcutsRef.current.onDelete()
      }

      // Toggle Inspector: Ctrl+I
      if (isCmd && !e.shiftKey && key === 'i' && shortcutsRef.current.onToggleInspector) {
        e.preventDefault()
        shortcutsRef.current.onToggleInspector()
      }

      // Graph Nexus: Ctrl+G
      if (isCmd && !e.shiftKey && key === 'g' && shortcutsRef.current.onToggleGraph) {
        e.preventDefault()
        shortcutsRef.current.onToggleGraph()
      }

      // Close Tab: Ctrl+W
      if (isCmd && !e.shiftKey && key === 'w') {
        if (shortcutsRef.current.onCloseTab) {
          e.preventDefault()
          e.stopPropagation()
          shortcutsRef.current.onCloseTab()
        }
      }

      // Close Window: Ctrl+Shift+W
      if (isCmd && e.shiftKey && key === 'w') {
        if (shortcutsRef.current.onCloseWindow) {
          e.preventDefault()
          e.stopPropagation()
          shortcutsRef.current.onCloseWindow()
        }
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
      // Toggle Sidebar: Ctrl+B
      if (isCmd && !e.shiftKey && key === 'b') {
        if (shortcutsRef.current.onToggleSidebar) {
          e.preventDefault()
          shortcutsRef.current.onToggleSidebar()
        }
      }

      // Inline AI: Ctrl+K
      if (isCmd && !e.shiftKey && key === 'k') {
        if (shortcutsRef.current.onInlineAI) {
          e.preventDefault()
          e.stopPropagation()
          const handled = shortcutsRef.current.onInlineAI()
          if (handled) {
            e.stopPropagation()
          }
        }
      }
    }

    window.addEventListener('keydown', handleOtherKeys, { capture: true })
    return () => window.removeEventListener('keydown', handleOtherKeys, { capture: true })
  }, [])
}
