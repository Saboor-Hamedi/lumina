/**
 * @file SettingStore.test.ts
 * @description Unit tests for SettingStore.ts (TypeScript migration).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSettingStore } from '../../../../../src/renderer/src/core/store/SettingStore'

describe('SettingStore', () => {
  beforeEach(() => {
    // Reset global window API mocks
    window.api = {
      getSetting: vi.fn().mockResolvedValue({}),
      saveSetting: vi.fn().mockResolvedValue(true),
      saveSettings: vi.fn().mockResolvedValue(true),
      onSettingsChanged: vi.fn()
    } as any

    localStorage.clear()

    useSettingStore.setState({
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
        sidebarCollapsedSections: { pinned: false, recent: false, all: false },
        sortBy: 'name',
        sortDirection: 'asc',
        noteOrder: null,
        inlineMetadata: true,
        inlineTitle: true,
        graphTheme: 'default',
        graphNodeSize: 1.5,
        graphShowTexts: true,
        graphNodeColor: '#40bafa',
        graphSidebarOpen: true,
        deepSeekKey: null,
        deepSeekModel: 'deepseek-chat',
        huggingFaceKey: null,
        activeProvider: 'deepseek',
        activeModel: null,
        activeAIMode: 'Code',
        aiChatDisplayMode: 'sidebar',
        openaiKey: null,
        anthropicKey: null,
        groqKey: null,
        ollamaUrl: 'http://localhost:11434/api/chat',
        commandPaletteMode: 'search',
        commandPaletteSplitRatio: 50,
        launchOnStartup: false,
        globalShortcut: 'Ctrl+Space',
        windowOpacity: 1.0,
        modernUi: false,
        pinnedFolders: [],
        folderOrder: [],
        expandedFolders: [],
        sidebar: { width: 260, isLeftOpen: true },
        rightSidebar: { width: 300, isRightOpen: false },
        previewModalMaximized: false,
        settingsModalMaximized: false,
        themeModalMaximized: false,
        graphModalMaximized: false,
        docsModalMaximized: false,
        guideModalMaximized: false,
        templateModalMaximized: false,
        aiModalMaximized: false,
        emailModalWidth: 840,
        emailModalHeight: 510,
        emailSidebarWidth: 195,
        emailListWidth: 300,
        emailSidebarOpen: true,
        emailDetailOpen: true
      },
      isLoading: false,
      settingsWatcherUnsubscribe: null
    })
  })

  describe('initial defaults', () => {
    it('initializes with expected default values', () => {
      const state = useSettingStore.getState()
      expect(state.settings.theme).toBe('default')
      expect(state.settings.fontSize).toBe(16)
      expect(state.settings.fontFamily).toBe('Inter')
      expect(state.settings.autoSave).toBe(true)
      expect(state.settings.pinnedFolders).toEqual([])
    })
  })

  describe('updateSetting', () => {
    it('optimistically updates setting and invokes saveSetting IPC', async () => {
      await useSettingStore.getState().updateSetting('theme', 'dark')

      expect(useSettingStore.getState().settings.theme).toBe('dark')
      expect(window.api.saveSetting).toHaveBeenCalledWith('theme', 'dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })

    it('updates font properties in DOM and state', async () => {
      await useSettingStore.getState().updateSetting('fontSize', 18)
      await useSettingStore.getState().updateSetting('fontFamily', 'Fira Code')

      expect(useSettingStore.getState().settings.fontSize).toBe(18)
      expect(useSettingStore.getState().settings.fontFamily).toBe('Fira Code')
      expect(document.documentElement.style.getPropertyValue('--font-editor')).toBe('Fira Code')
      expect(document.documentElement.style.getPropertyValue('--font-size-editor')).toBe('18px')
    })

    it('saves modernUi to localStorage and updates attribute', async () => {
      await useSettingStore.getState().updateSetting('modernUi', true)

      expect(useSettingStore.getState().settings.modernUi).toBe(true)
      expect(localStorage.getItem('lumina_modern_ui')).toBe('true')
      expect(document.documentElement.getAttribute('data-modern-ui')).toBe('true')
    })

    it('handles AI provider keys in localStorage', async () => {
      await useSettingStore.getState().updateSetting('deepSeekKey', 'sk-test-123')
      expect(localStorage.getItem('lumina_deepseek_key')).toBe('sk-test-123')

      await useSettingStore.getState().updateSetting('deepSeekKey', null)
      expect(localStorage.getItem('lumina_deepseek_key')).toBeNull()
    })
  })

  describe('togglePinnedFolder', () => {
    it('adds folderId when not pinned, and removes when already pinned', async () => {
      await useSettingStore.getState().togglePinnedFolder('folder-1')
      expect(useSettingStore.getState().settings.pinnedFolders).toEqual(['folder-1'])
      expect(window.api.saveSetting).toHaveBeenCalledWith('pinnedFolders', ['folder-1'])

      await useSettingStore.getState().togglePinnedFolder('folder-1')
      expect(useSettingStore.getState().settings.pinnedFolders).toEqual([])
      expect(window.api.saveSetting).toHaveBeenCalledWith('pinnedFolders', [])
    })
  })

  describe('updateSettings', () => {
    it('updates multiple settings simultaneously and saves to IPC', async () => {
      await useSettingStore.getState().updateSettings({
        fontSize: 20,
        sortBy: 'date',
        previewModalMaximized: true
      })

      const state = useSettingStore.getState()
      expect(state.settings.fontSize).toBe(20)
      expect(state.settings.sortBy).toBe('date')
      expect(state.settings.previewModalMaximized).toBe(true)
      expect(localStorage.getItem('lumina_modal_maximized_preview')).toBe('true')
      expect(window.api.saveSettings).toHaveBeenCalledWith({
        fontSize: 20,
        sortBy: 'date',
        previewModalMaximized: true
      })
    })
  })

  describe('init', () => {
    it('loads settings via IPC and updates loading state', async () => {
      ;(window.api.getSetting as any).mockResolvedValueOnce({
        theme: 'dracula',
        fontSize: 22
      })

      useSettingStore.setState({ isLoading: true })
      await useSettingStore.getState().init()

      const state = useSettingStore.getState()
      expect(state.isLoading).toBe(false)
      expect(state.settings.theme).toBe('dracula')
      expect(state.settings.fontSize).toBe(22)
    })
  })
})
