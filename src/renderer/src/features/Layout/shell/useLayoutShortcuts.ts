import { useEffect, type MutableRefObject } from 'react'
import { toggleSidebarView } from '../../Navigation/sidebarViewStore'
import { useKeyboardShortcuts, matchesShortcut } from '../../../core/shortcuts'
import { useWorkspaceStore, GRAPH_TAB_ID } from '../../../core/store/workspaceStore'
import { useSettingsStore } from '../../../core/store/SettingStore'
import type { RenameModalState } from '../AppModals'
import type { ToastType } from '../../../core/notification'

export function isRecordingShortcutInput(): boolean {
  return Boolean(
    (window as any).__isRecordingShortcut ||
      document.querySelector(
        '.shortcut-recording, .shortcut-inline-input, .shortcut-modal-overlay'
      ) ||
      (document.activeElement &&
        (document.activeElement as HTMLElement).closest &&
        (document.activeElement as HTMLElement).closest(
          '.shortcut-inline-container, .shortcut-modal'
        ))
  )
}

export interface UseLayoutShortcutsOptions {
  snippets: any[]
  selectedSnippet: any
  activeTabId: string | null
  saveSnippet: (note: any) => Promise<any>
  setSelectedSnippet: (note: any) => void
  setActiveTab: (tab: string) => void
  setPaletteInitialQuery: (query: string) => void
  setShowPalette: (show: boolean) => void
  setSettingsInitialTab: (tab: string) => void
  setShowSettings: (show: boolean) => void
  setShowDocsModal: (show: boolean) => void
  setShowGuideModal: (show: boolean) => void
  setShowAIChatModal: (show: boolean) => void
  setShowActiveIconPicker: (show: boolean) => void
  setRenameModal: (state: RenameModalState) => void
  setSnippetToDelete: (note: any) => void
  setShowDeleteConfirm: (show: boolean) => void
  showActiveIconPicker: boolean
  renameModal: RenameModalState
  showAIChatModal: boolean
  showPalette: boolean
  showSettings: boolean
  showDeleteConfirm: boolean
  showDocsModal: boolean
  showGuideModal: boolean
  updateLeftSidebarOpen: (valOrFn: boolean | ((prev: boolean) => boolean)) => void
  updateRightSidebarOpen: (valOrFn: boolean | ((prev: boolean) => boolean)) => void
  isRightSidebarOpenRef: MutableRefObject<boolean>
  rightSidebarTabRef: MutableRefObject<string>
  setRightSidebarTab: (tab: string) => void
  handleOpenOrCreateCanvasTabRef: MutableRefObject<() => void>
  handleToggleAIChat: () => void
  handleToggleTerminal: () => void
  handleToggleInspector: () => void
  handleNew: () => Promise<void>
  showToast: (message: string, type?: ToastType) => void
}

export function useLayoutShortcuts({
  snippets,
  selectedSnippet,
  activeTabId,
  saveSnippet,
  setSelectedSnippet,
  setActiveTab,
  setPaletteInitialQuery,
  setShowPalette,
  setSettingsInitialTab,
  setShowSettings,
  setShowDocsModal,
  setShowGuideModal,
  setShowAIChatModal,
  setShowActiveIconPicker,
  setRenameModal,
  setSnippetToDelete,
  setShowDeleteConfirm,
  showActiveIconPicker,
  renameModal,
  showAIChatModal,
  showPalette,
  showSettings,
  showDeleteConfirm,
  showDocsModal,
  showGuideModal,
  updateLeftSidebarOpen,
  updateRightSidebarOpen,
  isRightSidebarOpenRef,
  rightSidebarTabRef,
  setRightSidebarTab,
  handleOpenOrCreateCanvasTabRef,
  handleToggleAIChat,
  handleToggleTerminal,
  handleToggleInspector,
  handleNew,
  showToast
}: UseLayoutShortcutsOptions) {
  // Rename shortcut (Ctrl/Cmd + R, F2) + open-rename-modal CustomEvent
  useEffect(() => {
    const handleRenameShortcut = (e: KeyboardEvent) => {
      if (isRecordingShortcutInput()) return
      const key = e.key && e.key.toLowerCase()
      const isRenameShortcut =
        ((e.ctrlKey || e.metaKey) && key === 'r' && !e.shiftKey && !e.altKey) ||
        (e.key === 'F2' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey)

      if (isRenameShortcut) {
        e.preventDefault()
        const currentSelectedFolder = useWorkspaceStore.getState().selectedFolder
        if (currentSelectedFolder) {
          const folderName = currentSelectedFolder.split('/').pop() || ''
          setRenameModal({
            isOpen: true,
            item: { type: 'folder', id: currentSelectedFolder, name: folderName },
            newName: folderName
          })
        } else if (selectedSnippet) {
          setRenameModal({
            isOpen: true,
            item: selectedSnippet,
            newName: selectedSnippet.title || ''
          })
        } else {
          showToast('No note or folder selected to rename', 'info')
        }
      }
    }

    const handleOpenRenameModal = (e: Event) => {
      const customEvent = e as CustomEvent
      const target = customEvent.detail?.note || customEvent.detail?.item || selectedSnippet
      if (target) {
        setRenameModal({
          isOpen: true,
          item: target,
          newName: target.title || target.name || ''
        })
      }
    }

    window.addEventListener('keydown', handleRenameShortcut)
    window.addEventListener('open-rename-modal', handleOpenRenameModal)
    return () => {
      window.removeEventListener('keydown', handleRenameShortcut)
      window.removeEventListener('open-rename-modal', handleOpenRenameModal)
    }
  }, [selectedSnippet, showToast, setRenameModal])

  // Dedicated direct capturing listener for Canvas Tab (default: Ctrl + Shift + ;)
  useEffect(() => {
    const handleCanvasShortcut = (e: KeyboardEvent) => {
      if (isRecordingShortcutInput()) return
      const isCtrl = e.ctrlKey || e.metaKey
      const isShift = e.shiftKey
      const isSemicolon =
        e.code === 'Semicolon' ||
        e.key === ';' ||
        e.key === ':' ||
        e.keyCode === 186 ||
        e.keyCode === 59

      const isDefaultCanvas = isCtrl && isShift && !e.altKey && isSemicolon

      const userShortcuts = useSettingsStore.getState().settings.shortcuts || {}
      const configuredCanvasKey = userShortcuts.canvasDrawer || userShortcuts.canvas
      const matchesConfigured =
        configuredCanvasKey &&
        configuredCanvasKey !== 'Ctrl + Shift + /' &&
        configuredCanvasKey !== 'Ctrl + Shift + ;'
          ? matchesShortcut(e, configuredCanvasKey)
          : false

      if (isDefaultCanvas || matchesConfigured) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        const now = Date.now()
        const lastDispatch = (window as any).__lastCanvasDispatch || 0
        if (now - lastDispatch < 300) {
          return
        }
        ;(window as any).__lastCanvasDispatch = now
        handleOpenOrCreateCanvasTabRef.current?.()
      }
    }

    const handleCanvasTabEvent = () => {
      handleOpenOrCreateCanvasTabRef.current?.()
    }

    window.addEventListener('keydown', handleCanvasShortcut, true)
    window.addEventListener('open-canvas-tab', handleCanvasTabEvent)
    window.addEventListener('toggle-canvas-drawer', handleCanvasTabEvent)
    window.addEventListener('open-canvas-drawer', handleCanvasTabEvent)

    return () => {
      window.removeEventListener('keydown', handleCanvasShortcut, true)
      window.removeEventListener('open-canvas-tab', handleCanvasTabEvent)
      window.removeEventListener('toggle-canvas-drawer', handleCanvasTabEvent)
      window.removeEventListener('open-canvas-drawer', handleCanvasTabEvent)
    }
  }, [handleOpenOrCreateCanvasTabRef])

  // Dedicated capture-phase shortcut listener for Tab Navigation (Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+1..9)
  useEffect(() => {
    const handleTabNavCapture = (e: KeyboardEvent) => {
      if (isRecordingShortcutInput()) return

      const isPrimary = e.ctrlKey || e.metaKey

      // Ctrl + 1..9 (Direct Tab Switching)
      if (isPrimary && !e.altKey && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        const targetIdx = parseInt(e.key, 10) - 1
        const tabs = useWorkspaceStore.getState().openTabs || []
        if (targetIdx >= 0 && targetIdx < tabs.length) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          useWorkspaceStore.getState().setActiveTabId(tabs[targetIdx])
          return
        }
      }

      // Ctrl + Tab / Ctrl + Shift + Tab (Tab Cycling)
      if (isPrimary && !e.altKey && (e.key === 'Tab' || e.code === 'Tab')) {
        const tabs = useWorkspaceStore.getState().openTabs || []
        if (tabs.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          const currentId = useWorkspaceStore.getState().activeTabId
          const currentIdx = currentId ? tabs.indexOf(currentId) : -1
          if (e.shiftKey) {
            const prevIdx = currentIdx <= 0 ? tabs.length - 1 : currentIdx - 1
            useWorkspaceStore.getState().setActiveTabId(tabs[prevIdx])
          } else {
            const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % tabs.length
            useWorkspaceStore.getState().setActiveTabId(tabs[nextIdx])
          }
          return
        }
      }
    }

    window.addEventListener('keydown', handleTabNavCapture, true)
    return () => window.removeEventListener('keydown', handleTabNavCapture, true)
  }, [])

  // Dedicated capture-phase shortcut listener for Zen Mode (Ctrl + .)
  useEffect(() => {
    const handleZenCapture = (e: KeyboardEvent) => {
      if (isRecordingShortcutInput()) return

      const userShortcuts = useSettingsStore.getState().settings.shortcuts || {}
      const zenKey = userShortcuts.zenMode || 'Ctrl + .'

      if (matchesShortcut(e, zenKey)) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        const now = Date.now()
        const last = (window as any).__lastZenDispatch || 0
        if (now - last < 400) return
        ;(window as any).__lastZenDispatch = now

        useSettingsStore.getState().toggleZenMode()
      }
    }

    window.addEventListener('keydown', handleZenCapture, true)
    return () => window.removeEventListener('keydown', handleZenCapture, true)
  }, [])

  // Standard application keyboard shortcuts
  useKeyboardShortcuts({
    onGlobalSearch: () => {
      setActiveTab('search')
      updateLeftSidebarOpen(true)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('global-search-focus'))
      }, 50)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('global-search-focus'))
      }, 150)
    },
    onFind: () => window.dispatchEvent(new CustomEvent('find-in-editor')),
    onTogglePalette: () => {
      if (showPalette) {
        window.dispatchEvent(
          new CustomEvent('lumina-palette-shortcut', { detail: { mode: 'notes' } })
        )
        return
      }
      setPaletteInitialQuery('')
      setShowPalette(true)
    },
    onToggleZenMode: () => {
      useSettingsStore.getState().toggleZenMode()
    },
    onTogglePaletteCommandMode: () => {
      if (showPalette) {
        window.dispatchEvent(
          new CustomEvent('lumina-palette-shortcut', { detail: { mode: 'commands' } })
        )
        return
      }
      setPaletteInitialQuery('> ')
      setShowPalette(true)
    },
    onToggleCommandPalette: () => {
      if (showPalette) {
        window.dispatchEvent(
          new CustomEvent('lumina-palette-shortcut', { detail: { mode: 'commands' } })
        )
        return
      }
      setPaletteInitialQuery('>')
      setShowPalette(true)
    },
    onOpenFile: async () => {
      try {
        const winApi = (window as any).api
        if (!winApi?.openFile) return
        const file = await winApi.openFile()
        if (file && typeof file.content === 'string') {
          const newSnippet = {
            id: Date.now().toString(),
            title: file.name.replace(/\.[^/.]+$/, ''),
            code: file.content,
            language: 'markdown',
            timestamp: Date.now()
          }
          await saveSnippet(newSnippet)
          setSelectedSnippet(newSnippet)
          showToast(`Opened ${file.name}`, 'success')
        }
      } catch (err) {
        console.error('Failed to import file:', err)
        showToast('Failed to open file', 'error')
      }
    },
    onOpenDocs: () => {
      setShowDocsModal(true)
    },
    onOpenShortcuts: () => {
      setSettingsInitialTab('shortcuts')
      setShowSettings(true)
    },
    onChangeIcon: () => {
      const active = selectedSnippet || snippets.find((s: any) => s.id === activeTabId)
      if (active) {
        setShowActiveIconPicker(true)
      } else {
        showToast('Open a note to change its icon', 'info')
      }
    },
    onEscape: () => {
      if (showActiveIconPicker) {
        setShowActiveIconPicker(false)
        return true
      }
      if (renameModal.isOpen) {
        setRenameModal({ isOpen: false, item: null, newName: '' })
        return true
      }
      if (showAIChatModal) {
        setShowAIChatModal(false)
        return true
      }
      if (showPalette) {
        setShowPalette(false)
        return true
      }
      if (showSettings) {
        setShowSettings(false)
        return true
      }
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false)
        return true
      }
      if (showDocsModal) {
        setShowDocsModal(false)
        return true
      }
      if (showGuideModal) {
        setShowGuideModal(false)
        return true
      }
      return false
    },
    onToggleSettings: () => setShowSettings(true),
    onToggleTheme: () => toggleSidebarView('theme'),
    onToggleGraph: () => useWorkspaceStore.getState().openGraphTab(),
    onToggleAIChat: () => handleToggleAIChat(),
    onToggleSidebar: () => toggleSidebarView('files'),
    onToggleTerminal: handleToggleTerminal,
    onToggleInspector: handleToggleInspector,
    onToggleOutline: () => {
      if (isRightSidebarOpenRef.current && rightSidebarTabRef.current === 'outline') {
        updateRightSidebarOpen(false)
      } else {
        setRightSidebarTab('outline')
        updateRightSidebarOpen(true)
      }
    },
    onToggleCanvasDrawer: () => {
      handleOpenOrCreateCanvasTabRef.current?.()
    },
    onNew: () => {
      void handleNew()
    },
    onNewFolder: () => {
      window.dispatchEvent(new CustomEvent('trigger-new-folder'))
    },
    onDelete: () => {
      const ws = useWorkspaceStore.getState() as any
      if (ws?.selectedFolder) {
        window.dispatchEvent(new CustomEvent('trigger-delete-folder'))
        return
      }
      const activeItem =
        selectedSnippet ||
        (activeTabId && activeTabId !== GRAPH_TAB_ID
          ? snippets.find((s: any) => s.id === activeTabId)
          : null)
      if (activeItem) {
        setSnippetToDelete(activeItem)
        setShowDeleteConfirm(true)
      }
    },
    onCloseTab: () => {
      if (activeTabId) {
        useWorkspaceStore.getState().closeTab(activeTabId)
      }
    },
    onCloseWindow: () => {
      const winApi = (window as any).api
      if (winApi?.closeWindow) {
        winApi.closeWindow()
      } else {
        console.error('[MainLayout] Close window API not available')
      }
    },
    onQuitApp: () => {
      const winApi = (window as any).api
      if (winApi?.quitApp) {
        winApi.quitApp()
      } else if (winApi?.closeWindow) {
        winApi.closeWindow()
      } else {
        window.close()
      }
    },
    onNextTab: () => {
      const tabs = useWorkspaceStore.getState().openTabs || []
      if (tabs.length === 0) return
      const currentId = useWorkspaceStore.getState().activeTabId
      const currentIdx = currentId ? tabs.indexOf(currentId) : -1
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % tabs.length
      useWorkspaceStore.getState().setActiveTabId(tabs[nextIdx])
    },
    onPreviousTab: () => {
      const tabs = useWorkspaceStore.getState().openTabs || []
      if (tabs.length === 0) return
      const currentId = useWorkspaceStore.getState().activeTabId
      const currentIdx = currentId ? tabs.indexOf(currentId) : -1
      const prevIdx = currentIdx <= 0 ? tabs.length - 1 : currentIdx - 1
      useWorkspaceStore.getState().setActiveTabId(tabs[prevIdx])
    },
    onSelectTabByIndex: (index) => {
      const tabs = useWorkspaceStore.getState().openTabs || []
      if (index >= 0 && index < tabs.length) {
        useWorkspaceStore.getState().setActiveTabId(tabs[index])
      }
    }
  })
}
