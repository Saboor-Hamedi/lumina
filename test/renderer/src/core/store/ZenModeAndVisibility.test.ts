/**
 * @file ZenModeAndVisibility.test.ts
 * @description Unit tests for Zen Mode, UI visibility toggles, and state restoration in SettingStore.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSettingStore } from '../../../../../src/renderer/src/core/store/SettingStore'

describe('SettingStore - Zen Mode and Visibility Management', () => {
  beforeEach(() => {
    window.api = {
      getSetting: vi.fn().mockResolvedValue({}),
      saveSetting: vi.fn().mockResolvedValue(true),
      saveSettings: vi.fn().mockResolvedValue(true),
      onSettingsChanged: vi.fn()
    } as any

    localStorage.clear()

    useSettingStore.setState({
      settings: {
        titleBarVisible: true,
        statusBarVisible: true,
        activityBarVisible: true,
        tabsVisible: true,
        inlineMetadata: true,
        sidebar: { width: 260, isLeftOpen: true },
        rightSidebar: { width: 300, isRightOpen: false },
        zenMode: {
          enabled: false,
          hideTitleBar: true,
          hideStatusBar: true,
          hideActivityBar: true,
          hidePrimarySidebar: true,
          hideSecondarySidebar: true,
          hideTabs: true
        },
        zenPreState: null
      } as any,
      isLoading: false,
      settingsWatcherUnsubscribe: null
    })
  })

  it('initializes with default visibility states', () => {
    const s = useSettingStore.getState().settings
    expect(s.titleBarVisible).toBe(true)
    expect(s.statusBarVisible).toBe(true)
    expect(s.activityBarVisible).toBe(true)
    expect(s.zenMode.enabled).toBe(false)
    expect(s.zenPreState).toBeNull()
  })

  it('toggles individual components (title bar, status bar, activity bar, sidebars, metadata)', async () => {
    const store = useSettingStore.getState()

    // Title Bar
    await store.toggleTitleBar()
    expect(useSettingStore.getState().settings.titleBarVisible).toBe(false)
    await store.toggleTitleBar()
    expect(useSettingStore.getState().settings.titleBarVisible).toBe(true)

    // Status Bar
    await store.toggleStatusBar()
    expect(useSettingStore.getState().settings.statusBarVisible).toBe(false)

    // Activity Bar
    await store.toggleActivityBar()
    expect(useSettingStore.getState().settings.activityBarVisible).toBe(false)

    // Primary Sidebar
    await store.togglePrimarySidebar()
    expect(useSettingStore.getState().settings.sidebar.isLeftOpen).toBe(false)

    // Secondary Sidebar
    await store.toggleSecondarySidebar()
    expect(useSettingStore.getState().settings.rightSidebar.isRightOpen).toBe(true)

    // Editor Metadata
    await store.toggleEditorMetadata()
    expect(useSettingStore.getState().settings.inlineMetadata).toBe(false)
  })

  it('entering Zen Mode saves exact pre-state and hides configured components', async () => {
    // Setup initial state: Left open, Right closed, all bars visible
    useSettingStore.setState({
      settings: {
        ...useSettingStore.getState().settings,
        titleBarVisible: true,
        statusBarVisible: true,
        activityBarVisible: true,
        sidebar: { width: 260, isLeftOpen: true },
        rightSidebar: { width: 300, isRightOpen: false },
        zenMode: {
          enabled: false,
          hideTitleBar: true,
          hideStatusBar: true,
          hideActivityBar: true,
          hidePrimarySidebar: true,
          hideSecondarySidebar: true
        },
        zenPreState: null
      }
    })

    await useSettingStore.getState().enterZenMode()
    const state = useSettingStore.getState().settings

    expect(state.zenMode.enabled).toBe(true)
    // Pre-state preserved
    expect(state.zenPreState).toEqual({
      titleBarVisible: true,
      statusBarVisible: true,
      activityBarVisible: true,
      tabsVisible: true,
      breadcrumbsVisible: true,
      isLeftOpen: true,
      isRightOpen: false
    })

    // UI elements hidden
    expect(state.titleBarVisible).toBe(false)
    expect(state.statusBarVisible).toBe(false)
    expect(state.activityBarVisible).toBe(false)
    expect(state.tabsVisible).toBe(false)
    expect(state.breadcrumbsVisible).toBe(false)
    expect(state.sidebar.isLeftOpen).toBe(false)
    expect(state.rightSidebar.isRightOpen).toBe(false)
  })

  it('exiting Zen Mode restores the exact previous panel visibility configuration', async () => {
    // Suppose before Zen Mode, Right was OPEN, Left was CLOSED, Status Bar was HIDDEN
    useSettingStore.setState({
      settings: {
        ...useSettingStore.getState().settings,
        titleBarVisible: true,
        statusBarVisible: false,
        activityBarVisible: true,
        sidebar: { width: 260, isLeftOpen: false },
        rightSidebar: { width: 300, isRightOpen: true },
        zenMode: {
          enabled: false,
          hideTitleBar: true,
          hideStatusBar: true,
          hideActivityBar: true,
          hidePrimarySidebar: true,
          hideSecondarySidebar: true
        },
        zenPreState: null
      }
    })

    // Enter Zen Mode
    await useSettingStore.getState().enterZenMode()
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)
    expect(useSettingStore.getState().settings.rightSidebar.isRightOpen).toBe(false)

    // Exit Zen Mode
    await useSettingStore.getState().exitZenMode()
    const restored = useSettingStore.getState().settings

    expect(restored.zenMode.enabled).toBe(false)
    expect(restored.zenPreState).toBeNull()
    expect(restored.titleBarVisible).toBe(true)
    expect(restored.statusBarVisible).toBe(false) // Was false before, restored as false!
    expect(restored.activityBarVisible).toBe(true)
    expect(restored.sidebar.isLeftOpen).toBe(false) // Was false before, restored as false!
    expect(restored.rightSidebar.isRightOpen).toBe(true) // Was true before, restored as true!
  })

  it('toggleZenMode switches between enter and exit', async () => {
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(false)

    await useSettingStore.getState().toggleZenMode()
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(true)

    await useSettingStore.getState().toggleZenMode()
    expect(useSettingStore.getState().settings.zenMode.enabled).toBe(false)
  })

  it('safely normalizes older or malformed settings during init()', async () => {
    // Malformed backend payload without zenMode, zenPreState, or visibility keys
    window.api.getSetting = vi.fn().mockResolvedValue({
      theme: 'dracula',
      fontSize: 18
      // Missing titleBarVisible, statusBarVisible, activityBarVisible, zenMode
    })

    await useSettingStore.getState().init()

    const s = useSettingStore.getState().settings
    expect(s.theme).toBe('dracula')
    expect(s.fontSize).toBe(18)
    // Resilient defaults filled in
    expect(s.titleBarVisible).toBe(true)
    expect(s.statusBarVisible).toBe(true)
    expect(s.activityBarVisible).toBe(true)
    expect(s.zenMode).toBeDefined()
    expect(s.zenMode.enabled).toBe(false)
    expect(s.zenMode.hideTitleBar).toBe(true)
    expect(s.zenPreState).toBeNull()
  })
})
