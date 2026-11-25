/**
 * WorkspacePane.tsx
 *
 * Reusable editor pane component for single-pane and multi-pane split-view editing.
 * Renders a pane's TabBar, optional Breadcrumbs, and mounted TabContentPanes.
 */

import React, { useMemo } from 'react'
import TabBar from './TabBar'
import TabContentPane from './TabContentPane'
import Breadcrumbs from '../Breadcrumbs/index'
import {
  useWorkspaceStore,
  GRAPH_TAB_ID,
  LUMINA_TAB_ID,
  type WorkspacePaneId
} from '../../core/store/workspaceStore'
import { useShallow } from 'zustand/react/shallow'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useTabDragStore } from './tabDragDrop'

const Graph = React.lazy(() => import('../graph/Graph'))
const LuminaChatContent = React.lazy(() =>
  import('../AI/components/LuminaChatContent').then((m) => ({ default: m.LuminaChatContent }))
)

interface PaneSpecialTabProps {
  paneId: WorkspacePaneId
  onNavigate?: (snippet: any) => void
}

const GraphTabPane = React.memo<PaneSpecialTabProps>(({ paneId, onNavigate }) => {
  const isSelected = useWorkspaceStore((state) =>
    paneId === 'primary'
      ? state.activeTabId === GRAPH_TAB_ID
      : state.panes[paneId]?.activeTabId === GRAPH_TAB_ID
  )
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: isSelected ? 1 : 0,
        pointerEvents: isSelected ? 'auto' : 'none',
        visibility: isSelected ? 'visible' : 'hidden',
        contentVisibility: isSelected ? 'visible' : 'hidden',
        contain: isSelected ? 'none' : 'strict',
        display: isSelected ? 'flex' : 'none',
        overflow: 'hidden',
        zIndex: isSelected ? 10 : 1,
        transition: 'opacity 0.08s ease-out'
      }}
    >
      <React.Suspense fallback={null}>
        <Graph embedded={true} isOpen={isSelected} onNavigate={onNavigate} />
      </React.Suspense>
    </div>
  )
})
GraphTabPane.displayName = 'GraphTabPane'

const LuminaTabPane = React.memo<{ paneId: WorkspacePaneId }>(({ paneId }) => {
  const isSelected = useWorkspaceStore((state) =>
    paneId === 'primary'
      ? state.activeTabId === LUMINA_TAB_ID
      : state.panes[paneId]?.activeTabId === LUMINA_TAB_ID
  )
  return (
    <div
      style={{
        display: isSelected ? 'flex' : 'none',
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        flexDirection: 'column'
      }}
    >
      <React.Suspense fallback={null}>
        <LuminaChatContent isSidebar={false} isModal={false} />
      </React.Suspense>
    </div>
  )
})
LuminaTabPane.displayName = 'LuminaTabPane'

export interface WorkspacePaneProps {
  paneId: WorkspacePaneId
  snippetMap: Map<string, any>
  showTabHeader: boolean
  isTabsVisible: boolean
  isBreadcrumbsVisible: boolean
  isZenModeEnabled: boolean
  isTerminalMaximized: boolean
  isRightSidebarOpen: boolean
  isLeftSidebarOpen: boolean
  onToggleRightSidebar: () => void
  onToggleLeftSidebar: () => void
  onSave: (snippet: any) => Promise<any> | void
  onToggleInspector: () => void
  onToggleExplorerModal: () => void
  onSettingsClick: () => void
  onThemeClick: () => void
  onGraphClick: () => void
  onNavigate: (snippet: any) => void
  flexRatio?: number
}

const EMPTY_TABS: string[] = []

export const WorkspacePane: React.FC<WorkspacePaneProps> = React.memo(
  ({
    paneId,
    snippetMap,
    showTabHeader,
    isTabsVisible,
    isBreadcrumbsVisible,
    isZenModeEnabled,
    isTerminalMaximized,
    isRightSidebarOpen,
    isLeftSidebarOpen,
    onToggleRightSidebar,
    onToggleLeftSidebar,
    onSave,
    onToggleInspector,
    onToggleExplorerModal,
    onSettingsClick,
    onThemeClick,
    onGraphClick,
    onNavigate,
    flexRatio
  }) => {
    const { tabs, activeId, isSplit, isFocused, setFocusedPane } = useWorkspaceStore(
      useShallow((state) => ({
        tabs:
          paneId === 'primary'
            ? state.openTabs
            : state.panes[paneId]?.tabs || EMPTY_TABS,
        activeId:
          paneId === 'primary'
            ? state.activeTabId
            : state.panes[paneId]?.activeTabId ?? null,
        isSplit: state.splitDirection !== 'none',
        isFocused: state.focusedPane === paneId,
        setFocusedPane: state.setFocusedPane
      }))
    )

    const hideTabsInZen = useSettingsStore((s) => s.settings?.zenMode?.hideTabs !== false)
    const dropZone = useTabDragStore((state) =>
      state.dropTarget?.targetPane === paneId ? state.dropTarget.zone : null
    )

    const activeSnippet = useMemo(() => {
      if (!activeId || activeId === GRAPH_TAB_ID || activeId === LUMINA_TAB_ID) return null
      return snippetMap.get(activeId) || null
    }, [activeId, snippetMap])

    const renderedEditors = useMemo(() => {
      return tabs.map((tabId: string) => {
        if (tabId === GRAPH_TAB_ID) {
          return <GraphTabPane key={`${paneId}:${tabId}`} paneId={paneId} onNavigate={onNavigate} />
        }
        if (tabId === LUMINA_TAB_ID) {
          return <LuminaTabPane key={`${paneId}:${tabId}`} paneId={paneId} />
        }
        const snippet = snippetMap.get(tabId)
        if (!snippet) return null
        return (
          <TabContentPane
            key={`${paneId}:${tabId}`}
            paneId={paneId}
            snippet={snippet}
            onSave={onSave}
            onToggleInspector={onToggleInspector}
            onToggleExplorerModal={onToggleExplorerModal}
            onSettingsClick={onSettingsClick}
            onThemeClick={onThemeClick}
            onGraphClick={onGraphClick}
          />
        )
      })
    }, [
      paneId,
      tabs,
      snippetMap,
      onSave,
      onToggleInspector,
      onToggleExplorerModal,
      onSettingsClick,
      onThemeClick,
      onGraphClick,
      onNavigate
    ])

    return (
      <div
        data-workspace-pane={paneId}
        className={`workspace-pane${isSplit ? ' is-split' : ''}${isSplit && isFocused ? ' is-focused' : ''}`}
        style={flexRatio !== undefined ? { flex: flexRatio } : { flex: 1 }}
        onMouseDown={() => {
          if (isSplit && !isFocused) {
            setFocusedPane(paneId)
          }
        }}
      >
        {showTabHeader && (
          <>
            <div className={`zen-collapsible-bar zen-tabs-bar${!isTabsVisible || (isZenModeEnabled && hideTabsInZen) ? ' zen-hidden' : ''}`}>
              <TabBar
                paneId={paneId}
                isSidebarOpen={isRightSidebarOpen}
                onToggleSidebar={onToggleRightSidebar}
                isLeftSidebarOpen={isLeftSidebarOpen}
                onToggleLeftSidebar={onToggleLeftSidebar}
              />
            </div>
            {!isTerminalMaximized && activeSnippet && (
              <div className={`zen-collapsible-bar zen-breadcrumbs-bar${!isBreadcrumbsVisible || isZenModeEnabled ? ' zen-hidden' : ''}`}>
                <Breadcrumbs snippet={activeSnippet} />
              </div>
            )}
          </>
        )}

        <div className="workspace-pane-body">
          {renderedEditors}
          {dropZone && dropZone !== 'tabbar' && (
            <div className={`pane-drop-overlay zone-${dropZone}`} aria-hidden="true" />
          )}
        </div>
      </div>
    )
  }
)

WorkspacePane.displayName = 'WorkspacePane'
export default WorkspacePane
