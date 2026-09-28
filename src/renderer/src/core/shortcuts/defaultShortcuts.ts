import { ShortcutDefinition, ShortcutGroup, ShortcutMap } from './types'

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // General
  { id: 'spotlight', label: 'Spotlight (Internal & Global)', defaultKey: 'Ctrl + Space', category: 'General', isGlobal: true },
  { id: 'settings', label: 'Settings', defaultKey: 'Ctrl + ,', category: 'General' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', defaultKey: 'Ctrl + /', category: 'General' },
  { id: 'quickSearch', label: 'Quick Search', defaultKey: 'Ctrl + P', category: 'General' },
  { id: 'globalSearch', label: 'Global Search', defaultKey: 'Ctrl + Shift + F', category: 'General' },
  { id: 'toggleTheme', label: 'Toggle Theme', defaultKey: 'Ctrl + T', category: 'General' },
  { id: 'aiChat', label: 'AI Chat', defaultKey: 'Ctrl + Shift + \\', category: 'General' },
  { id: 'canvasDrawer', label: 'Canvas Drawer', defaultKey: 'Ctrl + Shift + /', category: 'General' },
  { id: 'voiceDictation', label: 'Voice Dictation', defaultKey: 'Shift + Alt + V', category: 'General' },

  // File
  { id: 'newNote', label: 'New Note', defaultKey: 'Ctrl + N', category: 'File' },
  { id: 'openFile', label: 'Open File', defaultKey: 'Ctrl + O', category: 'File' },
  { id: 'save', label: 'Save', defaultKey: 'Ctrl + S', category: 'File' },
  { id: 'changeIcon', label: 'Change Note / Tab Icon', defaultKey: 'Ctrl + Win + .', category: 'File' },
  { id: 'closeTab', label: 'Close Tab', defaultKey: 'Ctrl + W', category: 'File' },
  { id: 'closeWindow', label: 'Close Window', defaultKey: 'Ctrl + Shift + W', category: 'File' },
  { id: 'deleteNote', label: 'Delete Note', defaultKey: 'Ctrl + Shift + D', category: 'File', isDanger: true },

  // Navigation
  { id: 'focusBreadcrumbs', label: 'Focus Breadcrumbs', defaultKey: 'Ctrl + Shift + .', category: 'Navigation' },
  { id: 'toggleSidebar', label: 'Toggle Left Sidebar', defaultKey: 'Ctrl + B', category: 'Navigation' },
  { id: 'toggleInspector', label: 'Toggle Right Sidebar', defaultKey: 'Ctrl + Shift + B', category: 'Navigation' },
  { id: 'toggleOutline', label: 'Toggle Outline', defaultKey: 'Ctrl + Shift + O', category: 'Navigation' },
  { id: 'graphView', label: 'Graph View', defaultKey: 'Ctrl + G', category: 'Navigation' },
  { id: 'togglePreview', label: 'Toggle Preview', defaultKey: 'Ctrl + \\', category: 'Navigation' },
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
