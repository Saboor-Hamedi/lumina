import { create } from 'zustand'

export const useSettingsStore = create((set, get) => ({
  settings: {
    theme: 'default',
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
    graphTheme: 'default',
    graphNodeSize: 1.5,
    graphShowTexts: true,
    graphNodeColor: '#40bafa',
    // AI Settings - preserve these during hot reload
    deepSeekKey: (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_deepseek_key')) || null,
    deepSeekModel: 'deepseek-chat',
    huggingFaceKey: null,

    // New Multi-Provider Support
    activeProvider: (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_active_provider')) || 'deepseek',
    activeModel: null,
    activeAIMode: (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_active_ai_mode')) || 'Plan',
    aiChatDisplayMode: 'sidebar',
    openaiKey: (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_openai_key')) || null,
    anthropicKey: (typeof localStorage !== 'undefined' && localStorage.getItem('lumina_anthropic_key')) || null,
    ollamaUrl: 'http://localhost:11434/api/chat',

    // Command Palette
    commandPaletteMode: 'search',
    commandPaletteSplitRatio: 50,

    // Desktop Integration
    launchOnStartup: false,
    globalShortcut: 'Ctrl+Space',

    // Favorites & Ordering
    pinnedFolders: [],
    folderOrder: [],
    expandedFolders: []
  },

  isLoading: true,
  settingsWatcherUnsubscribe: null,

  // Initialize from robust settings.json via IPC
  init: async () => {
    try {
      if (window.api && window.api.getSetting) {
        const allSettings = await window.api.getSetting()
        if (allSettings) {
          const currentSettings = get().settings
          const mergedSettings = { ...currentSettings, ...allSettings }

          set({ settings: mergedSettings })

          const root = document.documentElement
          root.setAttribute('data-theme', mergedSettings.theme)
          root.style.setProperty('--font-editor', mergedSettings.fontFamily)
          root.style.setProperty('--font-size-editor', `${mergedSettings.fontSize}px`)
          if (window.api && typeof window.api.onSettingsChanged === 'function') {
            if (!get().settingsWatcherUnsubscribe) {
              const unsub = window.api.onSettingsChanged((newSettings) => {
                try {
                  const active = get().settings
                  const updatedParams = { ...active, ...newSettings }
                  set({ settings: updatedParams })

                  const root = document.documentElement
                  root.setAttribute('data-theme', updatedParams.theme)
                  root.style.setProperty('--font-editor', updatedParams.fontFamily)
                  root.style.setProperty('--font-size-editor', `${updatedParams.fontSize}px`)
                  root.style.setProperty('--cursor-style', updatedParams.cursorStyle)
                } catch (err) {
                  console.error('[useSettingsStore] Error applying external settings:', err)
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
          if (window.api && window.api.getSetting) {
            const allSettings = await window.api.getSetting().catch(() => null)
            if (allSettings) {
              const currentDefaults = get().settings
              const mergedSettings = { ...currentDefaults, ...allSettings }
              set({ settings: mergedSettings })
              const root = document.documentElement
              root.setAttribute('data-theme', mergedSettings.theme)
              root.style.setProperty('--font-editor', mergedSettings.fontFamily)
              root.style.setProperty('--font-size-editor', `${mergedSettings.fontSize}px`)
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

  updateSetting: async (key, value) => {
    // Optimistic Update
    set((state) => ({
      settings: { ...state.settings, [key]: value }
    }))

    // Apply specific side effects
    const root = document.documentElement
    if (key === 'theme') root.setAttribute('data-theme', value)
    if (key === 'fontFamily') root.style.setProperty('--font-editor', value)
    if (key === 'fontSize') root.style.setProperty('--font-size-editor', `${value}px`)

    try {
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
      } else if (key === 'activeProvider') {
        if (value) localStorage.setItem('lumina_active_provider', value)
      }

      if (window.api && typeof window.api.saveSetting === 'function') {
        await window.api.saveSetting(key, value)
      }
    } catch (err) {
      console.error(`Failed to save setting ${key}:`, err)
    }
  },

  togglePinnedFolder: async (folderId) => {
    const current = get().settings.pinnedFolders || []
    const newPinned = current.includes(folderId)
      ? current.filter((id) => id !== folderId)
      : [...current, folderId]

    set((state) => ({
      settings: { ...state.settings, pinnedFolders: newPinned }
    }))

    try {
      if (window.api && window.api.saveSetting) {
        await window.api.saveSetting('pinnedFolders', newPinned)
      }
    } catch (err) {
      console.error(`Failed to save pinnedFolders:`, err)
    }
  },

  updateSettings: async (settings) => {
    // Optimistic Update
    set((state) => ({
      settings: { ...state.settings, ...settings }
    }))

    // Persist to settings.json
    try {
      if (window.api && window.api.saveSettings) {
        await window.api.saveSettings(settings)
      }
    } catch (err) {
      console.error(`Failed to save multiple settings:`, err)
    }
  }
}))
