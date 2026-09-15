/**
 * ============================================================================
 * Lumina Canvas Studio & Right Toolbar Container (ConvasToolBarRight.tsx)
 * ============================================================================
 * Dual-mode right-side canvas control center container:
 *
 * 1. SLIM DOCK MODE (Collapsed):
 *    - Rendered via `SlimCanvasDock`
 *    - Slender vertical dock anchored on the right edge with fast-action tools.
 *
 * 2. EXPANDED CANVAS STUDIO MODE (Expanded):
 *    - 290px control studio container orchestrating modular subcomponents:
 *        📐 StudioHeader: title, count badge, drawer & collapse actions
 *        🗂️ StudioTabsBar: segmented navigation (Shapes, Wires, Layout, Export)
 *        🎨 StudioShapesTab: 22 geometric shapes, color swatches & search
 *        🔗 StudioWiresTab: smart dynamic direction & line style selectors
 *        📐 StudioLayoutTab: grid snapping, alignment, distribution & zoom
 *        💾 StudioExportTab: PNG, SVG, image copy, and diagram statistics
 * ============================================================================
 */

import React, { useState, useMemo, useCallback } from 'react'
import {
  StudioTab,
  ConvasToolBarRightProps,
  StudioHeader,
  StudioTabsBar,
  StudioShapesTab,
  StudioWiresTab,
  StudioLayoutTab,
  StudioExportTab,
  SlimCanvasDock
} from './toolbar'

export * from './toolbar/types'

export const ConvasToolBarRight: React.FC<ConvasToolBarRightProps> = React.memo(
  ({
    zoom,
    onZoomIn,
    onZoomOut,
    onResetViewport,
    onZoomToFit,
    onSetZoom,
    onDeleteSelected,
    canDelete,
    onAddShape,
    onCopyImage,
    onExportPNG,
    onExportSVG,
    onOpenDrawer,
    hasSelectedNodes = false,
    selectedCount = 0,
    snapToGrid = false,
    onToggleSnapToGrid,
    onSnapAllToGrid,
    isMiniMapOpen = false,
    onToggleMiniMap,
    nodes = [],
    edges = [],
    defaultLineStyle = 'curved',
    onChangeDefaultLineStyle,
    defaultEndpoints = 'directed',
    onChangeDefaultEndpoints,
    onAlignSelection,
    onDistributeSelection
  }) => {
    // Persistent expansion state
    const [isExpanded, setIsExpanded] = useState(() => {
      try {
        return localStorage.getItem('lumina-canvas-studio-expanded') === 'true'
      } catch {
        return false
      }
    })

    const toggleExpanded = useCallback(() => {
      setIsExpanded((prev) => {
        const next = !prev
        try {
          localStorage.setItem('lumina-canvas-studio-expanded', String(next))
        } catch {}
        return next
      })
    }, [])

    // Top Navigation Tabs
    const [activeTab, setActiveTab] = useState<StudioTab>('shapes')

    // Diagram metrics calculations for the Export / Insights tab
    const stats = useMemo(() => {
      let shapeCount = 0
      let noteCount = 0
      let textCount = 0
      let linkCount = 0

      for (const n of nodes) {
        if (n.type === 'shape') shapeCount++
        else if (n.type === 'note') noteCount++
        else if (n.type === 'text') textCount++
        else if (n.type === 'link') linkCount++
      }

      return {
        totalNodes: nodes.length,
        shapeCount,
        noteCount,
        textCount,
        linkCount,
        edgeCount: edges.length
      }
    }, [nodes, edges])

    // ========================================================================
    // EXPANDED STUDIO DRAWER VIEW
    // ========================================================================
    if (isExpanded) {
      return (
        <aside
          className="lumina-canvas-toolbar lumina-canvas-toolbar-right is-expanded"
          aria-label="Canvas Studio"
          onWheel={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          {/* Studio Header */}
          <StudioHeader
            cardCount={nodes.length}
            onOpenDrawer={onOpenDrawer}
            onCollapse={toggleExpanded}
          />

          {/* Segmented Navigation Bar */}
          <StudioTabsBar activeTab={activeTab} onSelectTab={setActiveTab} />

          {/* Studio Scrollable Body with Clean Dedicated Subcomponents */}
          <div className="lumina-canvas-studio-body" onWheel={(e) => e.stopPropagation()}>
            {activeTab === 'shapes' && <StudioShapesTab onAddShape={onAddShape} />}

            {activeTab === 'connectors' && (
              <StudioWiresTab
                defaultLineStyle={defaultLineStyle}
                onChangeDefaultLineStyle={onChangeDefaultLineStyle}
                defaultEndpoints={defaultEndpoints}
                onChangeDefaultEndpoints={onChangeDefaultEndpoints}
              />
            )}

            {activeTab === 'grid' && (
              <StudioLayoutTab
                zoom={zoom}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onResetViewport={onResetViewport}
                onZoomToFit={onZoomToFit}
                onSetZoom={onSetZoom}
                selectedCount={selectedCount}
                snapToGrid={snapToGrid}
                onToggleSnapToGrid={onToggleSnapToGrid}
                onSnapAllToGrid={onSnapAllToGrid}
                isMiniMapOpen={isMiniMapOpen}
                onToggleMiniMap={onToggleMiniMap}
                onAlignSelection={onAlignSelection}
                onDistributeSelection={onDistributeSelection}
              />
            )}

            {activeTab === 'export' && (
              <StudioExportTab
                onCopyImage={onCopyImage}
                onExportPNG={onExportPNG}
                onExportSVG={onExportSVG}
                hasSelectedNodes={hasSelectedNodes}
                selectedCount={selectedCount}
                stats={stats}
              />
            )}
          </div>
        </aside>
      )
    }

    // ========================================================================
    // SLIM DOCK VIEW (COLLAPSED)
    // ========================================================================
    return (
      <SlimCanvasDock
        zoom={zoom}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onResetViewport={onResetViewport}
        onZoomToFit={onZoomToFit}
        onDeleteSelected={onDeleteSelected}
        canDelete={canDelete}
        onToggleExpand={toggleExpanded}
        onAddShape={onAddShape}
        onCopyImage={onCopyImage}
        onExportPNG={onExportPNG}
        onExportSVG={onExportSVG}
        onOpenDrawer={onOpenDrawer}
        hasSelectedNodes={hasSelectedNodes}
        snapToGrid={snapToGrid}
        onToggleSnapToGrid={onToggleSnapToGrid}
        isMiniMapOpen={isMiniMapOpen}
        onToggleMiniMap={onToggleMiniMap}
      />
    )
  }
)

ConvasToolBarRight.displayName = 'ConvasToolBarRight'
export default ConvasToolBarRight
