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
    translucency: false,
    mirrorMode: true, // New premium feature default
    inlineMetadata: true,
    graphTheme: 'default',
    // AI Settings - preserve these during hot reload
    deepSeekKey: null,
    deepSeekModel: 'deepseek-chat',
    huggingFaceKey: null,
    
    // New Multi-Provider Support
    activeProvider: 'deepseek', // 'deepseek', 'openai', 'anthropic', 'ollama'
    activeModel: null, // If null, provider uses its default
    openaiKey: null,
    anthropicKey: null,
    ollamaUrl: 'http://localhost:11434/api/chat'
  },

  isLoading: true,
  settingsWatcherUnsubscribe: null,

  // Initialize from robust settings.json via IPC
  init: async () => {
    try {
      if (window.api && window.api.getSetting) {
        // Fetch all at once if possible, or key by key. For now, fetch generic.
        // Or if we implemented `db:getSettings`, but we have specific keys.
        // Let's assume we can fetch individual or better yet, optimize backend later.
        // For now, let's just fetch individual or assume backend sends all if key is null?
        // Actually, SettingsManager.get() returns all if key is null/undefined.
        const allSettings = await window.api.getSetting()
        if (allSettings) {
          // Merge with defaults to ensure new keys are present
          const currentSettings = get().settings
          // Deep merge or spread is fine for flat settings. Spread prioritizes 'allSettings' (persisted).
          // But we want to ensure keys present in 'currentSettings' (defaults) but missing in 'allSettings' are kept.
          const mergedSettings = { ...currentSettings, ...allSettings }
          
          set({ settings: mergedSettings, isLoading: false })
          
          // Apply side effects using merged settings
          const root = document.documentElement
          root.setAttribute('data-theme', mergedSettings.theme)
          root.style.setProperty('--font-editor', mergedSettings.fontFamily)
          root.style.setProperty('--font-size-editor', `${mergedSettings.fontSize}px`)
          root.setAttribute('data-translucency', mergedSettings.translucency ? 'true' : 'false')
          root.setAttribute('data-mirror-mode', mergedSettings.mirrorMode ? 'true' : 'false')
          document.body.setAttribute('data-mirror-mode', mergedSettings.mirrorMode ? 'true' : 'false')
          // Apply window effect via IPC
          if (window.api && window.api.setTranslucency) {
            window.api.setTranslucency(mergedSettings.translucency)
          }
          // Subscribe to external changes via IPC (main process watcher)
          if (window.api && typeof window.api.onSettingsChanged === 'function') {
            // Ensure we don't double-subscribe
            if (!get().settingsWatcherUnsubscribe) {
              const unsub = window.api.onSettingsChanged((newSettings) => {
                try {
                  // When external update comes, merge it too
                  const active = get().settings
                  const updatedParams = { ...active, ...newSettings }
                  set({ settings: updatedParams })
                  
                  const root = document.documentElement
                  root.setAttribute('data-theme', updatedParams.theme)
                  root.style.setProperty('--font-editor', updatedParams.fontFamily)
                  root.style.setProperty('--font-size-editor', `${updatedParams.fontSize}px`)
                  root.style.setProperty('--cursor-style', updatedParams.cursorStyle)
                  root.setAttribute('data-translucency', updatedParams.translucency ? 'true' : 'false')
                  root.setAttribute('data-mirror-mode', updatedParams.mirrorMode ? 'true' : 'false')
                  document.body.setAttribute('data-mirror-mode', updatedParams.mirrorMode ? 'true' : 'false')
                  if (window.api && window.api.setTranslucency) {
                    window.api.setTranslucency(updatedParams.translucency)
                  }
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
      set({ isLoading: false })
      // Retry once after 1s
      setTimeout(async () => {
        try {
          if (window.api && window.api.getSetting) {
            const allSettings = await window.api.getSetting().catch(() => null) // Catch IPC error
            if (allSettings) {
              // Merge with current defaults to preserve any new default keys while keeping user values
              const currentDefaults = get().settings
              const mergedSettings = { ...currentDefaults, ...allSettings }
              set({ settings: mergedSettings })
              // Apply side effects
              const root = document.documentElement
              root.setAttribute('data-theme', mergedSettings.theme)
              root.style.setProperty('--font-editor', mergedSettings.fontFamily)
              root.style.setProperty('--font-size-editor', `${mergedSettings.fontSize}px`)
              root.setAttribute('data-translucency', mergedSettings.translucency ? 'true' : 'false')
              root.setAttribute('data-mirror-mode', mergedSettings.mirrorMode ? 'true' : 'false')
              document.body.setAttribute('data-mirror-mode', mergedSettings.mirrorMode ? 'true' : 'false')
              if (window.api && window.api.setTranslucency) {
                window.api.setTranslucency(mergedSettings.translucency)
              }
              // Subscribe to IPC settings changes if available
              if (window.api && typeof window.api.onSettingsChanged === 'function') {
                if (!get().settingsWatcherUnsubscribe) {
                  const unsub = window.api.onSettingsChanged((newSettings) => {
                    try {
                      set({ settings: newSettings })
                      const root = document.documentElement
                      root.setAttribute('data-theme', newSettings.theme)
                      root.style.setProperty('--font-editor', newSettings.fontFamily)
                      root.style.setProperty('--font-size-editor', `${newSettings.fontSize}px`)
                      root.style.setProperty('--cursor-style', newSettings.cursorStyle)
                      root.setAttribute('data-translucency', newSettings.translucency ? 'true' : 'false')
                      if (window.api && window.api.setTranslucency) {
                        window.api.setTranslucency(newSettings.translucency)
                      }
                    } catch (err) {
                      console.error('[useSettingsStore] Error applying external settings (retry):', err)
                    }
                  })
                  set({ settingsWatcherUnsubscribe: unsub })
                }
              }
            } else {
              console.warn('Backend settings unavailable, using defaults.')
              // Defaults are already set in initialState
            }
          }
        } catch (e) {
          console.warn('Retry failed', e)
        }
      }, 1000)
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
    if (key === 'translucency') {
      root.setAttribute('data-translucency', value ? 'true' : 'false')
      if (window.api && window.api.setTranslucency) {
        window.api.setTranslucency(value)
      }
    }
    if (key === 'mirrorMode') {
      root.setAttribute('data-mirror-mode', value ? 'true' : 'false')
      document.body.setAttribute('data-mirror-mode', value ? 'true' : 'false')
    }

    // Persist to settings.json
    try {
      await window.api.saveSetting(key, value)
    } catch (err) {
      console.error(`Failed to save setting ${key}:`, err)
      // Revert on failure? For now, keep optimistic.
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
