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
    inlineMetadata: true
  },
  
  isLoading: true,
  
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
          set({ settings: allSettings, isLoading: false })
          // Apply side effects
          const root = document.documentElement
          root.setAttribute('data-theme', allSettings.theme)
          root.style.setProperty('--font-editor', allSettings.fontFamily)
          root.style.setProperty('--font-size-editor', `${allSettings.fontSize}px`)
          root.style.setProperty('--cursor-style', allSettings.cursorStyle)
          root.setAttribute('data-translucency', allSettings.translucency ? 'true' : 'false')
          // Apply window effect via IPC
          if (window.api && window.api.setTranslucency) {
            window.api.setTranslucency(allSettings.translucency)
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
                set({ settings: allSettings })
                const root = document.documentElement
                root.setAttribute('data-theme', allSettings.theme)
                root.style.setProperty('--font-editor', allSettings.fontFamily)
                root.style.setProperty('--font-size-editor', `${allSettings.fontSize}px`)
                root.style.setProperty('--cursor-style', allSettings.cursorStyle)
                root.setAttribute('data-translucency', allSettings.translucency ? 'true' : 'false')
                if (window.api && window.api.setTranslucency) {
                  window.api.setTranslucency(allSettings.translucency)
                }
              } else {
                 console.warn('Backend settings unavailable, using defaults.')
                 // Defaults are already set in initialState
              }
            }
         } catch(e) { console.warn('Retry failed', e) }
      }, 1000)
    }
  },

  updateSetting: async (key, value) => {
    // Optimistic Update
    set(state => ({
      settings: { ...state.settings, [key]: value }
    }))

    // Apply specific side effects
    const root = document.documentElement
    if (key === 'theme') root.setAttribute('data-theme', value)
    if (key === 'fontFamily') root.style.setProperty('--font-editor', value)
    if (key === 'fontSize') root.style.setProperty('--font-size-editor', `${value}px`)
    if (key === 'cursorStyle') root.style.setProperty('--cursor-style', value)
    if (key === 'translucency') {
      root.setAttribute('data-translucency', value ? 'true' : 'false')
      if (window.api && window.api.setTranslucency) {
        window.api.setTranslucency(value)
      }
    }

    // Persist to settings.json
    try {
      await window.api.saveSetting(key, value)
    } catch (err) {
      console.error(`Failed to save setting ${key}:`, err)
      // Revert on failure? For now, keep optimistic.
    }
  }
}))
