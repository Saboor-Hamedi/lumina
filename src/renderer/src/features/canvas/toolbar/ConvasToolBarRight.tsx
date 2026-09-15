/**
 * ============================================================================
 * Lumina Canvas Studio & Right Toolbar Container (toolbar/ConvasToolBarRight.tsx)
 * ============================================================================
 * Dual-mode right-side canvas control center container:
 *
 * 1. SLIM DOCK MODE (Collapsed):
 *    - Rendered via `SlimCanvasDock`
 *    - Slender vertical dock anchored on the right edge with fast-action tools.
 *
 * 2. EXPANDED CANVAS STUDIO MODE (Expanded):
 *    - 300px full-height control studio container orchestrating modular subcomponents:
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
  ConvasToolBarRightProps
} from './types'
import { StudioHeader } from './StudioHeader'
import { StudioTabsBar } from './StudioTabsBar'
import { StudioShapesTab } from './StudioShapesTab'
import { StudioWiresTab } from './StudioWiresTab'
import { StudioLayoutTab } from './StudioLayoutTab'
import { StudioExportTab } from './StudioExportTab'
import { SlimCanvasDock } from './SlimCanvasDock'
import CanvasMiniMap from '../components/controls/CanvasMiniMap'

export * from './types'

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
    selectedColor,
    onUpdateSelectedColor,
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
    onDistributeSelection,
    onUndo,
    canUndo,
    onRedo,
    canRedo,
    viewport,
    containerRect,
    onPanTo
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

    const handleToggleMiniMap = useCallback(() => {
      if (!isExpanded) {
        setIsExpanded(true)
        try {
          localStorage.setItem('lumina-canvas-studio-expanded', 'true')
        } catch {}
        if (!isMiniMapOpen) {
          onToggleMiniMap?.()
        }
      } else {
        onToggleMiniMap?.()
      }
    }, [isExpanded, isMiniMapOpen, onToggleMiniMap])

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
            onUndo={onUndo}
            canUndo={canUndo}
            onRedo={onRedo}
            canRedo={canRedo}
          />

          {/* Segmented Navigation Bar */}
          <StudioTabsBar activeTab={activeTab} onSelectTab={setActiveTab} />

          {/* Studio Scrollable Body with Clean Dedicated Subcomponents */}
          <div className="lumina-canvas-studio-body" onWheel={(e) => e.stopPropagation()}>
            {activeTab === 'shapes' && (
              <StudioShapesTab
                onAddShape={onAddShape}
                selectedColor={selectedColor}
                onUpdateSelectedColor={onUpdateSelectedColor}
                selectedCount={selectedCount}
              />
            )}

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

          {/* Studio Footer: Embedded Spatial Navigator Card Dropdown */}
          <div className="lumina-canvas-studio-footer">
            <CanvasMiniMap
              nodes={nodes}
              viewport={viewport || { x: 0, y: 0, zoom: 1 }}
              containerRect={containerRect || null}
              onPanTo={onPanTo || (() => {})}
              isOpen={isMiniMapOpen}
              onToggleOpen={onToggleMiniMap || (() => {})}
              variant="footer-card"
            />
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
        onUndo={onUndo}
        canUndo={canUndo}
        onRedo={onRedo}
        canRedo={canRedo}
        onAddShape={onAddShape}
        onCopyImage={onCopyImage}
        onExportPNG={onExportPNG}
        onExportSVG={onExportSVG}
        onOpenDrawer={onOpenDrawer}
        hasSelectedNodes={hasSelectedNodes}
        snapToGrid={snapToGrid}
        onToggleSnapToGrid={onToggleSnapToGrid}
        isMiniMapOpen={isMiniMapOpen}
        onToggleMiniMap={handleToggleMiniMap}
      />
    )
  }
)

ConvasToolBarRight.displayName = 'ConvasToolBarRight'
export default ConvasToolBarRight
