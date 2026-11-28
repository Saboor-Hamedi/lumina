/**
 * @file SettingStore.ts
 * @description TypeScript migration of useSettingsStore.
 * 
 * MIGRATION NOTICE:
 * This store has been migrated from JavaScript (`useSettingsStore.js`) to TypeScript (`SettingStore.ts`)
 * to provide strict compile-time type checking, auto-completion for setting keys and values,
 * and robust type safety across IPC contracts and localStorage persistence.
 */

import { create } from 'zustand'
import { applyTheme } from '../../features/theme/hooks/themeDefinitions'
import { saveWorkspaceProfile } from '../../features/Settings/hook/workspaceProfile'
import {
  applyLinkCardDomAttributes,
  DEFAULT_LINK_CARD_SETTINGS,
  LINK_CARDS_CONFIG_EVENT,
  type LinkCardColumns,
  type LinkCardSize,
  type LinkCardStyle,
  type LinkCardThumbnailPosition,
  type LinkCardWidth
} from '../../features/links/linkCardConfig'

export interface SidebarSectionCollapsedState {
  pinned: boolean
  recent: boolean
  all: boolean
}

export interface SidebarGeometry {
  width: number
  isLeftOpen: boolean
}

export interface RightSidebarGeometry {
  width: number
  isRightOpen: boolean
}

export interface ZenModeSettings {
  enabled: boolean
  hideTitleBar: boolean
  hideStatusBar: boolean
  hideActivityBar: boolean
  hideRightActivityBar?: boolean
  hidePrimarySidebar: boolean
  hideSecondarySidebar: boolean
  hideTabs?: boolean
}

export interface ZenPreState {
  titleBarVisible?: boolean
  statusBarVisible?: boolean
  activityBarVisible?: boolean
  rightActivityBarVisible?: boolean
  tabsVisible?: boolean
  breadcrumbsVisible?: boolean
  isLeftOpen?: boolean
  isRightOpen?: boolean
}

export interface Settings {
  theme: string
  fontSize: number
  fontFamily: string
  lineHeight: number
  showLineNumbers: boolean
  autoSave: boolean
  cursorStyle: string
  cursor?: { [key: string]: any }
  smoothScrolling: boolean
  /** Reserved editor keymap mode slot (`'default'` | `'vim'`). Vim mode wired later. */
  editorKeymapMode?: 'default' | 'vim'
  sidebarCollapsedSections: SidebarSectionCollapsedState
  sortBy: string
  sortDirection: string
  noteOrder: string[] | null
  inlineMetadata: boolean
  inlineTitle: boolean
  // Link & YouTube Preview Cards
  linkCardsEnabled?: boolean
  linkCardStyle?: LinkCardStyle
  linkCardWidth?: LinkCardWidth
  linkCardSize?: LinkCardSize
  linkCardThumbnailPosition?: LinkCardThumbnailPosition
  linkCardColumns?: LinkCardColumns
  linkCardShowDescription?: boolean
  youtubeOpenInModal?: boolean
  // Per-note Notion-style cover banner & profile emoji (stored ONLY in app_config.json)
  noteAppearance?: Record<
    string,
    {
      cover?: { type: 'gradient' | 'image'; value: string; positionY?: number } | null
      emoji?: string | null
    }
  >
  graphTheme: string
  graphNodeSize: number
  graphShowTexts: boolean
  graphNodeColor: string
  graphSidebarOpen: boolean

  // AI Settings
  deepSeekKey: string | null
  deepSeekModel: string
  huggingFaceKey: string | null
  activeProvider: string
  activeModel: string | null
  activeModelProvider: string | null
  aiModelsByProvider: Record<string, string> | null
  aiAvailableModelsByProvider: Record<string, string[]> | null
  activeAIMode: string
  aiChatDisplayMode: string
  openaiKey: string | null
  anthropicKey: string | null
  ollamaUrl: string
  ollamaModel: string | null

  // Command Palette
  commandPaletteMode: string
  commandPaletteSplitRatio: number

  // Desktop Integration
  launchOnStartup: boolean
  globalShortcut: string
  windowOpacity: number
  modernUi: boolean

  // Status Bar item visibility (VS Code-style). null = every item uses its default (visible).
  statusBarItems?: Record<string, boolean> | null

  // Favorites & Ordering
  pinnedFolders: string[]
  folderOrder: string[]
  expandedFolders: string[]

  // Sidebars geometry & state
  sidebar: SidebarGeometry
  rightSidebar: RightSidebarGeometry

  // Component Visibility & Zen Mode
  titleBarVisible: boolean
  statusBarVisible: boolean
  activityBarVisible: boolean
  rightActivityBarVisible?: boolean
  tabsVisible?: boolean
  breadcrumbsVisible?: boolean
  zenMode: ZenModeSettings
  zenPreState?: ZenPreState | null

  // Modal Window Persistence
  previewModalMaximized: boolean
  settingsModalMaximized: boolean
  themeModalMaximized: boolean
  graphModalMaximized: boolean
  docsModalMaximized: boolean
  guideModalMaximized: boolean
  templateModalMaximized: boolean
  aiModalMaximized: boolean

  // Email Modal Geometry & State Persistence
  emailModalWidth: number
  emailModalHeight: number
  emailSidebarWidth: number
  emailListWidth: number
  emailSidebarOpen: boolean
  emailDetailOpen: boolean

  // Calendar & Timer Suite (persisted in app-config.json)
  calendarEvents?: Array<{
    id: string
    dateStr: string
    title: string
    completed?: boolean
    createdAt: number
  }>
  calendarAlarms?: Array<{
    id: string
    title: string
    timeStr: string
    timestamp: number
    triggered?: boolean
    enabled: boolean
  }>
  calendarCountdown?: {
    id: string
    title: string
    targetTimestamp: number
  } | null
  calendarCoverTheme?: number

  // Extensible for dynamic properties (e.g. googleUser, sound settings, shortcuts)
  [key: string]: any
}

export interface SettingStoreState {
  settings: Settings
  isLoading: boolean
  settingsWatcherUnsubscribe: (() => void) | null

  // Actions
  init: () => Promise<void>
  updateSetting: (key: string, value: any) => Promise<void>
  togglePinnedFolder: (folderId: string) => Promise<void>
  updateSettings: (settings: Partial<Settings>) => Promise<void>
  toggleZenMode: () => Promise<void>
  enterZenMode: () => Promise<void>
  exitZenMode: () => Promise<void>
  toggleTitleBar: () => Promise<void>
  toggleStatusBar: () => Promise<void>
  toggleActivityBar: () => Promise<void>
  toggleRightActivityBar: () => Promise<void>
  toggleTabs: () => Promise<void>
  toggleBreadcrumbs: () => Promise<void>
  togglePrimarySidebar: () => Promise<void>
  toggleSecondarySidebar: () => Promise<void>
  toggleEditorMetadata: () => Promise<void>
  resetToDefaults: () => Promise<void>
}

export const useSettingStore = create<SettingStoreState>((set, get) => ({
  settings: {
    theme:
      (typeof localStorage !== 'undefined' && localStorage.getItem('theme-id')) || 'light',
    fontSize: 12,
    fontFamily: 'Inter',
    lineHeight: 1.6,
    showLineNumbers: false,
    autoSave: true,
    cursorStyle: 'smooth',
    smoothScrolling: true,
    sidebarCollapsedSections: {
      pinned: false,
      recent: false,
      all: false
    },
    sortBy: 'name',
    sortDirection: 'asc',
    noteOrder: null, // Array of snippet IDs for custom drag sort order
    inlineMetadata: true,
    inlineTitle: true,
    ...DEFAULT_LINK_CARD_SETTINGS,
    graphTheme: 'default',
    graphNodeSize: 1.5,
    graphShowTexts: true,
    graphNodeColor: '#40bafa',
    graphSidebarOpen: true,

    // AI Settings - loaded from app_config via settings IPC
    deepSeekKey: null,
    deepSeekModel: 'deepseek-flash',
    huggingFaceKey: null,

    // Multi-Provider Support
    activeProvider: 'deepseek',
    activeModel: null,
    activeModelProvider: null,
    aiModelsByProvider: null,
    aiAvailableModelsByProvider: null,
    activeAIMode: 'Code',
    aiChatDisplayMode: 'sidebar',
    openaiKey: null,
    anthropicKey: null,
    ollamaUrl: 'http://localhost:11434/api/chat',
    ollamaModel: null,

    // Command Palette
    commandPaletteMode: 'search',
    commandPaletteSplitRatio: 50,

    // Desktop Integration
    launchOnStartup: false,
    globalShortcut: 'Ctrl+Space',
    windowOpacity: 1.0,

    modernUi: true,

    // Status Bar item visibility (null = all items visible by default)
    statusBarItems: null,

    // Favorites & Ordering
    pinnedFolders: [],
    folderOrder: [],
    expandedFolders: [],

    // Sidebars geometry & state (hydrate width synchronously for zero-jump first paint)
    sidebar: {
      width: (() => {
        try {
          const w = Number(typeof localStorage !== 'undefined' ? localStorage.getItem('lumina_left_sidebar_width') : 0)
          return w >= 130 && w <= 600 ? w : 220
        } catch {
          return 220
        }
      })(),
      isLeftOpen: true
    },
    rightSidebar: {
      width: (() => {
        try {
          const w = Number(typeof localStorage !== 'undefined' ? localStorage.getItem('lumina_right_sidebar_width') : 0)
          return w >= 130 && w <= 750 ? w : 220
        } catch {
          return 220
        }
      })(),
      isRightOpen: false
    },

    // Component Visibility & Zen Mode Defaults
    titleBarVisible: true,
    statusBarVisible: false,
    activityBarVisible: true,
    rightActivityBarVisible: true,
    tabsVisible: true,
    breadcrumbsVisible: true,
    zenMode: {
      enabled: false,
      hideTitleBar: true,
      hideStatusBar: true,
      hideActivityBar: true,
      hideRightActivityBar: true,
      hidePrimarySidebar: true,
      hideSecondarySidebar: true,
      hideTabs: true
    },
    zenPreState: null,

    // Modal Window Persistence
    previewModalMaximized: false,
    settingsModalMaximized: false,
    themeModalMaximized: false,
    graphModalMaximized: false,
    docsModalMaximized: false,
    guideModalMaximized: false,
    templateModalMaximized: false,
    aiModalMaximized: false,

    // Calendar & Timer Suite
    calendarEvents: [],
    calendarAlarms: [],
    calendarCountdown: null,
    calendarCoverTheme: 0,

    // Email Modal Geometry & State Persistence (settings.json)
    emailModalWidth: 840,
    emailModalHeight: 510,
    emailSidebarWidth: 195,
    emailListWidth: 300,
    emailSidebarOpen: true,
    emailDetailOpen: true,

    // Integrated Terminal default shell
    defaultTerminalShell: 'bash.exe'
  },

  isLoading: true,
  settingsWatcherUnsubscribe: null,

  // Initialize from robust settings.json via IPC
  init: async () => {
    try {
      const api = (window as any).api
      if (api && api.getSetting) {
        const allSettings = await api.getSetting()
        if (allSettings) {
          const currentSettings = get().settings
          const mergedSettings: Settings = { ...currentSettings, ...allSettings }
          const activeTheme =
            mergedSettings.theme && mergedSettings.theme !== 'default'
              ? mergedSettings.theme
              : ((typeof localStorage !== 'undefined' && localStorage.getItem('theme-id')) || 'light')
          mergedSettings.theme = activeTheme
          if (mergedSettings.shortcuts?.canvasDrawer === 'Ctrl + Shift + /') {
            mergedSettings.shortcuts.canvasDrawer = 'Ctrl + Shift + ;'
          }
          if (mergedSettings.shortcuts?.canvas === 'Ctrl + Shift + /') {
            mergedSettings.shortcuts.canvas = 'Ctrl + Shift + ;'
          }

          set({ settings: mergedSettings })

          if (typeof localStorage !== 'undefined') {
            if (typeof mergedSettings.sidebar?.width === 'number') {
              localStorage.setItem('lumina_left_sidebar_width', String(mergedSettings.sidebar.width))
            }
            if (typeof mergedSettings.rightSidebar?.width === 'number') {
              localStorage.setItem('lumina_right_sidebar_width', String(mergedSettings.rightSidebar.width))
            }
          }

          if (typeof document !== 'undefined') {
            const root = document.documentElement
            applyTheme(activeTheme)
            applyLinkCardDomAttributes(mergedSettings)
            root.setAttribute('data-modern-ui', String(Boolean(mergedSettings.modernUi)))
            root.style.setProperty('--font-editor', mergedSettings.fontFamily)
            root.style.setProperty('--font-size-editor', `${mergedSettings.fontSize}px`)
          }

          if (api && typeof api.onSettingsChanged === 'function') {
            if (!get().settingsWatcherUnsubscribe) {
              const unsub = api.onSettingsChanged((newSettings: Partial<Settings>) => {
                try {
                  const active = get().settings
                  const updatedParams: Settings = { ...active, ...newSettings }
                  set({ settings: updatedParams })

                  if (typeof document !== 'undefined') {
                    const root = document.documentElement
                    if (newSettings.theme && newSettings.theme !== 'default') {
                      applyTheme(newSettings.theme)
                    } else if (updatedParams.theme) {
                      root.setAttribute('data-theme', updatedParams.theme)
                    }
                    root.setAttribute('data-modern-ui', String(Boolean(updatedParams.modernUi)))
                    applyLinkCardDomAttributes(updatedParams)
                    root.style.setProperty('--font-editor', updatedParams.fontFamily)
                    root.style.setProperty('--font-size-editor', `${updatedParams.fontSize}px`)
                    root.style.setProperty('--cursor-style', updatedParams.cursorStyle)
                  }
                } catch (err) {
                  console.error('[SettingStore] Error applying external settings:', err)
                }
              })
              set({ settingsWatcherUnsubscribe: unsub })
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
      setTimeout(async () => {
        try {
          const api = (window as any).api
          if (api && api.getSetting) {
            const allSettings = await api.getSetting().catch(() => null)
            if (allSettings) {
              const currentDefaults = get().settings
              const mergedSettings: Settings = { ...currentDefaults, ...allSettings }
              const activeTheme =
                mergedSettings.theme && mergedSettings.theme !== 'default'
                  ? mergedSettings.theme
                  : ((typeof localStorage !== 'undefined' && localStorage.getItem('theme-id')) || 'dark')
              mergedSettings.theme = activeTheme
              set({ settings: mergedSettings })

          if (typeof localStorage !== 'undefined') {
            if (typeof mergedSettings.sidebar?.width === 'number') {
              localStorage.setItem('lumina_left_sidebar_width', String(mergedSettings.sidebar.width))
            }
            if (typeof mergedSettings.rightSidebar?.width === 'number') {
              localStorage.setItem('lumina_right_sidebar_width', String(mergedSettings.rightSidebar.width))
            }
          }
              if (typeof document !== 'undefined') {
                const root = document.documentElement
                root.setAttribute('data-theme', mergedSettings.theme)
                root.setAttribute('data-modern-ui', String(Boolean(mergedSettings.modernUi)))
                root.style.setProperty('--font-editor', mergedSettings.fontFamily)
                root.style.setProperty('--font-size-editor', `${mergedSettings.fontSize}px`)
              }
            }
          }
        } catch (e) {
          console.warn('Retry failed', e)
        }
      }, 1000)
    } finally {
      set({ isLoading: false })
    }
  },

  updateSetting: async (key: string, value: any) => {
    // Optimistic Update
    set((state) => ({
      settings: { ...state.settings, [key]: value }
    }))

    // Persist per-workspace theme, accent color, and AI mode profiles automatically
    if (key === 'theme' || key === 'accentColor' || key === 'activeAIMode') {
      const s = get().settings
      const wsPath = s.workspacePath || s.vaultPath
      if (wsPath) {
        saveWorkspaceProfile(wsPath, { [key]: value })
      }
    }

    // Apply specific DOM side effects
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      if (key === 'theme') root.setAttribute('data-theme', value)
      if (key === 'modernUi') {
        root.setAttribute('data-modern-ui', String(Boolean(value)))
      }
      if (key === 'fontFamily') root.style.setProperty('--font-editor', value)
      if (key === 'fontSize') root.style.setProperty('--font-size-editor', `${value}px`)
      if (
        key === 'linkCardsEnabled' ||
        key === 'linkCardStyle' ||
        key === 'linkCardWidth' ||
        key === 'linkCardSize' ||
        key === 'linkCardThumbnailPosition' ||
        key === 'linkCardColumns' ||
        key === 'linkCardShowDescription' ||
        key === 'youtubeOpenInModal'
      ) {
        applyLinkCardDomAttributes(get().settings)
        if ((key === 'linkCardsEnabled' || key === 'linkCardColumns') && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(LINK_CARDS_CONFIG_EVENT))
        }
      }
    }

    if (typeof localStorage !== 'undefined') {
      if (key === 'modernUi') localStorage.setItem('lumina_modern_ui', String(Boolean(value)))
      if (key === 'deepSeekKey') {
        if (value) localStorage.setItem('lumina_deepseek_key', String(value))
        else localStorage.removeItem('lumina_deepseek_key')
      }
      if (key === 'previewModalMaximized') {
        localStorage.setItem('lumina_modal_maximized_preview', String(Boolean(value)))
      }
      if (key === 'sidebar' && typeof value?.width === 'number') {
        localStorage.setItem('lumina_left_sidebar_width', String(value.width))
      }
      if (key === 'rightSidebar' && typeof value?.width === 'number') {
        localStorage.setItem('lumina_right_sidebar_width', String(value.width))
      }
    }

    try {
      const api = (window as any).api
      if (api && typeof api.saveSetting === 'function') {
        await api.saveSetting(key, value)
      }
    } catch (err) {
      console.error(`Failed to save setting ${key}:`, err)
    }
  },

  togglePinnedFolder: async (folderId: string) => {
    const current = get().settings.pinnedFolders || []
    const newPinned = current.includes(folderId)
      ? current.filter((id) => id !== folderId)
      : [...current, folderId]

    set((state) => ({
      settings: { ...state.settings, pinnedFolders: newPinned }
    }))

    try {
      const api = (window as any).api
      if (api && api.saveSetting) {
        await api.saveSetting('pinnedFolders', newPinned)
      }
    } catch (err) {
      console.error(`Failed to save pinnedFolders:`, err)
    }
  },

  updateSettings: async (newSettings: Partial<Settings>) => {
    // Optimistic Update
    set((state) => ({
      settings: { ...state.settings, ...newSettings }
    }))

    if (typeof localStorage !== 'undefined') {
      if (newSettings.modernUi !== undefined) {
        localStorage.setItem('lumina_modern_ui', String(Boolean(newSettings.modernUi)))
      }
      if (typeof newSettings.sidebar?.width === 'number') {
        localStorage.setItem('lumina_left_sidebar_width', String(newSettings.sidebar.width))
      }
      if (typeof newSettings.rightSidebar?.width === 'number') {
        localStorage.setItem('lumina_right_sidebar_width', String(newSettings.rightSidebar.width))
      }
      if (newSettings.deepSeekKey !== undefined) {
        if (newSettings.deepSeekKey) {
          localStorage.setItem('lumina_deepseek_key', String(newSettings.deepSeekKey))
        } else {
          localStorage.removeItem('lumina_deepseek_key')
        }
      }
      if (newSettings.previewModalMaximized !== undefined) {
        localStorage.setItem('lumina_modal_maximized_preview', String(Boolean(newSettings.previewModalMaximized)))
      }
    }

    // Persist to settings.json via IPC
    try {
      const api = (window as any).api
      if (api && api.saveSettings) {
        await api.saveSettings(newSettings)
      }
    } catch (err) {
      console.error(`Failed to save multiple settings:`, err)
    }
  },
  toggleTitleBar: async () => {
    const s = get().settings
    if (s.zenMode?.enabled) {
      const currentlyHidden = s.zenMode.hideTitleBar !== false || s.titleBarVisible === false
      await get().updateSettings({
        titleBarVisible: currentlyHidden,
        zenMode: { ...s.zenMode, hideTitleBar: !currentlyHidden }
      })
      return
    }
    const current = s.titleBarVisible ?? true
    await get().updateSetting('titleBarVisible', !current)
  },

  toggleStatusBar: async () => {
    const s = get().settings
    if (s.zenMode?.enabled) {
      const currentlyHidden = s.zenMode.hideStatusBar !== false || s.statusBarVisible === false
      await get().updateSettings({
        statusBarVisible: currentlyHidden,
        zenMode: { ...s.zenMode, hideStatusBar: !currentlyHidden }
      })
      return
    }
    const current = s.statusBarVisible ?? false
    await get().updateSetting('statusBarVisible', !current)
  },

  toggleActivityBar: async () => {
    const s = get().settings
    if (s.zenMode?.enabled) {
      const currentlyHidden = s.zenMode.hideActivityBar !== false || s.activityBarVisible === false
      await get().updateSettings({
        activityBarVisible: currentlyHidden,
        zenMode: { ...s.zenMode, hideActivityBar: !currentlyHidden }
      })
      return
    }
    const current = s.activityBarVisible ?? true
    await get().updateSetting('activityBarVisible', !current)
  },

  toggleRightActivityBar: async () => {
    const s = get().settings
    if (s.zenMode?.enabled) {
      const currentlyHidden =
        s.zenMode.hideRightActivityBar !== false || s.rightActivityBarVisible === false
      await get().updateSettings({
        rightActivityBarVisible: currentlyHidden,
        zenMode: { ...s.zenMode, hideRightActivityBar: !currentlyHidden }
      })
      return
    }
    const current = s.rightActivityBarVisible ?? true
    await get().updateSetting('rightActivityBarVisible', !current)
  },

  toggleTabs: async () => {
    const s = get().settings
    if (s.zenMode?.enabled) {
      const currentlyHidden = s.zenMode.hideTabs !== false || s.tabsVisible === false
      await get().updateSettings({
        tabsVisible: currentlyHidden,
        zenMode: { ...s.zenMode, hideTabs: !currentlyHidden }
      })
      return
    }
    const current = s.tabsVisible ?? true
    await get().updateSetting('tabsVisible', !current)
  },

  toggleBreadcrumbs: async () => {
    const current = get().settings.breadcrumbsVisible ?? false
    await get().updateSetting('breadcrumbsVisible', !current)
  },

  togglePrimarySidebar: async () => {
    const s = get().settings.sidebar || { width: 150, isLeftOpen: true }
    await get().updateSetting('sidebar', { ...s, isLeftOpen: !s.isLeftOpen })
  },

  toggleSecondarySidebar: async () => {
    const r = get().settings.rightSidebar || { width: 150, isRightOpen: false }
    await get().updateSetting('rightSidebar', { ...r, isRightOpen: !r.isRightOpen })
  },

  toggleEditorMetadata: async () => {
    const current = get().settings.inlineMetadata ?? true
    await get().updateSetting('inlineMetadata', !current)
  },

  enterZenMode: async () => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-zen-mode', 'true')
    }
    const s = get().settings
    const zen = s.zenMode || {
      enabled: false,
      hideTitleBar: true,
      hideStatusBar: true,
      hideActivityBar: true,
      hidePrimarySidebar: true,
      hideSecondarySidebar: true,
      hideTabs: true
    }

    const preState: ZenPreState = {
      titleBarVisible: s.titleBarVisible ?? true,
      statusBarVisible: s.statusBarVisible ?? true,
      activityBarVisible: s.activityBarVisible ?? true,
      rightActivityBarVisible: s.rightActivityBarVisible ?? true,
      tabsVisible: s.tabsVisible ?? true,
      breadcrumbsVisible: s.breadcrumbsVisible ?? true,
      isLeftOpen: s.sidebar?.isLeftOpen ?? true,
      isRightOpen: s.rightSidebar?.isRightOpen ?? false
    }

    const updates: Partial<Settings> = {
      zenMode: { ...zen, enabled: true },
      zenPreState: preState,
      titleBarVisible: zen.hideTitleBar !== false ? false : s.titleBarVisible,
      breadcrumbsVisible: false,
      sidebar: { ...(s.sidebar || { width: 150, isLeftOpen: true }), isLeftOpen: false },
      rightSidebar: { ...(s.rightSidebar || { width: 150, isRightOpen: false }), isRightOpen: false }
    }

    await get().updateSettings(updates)
  },

  exitZenMode: async () => {
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-zen-mode')
    }
    const s = get().settings
    const zen = s.zenMode || {
      enabled: false,
      hideTitleBar: true,
      hideStatusBar: true,
      hideActivityBar: true,
      hidePrimarySidebar: true,
      hideSecondarySidebar: true,
      hideTabs: true
    }
    const pre = s.zenPreState

    const updates: Partial<Settings> = {
      zenMode: {
        ...zen,
        enabled: false,
        hideTitleBar: true,
        hideStatusBar: true,
        hideActivityBar: true,
        hideRightActivityBar: true,
        hideTabs: true
      },
      zenPreState: null
    }

    if (pre) {
      if (pre.titleBarVisible !== undefined) updates.titleBarVisible = pre.titleBarVisible
      if (pre.statusBarVisible !== undefined) updates.statusBarVisible = pre.statusBarVisible
      if (pre.activityBarVisible !== undefined) updates.activityBarVisible = pre.activityBarVisible
      if (pre.rightActivityBarVisible !== undefined) updates.rightActivityBarVisible = pre.rightActivityBarVisible
      if (pre.tabsVisible !== undefined) updates.tabsVisible = pre.tabsVisible
      if (pre.breadcrumbsVisible !== undefined) updates.breadcrumbsVisible = pre.breadcrumbsVisible
      if (pre.isLeftOpen !== undefined) {
        updates.sidebar = {
          ...(s.sidebar || { width: 150, isLeftOpen: true }),
          isLeftOpen: Boolean(s.sidebar?.isLeftOpen || pre.isLeftOpen)
        }
      }
      if (pre.isRightOpen !== undefined) {
        updates.rightSidebar = {
          ...(s.rightSidebar || { width: 150, isRightOpen: false }),
          isRightOpen: Boolean(s.rightSidebar?.isRightOpen || pre.isRightOpen)
        }
      }
    } else {
      updates.titleBarVisible = true
      updates.statusBarVisible = true
      updates.activityBarVisible = true
      updates.rightActivityBarVisible = true
      updates.tabsVisible = true
      updates.breadcrumbsVisible = true
      updates.sidebar = { ...(s.sidebar || { width: 150, isLeftOpen: true }), isLeftOpen: true }
      updates.rightSidebar = { ...(s.rightSidebar || { width: 150, isRightOpen: false }), isRightOpen: false }
    }

    await get().updateSettings(updates)
  },

  toggleZenMode: async () => {
    const enabled = get().settings.zenMode?.enabled ?? false
    if (enabled) {
      await get().exitZenMode()
    } else {
      await get().enterZenMode()
    }
  },

  resetToDefaults: async () => {
    const current = get().settings
    const defaultCursor = {
      caretWidth: 2,
      caretStyle: 'smooth',
      caretColor: '',
      editorFontFamily: 'JetBrains Mono',
      editorFontSize: 12,
      previewFontFamily: 'JetBrains Mono',
      previewFontSize: 12
    }

    // Reset all UI, theme, typography, layout, and shortcut settings to Lumina defaults
    // while strictly preserving AI/Agent API keys, models, and workspace paths.
    const updates: Partial<Settings> = {
      theme: 'light',
      fontSize: 12,
      fontFamily: 'JetBrains Mono',
      lineHeight: 1.6,
      showLineNumbers: false,
      autoSave: true,
      cursorStyle: 'smooth',
      cursor: defaultCursor,
      smoothScrolling: true,
      inlineMetadata: true,
      inlineTitle: true,
      ...DEFAULT_LINK_CARD_SETTINGS,
      graphTheme: 'default',
      graphNodeSize: 1.5,
      graphShowTexts: true,
      graphNodeColor: '#0284c7',
      graphSidebarOpen: true,
      windowOpacity: 1.0,
      modernUi: true,
      statusBarItems: null,
      shortcuts: {},
      sidebar: { width: 220, isLeftOpen: true },
      rightSidebar: { width: 220, isRightOpen: false },
      titleBarVisible: true,
      statusBarVisible: false,
      activityBarVisible: true,
      rightActivityBarVisible: true,
      tabsVisible: true,
      breadcrumbsVisible: true,
      zenMode: {
        enabled: false,
        hideTitleBar: true,
        hideStatusBar: true,
        hideActivityBar: true,
        hideRightActivityBar: true,
        hidePrimarySidebar: true,
        hideSecondarySidebar: true,
        hideTabs: true
      },
      zenPreState: null,
      // Explicitly retain AI / Agent credentials & workspace location
      deepSeekKey: current.deepSeekKey,
      deepSeekModel: current.deepSeekModel,
      huggingFaceKey: current.huggingFaceKey,
      openaiKey: current.openaiKey,
      anthropicKey: current.anthropicKey,
      ollamaUrl: current.ollamaUrl,
      ollamaModel: current.ollamaModel,
      activeProvider: current.activeProvider,
      activeModel: current.activeModel,
      activeModelProvider: current.activeModelProvider,
      aiModelsByProvider: current.aiModelsByProvider,
      aiAvailableModelsByProvider: current.aiAvailableModelsByProvider,
      activeAIMode: current.activeAIMode,
      aiChatDisplayMode: current.aiChatDisplayMode
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme-id', 'light')
      localStorage.setItem('theme-colors', JSON.stringify(defaultCursor))
      localStorage.setItem('lumina_left_sidebar_width', '220')
      localStorage.setItem('lumina_right_sidebar_width', '220')
    }

    if (typeof document !== 'undefined') {
      applyTheme('light', true)
      applyLinkCardDomAttributes(DEFAULT_LINK_CARD_SETTINGS)
      const root = document.documentElement
      root.setAttribute('data-modern-ui', 'true')
      root.style.setProperty('--font-size-editor', '12px')
      root.style.setProperty('--editor-font-size', `${12 / 16}rem`)
      root.style.setProperty('--preview-font-size', `${12 / 16}rem`)
      root.style.setProperty('--preview-font-size-px', '12px')
    }

    await get().updateSettings(updates)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lumina-settings-reset', { detail: defaultCursor }))
    }
  }

}))

/**
 * Backward compatibility alias for legacy imports (`useSettingsStore`).
 */
export const useSettingsStore = useSettingStore
export default useSettingStore
