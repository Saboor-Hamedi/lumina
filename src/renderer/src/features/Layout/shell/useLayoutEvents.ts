import { useEffect, type MutableRefObject } from 'react'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { useUpdateStore } from '../../../core/store/UpdateSetting'
import type { ToastType } from '../../../core/notification'
import { isRecordingShortcutInput } from './useLayoutShortcuts'

export interface UseLayoutEventsOptions {
  openTabsLength: number
  activeTab: string
  splitDirection: 'vertical' | 'horizontal' | 'none' | null
  splitPane: (direction: 'vertical' | 'horizontal') => void
  closeSplit: () => void
  loadWorkspace: () => Promise<void>
  setSelectedSnippet: (note: any) => void
  setLeftWidth: (width: number) => void
  setRightWidth: (width: number) => void
  isLeftSidebarOpenRef: MutableRefObject<boolean>
  isRightSidebarOpenRef: MutableRefObject<boolean>
  setRightSidebarTab: (tab: string) => void
  setSettingsInitialTab: (tab: string) => void
  setShowSettings: (show: boolean) => void
  setShowGuideModal: (show: boolean) => void
  setShowPalette: React.Dispatch<React.SetStateAction<boolean>>
  setPaletteInitialQuery: (query: string) => void
  updateLeftSidebarOpen: (valOrFn: boolean | ((prev: boolean) => boolean)) => void
  updateRightSidebarOpen: (valOrFn: boolean | ((prev: boolean) => boolean)) => void
  handleToggleLeftSidebar: () => void
  handleToggleInspector: () => void
  handleToggleAIChat: () => void
  handleNewCanvas: () => void
  handleOpenTheme: () => void
  handleToggleTerminal: () => void
  showToast: (message: string, type?: ToastType) => void
  clearToast: () => void
}

export function useLayoutEvents({
  openTabsLength,
  activeTab,
  splitDirection,
  splitPane,
  closeSplit,
  loadWorkspace,
  setSelectedSnippet,
  setLeftWidth,
  setRightWidth,
  isLeftSidebarOpenRef,
  isRightSidebarOpenRef,
  setRightSidebarTab,
  setSettingsInitialTab,
  setShowSettings,
  setShowGuideModal,
  setShowPalette,
  setPaletteInitialQuery,
  updateLeftSidebarOpen,
  updateRightSidebarOpen,
  handleToggleLeftSidebar,
  handleToggleInspector,
  handleToggleAIChat,
  handleNewCanvas,
  handleOpenTheme,
  handleToggleTerminal,
  showToast,
  clearToast
}: UseLayoutEventsOptions) {
  // Global toast events
  useEffect(() => {
    const handleGlobalToast = (e: any) => {
      const { message, type = 'info' } = e.detail || {}
      if (message) {
        showToast(message, type)
      }
    }
    const handleClearToast = () => clearToast()
    window.addEventListener('show-toast', handleGlobalToast as EventListener)
    window.addEventListener('clear-toast', handleClearToast)
    return () => {
      window.removeEventListener('show-toast', handleGlobalToast as EventListener)
      window.removeEventListener('clear-toast', handleClearToast)
    }
  }, [showToast, clearToast])

  // App initialization, session restore, updater init, and modal/IPC listeners
  useEffect(() => {
    const initApp = async () => {
      try {
        await Promise.all([useSettingsStore.getState().init(), loadWorkspace()])

        const actualSettings = (useSettingsStore.getState().settings as any) || {}

        if (actualSettings.openTabs && Array.isArray(actualSettings.openTabs)) {
          useWorkspaceStore
            .getState()
            .restoreSession(
              actualSettings.openTabs,
              actualSettings.lastNoteId,
              actualSettings.pinnedTabIds || [],
              actualSettings.splitLayout ?? null
            )
        } else if (actualSettings.lastNoteId) {
          const allSnippets = useWorkspaceStore.getState().notes || []
          const last = allSnippets.find((s: any) => s.id === actualSettings.lastNoteId)
          if (last) setSelectedSnippet(last)
        }

        const legacySidebar = actualSettings.sidebar || {}
        let finalLeftOpen = true
        if (typeof legacySidebar.isLeftOpen === 'boolean') {
          finalLeftOpen = legacySidebar.isLeftOpen
        } else if (typeof actualSettings.isLeftSidebarOpen === 'boolean') {
          finalLeftOpen = actualSettings.isLeftSidebarOpen
        }

        isLeftSidebarOpenRef.current = finalLeftOpen
        window.dispatchEvent(
          new CustomEvent('left-sidebar-toggle', { detail: { open: finalLeftOpen } })
        )

        const rawLeftWidth =
          legacySidebar.width || legacySidebar.leftWidth || actualSettings.leftWidth
        if (rawLeftWidth) {
          const clampedLeft = Math.min(600, Math.max(130, Number(rawLeftWidth)))
          setLeftWidth(clampedLeft)
        }

        const legacyRSidebar = actualSettings.rightSidebar || {}
        let finalRightOpen = false
        if (typeof legacyRSidebar.isRightOpen === 'boolean') {
          finalRightOpen = legacyRSidebar.isRightOpen
        } else if (typeof actualSettings.isRightSidebarOpen === 'boolean') {
          finalRightOpen = actualSettings.isRightSidebarOpen
        }

        isRightSidebarOpenRef.current = finalRightOpen

        const rawRightWidth =
          legacyRSidebar.width || legacyRSidebar.rightWidth || actualSettings.rightWidth
        if (rawRightWidth) {
          const clampedRight = Math.min(750, Math.max(130, Number(rawRightWidth)))
          setRightWidth(clampedRight)
        }
      } catch (err) {
        console.error('MainLayout initApp error:', err)
      }
    }

    initApp()

    const unsub = useUpdateStore.getState().init()

    const handleOpenDetailsModal = () => {
      setRightSidebarTab('details')
      updateRightSidebarOpen(true)
    }
    window.addEventListener('open-details-modal', handleOpenDetailsModal)

    const handleOpenAISettings = () => {
      setSettingsInitialTab('ai')
      setShowSettings(true)
    }
    window.addEventListener('open-ai-settings', handleOpenAISettings)

    const handleOpenGuide = () => {
      setShowGuideModal(true)
    }
    window.addEventListener('open-guide', handleOpenGuide)

    window.addEventListener('toggle-inspector', handleToggleInspector)

    let cleanupGlobalShortcut: (() => void) | null = null
    const winApi = (window as any).api
    if (winApi?.onToggleCommandPalette) {
      cleanupGlobalShortcut = winApi.onToggleCommandPalette(() => {
        if (isRecordingShortcutInput()) {
          return
        }
        setShowPalette((prev) => !prev)
      })
    }

    return () => {
      unsub && unsub()
      window.removeEventListener('open-details-modal', handleOpenDetailsModal)
      window.removeEventListener('open-ai-settings', handleOpenAISettings)
      window.removeEventListener('open-guide', handleOpenGuide)
      window.removeEventListener('toggle-inspector', handleToggleInspector)
      if (cleanupGlobalShortcut) cleanupGlobalShortcut()
    }
  }, [
    updateRightSidebarOpen,
    handleToggleInspector,
    loadWorkspace,
    setSelectedSnippet,
    setLeftWidth,
    setRightWidth,
    isLeftSidebarOpenRef,
    isRightSidebarOpenRef,
    setRightSidebarTab,
    setSettingsInitialTab,
    setShowSettings,
    setShowGuideModal,
    setShowPalette
  ])

  // Debounced vault filesystem watcher reload
  useEffect(() => {
    const winApi = (window as any).api
    if (winApi?.onVaultUpdated) {
      let debounceTimer: ReturnType<typeof setTimeout> | null = null
      const cleanup = winApi.onVaultUpdated(() => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          debounceTimer = null
          loadWorkspace()
        }, 250)
      })
      return () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        cleanup?.()
      }
    }
  }, [loadWorkspace])

  // Close right sidebar when switching to graph sidebar tab
  useEffect(() => {
    if (activeTab === 'graph') {
      updateRightSidebarOpen(false)
    }
  }, [activeTab, updateRightSidebarOpen])

  // Cross-feature UI action CustomEvents
  useEffect(() => {
    const handleAskAnything = (e: any) => {
      const query = e.detail?.query || ''
      setPaletteInitialQuery(query)
      setShowPalette(true)
    }
    const handleAIChatEvent = () => {
      handleToggleAIChat()
    }
    const handleToggleLeftSidebarEvent = (e?: Event) => {
      const detailOpen = (e as CustomEvent<{ open?: boolean }>)?.detail?.open
      if (typeof detailOpen === 'boolean') {
        updateLeftSidebarOpen(detailOpen)
        return
      }
      handleToggleLeftSidebar()
    }
    const handleNewCanvasEvent = () => {
      handleNewCanvas()
    }
    const handleOpenThemeEvent = () => {
      handleOpenTheme()
    }
    const handleOpenGraphEvent = () => {
      useWorkspaceStore.getState().openGraphTab()
    }
    const handleToggleTerminalEvent = () => {
      handleToggleTerminal()
    }
    window.addEventListener('open-ask-anything', handleAskAnything as EventListener)
    window.addEventListener('open-ai-chat', handleAIChatEvent)
    window.addEventListener('toggle-left-sidebar', handleToggleLeftSidebarEvent)
    window.addEventListener('trigger-new-canvas', handleNewCanvasEvent)
    window.addEventListener('open-theme-modal', handleOpenThemeEvent)
    window.addEventListener('open-graph-modal', handleOpenGraphEvent)
    window.addEventListener('open-graph-tab', handleOpenGraphEvent)
    window.addEventListener('toggle-terminal', handleToggleTerminalEvent)

    return () => {
      window.removeEventListener('open-ask-anything', handleAskAnything as EventListener)
      window.removeEventListener('open-ai-chat', handleAIChatEvent)
      window.removeEventListener('toggle-left-sidebar', handleToggleLeftSidebarEvent)
      window.removeEventListener('trigger-new-canvas', handleNewCanvasEvent)
      window.removeEventListener('open-theme-modal', handleOpenThemeEvent)
      window.removeEventListener('open-graph-modal', handleOpenGraphEvent)
      window.removeEventListener('open-graph-tab', handleOpenGraphEvent)
      window.removeEventListener('toggle-terminal', handleToggleTerminalEvent)
    }
  }, [
    handleToggleAIChat,
    handleToggleLeftSidebar,
    updateLeftSidebarOpen,
    handleNewCanvas,
    handleOpenTheme,
    handleToggleTerminal,
    setPaletteInitialQuery,
    setShowPalette
  ])

  // Auto-open "What's New" (release-notes) tab when a new update is detected or after upgrading
  useEffect(() => {
    const checkStartupReleaseNotes = async () => {
      try {
        const settings = (useSettingsStore.getState().settings as any) || {}
        if (settings.autoOpenReleaseNotes === false) return
        const api = (window as any).api
        const currentVer = String((await api?.getVersion?.()) || '')
          .replace(/^v/i, '')
          .trim()
        const lastSeen = String(settings.lastSeenVersion || '')
          .replace(/^v/i, '')
          .trim()
        if (currentVer && lastSeen && currentVer !== lastSeen) {
          await useSettingsStore.getState().updateSetting('lastSeenVersion', currentVer)
          useWorkspaceStore.getState().openReleaseNotesTab()
        } else if (currentVer && !lastSeen) {
          await useSettingsStore.getState().updateSetting('lastSeenVersion', currentVer)
        }
      } catch {
        /* ignore version check errors */
      }
    }

    const handleUpdateDetected = (e: Event) => {
      const remoteVer = String((e as CustomEvent)?.detail?.version || '')
        .replace(/^v/i, '')
        .trim()
      if (!remoteVer) return
      const settings = (useSettingsStore.getState().settings as any) || {}
      if (settings.autoOpenReleaseNotes === false) return
      const lastNotified = String(settings.lastNotifiedUpdateVersion || '')
        .replace(/^v/i, '')
        .trim()
      if (remoteVer !== lastNotified) {
        void useSettingsStore.getState().updateSetting('lastNotifiedUpdateVersion', remoteVer)
        useWorkspaceStore.getState().openReleaseNotesTab()
      }
    }

    const handleOpenReleaseNotesEvent = () => {
      useWorkspaceStore.getState().openReleaseNotesTab()
    }

    void checkStartupReleaseNotes()
    window.addEventListener('lumina-update-detected', handleUpdateDetected)
    window.addEventListener('open-release-notes', handleOpenReleaseNotesEvent)
    return () => {
      window.removeEventListener('lumina-update-detected', handleUpdateDetected)
      window.removeEventListener('open-release-notes', handleOpenReleaseNotesEvent)
    }
  }, [])

  // Idle-deferred Editor preload only when no tabs are open yet; never eagerly preload Terminal when closed
  useEffect(() => {
    if (openTabsLength > 0) return
    const preload = () => {
      void import('../../Editor/Editor')
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(preload, { timeout: 2500 })
      return () => (window as any).cancelIdleCallback(id)
    }
    const timer = setTimeout(preload, 1200)
    return () => clearTimeout(timer)
  }, [openTabsLength])

  // Split editor event
  useEffect(() => {
    const onSplitEditor = (e: Event) => {
      const direction = (e as CustomEvent<{ direction?: 'vertical' | 'horizontal' }>)?.detail
        ?.direction
      if (!direction) return
      if (splitDirection === direction) {
        closeSplit()
      } else {
        splitPane(direction)
      }
    }
    window.addEventListener('split-editor', onSplitEditor as EventListener)
    return () => window.removeEventListener('split-editor', onSplitEditor as EventListener)
  }, [splitDirection, splitPane, closeSplit])
}
