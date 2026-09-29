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

export interface Settings {
  theme: string
  fontSize: number
  fontFamily: string
  lineHeight: number
  showLineNumbers: boolean
  autoSave: boolean
  cursorStyle: string
  smoothScrolling: boolean
  sidebarCollapsedSections: SidebarSectionCollapsedState
  sortBy: string
  sortDirection: string
  noteOrder: string[] | null
  inlineMetadata: boolean
  inlineTitle: boolean
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
  activeAIMode: string
  aiChatDisplayMode: string
  openaiKey: string | null
  anthropicKey: string | null
  groqKey: string | null
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

  // Favorites & Ordering
  pinnedFolders: string[]
  folderOrder: string[]
  expandedFolders: string[]

  // Sidebars geometry & state
  sidebar: SidebarGeometry
  rightSidebar: RightSidebarGeometry

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
}

export const useSettingStore = create<SettingStoreState>((set, get) => ({
  settings: {
    theme:
      (typeof localStorage !== 'undefined' && localStorage.getItem('theme-id')) || 'dark',
    fontSize: 16,
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
    inlineMetadata: false,
    inlineTitle: true,
    graphTheme: 'default',
    graphNodeSize: 1.5,
    graphShowTexts: true,
    graphNodeColor: '#40bafa',
    graphSidebarOpen: true,

    // AI Settings - loaded from app_config via settings IPC
    deepSeekKey: null,
    deepSeekModel: 'deepseek-chat',
    huggingFaceKey: null,

    // Multi-Provider Support
    activeProvider: 'deepseek',
    activeModel: null,
    activeAIMode: 'Code',
    aiChatDisplayMode: 'sidebar',
    openaiKey: null,
    anthropicKey: null,
    groqKey: null,
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

    // Favorites & Ordering
    pinnedFolders: [],
    folderOrder: [],
    expandedFolders: [],

    // Sidebars geometry & state
    sidebar: {
      width: 260,
      isLeftOpen: true
    },
    rightSidebar: {
      width: 300,
      isRightOpen: false
    },

    // Modal Window Persistence
    previewModalMaximized: false,
    settingsModalMaximized: false,
    themeModalMaximized: false,
    graphModalMaximized: false,
    docsModalMaximized: false,
    guideModalMaximized: false,
    templateModalMaximized: false,
    aiModalMaximized: false,

    // Email Modal Geometry & State Persistence (settings.json)
    emailModalWidth: 840,
    emailModalHeight: 510,
    emailSidebarWidth: 195,
    emailListWidth: 300,
    emailSidebarOpen: true,
    emailDetailOpen: true
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
              : ((typeof localStorage !== 'undefined' && localStorage.getItem('theme-id')) || 'dark')
          mergedSettings.theme = activeTheme

          set({ settings: mergedSettings })

          if (typeof document !== 'undefined') {
            const root = document.documentElement
            root.setAttribute('data-theme', mergedSettings.theme)
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
                    root.setAttribute('data-theme', updatedParams.theme)
                    root.setAttribute('data-modern-ui', String(Boolean(updatedParams.modernUi)))
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

    // Apply specific DOM side effects
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      if (key === 'theme') root.setAttribute('data-theme', value)
      if (key === 'modernUi') {
        root.setAttribute('data-modern-ui', String(Boolean(value)))
      }
      if (key === 'fontFamily') root.style.setProperty('--font-editor', value)
      if (key === 'fontSize') root.style.setProperty('--font-size-editor', `${value}px`)
      if (key === 'cursor' || key === 'useBorderLeft') {
        const isBorder = key === 'cursor' ? (value?.useBorderLeft !== false) : Boolean(value)
        root.setAttribute('data-use-active-line-border', isBorder ? 'true' : 'false')
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('caret-style-update'))
        }
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

    // Persist to settings.json via IPC
    try {
      const api = (window as any).api
      if (api && api.saveSettings) {
        await api.saveSettings(newSettings)
      }
    } catch (err) {
      console.error(`Failed to save multiple settings:`, err)
    }
  }
}))

/**
 * Backward compatibility alias for legacy imports (`useSettingsStore`).
 */
export const useSettingsStore = useSettingStore
export default useSettingStore
