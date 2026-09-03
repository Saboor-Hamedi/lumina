import React, { useState, useEffect, useCallback } from 'react'
import Editor from '../Editor/Editor'
import Settings from '../Settings/Settings'
import Sidebar from '../Navigation/Sidebar'
import ThemeModal from '../Theme/ThemeModal'
import CommandPalette from '../Overlays/CommandPalette'
import Graph from '../Graph/Graph'
import Documentation from '../Docs/Documentation'
import Dashboard from '../Workspace/components/Dashboard'
import TabBar from '../Workspace/components/TabBar'
import { ImageViewerTab } from '../media'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useVaultStore, GRAPH_TAB_ID } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { useToast } from '../../core/hooks/useToast'
import ToastNotification from '../../core/notification'
import ConfirmModal from '../Overlays/Modals/ConfirmModal'
import RenameModal from '../Overlays/Modals/RenameModal'
import IconPicker from '../Icons/IconPicker'
import { handleRenameSnippet } from '../../core/hooks/handleRenameSnippet'
import ErrorBoundary from '../../components/ErrorBoundary'
import './AppShell.css'
import '../Overlays/Modals/ConfirmModal.css'
import '../Overlays/Modals/RenameModal.css'

import LuminaChat from '../AI/LuminaChat'
import { useAIStore } from '../AI/tools/LuminaChat'
import { useTypingSound } from '../../core/hooks/useTypingSound'
import { useShallow } from 'zustand/react/shallow'
import { X, Maximize2, Trash2, History, Bot, Info, MessageSquare } from 'lucide-react'

import RightSidebar from '../Inspector/RightSidebar'
import Breadcrumbs from '../Breadcrumbs'
import IndexingStatus from '../../components/IndexingStatus'
import StatusBar from '../Workspace/components/StatusBar'
import { useExternalFileDrop } from '../Explorer/hooks/useExternalFileDrop'
import ExternalDropOverlay from '../Explorer/components/ExternalDropOverlay'

/**
 * AppShell Component
 * Main application shell that manages the overall layout, sidebars, modals, and state.
 * Handles three-pane layout (left sidebar, main content, right sidebar), keyboard shortcuts,
 * sidebar resizing, and modal management.
 *
 * @returns {JSX.Element} The main application shell component
 */
const AppShell = () => {
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
  const sidebarSetting = useSettingsStore((state) => state.settings?.sidebar)
  const rightSidebarSetting = useSettingsStore((state) => state.settings?.rightSidebar)

  useEffect(() => {
    const handleGlobalToast = (e) => {
      const { message, type = 'info', duration = 3000 } = e.detail || {}
      if (message) {
        showToast(message, type, duration)
      }
    }
    window.addEventListener('show-toast', handleGlobalToast)
    return () => window.removeEventListener('show-toast', handleGlobalToast)
  }, [showToast])

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
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showAIChatModal, setShowAIChatModal] = useState(() => {
    return useSettingsStore.getState().settings?.aiChatModalState?.isOpen || false
  })
  const [showExplorerModal, setShowExplorerModal] = useState(false)
  const [showActiveIconPicker, setShowActiveIconPicker] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false)
  const [rightSidebarTab, setRightSidebarTab] = useState('details')
  const [renameModal, setRenameModal] = useState({ isOpen: false, item: null, newName: '' })
  /**
   * Stores the right sidebar state (open/closed and width) when AI chat modal is opened.
   * Used to restore the sidebar to its previous state when the modal is closed.
   * @type {Object|null} { isOpen: boolean, width: number } | null
   */
  const [savedRightSidebarState, setSavedRightSidebarState] = useState(null)
  const [leftWidth, setLeftWidth] = useState(250)
  const [rightWidth, setRightWidth] = useState(200)
  const [resizingSide, setResizingSide] = useState(null)
  const [isRestoring, setIsRestoring] = useState(true)

  const appShellRef = React.useRef(null)
  const widthRef = React.useRef({ left: 250, right: 200 })

  const {
    isDraggingExternal: isWorkspaceDraggingExternal,
    handleDragEnter: handleWorkspaceDragEnter,
    handleDragOver: handleWorkspaceDragOver,
    handleDragLeave: handleWorkspaceDragLeave,
    handleDrop: handleWorkspaceDrop
  } = useExternalFileDrop()

  // Update width refs and CSS custom properties when widths change
  useEffect(() => {
    widthRef.current.left = leftWidth
    if (appShellRef.current) {
      appShellRef.current.style.setProperty('--left-sidebar-width', `${leftWidth}px`)
    }
    document.documentElement.style.setProperty('--left-sidebar-width', `${leftWidth}px`)
  }, [leftWidth])

  useEffect(() => {
    widthRef.current.right = rightWidth
    if (appShellRef.current) {
      appShellRef.current.style.setProperty('--right-sidebar-width', `${rightWidth}px`)
    }
    document.documentElement.style.setProperty('--right-sidebar-width', `${rightWidth}px`)
  }, [rightWidth])

  /**
   * Persist left sidebar open/closed state to sidebar settings.
   */
  useEffect(() => {
    if (isRestoring) return
    const currentSidebar = sidebarSetting || {}
    useSettingsStore.getState().updateSettings({
      sidebar: {
        ...currentSidebar,
        isLeftOpen: isLeftSidebarOpen
      }
    })
  }, [isLeftSidebarOpen, isRestoring])

  /**
   * Persist right sidebar open/closed state to rightSidebar settings.
   */
  useEffect(() => {
    if (isRestoring) return
    const currentRSidebar = rightSidebarSetting || {}
    useSettingsStore.getState().updateSettings({
      rightSidebar: {
        ...currentRSidebar,
        isRightOpen: isRightSidebarOpen
      }
    })
  }, [isRightSidebarOpen, isRestoring])

  // Deletion State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [snippetToDelete, setSnippetToDelete] = useState(null)

  // Super Lightweight Zero-Lag Sidebar Resizing Engine (VS Code Speed)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingSide) return

      const shellEl = appShellRef.current
      const rect = shellEl ? shellEl.getBoundingClientRect() : { left: 0, right: window.innerWidth }

      if (resizingSide === 'left') {
        let newWidth = e.clientX - rect.left
        if (newWidth < 180) newWidth = 180
        if (newWidth > 600) newWidth = 600
        widthRef.current.left = newWidth
        if (shellEl) shellEl.style.setProperty('--left-sidebar-width', `${newWidth}px`)
        document.documentElement.style.setProperty('--left-sidebar-width', `${newWidth}px`)
      } else if (resizingSide === 'right') {
        let newWidth = rect.right - e.clientX
        if (newWidth < 220) newWidth = 220
        if (newWidth > 750) newWidth = 750
        widthRef.current.right = newWidth
        if (shellEl) shellEl.style.setProperty('--right-sidebar-width', `${newWidth}px`)
        document.documentElement.style.setProperty('--right-sidebar-width', `${newWidth}px`)
      }
    }

    const handleMouseUp = () => {
      document.body.classList.remove('is-global-resizing')

      if (resizingSide === 'left') {
        const finalWidth = widthRef.current.left
        setLeftWidth(finalWidth)
        const currentSidebar = sidebarSetting || {}
        useSettingsStore.getState().updateSettings({
          sidebar: {
            ...currentSidebar,
            width: finalWidth
          }
        })
      } else if (resizingSide === 'right') {
        const finalWidth = widthRef.current.right
        setRightWidth(finalWidth)
        const currentRSidebar = rightSidebarSetting || {}
        useSettingsStore.getState().updateSettings({
          rightSidebar: {
            ...currentRSidebar,
            width: finalWidth
          }
        })
      }
      setResizingSide(null)
    }

    if (resizingSide) {
      document.body.classList.add('is-global-resizing')
      window.addEventListener('mousemove', handleMouseMove, { passive: true })
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.body.classList.remove('is-global-resizing')
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingSide, sidebarSetting, rightSidebarSetting])

  const handleResetSidebar = (side) => {
    if (side === 'left') {
      const defaultLeft = 280
      widthRef.current.left = defaultLeft
      setLeftWidth(defaultLeft)
      if (appShellRef.current) appShellRef.current.style.setProperty('--left-sidebar-width', `${defaultLeft}px`)
      document.documentElement.style.setProperty('--left-sidebar-width', `${defaultLeft}px`)
      useSettingsStore.getState().updateSettings({
        sidebar: { ...(sidebarSetting || {}), width: defaultLeft }
      })
    } else {
      const defaultRight = 320
      widthRef.current.right = defaultRight
      setRightWidth(defaultRight)
      if (appShellRef.current) appShellRef.current.style.setProperty('--right-sidebar-width', `${defaultRight}px`)
      document.documentElement.style.setProperty('--right-sidebar-width', `${defaultRight}px`)
      useSettingsStore.getState().updateSettings({
        rightSidebar: { ...(rightSidebarSetting || {}), width: defaultRight }
      })
    }
  }

  // Initialize vault & settings on mount
  // Initialize vault & settings on mount
  /**
   * Initialize application on mount.
   * Restores saved settings, vault state, tabs, and sidebar configurations.
   */
  useEffect(() => {
    /**
     * Initializes the application state from persisted settings.
     * @returns {Promise<void>}
     */
    const initApp = async () => {
      await useSettingsStore.getState().init()
      await loadVault()

      // Directly fetch from backend to avoid any race conditions with store initialization
      let actualSettings = useSettingsStore.getState().settings
      try {
        const backendSettings = await window.api.getSetting()
        if (backendSettings) {
          actualSettings = { ...actualSettings, ...backendSettings }
        }
      } catch (err) {
        console.error('Failed to fetch backend settings during init:', err)
      }

      if (actualSettings.openTabs && Array.isArray(actualSettings.openTabs)) {
        useVaultStore
          .getState()
          .restoreSession(
            actualSettings.openTabs,
            actualSettings.lastSnippetId,
            actualSettings.pinnedTabIds || []
          )
      } else if (actualSettings.lastSnippetId) {
        const allSnippets = useVaultStore.getState().snippets
        const last = allSnippets.find((s) => s.id === actualSettings.lastSnippetId)
        if (last) setSelectedSnippet(last)
      }
      // Default to chat mode (metadata moved to modal)
      if (!actualSettings.rightPanelMode || actualSettings.rightPanelMode === 'metadata') {
        useSettingsStore.getState().updateSetting('rightPanelMode', 'chat')
      }
      // Restore Widths & Toggles from split 'sidebar' and 'rightSidebar' objects
      // Order of precedence: new split objects > legacy migration objects > top-level keys

      // LEFT SIDEBAR
      const legacySidebar = actualSettings.sidebar || {}
      if (typeof legacySidebar.isLeftOpen === 'boolean')
        setIsLeftSidebarOpen(legacySidebar.isLeftOpen)
      else if (typeof actualSettings.isLeftSidebarOpen === 'boolean')
        setIsLeftSidebarOpen(actualSettings.isLeftSidebarOpen)

      const rawLeftWidth =
        legacySidebar.width || legacySidebar.leftWidth || actualSettings.leftWidth
      if (rawLeftWidth) {
        const clampedLeft = Math.min(500, Math.max(150, Number(rawLeftWidth)))
        setLeftWidth(clampedLeft)
      }

      // RIGHT SIDEBAR
      const legacyRSidebar = actualSettings.rightSidebar || {}
      if (typeof legacyRSidebar.isRightOpen === 'boolean')
        setIsRightSidebarOpen(legacyRSidebar.isRightOpen)
      else if (typeof actualSettings.isRightSidebarOpen === 'boolean')
        setIsRightSidebarOpen(actualSettings.isRightSidebarOpen)

      const rawRightWidth =
        legacyRSidebar.width || legacyRSidebar.rightWidth || actualSettings.rightWidth
      if (rawRightWidth) {
        const clampedRight = Math.min(500, Math.max(160, Number(rawRightWidth)))
        setRightWidth(clampedRight)
      }

      // Removed restoring activeTab

      setIsRestoring(false)
    }

    initApp()

    // Start listening for updates
    const unsub = useUpdateStore.getState().init()

    // Listen for details modal open event from EditorTitleBar
    // Listen for details modal open event from EditorTitleBar
    const handleOpenDetailsModal = () => {
      setRightSidebarTab('details')
      setIsRightSidebarOpen(true)
    }
    window.addEventListener('open-details-modal', handleOpenDetailsModal)

    // Listen for AI settings shortcut from Composer
    const handleOpenAISettings = () => {
      setSettingsInitialTab('ai')
      setShowSettings(true)
    }
    window.addEventListener('open-ai-settings', handleOpenAISettings)

    // Listen for Global Shortcut from Main Process
    let cleanupGlobalShortcut = null
    if (window.api?.onToggleCommandPalette) {
      cleanupGlobalShortcut = window.api.onToggleCommandPalette(() => {
        setShowPalette((prev) => !prev)
      })
    }

    return () => {
      unsub && unsub()
      window.removeEventListener('open-details-modal', handleOpenDetailsModal)
      window.removeEventListener('open-ai-settings', handleOpenAISettings)
      if (cleanupGlobalShortcut) cleanupGlobalShortcut()
    }
  }, [])

  // Listen for external vault updates
  useEffect(() => {
    if (window.api?.onVaultUpdated) {
      const cleanup = window.api.onVaultUpdated(() => {
        loadVault()
      })
      return cleanup
    }
  }, [loadVault])

  // Reactive Sidebar Toggles - Sync local state with store changes
  useEffect(() => {
    const sidebar = sidebarSetting || {}
    const rSidebar = rightSidebarSetting || {}

    // Left
    if (typeof sidebar.isLeftOpen === 'boolean' && sidebar.isLeftOpen !== isLeftSidebarOpen) {
      setIsLeftSidebarOpen(sidebar.isLeftOpen)
    }
    // Right
    if (typeof rSidebar.isRightOpen === 'boolean' && rSidebar.isRightOpen !== isRightSidebarOpen) {
      setIsRightSidebarOpen(rSidebar.isRightOpen)
    }
  }, [sidebarSetting, rightSidebarSetting])

  const pinnedTabIds = useVaultStore((state) => state.pinnedTabIds)

  // Ctrl+Shift+\ - Open AI Chat Modal and focus Composer textarea
  useEffect(() => {
    const handleAIChatShortcut = (e) => {
      const key = e.key && e.key.toLowerCase()
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (key === '\\' || key === '|' || e.code === 'Backslash')
      ) {
        e.preventDefault()
        setShowAIChatModal(true)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('focus-ai-composer'))
        }, 50)
      }
    }
    window.addEventListener('keydown', handleAIChatShortcut)
    return () => window.removeEventListener('keydown', handleAIChatShortcut)
  }, [])

  // Ctrl+R - rename selected folder or note
  useEffect(() => {
    const handleRenameShortcut = (e) => {
      const key = e.key && e.key.toLowerCase()
      // Make sure we only catch standard Ctrl+R without shift/alt to allow other shortcuts
      if ((e.ctrlKey || e.metaKey) && key === 'r' && !e.shiftKey && !e.altKey) {
        e.preventDefault() // prevent browser reload
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

  // Close sidebar automatically only when crossing the 700px threshold downwards
  useEffect(() => {
    let wasLarge = window.innerWidth > 700
    const handleResize = () => {
      const isLarge = window.innerWidth > 700
      // If we just shrank from large to small, close the sidebar
      if (wasLarge && !isLarge) {
        setIsLeftSidebarOpen(false)
      }
      wasLarge = isLarge
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Trigger AI Indexing when snippets change (Background)
  // Note: Vault indexing is handled automatically by main process on vault selection/save
  // This effect is disabled to prevent passing invalid vaultPath
  // useEffect(() => {
  //   if (snippets.length > 0) {
  //     // Vault indexing is handled by main process automatically
  //     // Don't call indexVault here as it requires a valid vaultPath string
  //   }
  // }, [snippets])

  // Close Inspector when switching to Graph
  useEffect(() => {
    if (activeTab === 'graph') {
      setIsRightSidebarOpen(false)
    }
  }, [activeTab])

  const handleToggleInspector = useCallback(() => {
    setIsRightSidebarOpen((prev) => !prev)
  }, [])

  useKeyboardShortcuts({
    onGlobalSearch: () => {
      setActiveTab('search')
      setIsLeftSidebarOpen(true)
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
        // file.content can be an empty string, so check typeof
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
        setIsRightSidebarOpen(false)
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
    onToggleSidebar: () => setIsLeftSidebarOpen((prev) => !prev),
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
        console.error('[AppShell] Close window API not available')
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

  /**
   * Creates a new note snippet and selects it.
   * @returns {Promise<void>}
   */
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
      console.error('[AppShell] Failed to create new note:', error)
      showToast('Failed to create note. Please try again.', 'error')
    }
  }

  /**
   * Confirms and executes the deletion of a snippet.
   * @returns {Promise<void>}
   */
  const handleConfirmDelete = async () => {
    if (snippetToDelete) {
      try {
        await useVaultStore.getState().deleteSnippet(snippetToDelete.id, true)
        setSnippetToDelete(null)
      } catch (error) {
        console.error('[AppShell] Failed to delete snippet:', error)
        showToast('Failed to delete note. Please try again.', 'error')
      }
    }
  }

  const handleOpenSettings = useCallback(() => setShowSettings(true), [])
  const handleOpenTheme = useCallback(() => setShowThemeModal(true), [])
  const handleToggleGraph = useCallback(() => setShowGraph(true), [])
  const handleToggleAIChat = useCallback(() => {
    const currentMode = useSettingsStore.getState().settings.aiChatDisplayMode || 'sidebar'
    if (currentMode === 'modal') {
      setShowAIChatModal((prev) => !prev)
    } else {
      // Sidebar mode: toggle right sidebar with chat tab
      if (isRightSidebarOpen && rightSidebarTab === 'chat') {
        setIsRightSidebarOpen(false)
      } else {
        setRightSidebarTab('chat')
        setIsRightSidebarOpen(true)
      }
    }
  }, [isRightSidebarOpen, rightSidebarTab])

  useEffect(() => {
    const handleAskAnything = (e) => {
      const query = e.detail?.query || ''
      setPaletteInitialQuery(query)
      setShowPalette(true)
    }
    window.addEventListener('open-ask-anything', handleAskAnything)
    window.addEventListener('open-ai-chat', handleToggleAIChat)
    return () => {
      window.removeEventListener('open-ask-anything', handleAskAnything)
      window.removeEventListener('open-ai-chat', handleToggleAIChat)
    }
  }, [])

  return (
    <div
      ref={appShellRef}
      className={`app-shell ${isLeftSidebarOpen ? 'left-open' : 'left-closed'} ${isRightSidebarOpen ? 'right-open' : 'right-closed'} ${resizingSide ? 'is-resizing' : ''}`}
      style={{
        opacity: isRestoring ? 0 : 1,
        transition: 'opacity 0.2s ease-in-out',
        '--left-sidebar-width': `${leftWidth}px`,
        '--right-sidebar-width': `${rightWidth}px`
      }}
    >
      <aside className="shell-sidebar-left">
        {isLeftSidebarOpen && (
          <div
            className="sidebar-resizer left"
            title="Double-click to reset default width (280px)"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setResizingSide('left')
            }}
            onDoubleClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleResetSidebar('left')
            }}
          />
        )}
        <Sidebar
          onSettingsClick={handleOpenSettings}
          onThemeClick={handleOpenTheme}
          onToggleGraph={handleToggleGraph}
          onToggleAIChat={handleToggleAIChat}
          onDocsClick={() => setShowDocsModal(true)}
        />
      </aside>
      <main className="shell-main">
        {/* Show TabBar even if no tabs are open so WindowControls remain visible */}
        {(activeTab === 'files' || activeTab === 'search') && (
          <>
            <TabBar
              isSidebarOpen={isRightSidebarOpen}
              onToggleSidebar={() => setIsRightSidebarOpen((prev) => !prev)}
              isLeftSidebarOpen={isLeftSidebarOpen}
              onToggleLeftSidebar={() => setIsLeftSidebarOpen((prev) => !prev)}
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
            onDragEnter={(e) => handleWorkspaceDragEnter(e, '')}
            onDragOver={(e) => handleWorkspaceDragOver(e, '')}
            onDragLeave={handleWorkspaceDragLeave}
            onDrop={(e) => handleWorkspaceDrop(e, '')}
            style={{
              display: 'flex',
              flexDirection: 'row',
              flex: 1,
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {isWorkspaceDraggingExternal && <ExternalDropOverlay targetName="Vault" />}
            <div
              style={{
                position: 'relative',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {openTabs.map((tabId) => {
                let snippet = snippets.find((s) => s.id === tabId)
                if (!snippet) return null
                const effectiveSelectedId = selectedSnippet?.id || activeTabId || openTabs[0]
                const isSelected = effectiveSelectedId === tabId

                return (
                  <div
                    key={tabId}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      opacity: isSelected ? 1 : 0,
                      pointerEvents: isSelected ? 'auto' : 'none',
                      visibility: isSelected ? 'visible' : 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      zIndex: isSelected ? 10 : 1
                    }}
                  >
                    <ErrorBoundary>
                      {snippet.type === 'image' ? (
                        <ImageViewerTab snippet={snippet} />
                      ) : (
                        <Editor
                          snippet={snippet}
                          onSave={saveSnippet}
                          onToggleInspector={handleToggleInspector}
                          isActive={isSelected}
                          onToggleExplorerModal={() => setShowExplorerModal((prev) => !prev)}
                          onSettingsClick={() => setShowSettings(true)}
                          onThemeClick={() => setShowThemeModal(true)}
                          onGraphClick={() => setShowGraph(true)}
                        />
                      )}
                    </ErrorBoundary>
                  </div>
                )
              })}
            </div>
          </div>
        ) : isRestoring ? (
          <div className="shell-main-placeholder" />
        ) : (
          <ErrorBoundary>
            <Dashboard
              onNew={handleNew}
              onToggleExplorerModal={() => setShowExplorerModal((prev) => !prev)}
              onSettingsClick={() => setShowSettings(true)}
              onThemeClick={() => setShowThemeModal(true)}
              onGraphClick={() => setShowGraph(true)}
            />
          </ErrorBoundary>
        )}

        {/* Inspector overlay — floats over shell-main from the right */}
        <aside className="shell-sidebar-right">
          {isRightSidebarOpen && (
            <div
              className="sidebar-resizer right"
              title="Double-click to reset default width (320px)"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setResizingSide('right')
              }}
              onDoubleClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleResetSidebar('right')
              }}
            />
          )}
          <RightSidebar
            rightSidebarTab={rightSidebarTab}
            setRightSidebarTab={setRightSidebarTab}
            setSettingsInitialTab={setSettingsInitialTab}
            setShowSettings={setShowSettings}
            setSavedRightSidebarState={setSavedRightSidebarState}
            isRightSidebarOpen={isRightSidebarOpen}
            rightWidth={rightWidth}
            setIsRightSidebarOpen={setIsRightSidebarOpen}
            setShowAIChatModal={setShowAIChatModal}
            selectedSnippet={selectedSnippet}
            isLoading={isLoading}
          />
        </aside>
        <StatusBar
          onToggleInspector={handleToggleInspector}
          onToggleExplorerModal={() => setShowExplorerModal((prev) => !prev)}
          onSettingsClick={() => setShowSettings(true)}
          onThemeClick={() => setShowThemeModal(true)}
          onGraphClick={() => setShowGraph(true)}
          onDocsClick={() => setShowDocsModal(true)}
          onShortcutsClick={() => {
            setSettingsInitialTab('shortcuts')
            setShowSettings(true)
          }}
        />
      </main>

      {showSettings && (
        <Settings
          onClose={() => {
            setShowSettings(false)
            setSettingsInitialTab('look-and-feel') // Reset to default
          }}
          onOpenTheme={() => {
            setShowSettings(false)
            setShowThemeModal(true)
          }}
          initialTab={settingsInitialTab}
        />
      )}
      {showThemeModal && (
        <ThemeModal isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} />
      )}
      <LuminaChat
        isOpen={showAIChatModal}
        onClose={() => {
          setShowAIChatModal(false)
          setSavedRightSidebarState(null)
        }}
        onDock={() => {
          setShowAIChatModal(false)
          useSettingsStore.getState().updateSetting('aiChatDisplayMode', 'sidebar')
          setRightSidebarTab('chat')
          setIsRightSidebarOpen(true)
        }}
        onUnfloat={() => {
          setShowAIChatModal(false)
          useSettingsStore.getState().updateSetting('aiChatDisplayMode', 'sidebar')
          setRightSidebarTab('chat')
          setIsRightSidebarOpen(true)
        }}
      />
      <CommandPalette
        isOpen={showPalette}
        initialQuery={paletteInitialQuery}
        onClose={() => setShowPalette(false)}
        items={snippets}
        onSelect={(snippet) => {
          setSelectedSnippet(snippet)
          setActiveTab('files')
        }}
        onNew={handleNew}
        onToggleSettings={(tab) => {
          setSettingsInitialTab(tab || 'look-and-feel')
          setShowSettings(true)
        }}
        onToggleGraph={() => setShowGraph(true)}
        onToggleChat={() => setShowAIChatModal(true)}
        onToggleDocs={() => setShowDocsModal(true)}
        onRename={() => {
          if (selectedSnippet) {
            setRenameModal({ isOpen: true, item: selectedSnippet, newName: selectedSnippet.title })
          }
        }}
      />
      {/* Graph Modal */}
      {showGraph && (
        <Graph
          isOpen={showGraph}
          onClose={() => setShowGraph(false)}
          onNavigate={(snippet) => {
            setSelectedSnippet(snippet)
            setActiveTab('files')
            setShowGraph(false)
          }}
        />
      )}
      {showDocsModal && (
        <Documentation isOpen={showDocsModal} onClose={() => setShowDocsModal(false)} />
      )}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Note?"
        message={`Are you sure you want to delete "${snippetToDelete?.title || 'this note'}"? This cannot be undone.`}
      />
      <RenameModal
        isOpen={renameModal.isOpen}
        initialName={renameModal.newName}
        itemType={renameModal.item?.type === 'folder' ? 'folder' : 'note'}
        onClose={() => setRenameModal({ isOpen: false, item: null, newName: '' })}
        onRename={async (newName) => {
          if (renameModal.item?.type === 'folder') {
            const folderId = renameModal.item.id
            const parentPath = folderId.includes('/')
              ? folderId.substring(0, folderId.lastIndexOf('/'))
              : ''
            const newFolderPath = parentPath ? `${parentPath}/${newName}` : newName
            if (newFolderPath !== folderId) {
              try {
                await window.api.renameFolder(folderId, newFolderPath)
                useVaultStore.getState().setSelectedFolder(newFolderPath)
                await loadVault()
                showToast('✓ Folder renamed successfully', 'success')
              } catch (err) {
                console.error('Failed to rename folder:', err)
                showToast('❌ Failed to rename folder', 'error')
              }
            }
            setRenameModal({ isOpen: false, item: null, newName: '' })
          } else {
            handleRenameSnippet({
              renameModal: { ...renameModal, newName },
              saveSnippet,
              setSelectedSnippet,
              setRenameModal,
              setIsCreatingSnippet: () => {},
              showToast
            })
          }
        }}
      />
      {showActiveIconPicker && (
        <IconPicker
          isOpen={showActiveIconPicker}
          onClose={() => setShowActiveIconPicker(false)}
          currentIcon={(selectedSnippet || snippets.find((s) => s.id === activeTabId))?.customIcon}
          onSelect={(iconName) => {
            const active = selectedSnippet || snippets.find((s) => s.id === activeTabId)
            if (active) {
              saveSnippet({ ...active, customIcon: iconName })
            }
          }}
        />
      )}
      <ToastNotification toast={toast} onClose={clearToast} />
      <IndexingStatus />
    </div>
  )
}

export default AppShell
