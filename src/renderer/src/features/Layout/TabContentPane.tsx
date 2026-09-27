/**
 * =========================================================================
 * TabContentPane (`TabContentPane.tsx`)
 * =========================================================================
 *
 * Individual Tab Content Pane renderer for Lumina's multi-tab workspace.
 *
 * Architecture & Responsibilities:
 * - Keeps tab contents mounted in the DOM to preserve local editor scroll positions,
 *   undo/redo history, canvas zoom, and media playback state across tab switching.
 * - Handles visibility via absolute positioning, CSS opacity, visibility, and pointerEvents
 *   rather than unmounting the tree.
 * - Inspects snippet properties to delegate rendering to the specialized viewer:
 *     1. Images (`type === 'image'`) -> ImageViewerTab
 *     2. PDFs (`type === 'pdf'`) -> PDFViewerTab
 *     3. Infinite Canvas (`type === 'canvas'` or `.canvas` extension) -> CanvasTabPane
 *     4. Markdown & Code notes (default fallback) -> Editor
 * - Wrapped with GlobalErrorHandler so any unhandled renderer exception in one note
 *   never crashes the entire application shell.
 * - Memoized with high-performance comparator: unselected background tabs never
 *   re-render when switching active notes, eliminating layout thrashing.
 * =========================================================================
 */

import React from 'react'
import Editor from '../Editor/Editor'
import GlobalErrorHandler from '../../components/GlobalErrorHandler'
import { useWorkspaceStore } from '../../core/store/workspaceStore'

const ImageViewerTab = React.lazy(() => import('../media/ImageViewerTab'))
const PDFViewerTab = React.lazy(() => import('../media/PDFViewerTab'))
const CanvasTabPane = React.lazy(() => import('../canvas/CanvasTabPane'))

export interface TabContentPaneProps {
  /** The note or snippet record to render in this pane */
  snippet: {
    id: string
    title?: string
    code?: string
    type?: string
    language?: string
    fileName?: string
    timestamp?: number
    color?: string
    isPinned?: boolean
    isLearned?: boolean
    [key: string]: any
  }
  /**
   * @deprecated isSelected is now derived internally from the store.
   * Kept in the interface for backward compatibility but ignored at runtime.
   */
  isSelected?: boolean
  /** Callback fired to persist note changes */
  onSave?: (snippet: any) => Promise<any> | void
  /** Action: toggle right inspector sidebar */
  onToggleInspector?: () => void
  /** Action: toggle quick explorer modal */
  onToggleExplorerModal?: () => void
  /** Action: open settings modal */
  onSettingsClick?: () => void
  /** Action: open theme selection modal */
  onThemeClick?: () => void
  /** Action: open knowledge graph view */
  onGraphClick?: () => void
}

/**
 * Individual Tab Content Pane renderer for Lumina's multi-tab workspace.
 *
 * Performance note: isSelected is derived from the Zustand store, NOT passed as a prop.
 * This ensures switching tabs only re-renders the two affected panes (old active + new active)
 * instead of all open panes. The heavy custom memo comparator below is kept as a safety net
 * but the store subscription alone is sufficient to isolate updates.
 */
export const TabContentPane: React.FC<TabContentPaneProps> = React.memo(
  ({
    snippet,
    onSave,
    onToggleInspector,
    onToggleExplorerModal,
    onSettingsClick,
    onThemeClick,
    onGraphClick
  }) => {
    // Each pane subscribes to only its own slice of state — O(1) check, zero cross-tab re-renders
    const isSelected = useWorkspaceStore(
      (state) => state.activeTabId === snippet.id || (!state.activeTabId && state.selectedNote?.id === snippet.id)
    )

    if (!snippet) return null

    return (
      <div
        className={`tab-content-pane ${isSelected ? 'active' : 'inactive'}`}
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
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: isSelected ? 10 : 1,
          transition: 'opacity 0.08s ease-out'
        }}
      >
        <GlobalErrorHandler>
          <React.Suspense fallback={null}>
            {snippet.type === 'image' ? (
              <ImageViewerTab snippet={snippet} />
            ) : snippet.type === 'pdf' ? (
              <PDFViewerTab snippet={snippet} />
            ) : snippet.type === 'canvas' ||
              snippet.language === 'canvas' ||
              snippet.fileName?.endsWith('.canvas') ? (
              <CanvasTabPane {...({ snippet, onSave, isSelected } as any)} />
            ) : (
              <Editor
                snippet={snippet as any}
                onSave={onSave as any}
                onToggleInspector={onToggleInspector}
                isActive={isSelected}
                onToggleExplorerModal={onToggleExplorerModal}
                onSettingsClick={onSettingsClick}
                onThemeClick={onThemeClick}
                onGraphClick={onGraphClick}
              />
            )}
          </React.Suspense>
        </GlobalErrorHandler>
      </div>
    )
  },
  (prev, next) => {
    // isSelected is now derived from store — only re-render when the snippet itself changes
    return (
      prev.snippet?.id === next.snippet?.id &&
      prev.snippet?.timestamp === next.snippet?.timestamp &&
      prev.snippet?.title === next.snippet?.title &&
      prev.snippet?.code === next.snippet?.code &&
      prev.snippet?.color === next.snippet?.color &&
      prev.snippet?.isPinned === next.snippet?.isPinned &&
      prev.snippet?.isLearned === next.snippet?.isLearned &&
      prev.onSave === next.onSave
    )
  }
)

TabContentPane.displayName = 'TabContentPane'

export default TabContentPane

