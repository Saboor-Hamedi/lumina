import { useEffect, useRef } from 'react'
import { KeyboardShortcutHandlers, ShortcutMap } from './types'
import { DEFAULT_SHORTCUTS, buildShortcutGroups, SHORTCUT_DISPLAY_GROUPS } from './defaultShortcuts'
import { useSettingsStore } from '../store/SettingStore'

export { buildShortcutGroups, SHORTCUT_DISPLAY_GROUPS }

/**
 * Robust Global Stack-Based Escape Handler (Engineering Std #5)
 * Handles modals, palettes, and overlays in correct LIFO order.
 */
type EscapeHandler = (e: KeyboardEvent) => boolean | void
const escapeHandlers: EscapeHandler[] = []

const handleGlobalKeyDown = (e: KeyboardEvent): void => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    // Shortcut recorders own Escape while they are active.
    if (
      (window as any).__isRecordingShortcut ||
      document.querySelector('.shortcut-recording, .shortcut-inline-input, .shortcut-modal-overlay')
    ) {
      return
    }

    // 1. Check topmost ephemeral hover cards first
    const hoverCard = document.querySelector('.cm-wiki-hover, .wikilink-hover-card, .hover-preview-card')
    if (hoverCard) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      window.dispatchEvent(new CustomEvent('close-hover-card'))
      hoverCard.remove()
      return
    }

    // 2. Lightboxes (Mermaid or Image Lightbox)
    const lightbox = document.querySelector('.mermaid-lightbox-overlay.show, .image-lightbox-overlay.show')
    if (lightbox) {
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      window.dispatchEvent(new CustomEvent('close-lightbox'))
      return
    }

    // 3. Process registered stack-based handlers in strict LIFO order
    for (let i = escapeHandlers.length - 1; i >= 0; i--) {
      const handler = escapeHandlers[i]
      const handled = handler(e)
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        break
      }
    }
  }
}

// Single singleton listener for Escape stack
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
}

/**
 * Checks if a KeyboardEvent matches a given shortcut key combination string.
 * Example shortcut strings: "Ctrl + S", "Ctrl + Shift + F", "Shift + Alt + V", "Ctrl + Win + ."
 */
export function matchesShortcut(e: KeyboardEvent, shortcutStr: string): boolean {
  if (!shortcutStr || shortcutStr === 'disabled') return false

  const parts = shortcutStr
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)

  let reqCtrl = false
  let reqShift = false
  let reqAlt = false
  let reqMeta = false
  let reqKey = ''

  for (const part of parts) {
    const p = part.toLowerCase()
    if (p === 'ctrl' || p === 'control') reqCtrl = true
    else if (p === 'shift') reqShift = true
    else if (p === 'alt' || p === 'option') reqAlt = true
    else if (p === 'win' || p === 'cmd' || p === 'meta' || p === 'command' || p === 'super') reqMeta = true
    else reqKey = part
  }

  // Platform-aware modifier mapping:
  // In cross-platform editors, Cmd/Meta on Mac and Ctrl on Win/Linux are interchangeable as primary command keys.
  // We allow either e.ctrlKey or e.metaKey for primary actions (reqCtrl).
  const isPrimaryPressed = e.ctrlKey || e.metaKey
  const isSecondaryPressed = e.ctrlKey && e.metaKey

  if (reqMeta && reqCtrl) {
    if (!isSecondaryPressed) return false
  } else if (reqMeta || reqCtrl) {
    if (!isPrimaryPressed) return false
  } else {
    // If neither was requested, neither should be pressed
    if (e.ctrlKey || e.metaKey) return false
  }

  // Main key matching
  const targetKey = reqKey.toLowerCase()
  const eventKey = e.key.toLowerCase()

  // For slash or question mark:
  // Note: On standard US layouts, '?' is Shift + '/'.
  // If targetKey is '?', it requires shift (either explicit 'Shift + ?' or implied by '?').
  // If targetKey is '/', it should only match without shift unless reqShift is explicitly true.
  const isTargetSlashOrQuestion = targetKey === '/' || targetKey === '?'
  if (isTargetSlashOrQuestion) {
    const isEventSlashOrQuestion =
      eventKey === '/' ||
      eventKey === '?' ||
      e.code === 'Slash' ||
      e.code === 'NumpadDivide' ||
      eventKey === 'divide'
    if (!isEventSlashOrQuestion) return false

    const expectsShift = reqShift || targetKey === '?'
    if (expectsShift !== Boolean(e.shiftKey)) return false
    if (Boolean(reqAlt) !== Boolean(e.altKey)) return false
    return true
  }

  if (Boolean(reqShift) !== Boolean(e.shiftKey)) return false
  if (Boolean(reqAlt) !== Boolean(e.altKey)) return false

  if (targetKey === 'space' || targetKey === ' ') {
    return e.code === 'Space' || eventKey === ' ' || eventKey === 'space'
  }
  if (targetKey === 'tab') {
    return e.key === 'Tab' || e.code === 'Tab'
  }
  if (targetKey === '.') {
    return eventKey === '.' || eventKey === '>' || e.code === 'Period'
  }
  if (targetKey === ',') {
    return eventKey === ',' || eventKey === '<' || e.code === 'Comma'
  }
  if (targetKey === ';') {
    return eventKey === ';' || eventKey === ':' || e.code === 'Semicolon'
  }
  if (targetKey === '\\') {
    return eventKey === '\\' || eventKey === '|' || e.code === 'Backslash'
  }

  // Alphabetic / numeric / other keys
  if (eventKey === targetKey) return true
  if (e.code.toLowerCase() === `key${targetKey}`) return true
  if (e.code.toLowerCase() === `digit${targetKey}`) return true

  return false
}

/**
 * Returns current shortcut key string for a given shortcut ID from settings or defaults.
 */
export function getActiveShortcutKey(id: string, customShortcuts?: ShortcutMap): string {
  if (customShortcuts && customShortcuts[id]) {
    return customShortcuts[id]
  }
  const def = DEFAULT_SHORTCUTS.find((s) => s.id === id)
  return def ? def.defaultKey : ''
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcutHandlers): void => {
  const shortcutsRef = useRef<KeyboardShortcutHandlers>(shortcuts)

  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  // Escape stack registration
  useEffect(() => {
    if (!shortcuts.onEscape) return

    const wrappedHandler: EscapeHandler = (e) => {
      if (shortcutsRef.current.onEscape) {
        return shortcutsRef.current.onEscape(e) ?? true
      }
      return false
    }

    escapeHandlers.push(wrappedHandler)

    return () => {
      const index = escapeHandlers.indexOf(wrappedHandler)
      if (index !== -1) {
        escapeHandlers.splice(index, 1)
      }
    }
  }, [!shortcuts.onEscape])

  // Dynamic Keydown shortcuts listener
  useEffect(() => {
    const handleOtherKeys = (e: KeyboardEvent): void => {
      // Prevent keyboard auto-repeat from triggering actions repeatedly
      if (e.repeat) return

      // Never trigger any shortcut if user is currently recording a new shortcut
      if (
        (window as any).__isRecordingShortcut ||
        document.querySelector('.shortcut-recording, .shortcut-inline-input, .shortcut-modal-overlay') ||
        (document.activeElement as HTMLElement)?.closest?.('.shortcut-inline-container, .shortcut-modal')
      ) {
        return
      }

      const userShortcuts = useSettingsStore.getState().settings.shortcuts || {}
      const getKey = (id: string): string => getActiveShortcutKey(id, userShortcuts)

      // Tab Navigation (Ctrl+Tab / Ctrl+Shift+Tab)
      if (matchesShortcut(e, getKey('previousTab')) && shortcutsRef.current.onPreviousTab) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onPreviousTab()
        return
      }
      if (matchesShortcut(e, getKey('nextTab')) && shortcutsRef.current.onNextTab) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onNextTab()
        return
      }

      // Global Search
      if (matchesShortcut(e, getKey('globalSearch')) && shortcutsRef.current.onGlobalSearch) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onGlobalSearch()
        return
      }

      // Focus Breadcrumbs
      if (matchesShortcut(e, getKey('focusBreadcrumbs'))) {
        e.preventDefault()
        e.stopPropagation()
        if (shortcutsRef.current.onFocusBreadcrumbs) {
          shortcutsRef.current.onFocusBreadcrumbs()
        } else {
          window.dispatchEvent(new CustomEvent('focus-breadcrumbs'))
        }
        return
      }

      // Change Note / Tab Icon
      if (matchesShortcut(e, getKey('changeIcon')) && shortcutsRef.current.onChangeIcon) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onChangeIcon()
        return
      }

      // Save
      if (matchesShortcut(e, getKey('save')) && shortcutsRef.current.onSave) {
        e.preventDefault()
        shortcutsRef.current.onSave()
        return
      }

      // Quick Search (Palette)
      if (matchesShortcut(e, getKey('quickSearch')) && shortcutsRef.current.onTogglePalette) {
        e.preventDefault()
        shortcutsRef.current.onTogglePalette()
        return
      }

      // Command Mode Palette (Ctrl+Shift+P)
      const commandModeKey = userShortcuts['commandMode'] || 'Ctrl + Shift + P'
      if (matchesShortcut(e, commandModeKey) && shortcutsRef.current.onTogglePaletteCommandMode) {
        e.preventDefault()
        shortcutsRef.current.onTogglePaletteCommandMode()
        return
      }

      // Open File
      if (matchesShortcut(e, getKey('openFile')) && shortcutsRef.current.onOpenFile) {
        e.preventDefault()
        shortcutsRef.current.onOpenFile()
        return
      }

      // Spotlight (Internal)
      if (matchesShortcut(e, getKey('spotlight')) && shortcutsRef.current.onToggleCommandPalette) {
        e.preventDefault()
        shortcutsRef.current.onToggleCommandPalette()
        return
      }

      // Settings
      if (matchesShortcut(e, getKey('settings')) && shortcutsRef.current.onToggleSettings) {
        e.preventDefault()
        shortcutsRef.current.onToggleSettings()
        return
      }

      // New Note
      if (matchesShortcut(e, getKey('newNote')) && shortcutsRef.current.onNew) {
        e.preventDefault()
        shortcutsRef.current.onNew()
        return
      }

      // Open Docs (Ctrl+D)
      const docsKey = userShortcuts['openDocs'] || 'Ctrl + D'
      if (matchesShortcut(e, docsKey) && shortcutsRef.current.onOpenDocs) {
        e.preventDefault()
        shortcutsRef.current.onOpenDocs()
        return
      }

      // Spatial Canvas Drawer Modal
      if (matchesShortcut(e, getKey('canvasDrawer'))) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        const now = Date.now()
        if ((window as any).__lastCanvasDrawerDispatch && now - (window as any).__lastCanvasDrawerDispatch < 300) {
          return
        }
        ;(window as any).__lastCanvasDrawerDispatch = now
        if (shortcutsRef.current.onToggleCanvasDrawer) {
          shortcutsRef.current.onToggleCanvasDrawer()
        } else {
          window.dispatchEvent(new CustomEvent('toggle-canvas-drawer'))
        }
        return
      }

      // Keyboard Shortcuts Dialog
      if (matchesShortcut(e, getKey('shortcuts')) && shortcutsRef.current.onOpenShortcuts) {
        e.preventDefault()
        shortcutsRef.current.onOpenShortcuts()
        return
      }

      // Toggle Theme
      if (matchesShortcut(e, getKey('toggleTheme')) && shortcutsRef.current.onToggleTheme) {
        e.preventDefault()
        shortcutsRef.current.onToggleTheme()
        return
      }

      // Delete Note
      if (matchesShortcut(e, getKey('deleteNote')) && shortcutsRef.current.onDelete) {
        e.preventDefault()
        shortcutsRef.current.onDelete()
        return
      }

      // Reveal in Explorer (Ctrl+Shift+E)
      const explorerKey = userShortcuts['revealInExplorer'] || 'Ctrl + Shift + E'
      if (matchesShortcut(e, explorerKey) && shortcutsRef.current.onRevealInExplorer) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onRevealInExplorer()
        return
      }

      // Rename (Ctrl+R)
      const renameKey = userShortcuts['rename'] || 'Ctrl + R'
      if (matchesShortcut(e, renameKey) && shortcutsRef.current.onRename) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onRename()
        return
      }

      // Toggle Inspector
      if (matchesShortcut(e, getKey('toggleInspector')) && shortcutsRef.current.onToggleInspector) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onToggleInspector()
        return
      }

      // Graph View
      if (matchesShortcut(e, getKey('graphView')) && shortcutsRef.current.onToggleGraph) {
        e.preventDefault()
        shortcutsRef.current.onToggleGraph()
        return
      }

      // Close Tab
      if (matchesShortcut(e, getKey('closeTab')) && shortcutsRef.current.onCloseTab) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onCloseTab()
        return
      }

      // Close Window
      if (matchesShortcut(e, getKey('closeWindow')) && shortcutsRef.current.onCloseWindow) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onCloseWindow()
        return
      }

      // AI Chat
      if (matchesShortcut(e, getKey('aiChat')) && shortcutsRef.current.onToggleAIChat) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onToggleAIChat()
        return
      }

      // Toggle Preview
      if (matchesShortcut(e, getKey('togglePreview')) && shortcutsRef.current.onTogglePreview) {
        e.preventDefault()
        shortcutsRef.current.onTogglePreview()
        return
      }

      // Voice Dictation
      if (matchesShortcut(e, getKey('voiceDictation'))) {
        e.preventDefault()
        e.stopPropagation()
        const now = Date.now()
        if (window.__lastVoiceToggleDispatch && now - window.__lastVoiceToggleDispatch < 450) {
          return
        }
        window.__lastVoiceToggleDispatch = now
        window.dispatchEvent(new CustomEvent('toggle-voice-dictation'))
        return
      }

      // Toggle Left Sidebar
      if (matchesShortcut(e, getKey('toggleSidebar')) && shortcutsRef.current.onToggleSidebar) {
        e.preventDefault()
        shortcutsRef.current.onToggleSidebar()
        return
      }

      // Inline AI
      if (matchesShortcut(e, getKey('inlineAI')) && shortcutsRef.current.onInlineAI) {
        e.preventDefault()
        e.stopPropagation()
        const handled = shortcutsRef.current.onInlineAI()
        if (handled) {
          e.stopPropagation()
        }
        return
      }
    }

    window.addEventListener('keydown', handleOtherKeys, { capture: true })
    return () => window.removeEventListener('keydown', handleOtherKeys, { capture: true })
  }, [])
}

export default useKeyboardShortcuts
