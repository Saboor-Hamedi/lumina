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
  vimMode: boolean
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
    vimMode: false,
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
    graphTheme: 'default',
    graphNodeSize: 1.5,
    graphShowTexts: true,
    graphNodeColor: '#40bafa',
    graphSidebarOpen: true,

    // AI Settings - preserve these during hot reload
    deepSeekKey:
      (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_deepseek_key')) || null,
    deepSeekModel: 'deepseek-chat',
    huggingFaceKey: null,

    // Multi-Provider Support
    activeProvider:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_active_provider')) ||
      'deepseek',
    activeModel: null,
    activeAIMode:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_active_ai_mode')) ||
      'Code',
    aiChatDisplayMode: 'sidebar',
    openaiKey:
      (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_openai_key')) || null,
    anthropicKey:
      (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_anthropic_key')) || null,
    groqKey:
      (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_groq_key')) || null,
    ollamaUrl: 'http://localhost:11434/api/chat',

    // Command Palette
    commandPaletteMode: 'search',
    commandPaletteSplitRatio: 50,

    // Desktop Integration
    launchOnStartup: false,
    globalShortcut: 'Ctrl+Space',
    windowOpacity: 1.0,

    modernUi:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_modern_ui') === 'true') ||
      false,

    // Favorites & Ordering
    pinnedFolders: [],
    folderOrder: [],
    expandedFolders:
      (typeof localStorage !== 'undefined' &&
        (() => {
          try {
            const cached = localStorage.getItem('lumina-expanded-folders')
            return cached ? JSON.parse(cached) : []
          } catch (e) {
            return []
          }
        })()) ||
      [],

    // Sidebars geometry & state
    sidebar: {
      width:
        (typeof localStorage !== 'undefined' &&
          parseInt(localStorage.getItem('lumina_left_sidebar_width') || '260', 10)) ||
        260,
      isLeftOpen:
        typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_left_sidebar_open') !== null
          ? localStorage.getItem('lumina_left_sidebar_open') === 'true'
          : true
    },
    rightSidebar: {
      width:
        (typeof localStorage !== 'undefined' &&
          parseInt(localStorage.getItem('lumina_right_sidebar_width') || '300', 10)) ||
        300,
      isRightOpen:
        typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_right_sidebar_open') !== null
          ? localStorage.getItem('lumina_right_sidebar_open') === 'true'
          : false
    },

    // Modal Window Persistence (remembers maximized state across opens)
    previewModalMaximized:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_modal_maximized_preview') === 'true') ||
      false,
    settingsModalMaximized:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_modal_maximized_settings') === 'true') ||
      false,
    themeModalMaximized:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_modal_maximized_theme') === 'true') ||
      false,
    graphModalMaximized:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_modal_maximized_graph') === 'true') ||
      false,
    docsModalMaximized:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_modal_maximized_docs') === 'true') ||
      false,
    guideModalMaximized:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_modal_maximized_guide') === 'true') ||
      false,
    templateModalMaximized:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_modal_maximized_template') === 'true') ||
      false,
    aiModalMaximized:
      (typeof localStorage !== 'undefined' &&
        localStorage.getItem('lumina_modal_maximized_ai') === 'true') ||
      false,

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
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('lumina_modern_ui', String(Boolean(value)))
        }
      }
      if (key === 'fontFamily') root.style.setProperty('--font-editor', value)
      if (key === 'fontSize') root.style.setProperty('--font-size-editor', `${value}px`)
    }

    try {
      if (typeof localStorage !== 'undefined') {
        if (key === 'activeAIMode') {
          localStorage.setItem('lumina_active_ai_mode', value)
        } else if (key === 'deepSeekKey') {
          if (value) localStorage.setItem('lumina_deepseek_key', value)
          else localStorage.removeItem('lumina_deepseek_key')
        } else if (key === 'openaiKey') {
          if (value) localStorage.setItem('lumina_openai_key', value)
          else localStorage.removeItem('lumina_openai_key')
        } else if (key === 'anthropicKey') {
          if (value) localStorage.setItem('lumina_anthropic_key', value)
          else localStorage.removeItem('lumina_anthropic_key')
        } else if (key === 'groqKey') {
          if (value) localStorage.setItem('lumina_groq_key', value)
          else localStorage.removeItem('lumina_groq_key')
        } else if (key === 'activeProvider') {
          if (value) localStorage.setItem('lumina_active_provider', value)
        }
      }

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

    // Save modal maximized states to localStorage as instant sync
    if (typeof localStorage !== 'undefined') {
      const modalKeys = [
        'previewModalMaximized',
        'settingsModalMaximized',
        'themeModalMaximized',
        'graphModalMaximized',
        'docsModalMaximized',
        'guideModalMaximized',
        'templateModalMaximized',
        'aiModalMaximized'
      ]
      modalKeys.forEach((key) => {
        if (key in newSettings) {
          const suffix = key.replace('ModalMaximized', '').toLowerCase()
          localStorage.setItem(`lumina_modal_maximized_${suffix}`, String(Boolean((newSettings as any)[key])))
        }
      })
    }

    // Persist to settings.json
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
