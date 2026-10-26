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
 * Example shortcut strings: "Ctrl + S", "Ctrl + Shift + F", "Shift + Alt + V", "Win + Shift + ."
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
    if (p === 'ctrl' || p === 'control' || p === 'cntl' || p === 'ctl') reqCtrl = true
    else if (p === 'shift') reqShift = true
    else if (p === 'alt' || p === 'option') reqAlt = true
    else if (p === 'win' || p === 'cmd' || p === 'meta' || p === 'command' || p === 'super') reqMeta = true
    else reqKey = part
  }

  // Platform-aware modifier mapping.
  // On macOS the primary command key is Command (meta), which our shortcut
  // strings call "Ctrl"; the physical Control key is represented as "Win".
  // On Windows/Linux "Ctrl" is physical Control and "Win" is the meta key.
  // Keeping Ctrl and Meta distinct means a meta combo such as "Win + Shift + ."
  // can never be mistaken for the Ctrl shortcut "Ctrl + Shift + ." (and back),
  // which previously made one action shadow the other.
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)
  const wantsCtrlKey = isMac ? reqMeta : reqCtrl
  const wantsMetaKey = isMac ? reqCtrl : reqMeta

  if (Boolean(wantsCtrlKey) !== Boolean(e.ctrlKey)) return false
  if (Boolean(wantsMetaKey) !== Boolean(e.metaKey)) return false

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

  // Dedicated robust semicolon matching (handles ':' shifted key and Semicolon code)
  const isSemicolonTarget = targetKey === ';' || targetKey === ':' || targetKey === 'semicolon'
  if (isSemicolonTarget) {
    const isSemicolonEvent =
      eventKey === ';' ||
      eventKey === ':' ||
      e.code === 'Semicolon' ||
      e.keyCode === 186 ||
      e.keyCode === 59
    if (!isSemicolonEvent) return false
    if (Boolean(reqShift) !== Boolean(e.shiftKey)) return false
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
    // If the saved shortcut is the old deprecated default 'Ctrl + Shift + /', migrate to new default
    if (id === 'canvasDrawer' && customShortcuts[id] === 'Ctrl + Shift + /') {
      return 'Ctrl + Shift + ;'
    }
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

      // When focus is inside the terminal, pass through all typing and keys to the shell,
      // only intercepting the toggleTerminal shortcut (Ctrl + J) so the user can close the dock.
      const isInsideTerminal = !!(document.activeElement as HTMLElement)?.closest?.('.xterm, .lumina-terminal, .xterm-helper-textarea')
      if (isInsideTerminal) {
        if (matchesShortcut(e, getKey('toggleTerminal')) && shortcutsRef.current.onToggleTerminal) {
          e.preventDefault()
          e.stopPropagation()
          shortcutsRef.current.onToggleTerminal()
        }
        return
      }

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

      // Direct Tab Navigation (Ctrl+1 through Ctrl+9)
      const isPrimary = (e.ctrlKey || e.metaKey) && !e.altKey
      if (isPrimary && !e.shiftKey && e.key >= '1' && e.key <= '9' && shortcutsRef.current.onSelectTabByIndex) {
        const tabIndex = parseInt(e.key, 10) - 1
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onSelectTabByIndex(tabIndex)
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

      // Zen Mode (Ctrl + .)
      if (matchesShortcut(e, getKey('zenMode'))) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        const now = Date.now()
        const last = (window as any).__lastZenDispatch || 0
        if (now - last < 400) return
        ;(window as any).__lastZenDispatch = now

        if (typeof document !== 'undefined') {
          document.documentElement.classList.add('zen-instant-transition')
        }
        if (shortcutsRef.current.onToggleZenMode) {
          shortcutsRef.current.onToggleZenMode()
        } else {
          useSettingsStore.getState().toggleZenMode()
        }
        if (typeof window !== 'undefined') {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              document.documentElement.classList.remove('zen-instant-transition')
            })
          })
        }
        return
      }

      // Command Mode Palette (Ctrl+Shift+P)
      const commandModeKey = userShortcuts['commandPalette'] || userShortcuts['commandMode'] || 'Ctrl + Shift + P'
      if (matchesShortcut(e, commandModeKey)) {
        e.preventDefault()
        e.stopPropagation()
        if (shortcutsRef.current.onTogglePaletteCommandMode) {
          shortcutsRef.current.onTogglePaletteCommandMode()
        } else if (shortcutsRef.current.onToggleCommandPalette) {
          shortcutsRef.current.onToggleCommandPalette()
        }
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

      // Spatial Canvas Tab (Ctrl + Shift + ;)
      const isSemicolonCode =
        e.code === 'Semicolon' ||
        e.key === ';' ||
        e.key === ':' ||
        e.keyCode === 186 ||
        e.keyCode === 59
      const isDirectCanvasDefault =
        (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && isSemicolonCode
      const matchesCustom =
        matchesShortcut(e, getKey('canvasDrawer')) || matchesShortcut(e, getKey('canvas'))

      if (isDirectCanvasDefault || matchesCustom) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        const now = Date.now()
        if ((window as any).__lastCanvasDispatch && now - (window as any).__lastCanvasDispatch < 300) {
          return
        }
        ;(window as any).__lastCanvasDispatch = now
        if (shortcutsRef.current.onToggleCanvas) {
          shortcutsRef.current.onToggleCanvas()
        } else if (shortcutsRef.current.onToggleCanvasDrawer) {
          shortcutsRef.current.onToggleCanvasDrawer()
        } else {
          window.dispatchEvent(new CustomEvent('open-canvas-tab'))
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

      // Toggle the right sidebar directly to its outline pane.
      if (matchesShortcut(e, getKey('toggleOutline')) && shortcutsRef.current.onToggleOutline) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onToggleOutline()
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

      // Close the App (Quit)
      if (matchesShortcut(e, getKey('quitApp')) && shortcutsRef.current.onQuitApp) {
        e.preventDefault()
        e.stopPropagation()
        shortcutsRef.current.onQuitApp()
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

      // Toggle Terminal (Ctrl+J or configured shortcut)
      const isPrimaryMod = (e.ctrlKey || e.metaKey) && !e.altKey
      const isDirectCtrlJ = isPrimaryMod && !e.shiftKey && (e.key === 'j' || e.key === 'J' || e.code === 'KeyJ')
      const isDirectBacktick = isPrimaryMod && !e.shiftKey && (e.key === '`' || e.code === 'Backquote')
      const isTerminalKey =
        isDirectCtrlJ ||
        isDirectBacktick ||
        matchesShortcut(e, getKey('toggleTerminal')) ||
        matchesShortcut(e, 'Ctrl + J') ||
        matchesShortcut(e, 'Ctrl + `') ||
        matchesShortcut(e, "Ctrl + '")
      if (isTerminalKey && shortcutsRef.current.onToggleTerminal) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        shortcutsRef.current.onToggleTerminal()
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
