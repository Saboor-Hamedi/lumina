export type ShortcutCategory = 'General' | 'File' | 'Navigation' | 'Editor'

export interface ShortcutDefinition {
  id: string
  label: string
  defaultKey: string
  category: ShortcutCategory
  isDanger?: boolean
  description?: string
  isGlobal?: boolean
  readonly?: boolean
}

export type ShortcutMap = Record<string, string>

export interface DisplayShortcutItem {
  id: string
  label: string
  key: string
  defaultKey: string
  isDanger?: boolean
  isCustom?: boolean
  readonly?: boolean
}

export interface ShortcutGroup {
  title: ShortcutCategory
  items: DisplayShortcutItem[]
}

export interface KeyboardShortcutHandlers {
  onEscape?: ((e?: KeyboardEvent) => boolean | void) | null
  onNextTab?: () => void
  onPreviousTab?: () => void
  onGlobalSearch?: () => void
  onFocusBreadcrumbs?: () => void
  onChangeIcon?: () => void
  onSave?: () => void
  onTogglePalette?: () => void
  onTogglePaletteCommandMode?: () => void
  onOpenFile?: () => void
  onToggleCommandPalette?: () => void
  onToggleSettings?: () => void
  onNew?: () => void
  onOpenDocs?: () => void
  onOpenShortcuts?: () => void
  onToggleTheme?: () => void
  onDelete?: () => void
  onRevealInExplorer?: () => void
  onRename?: () => void
  onToggleInspector?: () => void
  onToggleGraph?: () => void
  onCloseTab?: () => void
  onCloseWindow?: () => void
  onToggleAIChat?: () => void
  onTogglePreview?: () => void
  onToggleSidebar?: () => void
  onToggleInlineDrawing?: () => void
  onInlineAI?: () => boolean | void
}
