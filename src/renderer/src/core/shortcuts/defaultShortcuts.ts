export type { ShortcutDefinition, ShortcutGroup, ShortcutMap, DisplayShortcutItem } from './types'
import type { ShortcutDefinition, ShortcutGroup, ShortcutMap, DisplayShortcutItem } from './types'

export type ShortcutItem = DisplayShortcutItem

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // General
  { id: 'spotlight', label: 'Spotlight (Internal & Global)', defaultKey: 'Ctrl + Space', category: 'General', isGlobal: true },
  { id: 'commandPalette', label: 'Command Palette', defaultKey: 'Ctrl + Shift + P', category: 'General' },
  { id: 'settings', label: 'Settings', defaultKey: 'Ctrl + ,', category: 'General' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', defaultKey: 'Ctrl + /', category: 'General' },
  { id: 'quickSearch', label: 'Quick Search', defaultKey: 'Ctrl + P', category: 'General' },
  { id: 'globalSearch', label: 'Global Search', defaultKey: 'Ctrl + Shift + F', category: 'General' },
  { id: 'toggleTheme', label: 'Toggle Theme', defaultKey: 'Ctrl + T', category: 'General' },
  { id: 'aiChat', label: 'AI Chat', defaultKey: 'Ctrl + Shift + \\', category: 'General' },
  { id: 'canvasDrawer', label: 'Spatial Canvas', defaultKey: 'Ctrl + Shift + ;', category: 'General' },
  { id: 'voiceDictation', label: 'Voice Dictation', defaultKey: 'Shift + Alt + V', category: 'General' },

  // File
  { id: 'newNote', label: 'New Note', defaultKey: 'Ctrl + N', category: 'File' },
  { id: 'newFolder', label: 'New Folder', defaultKey: 'Ctrl + Shift + N', category: 'File' },
  { id: 'openFile', label: 'Open File', defaultKey: 'Ctrl + O', category: 'File' },
  { id: 'save', label: 'Save', defaultKey: 'Ctrl + S', category: 'File' },
  { id: 'changeIcon', label: 'Change Note / Tab Icon', defaultKey: 'Win + Shift + .', category: 'File' },
  { id: 'closeTab', label: 'Close Tab', defaultKey: 'Ctrl + W', category: 'File' },
  { id: 'closeWindow', label: 'Close Window', defaultKey: 'Ctrl + Shift + W', category: 'File' },
  { id: 'quitApp', label: 'Close the App (Quit)', defaultKey: 'Ctrl + Q', category: 'File' },
  { id: 'deleteNote', label: 'Delete Note', defaultKey: 'Ctrl + Shift + D', category: 'File', isDanger: true },

  // Navigation
  { id: 'zenMode', label: 'Toggle Zen Mode', defaultKey: 'Ctrl + .', category: 'Navigation' },
  { id: 'focusBreadcrumbs', label: 'Focus Breadcrumbs', defaultKey: 'Ctrl + Shift + .', category: 'Navigation' },
  { id: 'toggleSidebar', label: 'Toggle Left Sidebar', defaultKey: 'Ctrl + B', category: 'Navigation' },
  { id: 'toggleInspector', label: 'Toggle Right Sidebar', defaultKey: 'Ctrl + I', category: 'Navigation' },
  { id: 'toggleTerminal', label: 'Toggle Terminal', defaultKey: 'Ctrl + J', category: 'Navigation' },
  { id: 'toggleOutline', label: 'Toggle Outline', defaultKey: 'Ctrl + Shift + O', category: 'Navigation' },
  { id: 'graphView', label: 'Graph View', defaultKey: 'Ctrl + G', category: 'Navigation' },
  { id: 'localGraph', label: 'Local Graph', defaultKey: 'Alt + G', category: 'Navigation' },
  { id: 'splitVertical', label: 'Split Editor Right (Vertical)', defaultKey: 'Ctrl + \\', category: 'Navigation' },
  { id: 'splitHorizontal', label: 'Split Editor Down (Horizontal)', defaultKey: 'Ctrl + Alt + \\', category: 'Navigation' },
  { id: 'nextTab', label: 'Next Tab', defaultKey: 'Ctrl + Tab', category: 'Navigation' },
  { id: 'previousTab', label: 'Previous Tab', defaultKey: 'Ctrl + Shift + Tab', category: 'Navigation' },
  { id: 'tab1', label: 'Switch to Tab 1', defaultKey: 'Ctrl + 1', category: 'Navigation' },
  { id: 'tab2', label: 'Switch to Tab 2', defaultKey: 'Ctrl + 2', category: 'Navigation' },
  { id: 'tab3', label: 'Switch to Tab 3', defaultKey: 'Ctrl + 3', category: 'Navigation' },
  { id: 'tab4', label: 'Switch to Tab 4', defaultKey: 'Ctrl + 4', category: 'Navigation' },
  { id: 'tab5', label: 'Switch to Tab 5', defaultKey: 'Ctrl + 5', category: 'Navigation' },
  { id: 'tab6', label: 'Switch to Tab 6', defaultKey: 'Ctrl + 6', category: 'Navigation' },
  { id: 'tab7', label: 'Switch to Tab 7', defaultKey: 'Ctrl + 7', category: 'Navigation' },
  { id: 'tab8', label: 'Switch to Tab 8', defaultKey: 'Ctrl + 8', category: 'Navigation' },
  { id: 'tab9', label: 'Switch to Tab 9', defaultKey: 'Ctrl + 9', category: 'Navigation' },

  // Editor
  { id: 'inlineAI', label: 'Inline AI', defaultKey: 'Ctrl + K', category: 'Editor' },
  { id: 'moveLineUp', label: 'Move Line Up', defaultKey: 'Alt + Up', category: 'Editor' },
  { id: 'moveLineDown', label: 'Move Line Down', defaultKey: 'Alt + Down', category: 'Editor' },
  { id: 'duplicateLineUp', label: 'Duplicate Line Up', defaultKey: 'Shift + Alt + Up', category: 'Editor' },
  { id: 'duplicateLineDown', label: 'Duplicate Line Down', defaultKey: 'Shift + Alt + Down', category: 'Editor' },
  { id: 'toggleTask', label: 'Toggle Task / Checklist', defaultKey: 'Ctrl + Shift + X', category: 'Editor' },
  { id: 'pasteFormatted', label: 'Paste with Formatting', defaultKey: 'Ctrl + V', category: 'Editor', readonly: true },
  { id: 'pastePlainText', label: 'Paste as Plain Text', defaultKey: 'Ctrl + Shift + V', category: 'Editor', readonly: true }
]

export function normalizeShortcutString(str: string): string {
  if (!str) return ''
  const parts = str
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)

  let ctrl = false
  let alt = false
  let shift = false
  let meta = false
  let mainKey = ''

  for (const part of parts) {
    const p = part.toLowerCase()
    if (p === 'ctrl' || p === 'control') ctrl = true
    else if (p === 'alt' || p === 'option') alt = true
    else if (p === 'shift') shift = true
    else if (p === 'win' || p === 'cmd' || p === 'meta' || p === 'command' || p === 'super') meta = true
    else mainKey = part.toUpperCase()
  }

  const result: string[] = []
  if (ctrl) result.push('Ctrl')
  if (alt) result.push('Alt')
  if (shift) result.push('Shift')
  if (meta) result.push('Win')
  if (mainKey) result.push(mainKey)

  return result.join(' + ')
}

function canonicalMainKey(raw: string): string {
  const p = raw.trim().toLowerCase()
  if (p === 'arrowup' || p === 'up') return 'up'
  if (p === 'arrowdown' || p === 'down') return 'down'
  if (p === 'arrowleft' || p === 'left') return 'left'
  if (p === 'arrowright' || p === 'right') return 'right'
  if (p === ' ' || p === 'space') return 'space'
  if (p === '?' || p === '/') return '/'
  if (p === '>' || p === '.') return '.'
  if (p === '<' || p === ',') return ','
  if (p === ':' || p === ';') return ';'
  if (p === '|' || p === '\\') return '\\'
  return p
}

/**
 * Returns true if a browser `KeyboardEvent` matches a Lumina shortcut string
 * (e.g. `'Alt + Up'`, `'Shift + Alt + Down'`, `'Ctrl + Shift + X'`).
 * Maps `Ctrl` to `Cmd` (`metaKey`) on macOS automatically.
 */
export function matchesShortcutEvent(e: KeyboardEvent, shortcutStr: string): boolean {
  if (!shortcutStr) return false
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)

  const parts = shortcutStr
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)

  let expectCtrl = false
  let expectAlt = false
  let expectShift = false
  let expectWin = false
  let expectKey = ''

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control' || part === 'cmd' || part === 'command') {
      expectCtrl = true
    } else if (part === 'alt' || part === 'option') {
      expectAlt = true
    } else if (part === 'shift') {
      expectShift = true
    } else if (part === 'win' || part === 'meta' || part === 'super') {
      expectWin = true
    } else {
      expectKey = canonicalMainKey(part)
    }
  }

  if (!expectKey) return false

  const actualCtrl = isMac ? e.metaKey : e.ctrlKey
  const actualWin = isMac ? e.ctrlKey : e.metaKey
  if (actualCtrl !== expectCtrl) return false
  if (e.altKey !== expectAlt) return false
  if (e.shiftKey !== expectShift) return false
  if (actualWin !== expectWin) return false

  const code = e.code || ''
  let actualKey = ''
  if (code.startsWith('Key')) actualKey = code.slice(3).toLowerCase()
  else if (code.startsWith('Digit')) actualKey = code.slice(5).toLowerCase()
  else if (code === 'Space') actualKey = 'space'
  else if (code === 'ArrowUp') actualKey = 'up'
  else if (code === 'ArrowDown') actualKey = 'down'
  else if (code === 'ArrowLeft') actualKey = 'left'
  else if (code === 'ArrowRight') actualKey = 'right'
  else actualKey = canonicalMainKey(e.key || '')

  return actualKey === expectKey
}

/**
 * Resolves the active shortcut string for a given shortcut ID using custom overrides.
 */
export function getActiveShortcut(id: string, customShortcuts?: ShortcutMap): string {
  const custom = customShortcuts?.[id]
  if (custom) return custom
  return DEFAULT_SHORTCUTS.find((s) => s.id === id)?.defaultKey ?? ''
}

export function buildShortcutGroups(customShortcuts?: ShortcutMap): ShortcutGroup[] {
  const categories: ShortcutGroup['title'][] = ['General', 'File', 'Navigation', 'Editor']

  return categories.map((category) => {
    const items = DEFAULT_SHORTCUTS.filter((s) => s.category === category).map((def) => {
      const customKey = customShortcuts?.[def.id]
      const activeKey = customKey || def.defaultKey
      return {
        id: def.id,
        label: def.label,
        key: activeKey,
        defaultKey: def.defaultKey,
        isDanger: def.isDanger,
        isCustom: Boolean(customKey && customKey !== def.defaultKey),
        readonly: def.readonly
      }
    })

    return {
      title: category,
      items
    }
  })
}

export const SHORTCUT_DISPLAY_GROUPS: ShortcutGroup[] = buildShortcutGroups()
