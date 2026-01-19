import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSettingsStore } from './useSettingsStore'

describe('useSettingsStore', () => {
  beforeEach(() => {
    // Reset store
    useSettingsStore.setState({
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
        inlineMetadata: true,
        graphTheme: 'default'
      },
      isLoading: false
    })

    // Reset mocks
    vi.clearAllMocks()
    
    // Reset document
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-translucency')
    document.documentElement.style.cssText = ''

    // Mock window.api
    global.window.api = {
      getSetting: vi.fn(),
      saveSetting: vi.fn(),
      setTranslucency: vi.fn()
    }
  })

  describe('updateSetting', () => {
    it('updates setting optimistically', async () => {
      global.window.api.saveSetting.mockResolvedValue(true)

      await useSettingsStore.getState().updateSetting('fontSize', 18)

      expect(useSettingsStore.getState().settings.fontSize).toBe(18)
    })

    it('applies theme to document', async () => {
      global.window.api.saveSetting.mockResolvedValue(true)

      await useSettingsStore.getState().updateSetting('theme', 'light')

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })

    it('applies fontFamily to CSS variable', async () => {
      global.window.api.saveSetting.mockResolvedValue(true)

      await useSettingsStore.getState().updateSetting('fontFamily', 'Monaco')

      expect(document.documentElement.style.getPropertyValue('--font-editor')).toBe('Monaco')
    })

    it('applies fontSize to CSS variable', async () => {
      global.window.api.saveSetting.mockResolvedValue(true)

      await useSettingsStore.getState().updateSetting('fontSize', 20)

      expect(document.documentElement.style.getPropertyValue('--font-size-editor')).toBe('20px')
    })

    it('applies translucency setting', async () => {
      global.window.api.saveSetting.mockResolvedValue(true)
      global.window.api.setTranslucency = vi.fn()

      await useSettingsStore.getState().updateSetting('translucency', true)

      expect(document.documentElement.getAttribute('data-translucency')).toBe('true')
      expect(global.window.api.setTranslucency).toHaveBeenCalledWith(true)
    })

    it('persists setting via IPC', async () => {
      global.window.api.saveSetting.mockResolvedValue(true)

      await useSettingsStore.getState().updateSetting('autoSave', false)

      expect(global.window.api.saveSetting).toHaveBeenCalledWith('autoSave', false)
    })

    it('handles IPC errors gracefully', async () => {
      global.window.api.saveSetting.mockRejectedValue(new Error('IPC error'))

      // Should not throw
      await expect(
        useSettingsStore.getState().updateSetting('fontSize', 20)
      ).resolves.not.toThrow()

      // Optimistic update should still be applied
      expect(useSettingsStore.getState().settings.fontSize).toBe(20)
    })
  })

  describe('init', () => {
    it('loads settings from IPC', async () => {
      const mockSettings = {
        theme: 'dark',
        fontSize: 18,
        fontFamily: 'Fira Code'
      }
      global.window.api.getSetting.mockResolvedValue(mockSettings)

      await useSettingsStore.getState().init()

      expect(useSettingsStore.getState().settings.theme).toBe('dark')
      expect(useSettingsStore.getState().settings.fontSize).toBe(18)
      expect(useSettingsStore.getState().isLoading).toBe(false)
    })

    it('applies settings to document on init', async () => {
      const mockSettings = {
        theme: 'light',
        fontFamily: 'Monaco',
        fontSize: 20,
        cursorStyle: 'block',
        translucency: true
      }
      global.window.api.getSetting.mockResolvedValue(mockSettings)
      global.window.api.setTranslucency = vi.fn()

      await useSettingsStore.getState().init()

      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
      expect(document.documentElement.style.getPropertyValue('--font-editor')).toBe('Monaco')
      expect(document.documentElement.style.getPropertyValue('--font-size-editor')).toBe('20px')
      expect(document.documentElement.getAttribute('data-translucency')).toBe('true')
    })

    it('handles missing window.api gracefully', async () => {
      delete global.window.api

      await expect(useSettingsStore.getState().init()).resolves.not.toThrow()
      expect(useSettingsStore.getState().isLoading).toBe(false)
    })

    it('retries on failure', async () => {
      vi.useFakeTimers()
      global.window.api.getSetting
        .mockRejectedValueOnce(new Error('First attempt fails'))
        .mockResolvedValueOnce({ theme: 'dark' })

      const initPromise = useSettingsStore.getState().init()

      // Fast-forward past retry delay
      await vi.advanceTimersByTimeAsync(1000)

      await initPromise

      expect(global.window.api.getSetting).toHaveBeenCalledTimes(2)
      expect(useSettingsStore.getState().settings.theme).toBe('dark')

      vi.useRealTimers()
    })
  })
})
