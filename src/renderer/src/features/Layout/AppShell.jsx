import React, { useState, useEffect, useCallback } from 'react'
import MarkdownEditor from '../Editor/MarkdownEditor'
import SettingsModal from '../Settings/SettingsModal'
import ActivityBar from '../Navigation/ActivityBar'
import ThemeModal from '../Theme/ThemeModal'
import CommandPalette from '../Overlays/CommandPalette'
import Graph from '../Graph/Graph'
import Dashboard from '../Workspace/components/Dashboard'
import TabBar from '../Workspace/components/TabBar'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { useToast } from '../../core/hooks/useToast'
import ToastNotification from '../../core/notification'
import ConfirmModal from '../Overlays/ConfirmModal'
import UpdateToast from '../Overlays/UpdateToast'
import ErrorBoundary from '../../components/ErrorBoundary'
import './AppShell.css'
import '../Overlays/ConfirmModal.css'
import AIChatPanel from '../AI/AIChatPanel'

import AIChatModal from '../Overlays/AIChatModal'
import FileExplorer from '../Explorer/FileExplorer'
import SnippetDetails from '../Inspector/SnippetDetails'
import { useAIStore } from '../../core/store/useAIStore'
import { useTypingSound } from '../../core/hooks/useTypingSound'
import { X, Maximize2, Trash2, History, Bot, Info } from 'lucide-react'

import PanelHeaderDropdown from './components/PanelHeaderDropdown'
import IndexingStatus from '../../components/IndexingStatus'

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
  } = useVaultStore()
  const { toast, showToast, clearToast } = useToast()
  const { chatMessages, clearChat } = useAIStore()
  const settings = useSettingsStore((state) => state.settings)

  // Initialize typing sound hook globally
  useTypingSound()
  const [settingsInitialTab, setSettingsInitialTab] = useState('general')

  // Always default to 'files' instead of restoring from settings
  const [activeTab, setActiveTab] = useState('files')
  const [showSettings, setShowSettings] = useState(false)
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showAIChatModal, setShowAIChatModal] = useState(false)
  const [showExplorerModal, setShowExplorerModal] = useState(false)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false)
  const [rightSidebarTab, setRightSidebarTab] = useState('ai') // 'ai' or 'details'
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

  const widthRef = React.useRef({ left: 250, right: 200 })

  // Update width refs when widths change
  useEffect(() => {
    widthRef.current.left = leftWidth
  }, [leftWidth])
  useEffect(() => {
    widthRef.current.right = rightWidth
  }, [rightWidth])

  /**
   * Persist left sidebar open/closed state to sidebar settings.
   */
  useEffect(() => {
    if (isRestoring) return
    const currentSidebar = settings.sidebar || {}
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
    const currentRSidebar = settings.rightSidebar || {}
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

  // Sidebar Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingSide) return

      if (resizingSide === 'left') {
        let newWidth = e.clientX - 60 // Compensate for Ribbon
        if (newWidth < 180) newWidth = 180
        if (newWidth > 500) newWidth = 500
        setLeftWidth(newWidth)
      } else {
        // Right Resizer
        let newWidth = window.innerWidth - e.clientX
        if (newWidth < 180) newWidth = 180
        if (newWidth > 300) newWidth = 300
        setRightWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      // Persist new widths
      if (resizingSide) {
        if (resizingSide === 'left') {
          const currentSidebar = settings.sidebar || {}
          useSettingsStore.getState().updateSettings({
            sidebar: {
              ...currentSidebar,
              width: widthRef.current.left
            }
          })
        } else {
          const currentRSidebar = settings.rightSidebar || {}
          useSettingsStore.getState().updateSettings({
            rightSidebar: {
              ...currentRSidebar,
              width: widthRef.current.right
            }
          })
        }
      }
      setResizingSide(null)
    }

    if (resizingSide) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingSide]) // Only re-run when resizing starts/stops

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

      if (legacySidebar.width) setLeftWidth(legacySidebar.width)
      else if (legacySidebar.leftWidth) setLeftWidth(legacySidebar.leftWidth)
      else if (actualSettings.leftWidth) setLeftWidth(actualSettings.leftWidth)

      // RIGHT SIDEBAR
      const legacyRSidebar = actualSettings.rightSidebar || {}
      if (typeof legacyRSidebar.isRightOpen === 'boolean')
        setIsRightSidebarOpen(legacyRSidebar.isRightOpen)
      else if (typeof actualSettings.isRightSidebarOpen === 'boolean')
        setIsRightSidebarOpen(actualSettings.isRightSidebarOpen)

      if (legacyRSidebar.width) setRightWidth(legacyRSidebar.width)
      else if (legacyRSidebar.rightWidth) setRightWidth(legacyRSidebar.rightWidth)
      else if (actualSettings.rightWidth) setRightWidth(actualSettings.rightWidth)

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

    return () => {
      unsub && unsub()
      window.removeEventListener('open-details-modal', handleOpenDetailsModal)
      window.removeEventListener('open-ai-settings', handleOpenAISettings)
    }
  }, [])

  // Reactive Sidebar Toggles - Sync local state with store changes
  useEffect(() => {
    const sidebar = settings.sidebar || {}
    const rSidebar = settings.rightSidebar || {}

    // Left
    if (typeof sidebar.isLeftOpen === 'boolean' && sidebar.isLeftOpen !== isLeftSidebarOpen) {
      setIsLeftSidebarOpen(sidebar.isLeftOpen)
    }
    // Right
    if (typeof rSidebar.isRightOpen === 'boolean' && rSidebar.isRightOpen !== isRightSidebarOpen) {
      setIsRightSidebarOpen(rSidebar.isRightOpen)
    }
  }, [settings.sidebar, settings.rightSidebar])

  const pinnedTabIds = useVaultStore((state) => state.pinnedTabIds)

  // Ctrl+Shift+F - open global search sidebar and focus input
  useEffect(() => {
    const handleGlobalSearchShortcut = (e) => {
      const key = e.key && e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'f') {
        e.preventDefault()
        setActiveTab('search')
        setIsLeftSidebarOpen(true)
        // Focus search input after sidebar opens
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('global-search-focus'))
        }, 100)
      }
    }
    window.addEventListener('keydown', handleGlobalSearchShortcut)
    return () => window.removeEventListener('keydown', handleGlobalSearchShortcut)
  }, [])

  // Ctrl+B - toggle Explorer Modal
  useEffect(() => {
    const handleExplorerShortcut = (e) => {
      const key = e.key && e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'b') {
        e.preventDefault()
        setShowExplorerModal((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleExplorerShortcut)
    return () => window.removeEventListener('keydown', handleExplorerShortcut)
  }, [])

  // Ctrl+Shift+B - toggle left sidebar visibility
  useEffect(() => {
    const handleSidebarToggleShortcut = (e) => {
      const key = e.key && e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'b') {
        e.preventDefault()
        setIsLeftSidebarOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleSidebarToggleShortcut)
    return () => window.removeEventListener('keydown', handleSidebarToggleShortcut)
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
    onEscape: () => {
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
      return false
    },
    onTogglePalette: () => setShowPalette(true),
    onToggleSettings: () => setShowSettings(true),
    onToggleGraph: () => setShowGraph(true),
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
      if (selectedSnippet) {
        useVaultStore.getState().closeTab(selectedSnippet.id)
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
      showToast('New note created', 'success')
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

  return (
    <div
      className={`app-shell ${isLeftSidebarOpen ? 'left-open' : 'left-closed'} ${isRightSidebarOpen ? 'right-open' : 'right-closed'} ${resizingSide ? 'is-resizing' : ''}`}
      style={{
        opacity: isRestoring ? 0 : 1,
        transition: 'opacity 0.2s ease-in-out',
        '--left-sidebar-width': `${leftWidth}px`,
        '--right-sidebar-width': `${rightWidth}px`
      }}
    >
      <main className="shell-main">
        {/* Show TabBar even if no tabs are open so WindowControls remain visible */}
        {(activeTab === 'files' || activeTab === 'search') && <TabBar />}

        {openTabs.length > 0 ? (
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
              const snippet = snippets.find((s) => s.id === tabId)
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
                    <MarkdownEditor
                      snippet={snippet}
                      onSave={saveSnippet}
                      onToggleInspector={handleToggleInspector}
                      isActive={isSelected}
                      onToggleExplorerModal={() => setShowExplorerModal((prev) => !prev)}
                      onSettingsClick={() => setShowSettings(true)}
                      onThemeClick={() => setShowThemeModal(true)}
                      onGraphClick={() => setShowGraph(true)}
                      onDailyNoteClick={handleNew}
                    />
                  </ErrorBoundary>
                </div>
              )
            })}
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
              onDailyNoteClick={handleNew}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Floating ActivityBar */}
      <ActivityBar
        onSettingsClick={() => setShowSettings(true)}
        onThemeClick={() => setShowThemeModal(true)}
        onToggleGraph={() => setShowGraph(true)}
        onToggleExplorerModal={() => setShowExplorerModal((prev) => !prev)}
      />

      <aside className="shell-sidebar-right">
        {isRightSidebarOpen && (
          <div className="sidebar-resizer right" onMouseDown={() => setResizingSide('right')} />
        )}
        {isRightSidebarOpen && (
          <div className="inspector-panel">
            {/* Tab-style header - matches workspace tabs */}
            <div
              className="panel-header-tabs workspace-tabbar"
              style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            >
              <div 
                className={`workspace-tab ${rightSidebarTab === 'ai' ? 'active' : ''}`}
                onClick={() => setRightSidebarTab('ai')}
                style={{ cursor: 'pointer', borderRight: '1px solid var(--border-subtle)', paddingRight: rightSidebarTab === 'ai' ? '12px' : '16px' }}
              >
                <div
                  className="tab-context"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Bot size={13} style={{ opacity: rightSidebarTab === 'ai' ? 1 : 0.6 }} />
                  <span className="tab-title" style={{ opacity: rightSidebarTab === 'ai' ? 1 : 0.6 }}>AI Chat</span>
                  {rightSidebarTab === 'ai' && (
                    <>
                      <button
                        className="tab-close-btn"
                        style={{ opacity: 0.6 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          window.dispatchEvent(new CustomEvent('ai-toggle-history'))
                        }}
                        title="Toggle chat history"
                      >
                        <History size={11} />
                      </button>
                      <button
                        className="tab-close-btn"
                        style={{ opacity: 0.6 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          try {
                            clearChat()
                            showToast('Chat cleared')
                          } catch {}
                        }}
                        title="Clear chat"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div 
                className={`workspace-tab ${rightSidebarTab === 'details' ? 'active' : ''}`}
                onClick={() => setRightSidebarTab('details')}
                style={{ cursor: 'pointer', paddingRight: '16px' }}
              >
                <div
                  className="tab-context"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Info size={13} style={{ opacity: rightSidebarTab === 'details' ? 1 : 0.6 }} />
                  <span className="tab-title" style={{ opacity: rightSidebarTab === 'details' ? 1 : 0.6 }}>Details</span>
                </div>
              </div>
              {/* Right side buttons - Float and Dropdown */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0',
                  marginLeft: 'auto',
                  height: '32px' /* Match panel header height */,
                  WebkitAppRegion: 'no-drag'
                }}
              >
                <button
                  className="tab-float-btn-right"
                  onClick={(e) => {
                    e.stopPropagation()
                    try {
                      // Save current sidebar state and close it before opening modal
                      setSavedRightSidebarState({
                        isOpen: isRightSidebarOpen,
                        width: rightWidth
                      })
                      setIsRightSidebarOpen(false)
                      setShowAIChatModal(true)
                    } catch (error) {
                      console.error('[AppShell] Failed to float AI chat:', error)
                    }
                  }}
                  title="Float (Open as modal)"
                  aria-label="Float"
                >
                  <Maximize2 size={12} />
                </button>
                <PanelHeaderDropdown
                  onOpenSettings={() => {
                    setSettingsInitialTab('ai')
                    setShowSettings(true)
                  }}
                  onClearChat={() => {
                    try {
                      clearChat()
                      showToast('Chat history cleared')
                    } catch (error) {
                      console.error('[AppShell] Failed to clear chat:', error)
                      showToast('Failed to clear chat history')
                    }
                  }}
                  onExportChat={() => {
                    try {
                      const chatData = {
                        messages: chatMessages,
                        exportedAt: new Date().toISOString(),
                        version: '1.0'
                      }
                      const blob = new Blob([JSON.stringify(chatData, null, 2)], {
                        type: 'application/json'
                      })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `lumina-chat-${new Date().toISOString().split('T')[0]}.json`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                      showToast('Chat exported successfully')
                    } catch (error) {
                      console.error('[AppShell] Failed to export chat:', error)
                      showToast('Failed to export chat')
                    }
                  }}
                  onViewStats={() => {
                    const stats = {
                      totalMessages: chatMessages.length,
                      userMessages: chatMessages.filter((m) => m.role === 'user').length,
                      assistantMessages: chatMessages.filter((m) => m.role === 'assistant').length,
                      totalCharacters: chatMessages.reduce(
                        (sum, m) => sum + (m.content?.length || 0),
                        0
                      ),
                      averageMessageLength:
                        chatMessages.length > 0
                          ? Math.round(
                              chatMessages.reduce((sum, m) => sum + (m.content?.length || 0), 0) /
                                chatMessages.length
                            )
                          : 0
                    }
                    const statsText =
                      `Chat Statistics:\n\n` +
                      `Total Messages: ${stats.totalMessages}\n` +
                      `User Messages: ${stats.userMessages}\n` +
                      `Assistant Messages: ${stats.assistantMessages}\n` +
                      `Total Characters: ${stats.totalCharacters.toLocaleString()}\n` +
                      `Avg Message Length: ${stats.averageMessageLength} chars`
                    showToast(statsText, 5000)
                  }}
                  chatMessagesCount={chatMessages.length}
                />
              </div>
            </div>

            {/* Panel content */}
            <div className="panel-content">
              <ErrorBoundary>
                {rightSidebarTab === 'ai' ? (
                  <AIChatPanel />
                ) : (
                  <SnippetDetails snippet={selectedSnippet} isLoading={isLoading} />
                )}
              </ErrorBoundary>
            </div>
          </div>
        )}
      </aside>
      {showSettings && (
        <SettingsModal
          onClose={() => {
            setShowSettings(false)
            setSettingsInitialTab('general') // Reset to default
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
      <FileExplorer isOpen={showExplorerModal} onClose={() => setShowExplorerModal(false)} />
      <AIChatModal
        isOpen={showAIChatModal}
        onClose={() => {
          // Just close the modal, don't restore sidebar
          setShowAIChatModal(false)
          setSavedRightSidebarState(null)
        }}
        onUnfloat={() => {
          // Close modal AND restore sidebar to its previous state
          try {
            setShowAIChatModal(false)
            if (savedRightSidebarState?.isOpen) {
              if (savedRightSidebarState.width) {
                setRightWidth(savedRightSidebarState.width)
              }
              setIsRightSidebarOpen(true)

              // Persist both at once in the restructured rightSidebar object
              const currentRSidebar = settings.rightSidebar || {}
              useSettingsStore.getState().updateSettings({
                rightSidebar: {
                  ...currentRSidebar,
                  width: savedRightSidebarState.width || rightWidth,
                  isRightOpen: true
                }
              })
            }
            setSavedRightSidebarState(null)
          } catch (error) {
            console.error('[AppShell] Failed to unfloat AI chat:', error)
          }
        }}
      />
      <CommandPalette
        isOpen={showPalette}
        onClose={() => setShowPalette(false)}
        items={snippets}
        onSelect={(snippet) => {
          setSelectedSnippet(snippet)
          setActiveTab('files')
        }}
        onNew={handleNew}
        onToggleSettings={() => setShowSettings(true)}
        onToggleGraph={() => setShowGraph(true)}
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
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Note?"
        message={`Are you sure you want to delete "${snippetToDelete?.title || 'this note'}"? This cannot be undone.`}
      />
      <UpdateToast />
      <ToastNotification toast={toast} onClose={clearToast} />
      <IndexingStatus />
    </div>
  )
}

export default AppShell
