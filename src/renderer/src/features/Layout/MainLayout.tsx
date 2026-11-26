/**
 * MainLayout.tsx
 *
 * Core 3-Pane Application Shell & Workspace Orchestrator for Lumina.
 *
 * Supporting hooks and sections live in `./shell/`:
 * - `useSidebarPanels`: Left/right sidebar & Zen visibility state
 * - `useTerminalDock`: Bottom terminal dock state, Zen persistence, & resizing
 * - `useWorkspaceActions`: Note/canvas creation, deletion, starter workspace, & view toggles
 * - `useLayoutEvents`: App bootstrap, session restore, vault watcher, & window events
 * - `useLayoutShortcuts`: Capture-phase & global keyboard shortcuts
 * - `TerminalDockSection`: Collapsible/resizable bottom terminal panel view
 */

import React, { useState, useCallback, useMemo, useRef } from 'react'
import Sidebar from '../Navigation/Sidebar'
import ActivityBar from '../Navigation/ActivityBar'
import RightActivityBar from '../Navigation/RightActivityBar'
import Welcome from '../../Welcome'
import { SplitNodeRenderer } from './split'
import './split/split.css'
import AppModals, { RenameModalState } from './AppModals'
import { ExternalDropOverlay, useWorkspaceDrop } from '../Explorer/drop'
import { countExplorerPerfRender } from '../Explorer/utils/explorerPerf'
import { FileText, FolderDown } from 'lucide-react'
import {
  useWorkspaceStore,
  GRAPH_TAB_ID,
  LUMINA_TAB_ID,
  RELEASE_NOTES_TAB_ID
} from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useToast } from '../../core/notification'
import GlobalErrorHandler from '../../components/GlobalErrorHandler'
import '../../assets/mainlayout.css'
import '../modals/css/confirm.css'
import '../modals/css/renameModal.css'

import { useTypingSound } from '../../core/hooks/useTypingSound'
import { useShallow } from 'zustand/react/shallow'

import RightSidebar from '../Inspector/RightSidebar'
import StatusBar from './StatusBar'
import { useSidebarResize } from './resizeSidebar'
import {
  useSidebarPanels,
  useTerminalDock,
  useWorkspaceActions,
  useLayoutEvents,
  useLayoutShortcuts,
  TerminalDockSection,
  isCanvasNote
} from './shell'

export const MainLayout: React.FC = () => {
  countExplorerPerfRender('MainLayout')
  const {
    snippets,
    selectedSnippet,
    setSelectedSnippet,
    saveSnippet,
    isLoading,
    loadWorkspace,
    activeTabId,
    openTabs,
    splitDirection,
    splitTree,
    setSplitRatio,
    splitPane,
    closeSplit
  } = useWorkspaceStore(
    useShallow((state) => ({
      snippets: state.notes || [],
      selectedSnippet: state.selectedNote,
      setSelectedSnippet: state.setSelectedNote,
      saveSnippet: state.saveNote,
      isLoading: state.isLoading,
      loadWorkspace: state.loadWorkspace,
      activeTabId: state.activeTabId,
      openTabs: state.openTabs,
      splitDirection: state.splitDirection,
      splitTree: state.splitTree,
      setSplitRatio: state.setSplitRatio,
      splitPane: state.splitPane,
      closeSplit: state.closeSplit
    }))
  )

  const { toast, showToast, clearToast } = useToast()
  const { workspaceDrop, workspaceDropProps } = useWorkspaceDrop()
  useTypingSound()

  const [settingsInitialTab, setSettingsInitialTab] = useState('workspace')
  const [activeTab, setActiveTab] = useState('files')
  const [showSettings, setShowSettings] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [paletteInitialQuery, setPaletteInitialQuery] = useState('')
  const [showDocsModal, setShowDocsModal] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [showAIChatModal, setShowAIChatModal] = useState<boolean>(() => {
    return (useSettingsStore.getState().settings as any)?.aiChatModalState?.isOpen || false
  })
  const [, setShowExplorerModal] = useState(false)
  const [showActiveIconPicker, setShowActiveIconPicker] = useState(false)
  const [renameModal, setRenameModal] = useState<RenameModalState>({
    isOpen: false,
    item: null,
    newName: ''
  })
  const [, setSavedRightSidebarState] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [snippetToDelete, setSnippetToDelete] = useState<any>(null)
  const appShellRef = useRef<HTMLDivElement | null>(null)

  const {
    isLeftSidebarOpen,
    isRightSidebarOpen,
    isLeftSidebarOpenRef,
    isRightSidebarOpenRef,
    rightSidebarTab,
    setRightSidebarTab,
    rightSidebarTabRef,
    isZenModeEnabled,
    hideActivityBarInZen,
    hideRightActivityBarInZen,
    hideStatusBarInZen,
    isActivityBarVisible,
    isRightActivityBarVisible,
    isStatusBarVisible,
    isTabsVisible,
    isBreadcrumbsVisible,
    updateLeftSidebarOpen,
    updateRightSidebarOpen,
    handleToggleLeftSidebar,
    handleToggleRightSidebar,
    handleCloseRightSidebar,
    handleSelectRightSidebarTab,
    handleToggleInspector
  } = useSidebarPanels()

  const {
    isTerminalOpen,
    setIsTerminalOpen,
    hasMountedTerminal,
    terminalHeight,
    setTerminalHeight,
    isTerminalMaximized,
    isTerminalVisible,
    handleToggleTerminal,
    handleToggleTerminalMaximize,
    handleStartTerminalResize
  } = useTerminalDock(isZenModeEnabled)

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

  const {
    handleNew,
    handleNewCanvas,
    handleOpenOrCreateCanvasTab,
    handleOpenOrCreateCanvasTabRef,
    handleConfirmDelete,
    handleLoadStarterWorkspace,
    handleOpenSettings,
    handleOpenTheme,
    handleToggleGraph,
    handleOpenDocs,
    handleToggleExplorerModal,
    handleToggleAIChat
  } = useWorkspaceActions({
    selectedSnippet,
    saveSnippet,
    setSelectedSnippet,
    setActiveTab,
    setShowPalette,
    setShowSettings,
    setShowDocsModal,
    setShowExplorerModal,
    setShowAIChatModal,
    snippetToDelete,
    setSnippetToDelete,
    showToast
  })

  useLayoutEvents({
    openTabsLength: openTabs.length,
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
  })

  useLayoutShortcuts({
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
  })

  // Stable snippet map — only re-computes when notes change (saves, renames), NOT on tab switch
  const snippetMap = useMemo(() => {
    const map = new Map<string, any>()
    for (let i = 0; i < snippets.length; i++) {
      map.set(snippets[i].id, snippets[i])
    }
    return map
  }, [snippets])

  const hasValidOpenTabs = useMemo(
    () =>
      openTabs.some(
        (id: string) =>
          id === GRAPH_TAB_ID ||
          id === LUMINA_TAB_ID ||
          id === RELEASE_NOTES_TAB_ID ||
          snippetMap.has(id)
      ),
    [openTabs, snippetMap]
  )

  const showTabHeader = activeTab === 'files' || activeTab === 'search'

  const handleResizeSplit = useCallback(
    (splitId: string, ratio: number) => {
      setSplitRatio(ratio, splitId)
    },
    [setSplitRatio]
  )

  const sharedPaneProps = useMemo(
    () => ({
      snippetMap,
      showTabHeader,
      isTabsVisible,
      isBreadcrumbsVisible,
      isZenModeEnabled,
      isTerminalMaximized,
      isRightSidebarOpen,
      isLeftSidebarOpen,
      onToggleRightSidebar: handleToggleRightSidebar,
      onToggleLeftSidebar: handleToggleLeftSidebar,
      onSave: saveSnippet,
      onToggleInspector: handleToggleInspector,
      onToggleExplorerModal: handleToggleExplorerModal,
      onSettingsClick: handleOpenSettings,
      onThemeClick: handleOpenTheme,
      onGraphClick: handleToggleGraph,
      onNavigate: setSelectedSnippet,
      workspaceDrop
    }),
    [
      snippetMap,
      showTabHeader,
      isTabsVisible,
      isBreadcrumbsVisible,
      isZenModeEnabled,
      isTerminalMaximized,
      isRightSidebarOpen,
      isLeftSidebarOpen,
      handleToggleRightSidebar,
      handleToggleLeftSidebar,
      saveSnippet,
      handleToggleInspector,
      handleToggleExplorerModal,
      handleOpenSettings,
      handleOpenTheme,
      handleToggleGraph,
      setSelectedSnippet,
      workspaceDrop
    ]
  )

  return (
    <div
      ref={appShellRef}
      className={`app-shell ${isLeftSidebarOpen ? 'left-open' : 'left-closed'} ${isRightSidebarOpen ? 'right-open' : 'right-closed'}`}
      style={
        {
          '--left-sidebar-width': `${leftWidth}px`,
          '--left-sidebar-content-width': `${Math.max(130, leftWidth)}px`,
          '--right-sidebar-width': `${rightWidth}px`,
          '--right-sidebar-content-width': `${Math.max(130, rightWidth)}px`
        } as React.CSSProperties
      }
    >
      <div className="shell-body">
        <ActivityBar
          onToggleGraph={handleToggleGraph}
          onToggleTerminal={handleToggleTerminal}
          isTerminalOpen={isTerminalOpen}
          onOpenTheme={handleOpenTheme}
          onOpenDocs={handleOpenDocs}
          onOpenGuide={() => setShowGuideModal(true)}
          isZenHidden={!isActivityBarVisible || (isZenModeEnabled && hideActivityBarInZen)}
        />

        <div className="shell-workbench-column">
          <div
            className="shell-workbench-row"
            style={isTerminalVisible && isTerminalMaximized ? { display: 'none' } : undefined}
          >
            <aside className="shell-sidebar-left">
              <GlobalErrorHandler>
                <Sidebar />
              </GlobalErrorHandler>
            </aside>
            <div
              className={`sidebar-resizer left ${isLeftSidebarOpen ? 'open' : 'closed'}`}
              title="Double-click to reset default width (220px)"
              onPointerDown={(e) => handleStartResize('left', e)}
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
              <div className="shell-center-workspace" {...workspaceDropProps}>
                <div
                  className="workspace-editor-dock-area"
                  style={{
                    flex: isTerminalMaximized && isTerminalVisible ? 0 : 1,
                    display: isTerminalMaximized && isTerminalVisible ? 'none' : 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {isLoading ? (
                    <div
                      className="workspace-container"
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        flex: 1,
                        overflow: 'hidden',
                        position: 'relative'
                      }}
                    />
                  ) : hasValidOpenTabs ? (
                    <div className="workspace-container">
                      <SplitNodeRenderer
                        node={splitTree}
                        onResizeSplit={handleResizeSplit}
                        paneProps={sharedPaneProps}
                      />
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

                {workspaceDrop.isOver && !hasValidOpenTabs && (
                  <ExternalDropOverlay
                    label={workspaceDrop.label}
                    count={workspaceDrop.count}
                    icon={workspaceDrop.isExternal ? FolderDown : FileText}
                  />
                )}
              </div>
            </main>

            <div
              className={`sidebar-resizer right ${isRightSidebarOpen ? 'open' : 'closed'}`}
              title="Double-click to reset default width (220px)"
              onPointerDown={(e) => handleStartResize('right', e)}
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
                  selectedNote={selectedSnippet}
                  isLoading={isLoading}
                />
              </GlobalErrorHandler>
            </aside>
          </div>

          <TerminalDockSection
            hasMountedTerminal={hasMountedTerminal}
            isTerminalVisible={isTerminalVisible}
            isTerminalMaximized={isTerminalMaximized}
            terminalHeight={terminalHeight}
            onStartResize={handleStartTerminalResize}
            onResetHeight={() => setTerminalHeight(260)}
            onClose={() => setIsTerminalOpen(false)}
            onToggleMaximize={handleToggleTerminalMaximize}
          />

          <StatusBar
            onToggleInspector={handleToggleInspector}
            onSettingsClick={handleOpenSettings}
            onThemeClick={handleOpenTheme}
            isZenHidden={!isStatusBarVisible || (isZenModeEnabled && hideStatusBarInZen)}
          />
        </div>

        <RightActivityBar
          isRightSidebarOpen={isRightSidebarOpen}
          activeTab={rightSidebarTab}
          onSelectTab={handleSelectRightSidebarTab}
          onToggleGraph={handleToggleGraph}
          isGraphActive={activeTabId === GRAPH_TAB_ID}
          onToggleCanvas={handleOpenOrCreateCanvasTab}
          isCanvasActive={activeTabId !== GRAPH_TAB_ID && isCanvasNote(selectedSnippet)}
          isZenHidden={
            !isRightActivityBarVisible || (isZenModeEnabled && hideRightActivityBarInZen)
          }
        />
      </div>

      <AppModals
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        settingsInitialTab={settingsInitialTab}
        setSettingsInitialTab={setSettingsInitialTab}
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
        loadWorkspace={loadWorkspace}
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
