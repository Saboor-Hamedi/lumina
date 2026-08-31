import { useEffect, useRef } from 'react'

/**
 * Robust Global Stack-Based Escape Handler (Engineering Std #5)
 * Handles modals, palettes, and overlays in correct LIFO order.
 */
const escapeHandlers = []

const handleGlobalKeyDown = (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    for (let i = escapeHandlers.length - 1; i >= 0; i--) {
      const handler = escapeHandlers[i]
      const handled = handler(e)
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
        break
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
      // Prevent keyboard auto-repeat from triggering actions multiple times rapidly (e.g. creating 10 new notes)
      if (e.repeat) return

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

      // Global Search: Ctrl+Shift+F
      if (isCmd && e.shiftKey && key === 'f' && shortcutsRef.current.onGlobalSearch) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onGlobalSearch()
        return
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

      // Toggle Palette in Command Mode: Ctrl+Shift+P
      if (isCmd && e.shiftKey && key === 'p' && shortcutsRef.current.onTogglePaletteCommandMode) {
        e.preventDefault()
        shortcutsRef.current.onTogglePaletteCommandMode()
      }

      // Open File: Ctrl+O
      if (isCmd && !e.shiftKey && key === 'o' && shortcutsRef.current.onOpenFile) {
        e.preventDefault()
        shortcutsRef.current.onOpenFile()
      }

      // Command Palette (Internal Spotlight): Ctrl+Space
      if (
        isCmd &&
        !e.shiftKey &&
        (key === ' ' || e.code === 'Space') &&
        shortcutsRef.current.onToggleCommandPalette
      ) {
        e.preventDefault()
        shortcutsRef.current.onToggleCommandPalette()
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

      // Open Docs: Ctrl+D
      if (isCmd && !e.shiftKey && key === 'd' && shortcutsRef.current.onOpenDocs) {
        e.preventDefault()
        shortcutsRef.current.onOpenDocs()
      }

      // Open Shortcuts: Ctrl+? or Ctrl+/
      if (isCmd && (e.key === '?' || key === '/' || (e.shiftKey && key === '/')) && shortcutsRef.current.onOpenShortcuts) {
        e.preventDefault()
        shortcutsRef.current.onOpenShortcuts()
      }

      // Change Note / Tab Icon: Win + Shift + . or Ctrl + Shift + . (or Win + .)
      if (isCmd && (key === '.' || e.code === 'Period' || e.key === '>') && shortcutsRef.current.onChangeIcon) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onChangeIcon()
      }

      // Toggle Theme: Ctrl+T
      if (isCmd && !e.shiftKey && key === 't' && shortcutsRef.current.onToggleTheme) {
        e.preventDefault()
        shortcutsRef.current.onToggleTheme()
      }

      // Delete Snippet: Ctrl+Shift+D
      if (isCmd && e.shiftKey && key === 'd' && shortcutsRef.current.onDelete) {
        e.preventDefault()
        shortcutsRef.current.onDelete()
      }

      // Reveal in Explorer: Ctrl+Shift+E
      if (isCmd && e.shiftKey && key === 'e' && shortcutsRef.current.onRevealInExplorer) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onRevealInExplorer()
      }

      // Rename: Ctrl+R
      if (isCmd && !e.shiftKey && key === 'r' && shortcutsRef.current.onRename) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onRename()
      }

      // Toggle Inspector: Ctrl+I
      if (isCmd && !e.shiftKey && key === 'i' && shortcutsRef.current.onToggleInspector) {
        e.preventDefault()
        e.stopPropagation()
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

      // AI Chat: Ctrl+Shift+\
      const isBackslash = e.key === '\\' || e.key === '|'
      if (isCmd && e.shiftKey && isBackslash) {
        if (shortcutsRef.current.onToggleAIChat) {
          e.preventDefault()
          e.stopPropagation()
          shortcutsRef.current.onToggleAIChat()
          return
        }
      }

      // Toggle Preview: Ctrl+\ or Ctrl+Shift+V
      const triggerPreview = (isCmd && !e.shiftKey && isBackslash) || (isCmd && e.shiftKey && key === 'v')

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

export const SHORTCUT_DISPLAY_GROUPS = [
  {
    title: 'General',
    items: [
      { label: 'Spotlight (Internal & Global)', key: 'Ctrl + Space' },
      { label: 'Settings', key: 'Ctrl + ,' },
      { label: 'Keyboard Shortcuts', key: 'Ctrl + /' },
      { label: 'Quick Search', key: 'Ctrl + P' },
      { label: 'Global Search', key: 'Ctrl + Shift + F' },
      { label: 'Toggle Theme', key: 'Ctrl + T' },
      { label: 'AI Chat', key: 'Ctrl + Shift + \\' }
    ]
  },
  {
    title: 'File',
    items: [
      { label: 'New Note', key: 'Ctrl + N' },
      { label: 'Open File', key: 'Ctrl + O' },
      { label: 'Save', key: 'Ctrl + S' },
      { label: 'Change Note / Tab Icon', key: 'Win + Shift + .' },
      { label: 'Close Tab', key: 'Ctrl + W' },
      { label: 'Close Window', key: 'Ctrl + Shift + W' },
      { label: 'Delete Note', key: 'Ctrl + Shift + D', isDanger: true }
    ]
  },
  {
    title: 'Navigation',
    items: [
      { label: 'Toggle Left Sidebar', key: 'Ctrl + B' },
      { label: 'Toggle Inspector', key: 'Ctrl + I' },
      { label: 'Graph View', key: 'Ctrl + G' },
      { label: 'Toggle Preview', key: 'Ctrl + \\' },
      { label: 'Next Tab', key: 'Ctrl + Tab' },
      { label: 'Previous Tab', key: 'Ctrl + Shift + Tab' }
    ]
  },
  {
    title: 'Editor',
    items: [{ label: 'Inline AI', key: 'Ctrl + K' }]
  }
]
