// This is a comment to indicate I will read the file before writing.
import React, { useState, useEffect } from 'react'
import TitleBar from './TitleBar'
import ActivityBar from '../Navigation/ActivityBar'
import FileExplorer from '../Navigation/FileExplorer'
import SearchSidebar from '../Navigation/SearchSidebar'
import MarkdownEditor from '../Workspace/MarkdownEditor'
import SettingsModal from '../Overlays/SettingsModal'
import ThemeModal from '../Overlays/ThemeModal'
import CommandPalette from '../Overlays/CommandPalette'
import GraphNexus from '../Overlays/GraphNexus'
import Dashboard from '../Workspace/components/Dashboard'
import TabBar from '../Workspace/components/TabBar'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useVaultStore } from '../../core/store/useVaultStore'
import { GRAPH_TAB_ID } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { useToast } from '../../core/hooks/useToast'
import ToastNotification from '../../core/utils/ToastNotification'
import ConfirmModal from '../Overlays/ConfirmModal'
import UpdateToast from '../Overlays/UpdateToast'
import ErrorBoundary from '../../components/ErrorBoundary'
import '../../assets/toast.css'
import './AppShell.css'
import '../Overlays/ConfirmModal.css'
import AIChatPanel from '../AI/AIChatPanel'
import DetailsModal from '../Overlays/DetailsModal'
import { X, MessageSquare } from 'lucide-react'

const AppShell = () => {
  const { snippets, selectedSnippet, setSelectedSnippet, saveSnippet, isLoading, loadVault, activeTabId, openTabs } =
    useVaultStore()
  const { toast, showToast } = useToast()

  const [activeTab, setActiveTab] = useState('files')
  const [showSettings, setShowSettings] = useState(false)
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true)
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false)
  const [leftWidth, setLeftWidth] = useState(260)
  const [rightWidth, setRightWidth] = useState(300)
  const [resizingSide, setResizingSide] = useState(null) // 'left', 'right', or null
  const [isRestoring, setIsRestoring] = useState(true)
  const [rightPanelMode, setRightPanelMode] = useState('chat')

  // Width Refs for Persistence
  const widthRef = React.useRef({ left: 260, right: 300 })
  useEffect(() => {
    widthRef.current.left = leftWidth
  }, [leftWidth])
  useEffect(() => {
    widthRef.current.right = rightWidth
  }, [rightWidth])

  // Persist Sidebar Toggles
  useEffect(() => {
    if (isRestoring) return
    useSettingsStore.getState().updateSetting('isLeftSidebarOpen', isLeftSidebarOpen)
  }, [isLeftSidebarOpen, isRestoring])

  useEffect(() => {
    if (isRestoring) return
    useSettingsStore.getState().updateSetting('isRightSidebarOpen', isRightSidebarOpen)
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
        if (newWidth < 250) newWidth = 250
        if (newWidth > 600) newWidth = 600
        setRightWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      // Persist new widths
      if (resizingSide) {
        useSettingsStore.getState().updateSetting('leftWidth', widthRef.current.left)
        useSettingsStore.getState().updateSetting('rightWidth', widthRef.current.right)
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
  useEffect(() => {
    const initApp = async () => {
      await useSettingsStore.getState().init()
      await loadVault()
      const { settings } = useSettingsStore.getState()
      if (settings.openTabs && Array.isArray(settings.openTabs)) {
        useVaultStore
          .getState()
          .restoreSession(settings.openTabs, settings.lastSnippetId, settings.pinnedTabIds || [])
      } else if (settings.lastSnippetId) {
        const allSnippets = useVaultStore.getState().snippets
        const last = allSnippets.find((s) => s.id === settings.lastSnippetId)
        if (last) setSelectedSnippet(last)
      }
      // Default to chat mode (metadata moved to modal)
      if (settings.rightPanelMode && settings.rightPanelMode !== 'metadata') {
        setRightPanelMode(settings.rightPanelMode)
      } else {
        setRightPanelMode('chat')
        useSettingsStore.getState().updateSetting('rightPanelMode', 'chat')
      }
      // Restore Widths & Toggles
      if (settings.leftWidth) setLeftWidth(settings.leftWidth)
      if (settings.rightWidth) setRightWidth(settings.rightWidth)
      if (typeof settings.isLeftSidebarOpen === 'boolean')
        setIsLeftSidebarOpen(settings.isLeftSidebarOpen)
      if (typeof settings.isRightSidebarOpen === 'boolean')
        setIsRightSidebarOpen(settings.isRightSidebarOpen)

      setIsRestoring(false)
    }

    initApp()

    // Start listening for updates
    const unsub = useUpdateStore.getState().init()

    // Listen for details modal open event from EditorTitleBar
    const handleOpenDetailsModal = () => {
      setShowDetailsModal(true)
    }
    window.addEventListener('open-details-modal', handleOpenDetailsModal)

    return () => {
      unsub && unsub()
      window.removeEventListener('open-details-modal', handleOpenDetailsModal)
    }
  }, [])

  // ... imports

  // Persist Last Snippet & Tabs
  useEffect(() => {
    if (isRestoring) return
    if (selectedSnippet) {
      useSettingsStore.getState().updateSetting('lastSnippetId', selectedSnippet.id)
    }
  }, [selectedSnippet?.id, isRestoring])

  // Persist open tabs to settings (openTabs already destructured from useVaultStore above)
  useEffect(() => {
    if (isRestoring) return
    useSettingsStore.getState().updateSetting('openTabs', openTabs)
  }, [openTabs, isRestoring])

  const pinnedTabIds = useVaultStore((state) => state.pinnedTabIds)

  useEffect(() => {
    if (isRestoring) return
    useSettingsStore.getState().updateSetting('pinnedTabIds', pinnedTabIds)
  }, [pinnedTabIds, isRestoring])

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
    onToggleInspector: () => setIsRightSidebarOpen((prev) => !prev),
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
        console.warn('Close window API not available')
      }
    },
    onNextTab: () => {
      if (openTabs.length === 0) return
      const currentIdx = activeTabId ? openTabs.indexOf(activeTabId) : -1
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % openTabs.length
      const nextId = openTabs[nextIdx]
      if (nextId === GRAPH_TAB_ID) {
        useVaultStore.getState().openGraphTab()
      } else {
        const nextSnippet = snippets.find(s => s.id === nextId)
        if (nextSnippet) setSelectedSnippet(nextSnippet)
      }
    },
    onPreviousTab: () => {
      if (openTabs.length === 0) return
      const currentIdx = activeTabId ? openTabs.indexOf(activeTabId) : -1
      const prevIdx = currentIdx === -1 
        ? openTabs.length - 1 
        : currentIdx === 0 
          ? openTabs.length - 1 
          : currentIdx - 1
      const prevId = openTabs[prevIdx]
      if (prevId === GRAPH_TAB_ID) {
        useVaultStore.getState().openGraphTab()
      } else {
        const prevSnippet = snippets.find(s => s.id === prevId)
        if (prevSnippet) setSelectedSnippet(prevSnippet)
      }
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
      showToast('New note created', 'success')
    } catch (error) {
      console.error('Failed to create new note:', error)
      showToast('Failed to create note. Please try again.', 'error')
    }
  }

  const handleConfirmDelete = async () => {
    if (snippetToDelete) {
      await useVaultStore.getState().deleteSnippet(snippetToDelete.id, true)
      setSnippetToDelete(null)
    }
  }

  return (
    <div
      className={`app-shell ${isLeftSidebarOpen ? 'left-open' : 'left-closed'} ${isRightSidebarOpen ? 'right-open' : 'right-closed'} ${resizingSide ? 'is-resizing' : ''}`}
      style={{
        opacity: isRestoring ? 0 : 1,
        transition: 'opacity 0.2s ease-in-out',
        gridTemplateColumns: `var(--ribbon-width) ${isLeftSidebarOpen ? leftWidth + 'px' : '0px'} 1fr ${isRightSidebarOpen ? rightWidth + 'px' : '0px'}`
      }}
    >
      <header className="shell-header">
        <TitleBar />
      </header>
      <nav className="shell-ribbon">
        <ActivityBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSettingsClick={() => setShowSettings(true)}
          onThemeClick={() => setShowThemeModal(true)}
          onToggleSidebar={() => setIsLeftSidebarOpen((prev) => !prev)}
          isLeftSidebarOpen={isLeftSidebarOpen}
        />
      </nav>
      <aside className="shell-sidebar-left">
        <ErrorBoundary>
          {activeTab === 'search' ? (
            <SearchSidebar onNavigate={() => setActiveTab('files')} />
          ) : (
            <FileExplorer onNavigate={() => setActiveTab('files')} />
          )}
        </ErrorBoundary>
        {isLeftSidebarOpen && (
          <div
            className="sidebar-resizer left"
            onMouseDown={() => setResizingSide('left')}
          />
        )}
      </aside>
      <main className="shell-main">
        {/* Show TabBar when there are open tabs and we're in files/search view or graph tab is active */}
        {openTabs.length > 0 && (activeTab === 'files' || activeTab === 'search' || activeTabId === GRAPH_TAB_ID) && <TabBar />}

        {/* Render Graph Nexus if graph tab is active (embedded mode) */}
        {activeTabId === GRAPH_TAB_ID ? (
          <ErrorBoundary>
            <GraphNexus
              embedded={true}
              isOpen={true}
              onNavigate={(snippet) => {
                // Close graph tab and switch to the selected snippet
                const { closeTab } = useVaultStore.getState()
                closeTab(GRAPH_TAB_ID)
                setSelectedSnippet(snippet)
                setActiveTab('files')
              }}
            />
          </ErrorBoundary>
        ) : activeTab === 'graph' ? (
          // Fallback: if activity bar shows graph but no tab, show graph (backward compatibility)
          <ErrorBoundary>
            <GraphNexus
              embedded={true}
              isOpen={true}
              onNavigate={(snippet) => {
                setSelectedSnippet(snippet)
                setActiveTab('files')
              }}
            />
          </ErrorBoundary>
        ) : selectedSnippet ? (
          <ErrorBoundary>
            <MarkdownEditor
              snippet={selectedSnippet}
              onSave={saveSnippet}
              onToggleInspector={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            />
          </ErrorBoundary>
        ) : isRestoring ? (
          <div className="shell-main-placeholder" />
        ) : (
          <ErrorBoundary>
            <Dashboard onNew={handleNew} />
          </ErrorBoundary>
        )}
      </main>
      <aside className="shell-sidebar-right">
        {isRightSidebarOpen && (
          <div
            className="sidebar-resizer right"
            onMouseDown={() => setResizingSide('right')}
          />
        )}
        <div className="inspector-panel">
          {/* Tab-style header - matches workspace tabs */}
          <div className="panel-header-tabs workspace-tabbar">
            <div className="workspace-tab active">
              <div className="tab-context">
                <MessageSquare size={12} className="tab-icon" />
                <span className="tab-title">AI Chat</span>
              </div>
              <div className="tab-actions">
                <button
                  className="tab-close-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsRightSidebarOpen(false)
                    useSettingsStore.getState().updateSetting('isRightSidebarOpen', false)
                  }}
                  title="Close sidebar"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Panel content - only AI Chat */}
          <div className="panel-content">
            <ErrorBoundary>
              <AIChatPanel />
            </ErrorBoundary>
          </div>
        </div>
      </aside>
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onOpenTheme={() => {
            setShowSettings(false)
            setShowThemeModal(true)
          }}
        />
      )}
      {showThemeModal && <ThemeModal isOpen={showThemeModal} onClose={() => setShowThemeModal(false)} />}
      <DetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        snippet={selectedSnippet}
        isLoading={isLoading}
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
      {/* GraphNexus Modal - Only show when graph tab is NOT active (to prevent duplicate) */}
      {showGraph && activeTabId !== GRAPH_TAB_ID && (
        <GraphNexus
          isOpen={true}
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
      <ToastNotification toast={toast} />
    </div>
  )
}

export default AppShell
