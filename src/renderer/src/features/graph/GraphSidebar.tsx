import React, { useState, useEffect } from 'react'
import {
  RefreshCw,
  Layers,
  PanelRight,
  PanelRightClose,
  Download,
  FileCode,
  RotateCcw,
  Search,
  X
} from 'lucide-react'
import { useSettingsStore } from '../../core/store/SettingStore'
import ToolTip from '../../components/atoms/ToolTip'
import '../canvas/css/canvas-toolbar.css'
import '../canvas/css/canvas-studio.css'
import './css/GraphSidebar.css'
import '../../assets/toggle-theme.css'
import Toggle from '../../components/toggle'
import PerformancePanel from './PerformancePanel'

export interface GraphSidebarProps {
  isOpen?: boolean
  onToggleExpand?: () => void
  onClose?: () => void
  searchQuery?: string
  setSearchQuery?: (q: string) => void
  nodeCount?: number
  onRecenter?: (e?: any) => void
  is3DMode?: boolean
  onToggle3D?: () => void
  onExportPNG?: () => void
  onExportSVG?: () => void
  onResetLayout?: () => void
}

const GraphSidebar: React.FC<GraphSidebarProps> = ({
  isOpen = true,
  onToggleExpand,
  onClose,
  searchQuery,
  setSearchQuery,
  nodeCount: _nodeCount,
  onRecenter,
  is3DMode,
  onToggle3D,
  onExportPNG,
  onExportSVG,
  onResetLayout
}) => {
  const toggleHandler = onToggleExpand || onClose
  const { settings, updateSetting } = useSettingsStore()

  const fastUpdate = (key: string, val: any) => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, [key]: val }
    }))
  }

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery || '')

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        setSearchQuery?.(localSearchQuery)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [localSearchQuery, setSearchQuery, searchQuery])

  useEffect(() => {
    if (searchQuery !== localSearchQuery) {
      setLocalSearchQuery(searchQuery || '')
    }
  }, [searchQuery])

  if (!isOpen) {
    return (
      <div
        className="nexus-sidebar closed lumina-canvas-toolbar lumina-canvas-toolbar-right"
        data-testid="graph-sidebar"
        aria-label="Graph Dock"
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ToolTip text="Expand Controls" position="left">
          <button
            type="button"
            className="lumina-canvas-tool-btn active-hover"
            onClick={toggleHandler}
            aria-label="Expand Controls"
          >
            <PanelRight size={14} />
          </button>
        </ToolTip>

        <div className="lumina-canvas-divider horizontal" />

        {onRecenter && (
          <ToolTip text="Recenter View" position="left">
            <button
              type="button"
              className="lumina-canvas-tool-btn"
              onClick={onRecenter}
              aria-label="Recenter View"
            >
              <RefreshCw size={14} />
            </button>
          </ToolTip>
        )}

        {onToggle3D && (
          <ToolTip text={is3DMode ? 'Switch to 2D' : 'Switch to 3D'} position="left">
            <button
              type="button"
              className="lumina-canvas-tool-btn"
              onClick={onToggle3D}
              aria-label="Toggle 2D/3D"
            >
              <Layers size={14} />
            </button>
          </ToolTip>
        )}

        {onExportPNG && (
          <ToolTip text="Export PNG Image" position="left">
            <button
              type="button"
              className="lumina-canvas-tool-btn"
              onClick={onExportPNG}
              aria-label="Export PNG"
            >
              <Download size={14} />
            </button>
          </ToolTip>
        )}

        {onExportSVG && (
          <ToolTip text="Export SVG Vector" position="left">
            <button
              type="button"
              className="lumina-canvas-tool-btn"
              onClick={onExportSVG}
              aria-label="Export SVG"
            >
              <FileCode size={14} />
            </button>
          </ToolTip>
        )}
      </div>
    )
  }

  return (
    <aside
      className="nexus-sidebar lumina-canvas-toolbar lumina-canvas-toolbar-right is-expanded"
      data-testid="graph-sidebar"
      aria-label="Graph Controls"
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      tabIndex={-1}
    >
      {/* Top Header: Search Input with Clear Button + Close Sidebar */}
      <div className="lumina-canvas-studio-header nexus-expanded-header">
        <div className="nexus-search-box">
          <Search size={13} className="nexus-search-icon" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className="nexus-search-input"
          />
          {localSearchQuery && (
            <button
              type="button"
              className="nexus-search-clear"
              onClick={() => {
                setLocalSearchQuery('')
                setSearchQuery?.('')
              }}
              aria-label="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>

        <ToolTip text="Close Sidebar" position="bottom">
          <button
            type="button"
            className="lumina-canvas-studio-header-btn nexus-close-btn"
            onClick={toggleHandler}
            aria-label="Collapse Controls"
          >
            <PanelRightClose size={14} />
          </button>
        </ToolTip>
      </div>

      {/* Controls Body */}
      <div className="lumina-canvas-studio-body nexus-sidebar-content">
        {/* Unified Performance & Recenter Bar */}
        <PerformancePanel embedded={true} is3DMode={is3DMode} onRecenter={onRecenter} />

        {/* Export & Reset Row */}
        {(onExportPNG || onExportSVG || onResetLayout) && (
          <div className="nexus-actions-row">
            {onExportPNG && (
              <ToolTip text="Export PNG Image" position="bottom">
                <button type="button" className="nexus-chip-btn" onClick={onExportPNG}>
                  <Download size={12} />
                  <span>PNG</span>
                </button>
              </ToolTip>
            )}

            {onExportSVG && (
              <ToolTip text="Export SVG Vector" position="bottom">
                <button type="button" className="nexus-chip-btn" onClick={onExportSVG}>
                  <FileCode size={12} />
                  <span>SVG</span>
                </button>
              </ToolTip>
            )}

            {onResetLayout && (
              <ToolTip text="Reset Layout Positions" position="bottom">
                <button
                  type="button"
                  className="nexus-chip-btn icon-only"
                  onClick={onResetLayout}
                  aria-label="Reset Layout Positions"
                >
                  <RotateCcw size={12} />
                </button>
              </ToolTip>
            )}
          </div>
        )}

        {/* Filters Card */}
        <div className="nexus-card-section">
          <div className="nexus-section-title">Filters</div>
          <div className="nexus-toggle-list">
            <div className="nexus-toggle-row">
              <span>Tags</span>
              <Toggle
                checked={!settings.graphHideTags}
                onChange={(e: any) => updateSetting('graphHideTags', !e.target.checked)}
              />
            </div>
            <div className="nexus-toggle-row">
              <span>Unresolved</span>
              <Toggle
                checked={!settings.graphHideGhosts}
                onChange={(e: any) => updateSetting('graphHideGhosts', !e.target.checked)}
              />
            </div>
            <div className="nexus-toggle-row">
              <span>Orphans</span>
              <Toggle
                checked={!settings.graphHideOrphans}
                onChange={(e: any) => updateSetting('graphHideOrphans', !e.target.checked)}
              />
            </div>
            <div className="nexus-toggle-row">
              <span>3D Mode</span>
              <Toggle
                checked={is3DMode ?? (settings.graph3DMode ?? false)}
                onChange={(e: any) => {
                  if (onToggle3D) {
                    onToggle3D()
                  } else {
                    updateSetting('graph3DMode', e.target.checked)
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Display & Physics Forces Card */}
        <div className="nexus-card-section">
          <div className="nexus-section-header">
            <span className="nexus-section-title">Forces &amp; Display</span>
            <button
              type="button"
              className="nexus-reset-link"
              title="Reset physics defaults"
              onClick={() => {
                updateSetting('graphNodeSize', 1.5)
                updateSetting('graphCenterForce', 0.05)
                updateSetting('graphRepelForce', 0.3)
                updateSetting('graphLinkForce', 0.05)
                updateSetting('graphLinkHighlightOpacity', 0.6)
              }}
            >
              Reset
            </button>
          </div>
          <div className="nexus-slider-list">
            <div className="nexus-slider-row">
              <div className="nexus-slider-meta">
                <span>Node Size</span>
                <span className="nexus-slider-value">{(settings.graphNodeSize || 1.5).toFixed(1)}×</span>
              </div>
              <input
                type="range"
                className="graph-slider"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.graphNodeSize || 1.5}
                onChange={(e) => fastUpdate('graphNodeSize', parseFloat(e.target.value))}
                onMouseUp={(e: any) => updateSetting('graphNodeSize', parseFloat(e.target.value))}
                onTouchEnd={(e: any) => updateSetting('graphNodeSize', parseFloat(e.target.value))}
              />
            </div>
            <div className="nexus-slider-row">
              <div className="nexus-slider-meta">
                <span>Center Force</span>
                <span className="nexus-slider-value">{(settings.graphCenterForce ?? 0.05).toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="graph-slider"
                min="0.0"
                max="1.0"
                step="0.01"
                value={settings.graphCenterForce ?? 0.05}
                onChange={(e) => fastUpdate('graphCenterForce', parseFloat(e.target.value))}
                onMouseUp={(e: any) => updateSetting('graphCenterForce', parseFloat(e.target.value))}
                onTouchEnd={(e: any) => updateSetting('graphCenterForce', parseFloat(e.target.value))}
              />
            </div>
            <div className="nexus-slider-row">
              <div className="nexus-slider-meta">
                <span>Repel Force</span>
                <span className="nexus-slider-value">{(settings.graphRepelForce ?? 0.3).toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="graph-slider"
                min="0.0"
                max="1.0"
                step="0.01"
                value={settings.graphRepelForce ?? 0.3}
                onChange={(e) => fastUpdate('graphRepelForce', parseFloat(e.target.value))}
                onMouseUp={(e: any) => updateSetting('graphRepelForce', parseFloat(e.target.value))}
                onTouchEnd={(e: any) => updateSetting('graphRepelForce', parseFloat(e.target.value))}
              />
            </div>
            <div className="nexus-slider-row">
              <div className="nexus-slider-meta">
                <span>Link Force</span>
                <span className="nexus-slider-value">{(settings.graphLinkForce ?? 0.05).toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="graph-slider"
                min="0.0"
                max="1.0"
                step="0.01"
                value={settings.graphLinkForce ?? 0.05}
                onChange={(e) => fastUpdate('graphLinkForce', parseFloat(e.target.value))}
                onMouseUp={(e: any) => updateSetting('graphLinkForce', parseFloat(e.target.value))}
                onTouchEnd={(e: any) => updateSetting('graphLinkForce', parseFloat(e.target.value))}
              />
            </div>
            <div className="nexus-slider-row">
              <div className="nexus-slider-meta">
                <span>Link Highlight</span>
                <span className="nexus-slider-value">
                  {Math.round((settings.graphLinkHighlightOpacity ?? 0.6) * 100)}%
                </span>
              </div>
              <input
                type="range"
                className="graph-slider"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.graphLinkHighlightOpacity ?? 0.6}
                onChange={(e) => fastUpdate('graphLinkHighlightOpacity', parseFloat(e.target.value))}
                onMouseUp={(e: any) =>
                  updateSetting('graphLinkHighlightOpacity', parseFloat(e.target.value))
                }
                onTouchEnd={(e: any) =>
                  updateSetting('graphLinkHighlightOpacity', parseFloat(e.target.value))
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="nexus-sidebar-footer">
        <button
          type="button"
          className={`nexus-rotate-btn ${settings.graphAnimate !== false ? 'active' : ''}`}
          title={settings.graphAnimate !== false ? 'Stop Rotation' : 'Auto Rotate'}
          onClick={() =>
            updateSetting('graphAnimate', settings.graphAnimate === false ? true : false)
          }
        >
          <RefreshCw
            size={12}
            className={settings.graphAnimate !== false ? 'spin-icon' : ''}
          />
          <span>{settings.graphAnimate !== false ? 'Animating' : 'Paused'}</span>
        </button>
        {typeof _nodeCount === 'number' && (
          <span className="nexus-node-count-pill">{_nodeCount} nodes</span>
        )}
      </div>
    </aside>
  )
}

export default GraphSidebar
