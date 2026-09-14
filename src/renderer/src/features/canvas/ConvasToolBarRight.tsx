/**
 * ============================================================================
 * Lumina Canvas Studio & Right Toolbar (ConvasToolBarRight.tsx)
 * ============================================================================
 * Dual-mode right-side canvas control center:
 *
 * 1. SLIM DOCK MODE (Collapsed):
 *    - Slender vertical dock anchored on the right edge.
 *    - Fast access to Open Drawer, Shapes, Snap to Grid, Mini-Map, Zoom, Delete, Export.
 *    - Prominent top toggle button to expand into full Studio Drawer.
 *
 * 2. EXPANDABLE CANVAS STUDIO MODE (Expanded):
 *    - Full-featured, lightweight 290px control studio with smooth collapsible accordions.
 *    - Dropdown Sections:
 *        📐 Shapes & Diagrams: 22 geometric shapes with live SVGs & color swatches.
 *        🔗 Smart Connectors: Super smart dynamic direction, line style & arrowhead presets.
 *        🎨 Grid & Layout: 20px snap toggle, 6-way alignment, 2-way distribution, snap-all.
 *        🗺️ Navigation & Viewport: Zoom In/Out, preset badges (50/100/150/200%), fit, Mini-Map.
 *        💾 Export & Snapshot: High-res PNG, vector SVG, clipboard image copy.
 *        📊 Canvas Insights: Live counts of nodes, shapes, notes, wires, and selection.
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Shapes,
  Camera,
  Copy,
  Download,
  Image as ImageIcon,
  PanelBottomOpen,
  Maximize2,
  Grid,
  Map as MapIcon,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  PanelRight,
  PanelRightClose,
  ArrowRight,
  ArrowLeftRight,
  Minus,
  Spline,
  CornerDownRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Sparkles,
  Layers,
  Activity,
  Check
} from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { CanvasShapeType, CanvasNodeColor, CanvasEdgeLineStyle, CanvasNode, CanvasEdge } from './types'
import { CANVAS_SHAPES, SHAPE_COLOR_OPTIONS, renderShapeSVG } from './ConvasShapes'
import { CanvasAlignmentType, CanvasDistributionType } from './canvasAlignment'

export interface ConvasToolBarRightProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onResetViewport: () => void
  onZoomToFit?: () => void
  onSetZoom?: (targetZoom: number) => void
  onDeleteSelected: () => void
  canDelete: boolean
  onAddShape?: (shapeType: CanvasShapeType, width: number, height: number, color?: CanvasNodeColor) => void
  onCopyImage?: () => void
  onExportPNG?: () => void
  onExportSVG?: () => void
  onOpenDrawer?: () => void
  hasSelectedNodes?: boolean
  selectedCount?: number
  snapToGrid?: boolean
  onToggleSnapToGrid?: () => void
  onSnapAllToGrid?: () => void
  isMiniMapOpen?: boolean
  onToggleMiniMap?: () => void
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
  defaultLineStyle?: CanvasEdgeLineStyle
  onChangeDefaultLineStyle?: (style: CanvasEdgeLineStyle) => void
  defaultEndpoints?: 'directed' | 'bidirectional' | 'none'
  onChangeDefaultEndpoints?: (mode: 'directed' | 'bidirectional' | 'none') => void
  onAlignSelection?: (alignment: CanvasAlignmentType) => void
  onDistributeSelection?: (direction: CanvasDistributionType) => void
}

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

    // Accordion sections state
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
      shapes: true,
      connectors: true,
      grid: true,
      navigation: false,
      export: false,
      insights: false
    })

    const toggleSection = (sectionKey: string) => {
      setExpandedSections((prev) => ({
        ...prev,
        [sectionKey]: !prev[sectionKey]
      }))
    }

    // Selected color for newly spawned shapes in Studio palette
    const [activeColor, setActiveColor] = useState<CanvasNodeColor>('default')
    const [shapeSearch, setShapeSearch] = useState('')

    // Slim mode menu states
    const [isSlimExportOpen, setIsSlimExportOpen] = useState(false)
    const slimExportBtnRef = useRef<HTMLButtonElement | null>(null)

    useEffect(() => {
      if (!isSlimExportOpen) return
      const handlePointerDown = (e: MouseEvent | PointerEvent) => {
        const target = e.target as HTMLElement | null
        if (!target) return
        if (
          isSlimExportOpen &&
          !target.closest('.lumina-canvas-export-menu') &&
          !slimExportBtnRef.current?.contains(target)
        ) {
          setIsSlimExportOpen(false)
        }
      }
      document.addEventListener('pointerdown', handlePointerDown)
      return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [isSlimExportOpen])

    // Insights metrics calculation
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

    // Filtered shapes in Studio palette
    const filteredShapes = useMemo(() => {
      if (!shapeSearch.trim()) return CANVAS_SHAPES
      const q = shapeSearch.toLowerCase()
      return CANVAS_SHAPES.filter(
        (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      )
    }, [shapeSearch])

    // ========================================================================
    // EXPANDED STUDIO DRAWER VIEW
    // ========================================================================
    if (isExpanded) {
      return (
        <aside
          className="lumina-canvas-toolbar lumina-canvas-toolbar-right is-expanded"
          aria-label="Canvas Studio"
        >
          {/* Studio Header */}
          <div className="lumina-canvas-studio-header">
            <div className="lumina-canvas-studio-title-group">
              <SlidersHorizontal size={14} className="lumina-canvas-studio-title-icon" />
              <span className="lumina-canvas-studio-title">Canvas Studio</span>
              <span className="lumina-canvas-studio-badge">{nodes.length} nodes</span>
            </div>

            <div className="lumina-canvas-studio-actions">
              {onOpenDrawer && (
                <ToolTip text="Open in Drawer" position="bottom">
                  <button
                    type="button"
                    className="lumina-canvas-studio-header-btn"
                    onClick={onOpenDrawer}
                    aria-label="Open as Drawer"
                  >
                    <PanelBottomOpen size={13} />
                  </button>
                </ToolTip>
              )}

              <ToolTip text="Collapse Studio" position="bottom">
                <button
                  type="button"
                  className="lumina-canvas-studio-header-btn close"
                  onClick={toggleExpanded}
                  aria-label="Collapse Studio"
                >
                  <PanelRightClose size={14} />
                </button>
              </ToolTip>
            </div>
          </div>

          {/* Studio Scrollable Body */}
          <div className="lumina-canvas-studio-body">
            {/* SECTION 1: SHAPES & DIAGRAMS */}
            <div className="lumina-canvas-studio-section">
              <button
                type="button"
                className="lumina-canvas-studio-section-header"
                onClick={() => toggleSection('shapes')}
              >
                <div className="lumina-canvas-studio-section-title">
                  <Shapes size={13} className="section-icon" />
                  <span>Shapes & Diagrams</span>
                </div>
                {expandedSections.shapes ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>

              {expandedSections.shapes && (
                <div className="lumina-canvas-studio-section-content">
                  {/* Color Swatches */}
                  <div className="lumina-canvas-studio-colors-row">
                    {SHAPE_COLOR_OPTIONS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`lumina-canvas-studio-color-dot ${activeColor === c.id ? 'active' : ''}`}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => setActiveColor(c.id)}
                        title={c.label}
                      />
                    ))}
                  </div>

                  {/* Shapes Search */}
                  <div className="lumina-canvas-studio-input-wrap">
                    <input
                      type="text"
                      className="lumina-canvas-studio-search"
                      placeholder="Search 22 shapes..."
                      value={shapeSearch}
                      onChange={(e) => setShapeSearch(e.target.value)}
                    />
                  </div>

                  {/* Shapes Grid */}
                  <div className="lumina-canvas-studio-shapes-grid">
                    {filteredShapes.map((shape) => {
                      const colorHex =
                        SHAPE_COLOR_OPTIONS.find((c) => c.id === activeColor)?.hex || 'currentColor'

                      return (
                        <button
                          key={shape.id}
                          type="button"
                          className="lumina-canvas-studio-shape-card"
                          onClick={() => {
                            if (onAddShape) {
                              onAddShape(shape.id, shape.defaultWidth, shape.defaultHeight, activeColor)
                            }
                          }}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/lumina-shape', shape.id)
                            e.dataTransfer.setData(
                              'application/lumina-shape-meta',
                              JSON.stringify({
                                id: shape.id,
                                width: shape.defaultWidth,
                                height: shape.defaultHeight,
                                color: activeColor
                              })
                            )
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          title={`Click to add ${shape.label} or drag directly to canvas`}
                        >
                          <div className="shape-preview-svg" style={{ color: colorHex }}>
                            {renderShapeSVG(shape.id, colorHex, colorHex, 0.08, 1.4)}
                          </div>
                          <span className="shape-label">{shape.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: SMART CONNECTORS */}
            <div className="lumina-canvas-studio-section">
              <button
                type="button"
                className="lumina-canvas-studio-section-header"
                onClick={() => toggleSection('connectors')}
              >
                <div className="lumina-canvas-studio-section-title">
                  <Spline size={13} className="section-icon" />
                  <span>Smart Connectors</span>
                </div>
                {expandedSections.connectors ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>

              {expandedSections.connectors && (
                <div className="lumina-canvas-studio-section-content">
                  {/* Dynamic Port Routing Feature Callout */}
                  <div className="lumina-canvas-studio-chip-active">
                    <Sparkles size={12} className="chip-icon" />
                    <div className="chip-content">
                      <span className="chip-title">Super Smart Line Direction</span>
                      <span className="chip-subtitle">
                        Wires auto-flip optimal ports in real time when dragging shapes across 2D space.
                      </span>
                    </div>
                  </div>

                  {/* Default Line Style Selector */}
                  <div className="lumina-canvas-studio-field-group">
                    <label className="field-label">Default Wire Path</label>
                    <div className="lumina-canvas-studio-btn-toggle-group">
                      <button
                        type="button"
                        className={`toggle-btn ${defaultLineStyle === 'curved' ? 'active' : ''}`}
                        onClick={() => onChangeDefaultLineStyle && onChangeDefaultLineStyle('curved')}
                      >
                        <Spline size={12} />
                        <span>Curved</span>
                      </button>
                      <button
                        type="button"
                        className={`toggle-btn ${defaultLineStyle === 'step' ? 'active' : ''}`}
                        onClick={() => onChangeDefaultLineStyle && onChangeDefaultLineStyle('step')}
                      >
                        <CornerDownRight size={12} />
                        <span>Step</span>
                      </button>
                      <button
                        type="button"
                        className={`toggle-btn ${defaultLineStyle === 'straight' ? 'active' : ''}`}
                        onClick={() => onChangeDefaultLineStyle && onChangeDefaultLineStyle('straight')}
                      >
                        <Minus size={12} />
                        <span>Straight</span>
                      </button>
                    </div>
                  </div>

                  {/* Default Arrowhead Selector */}
                  <div className="lumina-canvas-studio-field-group">
                    <label className="field-label">Default Arrowheads</label>
                    <div className="lumina-canvas-studio-btn-toggle-group">
                      <button
                        type="button"
                        className={`toggle-btn ${defaultEndpoints === 'directed' ? 'active' : ''}`}
                        onClick={() => onChangeDefaultEndpoints && onChangeDefaultEndpoints('directed')}
                      >
                        <ArrowRight size={12} />
                        <span>Single</span>
                      </button>
                      <button
                        type="button"
                        className={`toggle-btn ${defaultEndpoints === 'bidirectional' ? 'active' : ''}`}
                        onClick={() => onChangeDefaultEndpoints && onChangeDefaultEndpoints('bidirectional')}
                      >
                        <ArrowLeftRight size={12} />
                        <span>Mutual</span>
                      </button>
                      <button
                        type="button"
                        className={`toggle-btn ${defaultEndpoints === 'none' ? 'active' : ''}`}
                        onClick={() => onChangeDefaultEndpoints && onChangeDefaultEndpoints('none')}
                      >
                        <Minus size={12} />
                        <span>Plain</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: GRID & ALIGNMENT */}
            <div className="lumina-canvas-studio-section">
              <button
                type="button"
                className="lumina-canvas-studio-section-header"
                onClick={() => toggleSection('grid')}
              >
                <div className="lumina-canvas-studio-section-title">
                  <Grid size={13} className="section-icon" />
                  <span>Grid & Alignment</span>
                </div>
                {expandedSections.grid ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>

              {expandedSections.grid && (
                <div className="lumina-canvas-studio-section-content">
                  {/* Snap to Grid Toggle */}
                  <div className="lumina-canvas-studio-row-switch">
                    <div className="switch-text">
                      <span className="switch-title">20px Grid Snapping</span>
                      <span className="switch-hint">Hold Shift or toggle (Ctrl+')</span>
                    </div>
                    <button
                      type="button"
                      className={`lumina-canvas-studio-switch-pill ${snapToGrid ? 'active' : ''}`}
                      onClick={onToggleSnapToGrid}
                    >
                      <div className="switch-thumb" />
                    </button>
                  </div>

                  {/* Align Selected Nodes (when 2+ nodes selected) */}
                  {onAlignSelection && (
                    <div className="lumina-canvas-studio-field-group">
                      <div className="field-label-row">
                        <label className="field-label">Align Selected</label>
                        <span className="field-sub">
                          {selectedCount > 1 ? `${selectedCount} selected` : 'Select 2+ cards'}
                        </span>
                      </div>
                      <div className="lumina-canvas-studio-icon-group">
                        <ToolTip text="Align Left" position="top">
                          <button
                            type="button"
                            className="studio-icon-btn"
                            disabled={selectedCount < 2}
                            onClick={() => onAlignSelection('left')}
                          >
                            <AlignLeft size={13} />
                          </button>
                        </ToolTip>
                        <ToolTip text="Align Center (H)" position="top">
                          <button
                            type="button"
                            className="studio-icon-btn"
                            disabled={selectedCount < 2}
                            onClick={() => onAlignSelection('center')}
                          >
                            <AlignCenter size={13} />
                          </button>
                        </ToolTip>
                        <ToolTip text="Align Right" position="top">
                          <button
                            type="button"
                            className="studio-icon-btn"
                            disabled={selectedCount < 2}
                            onClick={() => onAlignSelection('right')}
                          >
                            <AlignRight size={13} />
                          </button>
                        </ToolTip>
                        <ToolTip text="Align Top" position="top">
                          <button
                            type="button"
                            className="studio-icon-btn"
                            disabled={selectedCount < 2}
                            onClick={() => onAlignSelection('top')}
                          >
                            <AlignStartVertical size={13} />
                          </button>
                        </ToolTip>
                        <ToolTip text="Align Middle (V)" position="top">
                          <button
                            type="button"
                            className="studio-icon-btn"
                            disabled={selectedCount < 2}
                            onClick={() => onAlignSelection('middle')}
                          >
                            <AlignCenterVertical size={13} />
                          </button>
                        </ToolTip>
                        <ToolTip text="Align Bottom" position="top">
                          <button
                            type="button"
                            className="studio-icon-btn"
                            disabled={selectedCount < 2}
                            onClick={() => onAlignSelection('bottom')}
                          >
                            <AlignEndVertical size={13} />
                          </button>
                        </ToolTip>
                      </div>
                    </div>
                  )}

                  {/* Distribute Spacing (when 3+ nodes selected) */}
                  {onDistributeSelection && (
                    <div className="lumina-canvas-studio-field-group">
                      <div className="field-label-row">
                        <label className="field-label">Distribute Spacing</label>
                        <span className="field-sub">
                          {selectedCount > 2 ? `${selectedCount} selected` : 'Select 3+ cards'}
                        </span>
                      </div>
                      <div className="lumina-canvas-studio-icon-group">
                        <ToolTip text="Distribute Horizontally" position="top">
                          <button
                            type="button"
                            className="studio-icon-btn"
                            disabled={selectedCount < 3}
                            onClick={() => onDistributeSelection('horizontal')}
                          >
                            <AlignHorizontalDistributeCenter size={13} />
                          </button>
                        </ToolTip>
                        <ToolTip text="Distribute Vertically" position="top">
                          <button
                            type="button"
                            className="studio-icon-btn"
                            disabled={selectedCount < 3}
                            onClick={() => onDistributeSelection('vertical')}
                          >
                            <AlignVerticalDistributeCenter size={13} />
                          </button>
                        </ToolTip>
                      </div>
                    </div>
                  )}

                  {/* Snap All Nodes to Grid Action */}
                  {onSnapAllToGrid && (
                    <button
                      type="button"
                      className="lumina-canvas-studio-action-btn"
                      onClick={onSnapAllToGrid}
                    >
                      <Grid size={12} />
                      <span>Snap All Nodes to 20px Grid</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 4: NAVIGATION & MINI-MAP */}
            <div className="lumina-canvas-studio-section">
              <button
                type="button"
                className="lumina-canvas-studio-section-header"
                onClick={() => toggleSection('navigation')}
              >
                <div className="lumina-canvas-studio-section-title">
                  <MapIcon size={13} className="section-icon" />
                  <span>Navigation & Mini-Map</span>
                </div>
                {expandedSections.navigation ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>

              {expandedSections.navigation && (
                <div className="lumina-canvas-studio-section-content">
                  {/* Zoom Controls */}
                  <div className="lumina-canvas-studio-zoom-bar">
                    <button
                      type="button"
                      className="studio-icon-btn"
                      onClick={onZoomOut}
                      title="Zoom Out"
                    >
                      <ZoomOut size={13} />
                    </button>
                    <span className="zoom-value">{Math.round(zoom * 100)}%</span>
                    <button
                      type="button"
                      className="studio-icon-btn"
                      onClick={onZoomIn}
                      title="Zoom In"
                    >
                      <ZoomIn size={13} />
                    </button>
                  </div>

                  {/* Quick Zoom Presets */}
                  <div className="lumina-canvas-studio-presets-row">
                    {[0.5, 1.0, 1.5, 2.0].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`preset-btn ${Math.abs(zoom - preset) < 0.05 ? 'active' : ''}`}
                        onClick={() => onSetZoom && onSetZoom(preset)}
                      >
                        {Math.round(preset * 100)}%
                      </button>
                    ))}
                  </div>

                  {/* Zoom to Fit & Reset */}
                  <div className="lumina-canvas-studio-presets-row">
                    <button
                      type="button"
                      className="preset-btn secondary"
                      onClick={onResetViewport}
                      title="Reset Viewport to Origin (Ctrl+0)"
                    >
                      <RotateCcw size={11} />
                      <span>100% Reset</span>
                    </button>

                    {onZoomToFit && (
                      <button
                        type="button"
                        className="preset-btn secondary"
                        onClick={onZoomToFit}
                        title="Zoom to Fit All Cards (Shift+1)"
                      >
                        <Maximize2 size={11} />
                        <span>Fit All</span>
                      </button>
                    )}
                  </div>

                  {/* Mini-Map Navigator Toggle */}
                  {onToggleMiniMap && (
                    <div className="lumina-canvas-studio-row-switch" style={{ marginTop: 8 }}>
                      <div className="switch-text">
                        <span className="switch-title">Mini-Map Navigator</span>
                        <span className="switch-hint">Spatial radar preview</span>
                      </div>
                      <button
                        type="button"
                        className={`lumina-canvas-studio-switch-pill ${isMiniMapOpen ? 'active' : ''}`}
                        onClick={onToggleMiniMap}
                      >
                        <div className="switch-thumb" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 5: EXPORT & SNAPSHOT */}
            <div className="lumina-canvas-studio-section">
              <button
                type="button"
                className="lumina-canvas-studio-section-header"
                onClick={() => toggleSection('export')}
              >
                <div className="lumina-canvas-studio-section-title">
                  <Camera size={13} className="section-icon" />
                  <span>Export & Snapshot</span>
                </div>
                {expandedSections.export ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>

              {expandedSections.export && (
                <div className="lumina-canvas-studio-section-content">
                  {onCopyImage && (
                    <button
                      type="button"
                      className="lumina-canvas-studio-action-btn"
                      onClick={onCopyImage}
                    >
                      <Copy size={12} />
                      <span>{hasSelectedNodes ? 'Copy Selection to Clipboard' : 'Copy Snapshot as Image'}</span>
                    </button>
                  )}

                  {onExportPNG && (
                    <button
                      type="button"
                      className="lumina-canvas-studio-action-btn"
                      onClick={onExportPNG}
                    >
                      <ImageIcon size={12} />
                      <span>Export as High-Res PNG</span>
                    </button>
                  )}

                  {onExportSVG && (
                    <button
                      type="button"
                      className="lumina-canvas-studio-action-btn"
                      onClick={onExportSVG}
                    >
                      <Download size={12} />
                      <span>Export as Vector SVG</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 6: CANVAS INSIGHTS */}
            <div className="lumina-canvas-studio-section">
              <button
                type="button"
                className="lumina-canvas-studio-section-header"
                onClick={() => toggleSection('insights')}
              >
                <div className="lumina-canvas-studio-section-title">
                  <Activity size={13} className="section-icon" />
                  <span>Canvas Insights</span>
                </div>
                {expandedSections.insights ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>

              {expandedSections.insights && (
                <div className="lumina-canvas-studio-section-content">
                  <div className="lumina-canvas-studio-stats-grid">
                    <div className="stat-card">
                      <span className="stat-number">{stats.totalNodes}</span>
                      <span className="stat-label">Total Nodes</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-number">{stats.shapeCount}</span>
                      <span className="stat-label">Shapes</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-number">{stats.noteCount}</span>
                      <span className="stat-label">Notes</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-number">{stats.edgeCount}</span>
                      <span className="stat-label">Wires</span>
                    </div>
                    <div className="stat-card full-width">
                      <span className="stat-number">{selectedCount}</span>
                      <span className="stat-label">Items Selected</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      )
    }

    // ========================================================================
    // SLIM DOCK VIEW (COLLAPSED)
    // ========================================================================
    return (
      <div className="lumina-canvas-toolbar lumina-canvas-toolbar-right" aria-label="Canvas Dock">
        {/* Toggle Expand Studio Button */}
        <ToolTip text="Expand Canvas Studio" position="left">
          <button
            type="button"
            className="lumina-canvas-tool-btn active-hover"
            onClick={toggleExpanded}
            aria-label="Expand Canvas Studio"
          >
            <PanelRight size={14} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider horizontal" />

        {/* Open in Inline Canvas Drawer */}
        {onOpenDrawer && (
          <>
            <ToolTip text="Open as Inline Canvas Drawer" position="left">
              <button
                type="button"
                className="lumina-canvas-tool-btn"
                onClick={onOpenDrawer}
                aria-label="Open as Inline Canvas Drawer"
              >
                <PanelBottomOpen size={14} />
              </button>
            </ToolTip>

            <div className="lumina-canvas-divider horizontal" />
          </>
        )}

        {/* Shapes Menu Tool */}
        {onAddShape && (
          <>
            <ToolTip text="Shapes & Diagrams (Click Studio to browse)" position="left">
              <button
                type="button"
                className="lumina-canvas-tool-btn"
                onClick={toggleExpanded}
                aria-label="Shapes & Diagrams"
              >
                <Shapes size={13} />
              </button>
            </ToolTip>

            <div className="lumina-canvas-divider horizontal" />
          </>
        )}

        {/* Snap to Grid Toggle */}
        {onToggleSnapToGrid && (
          <>
            <ToolTip
              text={snapToGrid ? "Snap to Grid: ON (Ctrl+')" : "Snap to Grid: OFF (Ctrl+')"}
              position="left"
            >
              <button
                type="button"
                className={`lumina-canvas-tool-btn ${snapToGrid ? 'active' : ''}`}
                onClick={onToggleSnapToGrid}
                aria-label="Toggle Snap to Grid"
              >
                <Grid size={13} />
              </button>
            </ToolTip>

            <div className="lumina-canvas-divider horizontal" />
          </>
        )}

        {/* Mini-Map Navigator Toggle */}
        {onToggleMiniMap && (
          <>
            <ToolTip
              text={isMiniMapOpen ? 'Mini-Map Navigator (Open)' : 'Mini-Map Navigator (Closed)'}
              position="left"
            >
              <button
                type="button"
                className={`lumina-canvas-tool-btn ${isMiniMapOpen ? 'active' : ''}`}
                onClick={onToggleMiniMap}
                aria-label="Toggle Mini-Map Navigator"
              >
                <MapIcon size={13} />
              </button>
            </ToolTip>

            <div className="lumina-canvas-divider horizontal" />
          </>
        )}

        {/* Delete Selected Tool */}
        <ToolTip text="Delete Selected (Del)" position="left">
          <button
            type="button"
            className="lumina-canvas-tool-btn"
            onClick={onDeleteSelected}
            disabled={!canDelete}
          >
            <Trash2 size={13} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider horizontal" />

        {/* Zoom In */}
        <ToolTip text="Zoom In (Ctrl + Scroll)" position="left">
          <button type="button" className="lumina-canvas-tool-btn" onClick={onZoomIn}>
            <ZoomIn size={13} />
          </button>
        </ToolTip>

        {/* Zoom Percentage */}
        <span className="lumina-canvas-zoom-label" style={{ fontSize: '10px' }}>
          {Math.round(zoom * 100)}%
        </span>

        {/* Zoom Out */}
        <ToolTip text="Zoom Out" position="left">
          <button type="button" className="lumina-canvas-tool-btn" onClick={onZoomOut}>
            <ZoomOut size={13} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider horizontal" />

        {/* Reset View */}
        <ToolTip text="Reset View (Ctrl+0)" position="left">
          <button type="button" className="lumina-canvas-tool-btn" onClick={onResetViewport}>
            <RotateCcw size={13} />
          </button>
        </ToolTip>

        {/* Zoom to Fit View */}
        {onZoomToFit && (
          <ToolTip text="Zoom to Fit All (Shift+1)" position="left">
            <button type="button" className="lumina-canvas-tool-btn" onClick={onZoomToFit}>
              <Maximize2 size={13} />
            </button>
          </ToolTip>
        )}

        {/* Export / Copy Menu */}
        {(onCopyImage || onExportPNG || onExportSVG) && (
          <>
            <div className="lumina-canvas-divider horizontal" />

            <div style={{ position: 'relative' }}>
              <ToolTip text="Export / Copy as Image" position="left">
                <button
                  ref={slimExportBtnRef}
                  type="button"
                  className={`lumina-canvas-tool-btn ${isSlimExportOpen ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsSlimExportOpen((prev) => !prev)
                  }}
                  aria-label="Export / Copy as Image"
                >
                  <Camera size={13} />
                </button>
              </ToolTip>

              {isSlimExportOpen && (
                <div
                  className="lumina-canvas-export-menu"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onCopyImage && (
                    <button
                      type="button"
                      className="lumina-canvas-export-item"
                      onClick={() => {
                        setIsSlimExportOpen(false)
                        onCopyImage()
                      }}
                    >
                      <div className="lumina-canvas-export-item-left">
                        <Copy size={13} />
                        <span>{hasSelectedNodes ? 'Copy Selection as Image' : 'Copy as Image'}</span>
                      </div>
                      <span className="lumina-canvas-export-shortcut">Ctrl+Shift+C</span>
                    </button>
                  )}

                  {onExportPNG && (
                    <button
                      type="button"
                      className="lumina-canvas-export-item"
                      onClick={() => {
                        setIsSlimExportOpen(false)
                        onExportPNG()
                      }}
                    >
                      <div className="lumina-canvas-export-item-left">
                        <ImageIcon size={13} />
                        <span>Export as PNG</span>
                      </div>
                      <span className="lumina-canvas-export-shortcut">PNG</span>
                    </button>
                  )}

                  {onExportSVG && (
                    <button
                      type="button"
                      className="lumina-canvas-export-item"
                      onClick={() => {
                        setIsSlimExportOpen(false)
                        onExportSVG()
                      }}
                    >
                      <div className="lumina-canvas-export-item-left">
                        <Download size={13} />
                        <span>Export as Vector SVG</span>
                      </div>
                      <span className="lumina-canvas-export-shortcut">SVG</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    )
  }
)

ConvasToolBarRight.displayName = 'ConvasToolBarRight'

export default ConvasToolBarRight
