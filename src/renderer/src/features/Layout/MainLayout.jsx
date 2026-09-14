/**
 * MainLayout.jsx
 * 
 * Core 3-Pane Application Shell & Workspace Orchestrator for Lumina.
 * 
 * Architecture & Responsibilities:
 * - Left Pane: Collapsible Navigation Sidebar (Vault file tree, tags, quick actions, settings).
 * - Center Pane: 
 *     - TabBar: Multi-tab management (reorder, close, pin, preview, new tab).
 *     - Breadcrumbs: File path hierarchy navigation and quick rename.
 *     - TabContentPane: Mounted pane routing (Markdown Editor, Canvas, PDF, Image, or Welcome).
 *     - StatusBar: Document metadata, word counts, sync state, and zoom controls.
 * - Right Pane: Collapsible Inspector Sidebar (Document outline, backlinks, AI assistant).
 * - Modals Layer: Offloaded to AppModals to maintain rendering isolation.
 * - Resizing: Curtain drag resizers with double-click reset and snap-to-close behavior.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Sidebar from '../Navigation/Sidebar'
import ActivityBar from '../Navigation/ActivityBar'
import Welcome from '../../Welcome'
import TabBar from './TabBar'
import TabContentPane from './TabContentPane'
import AppModals from './AppModals'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useVaultStore, GRAPH_TAB_ID } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { useToast } from '../../core/hooks/useToast'
import { populateStarterWorkspace } from '../../core/utils/starterWorkspace'
import GlobalErrorHandler from '../../components/GlobalErrorHandler'
import '../../assets/mainlayout.css'
import '../modals/css/confirm.css'
import '../modals/css/renameModal.css'

import { useTypingSound } from '../../core/hooks/useTypingSound'
import { useShallow } from 'zustand/react/shallow'

import RightSidebar from '../Inspector/RightSidebar'
import Breadcrumbs from '../Breadcrumbs/index'
import StatusBar from './StatusBar'
import { useSidebarResize } from './useSidebarResize'

export const MainLayout = () => {
  const {
    snippets,
    selectedSnippet,
    setSelectedSnippet,
    saveSnippet,
    isLoading,
    loadVault,
    activeTabId,
    openTabs
  } = useVaultStore(
    useShallow((state) => ({
      snippets: state.snippets,
      selectedSnippet: state.selectedSnippet,
      setSelectedSnippet: state.setSelectedSnippet,
      saveSnippet: state.saveSnippet,
      isLoading: state.isLoading,
      loadVault: state.loadVault,
      activeTabId: state.activeTabId,
      openTabs: state.openTabs
    }))
  )
  const { toast, showToast, clearToast } = useToast()

  useEffect(() => {
    const handleGlobalToast = (e) => {
      const { message, type = 'info', duration = 3000 } = e.detail || {}
      if (message) {
        showToast(message, type, duration)
      }
    }
    const handleClearToast = () => clearToast()
    window.addEventListener('show-toast', handleGlobalToast)
    window.addEventListener('clear-toast', handleClearToast)
    return () => {
      window.removeEventListener('show-toast', handleGlobalToast)
      window.removeEventListener('clear-toast', handleClearToast)
    }
  }, [showToast, clearToast])

  useTypingSound()
  const [settingsInitialTab, setSettingsInitialTab] = useState('look-and-feel')

  const [activeTab, setActiveTab] = useState('files')
  const [showSettings, setShowSettings] = useState(false)
  const [initialSettingsTab, setInitialSettingsTab] = useState('general')
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [paletteInitialQuery, setPaletteInitialQuery] = useState('')
  const [showGraph, setShowGraph] = useState(false)
  const [showDocsModal, setShowDocsModal] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showAIChatModal, setShowAIChatModal] = useState(() => {
    return useSettingsStore.getState().settings?.aiChatModalState?.isOpen || false
  })
  const [showExplorerModal, setShowExplorerModal] = useState(false)
  const [showActiveIconPicker, setShowActiveIconPicker] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lumina_left_sidebar_open')
      if (saved !== null) return saved === 'true'
    }
    const storeVal = useSettingsStore.getState().settings?.sidebar?.isLeftOpen
    if (typeof storeVal === 'boolean') return storeVal
    return true
  })
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lumina_right_sidebar_open')
      if (saved !== null) return saved === 'true'
    }
    const storeVal = useSettingsStore.getState().settings?.rightSidebar?.isRightOpen
    if (typeof storeVal === 'boolean') return storeVal
    return false
  })
  const [rightSidebarTab, setRightSidebarTab] = useState('details')
  const [renameModal, setRenameModal] = useState({ isOpen: false, item: null, newName: '' })
  const [savedRightSidebarState, setSavedRightSidebarState] = useState(null)
  const appShellRef = useRef(null)

  const isLeftSidebarOpenRef = useRef(isLeftSidebarOpen)
  const isRightSidebarOpenRef = useRef(isRightSidebarOpen)

  useEffect(() => {
    isLeftSidebarOpenRef.current = isLeftSidebarOpen
  }, [isLeftSidebarOpen])

  useEffect(() => {
    isRightSidebarOpenRef.current = isRightSidebarOpen
  }, [isRightSidebarOpen])

  const updateLeftSidebarOpen = useCallback((valOrFn) => {
    const next = typeof valOrFn === 'function' ? valOrFn(isLeftSidebarOpenRef.current) : valOrFn
    isLeftSidebarOpenRef.current = next
    setIsLeftSidebarOpen(next)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumina_left_sidebar_open', String(next))
    }
    window.dispatchEvent(new CustomEvent('left-sidebar-toggle', { detail: { open: next } }))
    setTimeout(() => {
      const currentSidebar = useSettingsStore.getState().settings?.sidebar || {}
      if (currentSidebar.isLeftOpen !== next) {
        useSettingsStore.getState().updateSettings({
          sidebar: {
            ...currentSidebar,
            isLeftOpen: next
          }
        })
      }
    }, 0)
  }, [])

  const updateRightSidebarOpen = useCallback((valOrFn) => {
    const next = typeof valOrFn === 'function' ? valOrFn(isRightSidebarOpenRef.current) : valOrFn
    isRightSidebarOpenRef.current = next
    setIsRightSidebarOpen(next)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumina_right_sidebar_open', String(next))
    }
    setTimeout(() => {
      const currentRSidebar = useSettingsStore.getState().settings?.rightSidebar || {}
      if (currentRSidebar.isRightOpen !== next) {
        useSettingsStore.getState().updateSettings({
          rightSidebar: {
            ...currentRSidebar,
            isRightOpen: next
          }
        })
      }
    }, 0)
  }, [])

  const handleToggleLeftSidebar = useCallback(() => {
    updateLeftSidebarOpen((prev) => !prev)
  }, [updateLeftSidebarOpen])

  const handleToggleRightSidebar = useCallback(() => {
    updateRightSidebarOpen((prev) => !prev)
  }, [updateRightSidebarOpen])

  const handleCloseRightSidebar = useCallback(() => {
    updateRightSidebarOpen(false)
  }, [updateRightSidebarOpen])

  const handleToggleInspector = useCallback(() => {
    if (!isRightSidebarOpenRef.current) {
      setRightSidebarTab('details')
      updateRightSidebarOpen(true)
    } else {
      if (rightSidebarTab !== 'details') {
        setRightSidebarTab('details')
      } else {
        updateRightSidebarOpen(false)
      }
    }
  }, [rightSidebarTab, updateRightSidebarOpen])

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [snippetToDelete, setSnippetToDelete] = useState(null)

  const {
    leftWidth,
    rightWidth,
    setLeftWidth,
    setRightWidth,
    handleStartResize,
    handleResetSidebar
  } = useSidebarResize({
    appShellRef,
    isLeftSidebarOpen,
    isRightSidebarOpen,
    updateLeftSidebarOpen,
    handleCloseRightSidebar
  })

  useEffect(() => {
    const initApp = async () => {
      try {
        await Promise.all([
          useSettingsStore.getState().init(),
          loadVault()
        ])

        const actualSettings = useSettingsStore.getState().settings || {}

        if (actualSettings.openTabs && Array.isArray(actualSettings.openTabs)) {
          useVaultStore
            .getState()
            .restoreSession(
              actualSettings.openTabs,
              actualSettings.lastSnippetId,
              actualSettings.pinnedTabIds || []
            )
        } else if (actualSettings.lastSnippetId) {
          const allSnippets = useVaultStore.getState().snippets || []
          const last = allSnippets.find((s) => s.id === actualSettings.lastSnippetId)
          if (last) setSelectedSnippet(last)
        }

        let savedLeft = null
        let savedRight = null
        if (typeof localStorage !== 'undefined') {
          savedLeft = localStorage.getItem('lumina_left_sidebar_open')
          savedRight = localStorage.getItem('lumina_right_sidebar_open')
        }

        const legacySidebar = actualSettings.sidebar || {}
        if (savedLeft !== null) {
          setIsLeftSidebarOpen(savedLeft === 'true')
        } else if (typeof legacySidebar.isLeftOpen === 'boolean') {
          setIsLeftSidebarOpen(legacySidebar.isLeftOpen)
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('lumina_left_sidebar_open', String(legacySidebar.isLeftOpen))
          }
        } else if (typeof actualSettings.isLeftSidebarOpen === 'boolean') {
          setIsLeftSidebarOpen(actualSettings.isLeftSidebarOpen)
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('lumina_left_sidebar_open', String(actualSettings.isLeftSidebarOpen))
          }
        }

        let savedLeftWidth = null
        let savedRightWidth = null
        if (typeof localStorage !== 'undefined') {
          const rawL = localStorage.getItem('lumina_left_sidebar_width')
          if (rawL) {
            const parsedL = parseInt(rawL, 10)
            if (!isNaN(parsedL) && parsedL >= 180 && parsedL <= 600) {
              savedLeftWidth = parsedL
            }
          }
          const rawR = localStorage.getItem('lumina_right_sidebar_width')
          if (rawR) {
            const parsedR = parseInt(rawR, 10)
            if (!isNaN(parsedR) && parsedR >= 200 && parsedR <= 750) {
              savedRightWidth = parsedR
            }
          }
        }

        const rawLeftWidth =
          savedLeftWidth || legacySidebar.width || legacySidebar.leftWidth || actualSettings.leftWidth
        if (rawLeftWidth) {
          const clampedLeft = Math.min(600, Math.max(180, Number(rawLeftWidth)))
          setLeftWidth(clampedLeft)
        }

        const legacyRSidebar = actualSettings.rightSidebar || {}
        if (savedRight !== null) {
          setIsRightSidebarOpen(savedRight === 'true')
        } else if (typeof legacyRSidebar.isRightOpen === 'boolean') {
          setIsRightSidebarOpen(legacyRSidebar.isRightOpen)
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('lumina_right_sidebar_open', String(legacyRSidebar.isRightOpen))
          }
        } else if (typeof actualSettings.isRightSidebarOpen === 'boolean') {
          setIsRightSidebarOpen(actualSettings.isRightSidebarOpen)
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('lumina_right_sidebar_open', String(actualSettings.isRightSidebarOpen))
          }
        }

        const rawRightWidth =
          savedRightWidth || legacyRSidebar.width || legacyRSidebar.rightWidth || actualSettings.rightWidth
        if (rawRightWidth) {
          const clampedRight = Math.min(750, Math.max(200, Number(rawRightWidth)))
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

    let cleanupGlobalShortcut = null
    if (window.api?.onToggleCommandPalette) {
      cleanupGlobalShortcut = window.api.onToggleCommandPalette(() => {
        if (
          window.__isRecordingShortcut ||
          document.querySelector('.shortcut-recording, .shortcut-inline-input, .shortcut-modal-overlay') ||
          (document.activeElement && document.activeElement.closest && document.activeElement.closest('.shortcut-inline-container, .shortcut-modal'))
        ) {
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
  }, [updateRightSidebarOpen, handleToggleInspector])

  useEffect(() => {
    if (window.api?.onVaultUpdated) {
      const cleanup = window.api.onVaultUpdated(() => {
        loadVault()
      })
      return cleanup
    }
  }, [loadVault])

  const pinnedTabIds = useVaultStore((state) => state.pinnedTabIds)

  useEffect(() => {
    const handleRenameShortcut = (e) => {
      if (
        window.__isRecordingShortcut ||
        document.querySelector('.shortcut-recording, .shortcut-inline-input, .shortcut-modal-overlay') ||
        (document.activeElement && document.activeElement.closest && document.activeElement.closest('.shortcut-inline-container, .shortcut-modal'))
      ) {
        return
      }
      const key = e.key && e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && key === 'r' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        const currentSelectedFolder = useVaultStore.getState().selectedFolder
        if (currentSelectedFolder) {
          const folderName = currentSelectedFolder.split('/').pop()
          setRenameModal({
            isOpen: true,
            item: { type: 'folder', id: currentSelectedFolder, name: folderName },
            newName: folderName
          })
        } else if (selectedSnippet) {
          setRenameModal({
            isOpen: true,
            item: selectedSnippet,
            newName: selectedSnippet.title
          })
        } else {
          showToast('No note or folder selected to rename', 'info')
        }
      }
    }
    window.addEventListener('keydown', handleRenameShortcut)
    return () => window.removeEventListener('keydown', handleRenameShortcut)
  }, [selectedSnippet, showToast])

  useEffect(() => {
    let wasLarge = window.innerWidth > 700
    const handleResize = () => {
      const isLarge = window.innerWidth > 700
      if (wasLarge && !isLarge) {
        updateLeftSidebarOpen(false)
      }
      wasLarge = isLarge
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateLeftSidebarOpen])

  useEffect(() => {
    if (activeTab === 'graph') {
      updateRightSidebarOpen(false)
    }
  }, [activeTab, updateRightSidebarOpen])

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
      setPaletteInitialQuery('')
      setShowPalette(true)
    },
    onTogglePaletteCommandMode: () => {
      setPaletteInitialQuery('> ')
      setShowPalette(true)
    },
    onToggleCommandPalette: () => {
      setPaletteInitialQuery('>')
      setShowPalette(true)
    },
    onOpenFile: async () => {
      try {
        if (!window.api?.openFile) return
        const file = await window.api.openFile()
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
      const active = selectedSnippet || snippets.find((s) => s.id === activeTabId)
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
      if (showAIChatModal) {
        setShowAIChatModal(false)
        return true
      }
      if (showPalette) {
        setShowPalette(false)
        return true
      }
      if (showGraph) {
        setShowGraph(false)
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
      if (isRightSidebarOpen) {
        if (showPalette || document.querySelector('.command-palette-overlay, .command-palette-container, .modal-overlay')) {
          return false
        }
        updateRightSidebarOpen(false)
        return true
      }
      if (showDocsModal) {
        setShowDocsModal(false)
        return true
      }
      return false
    },
    onToggleSettings: () => setShowSettings(true),
    onToggleTheme: () => setShowThemeModal(true),
    onToggleGraph: () => setShowGraph(true),
    onToggleAIChat: () => handleToggleAIChat(),
    onToggleSidebar: () => updateLeftSidebarOpen((prev) => !prev),
    onToggleInspector: handleToggleInspector,
    onNew: () => handleNew(),
    onDelete: () => {
      if (selectedSnippet) {
        setSnippetToDelete(selectedSnippet)
        setShowDeleteConfirm(true)
      }
    },
    onCloseTab: () => {
      if (activeTabId) {
        useVaultStore.getState().closeTab(activeTabId)
      }
    },
    onCloseWindow: () => {
      if (window.api?.closeWindow) {
        window.api.closeWindow()
      } else {
        console.error('[MainLayout] Close window API not available')
      }
    },
    onNextTab: () => {
      if (openTabs.length === 0) return
      const currentIdx = activeTabId ? openTabs.indexOf(activeTabId) : -1
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % openTabs.length
      const nextId = openTabs[nextIdx]
      const nextSnippet = snippets.find((s) => s.id === nextId)
      if (nextSnippet) setSelectedSnippet(nextSnippet)
    },
    onPreviousTab: () => {
      if (openTabs.length === 0) return
      const currentIdx = activeTabId ? openTabs.indexOf(activeTabId) : -1
      const prevIdx =
        currentIdx === -1
          ? openTabs.length - 1
          : currentIdx === 0
            ? openTabs.length - 1
            : currentIdx - 1
      const prevId = openTabs[prevIdx]
      const prevSnippet = snippets.find((s) => s.id === prevId)
      if (prevSnippet) setSelectedSnippet(prevSnippet)
    }
  })

  const handleNew = async () => {
    try {
      const newSnippet = {
        id: crypto.randomUUID(),
        title: 'New Note',
        code: '',
        language: 'markdown',
        tags: '',
        timestamp: Date.now()
      }
      await saveSnippet(newSnippet)
      setSelectedSnippet(newSnippet)
      setActiveTab('files')
      setShowPalette(false)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('focus-title-input'))
      }, 50)
    } catch (error) {
      console.error('[MainLayout] Failed to create new note:', error)
      showToast('Failed to create note. Please try again.', 'error')
    }
  }

  const handleConfirmDelete = async () => {
    if (snippetToDelete) {
      try {
        await useVaultStore.getState().deleteSnippet(snippetToDelete.id, true)
        setSnippetToDelete(null)
      } catch (error) {
        console.error('[MainLayout] Failed to delete snippet:', error)
        showToast('Failed to delete note. Please try again.', 'error')
      }
    }
  }

  const handleLoadStarterWorkspace = useCallback(async () => {
    try {
      const created = await populateStarterWorkspace((snippet) => saveSnippet(snippet))
      if (created && created.length > 0) {
        const welcomeSnippet = created.find((s) => s.id === 'starter-welcome') || created[0]
        setSelectedSnippet(welcomeSnippet)
        setActiveTab('files')
      }
    } catch (error) {
      console.error('[MainLayout] Failed to populate starter workspace:', error)
      showToast('Failed to load starter notes', 'error')
    }
  }, [saveSnippet, setSelectedSnippet, setActiveTab, showToast])

  const handleOpenSettings = useCallback(() => setShowSettings(true), [])
  const handleOpenTheme = useCallback(() => setShowThemeModal(true), [])
  const handleToggleGraph = useCallback(() => setShowGraph(true), [])
  const handleOpenDocs = useCallback(() => setShowDocsModal(true), [])
  const handleToggleExplorerModal = useCallback(() => setShowExplorerModal((prev) => !prev), [])
  const handleToggleAIChat = useCallback(() => {
    const currentMode = useSettingsStore.getState().settings.aiChatDisplayMode || 'sidebar'
    if (currentMode === 'modal') {
      setShowAIChatModal((prev) => !prev)
    } else {
      if (isRightSidebarOpenRef.current && rightSidebarTab === 'chat') {
        updateRightSidebarOpen(false)
      } else {
        setRightSidebarTab('chat')
        updateRightSidebarOpen(true)
      }
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('focus-ai-composer'))
    }, 50)
  }, [updateRightSidebarOpen, rightSidebarTab])

  useEffect(() => {
    const handleAskAnything = (e) => {
      const query = e.detail?.query || ''
      setPaletteInitialQuery(query)
      setShowPalette(true)
    }
    const handleAIChatEvent = () => {
      handleToggleAIChat()
    }
    const handleToggleLeftSidebarEvent = () => {
      handleToggleLeftSidebar()
    }
    window.addEventListener('open-ask-anything', handleAskAnything)
    window.addEventListener('open-ai-chat', handleAIChatEvent)
    window.addEventListener('toggle-left-sidebar', handleToggleLeftSidebarEvent)
    return () => {
      window.removeEventListener('open-ask-anything', handleAskAnything)
      window.removeEventListener('open-ai-chat', handleAIChatEvent)
      window.removeEventListener('toggle-left-sidebar', handleToggleLeftSidebarEvent)
    }
  }, [handleToggleAIChat, handleToggleLeftSidebar])

  const renderedEditors = useMemo(() => {
    const effectiveSelectedId = selectedSnippet?.id || activeTabId || openTabs[0]
    return openTabs.map((tabId) => {
      const snippet = snippets.find((s) => s.id === tabId)
      if (!snippet) return null
      return (
        <TabContentPane
          key={tabId}
          snippet={snippet}
          isSelected={effectiveSelectedId === tabId}
          onSave={saveSnippet}
          onToggleInspector={handleToggleInspector}
          onToggleExplorerModal={handleToggleExplorerModal}
          onSettingsClick={handleOpenSettings}
          onThemeClick={handleOpenTheme}
          onGraphClick={handleToggleGraph}
        />
      )
    })
  }, [
    openTabs,
    snippets,
    selectedSnippet,
    activeTabId,
    saveSnippet,
    handleToggleInspector,
    handleToggleExplorerModal,
    handleOpenSettings,
    handleOpenTheme,
    handleToggleGraph
  ])

  return (
    <div
      ref={appShellRef}
      className={`app-shell ${isLeftSidebarOpen ? 'left-open' : 'left-closed'} ${isRightSidebarOpen ? 'right-open' : 'right-closed'}`}
      style={{
        '--left-sidebar-width': `${leftWidth}px`,
        '--left-sidebar-content-width': `${Math.max(180, leftWidth)}px`,
        '--right-sidebar-width': `${rightWidth}px`,
        '--right-sidebar-content-width': `${Math.max(200, rightWidth)}px`
      }}
    >
      <div className="shell-body">
        <ActivityBar onToggleGraph={handleToggleGraph} />
        <aside className="shell-sidebar-left">
          <GlobalErrorHandler>
            <Sidebar />
          </GlobalErrorHandler>
        </aside>
        <div
          className={`sidebar-resizer left ${isLeftSidebarOpen ? 'open' : 'closed'}`}
          title="Double-click to reset default width (260px)"
          onMouseDown={(e) => handleStartResize('left', e)}
          onDoubleClick={(e) => {
            if (!isLeftSidebarOpen) return
            e.preventDefault()
            e.stopPropagation()
            handleResetSidebar('left')
          }}
        >
          <div className="resizer-knob">
            <span className="knob-dot" />
            <span className="knob-dot" />
            <span className="knob-dot" />
          </div>
        </div>
        <main className="shell-main">
          <div className="shell-center-workspace">
            {(activeTab === 'files' || activeTab === 'search') && (
              <>
                <TabBar
                  isSidebarOpen={isRightSidebarOpen}
                  onToggleSidebar={handleToggleRightSidebar}
                  isLeftSidebarOpen={isLeftSidebarOpen}
                  onToggleLeftSidebar={handleToggleLeftSidebar}
                />
                {selectedSnippet &&
                  activeTabId !== GRAPH_TAB_ID &&
                  snippets.some((s) => s.id === selectedSnippet.id) && (
                    <Breadcrumbs snippet={selectedSnippet} />
                  )}
              </>
            )}

            {openTabs.filter((id) => id === GRAPH_TAB_ID || snippets.some((s) => s.id === id)).length >
            0 ? (
              <div
                className="workspace-container"
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flex: 1,
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}
                >
                  {renderedEditors}
                </div>
              </div>
            ) : (
              <GlobalErrorHandler>
                <Welcome
                  onNew={handleNew}
                  onOpenGuide={() => setShowGuideModal(true)}
                  onOpenDocs={handleOpenDocs}
                  onLoadStarterWorkspace={handleLoadStarterWorkspace}
                  onToggleAIChat={handleToggleAIChat}
                />
              </GlobalErrorHandler>
            )}
          </div>
        </main>

        <div
          className={`sidebar-resizer right ${isRightSidebarOpen ? 'open' : 'closed'}`}
          title="Double-click to reset default width (300px)"
          onMouseDown={(e) => handleStartResize('right', e)}
          onDoubleClick={(e) => {
            if (!isRightSidebarOpen) return
            e.preventDefault()
            e.stopPropagation()
            handleResetSidebar('right')
          }}
        >
          <div className="resizer-knob">
            <span className="knob-dot" />
            <span className="knob-dot" />
            <span className="knob-dot" />
          </div>
        </div>
        <aside className="shell-sidebar-right">
          <GlobalErrorHandler>
            <RightSidebar
              rightSidebarTab={rightSidebarTab}
              setRightSidebarTab={setRightSidebarTab}
              setSettingsInitialTab={setSettingsInitialTab}
              setShowSettings={setShowSettings}
              setSavedRightSidebarState={setSavedRightSidebarState}
              isRightSidebarOpen={isRightSidebarOpen}
              rightWidth={rightWidth}
              setIsRightSidebarOpen={handleCloseRightSidebar}
              setShowAIChatModal={setShowAIChatModal}
              selectedSnippet={selectedSnippet}
              isLoading={isLoading}
            />
          </GlobalErrorHandler>
        </aside>
      </div>

      <StatusBar
        onToggleInspector={handleToggleInspector}
        onToggleExplorerModal={handleToggleExplorerModal}
        onSettingsClick={handleOpenSettings}
        onThemeClick={handleOpenTheme}
        onGraphClick={handleToggleGraph}
        onDocsClick={handleOpenDocs}
        onShortcutsClick={() => {
          setSettingsInitialTab('shortcuts')
          setShowSettings(true)
        }}
      />

      <AppModals
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        settingsInitialTab={settingsInitialTab}
        setSettingsInitialTab={setSettingsInitialTab}
        showThemeModal={showThemeModal}
        setShowThemeModal={setShowThemeModal}
        showAIChatModal={showAIChatModal}
        setShowAIChatModal={setShowAIChatModal}
        setSavedRightSidebarState={setSavedRightSidebarState}
        setRightSidebarTab={setRightSidebarTab}
        updateRightSidebarOpen={updateRightSidebarOpen}
        showPalette={showPalette}
        setShowPalette={setShowPalette}
        paletteInitialQuery={paletteInitialQuery}
        snippets={snippets}
        selectedSnippet={selectedSnippet}
        setSelectedSnippet={setSelectedSnippet}
        setActiveTab={setActiveTab}
        handleNew={handleNew}
        renameModal={renameModal}
        setRenameModal={setRenameModal}
        showGraph={showGraph}
        setShowGraph={setShowGraph}
        showDocsModal={showDocsModal}
        setShowDocsModal={setShowDocsModal}
        showGuideModal={showGuideModal}
        setShowGuideModal={setShowGuideModal}
        handleLoadStarterWorkspace={handleLoadStarterWorkspace}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        snippetToDelete={snippetToDelete}
        handleConfirmDelete={handleConfirmDelete}
        saveSnippet={saveSnippet}
        loadVault={loadVault}
        showToast={showToast}
        showActiveIconPicker={showActiveIconPicker}
        setShowActiveIconPicker={setShowActiveIconPicker}
        activeTabId={activeTabId}
        toast={toast}
        clearToast={clearToast}
      />
    </div>
  )
}

export default MainLayout
