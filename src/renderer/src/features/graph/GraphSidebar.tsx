import React, { useState, useEffect } from 'react'
import {
  RefreshCw,
  Layers,
  PanelRight,
  PanelRightClose,
  ExternalLink,
  Download,
  FileCode,
  RotateCcw
} from 'lucide-react'
import { useSettingsStore } from '../../core/store/SettingStore'
import ToolTip from '../../components/atoms/ToolTip'
import '../canvas/css/canvas-toolbar.css'
import '../canvas/css/canvas-studio.css'
import './css/GraphSidebar.css'
import '../../assets/toggle-theme.css'
import Toggle from '../../components/toggle'

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
  onSwitchToModal?: () => void
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
  onSwitchToModal,
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

        {onSwitchToModal && (
          <ToolTip text="Pop out to Modal" position="left">
            <button
              type="button"
              className="lumina-canvas-tool-btn"
              onClick={onSwitchToModal}
              aria-label="Open as Modal"
            >
              <ExternalLink size={14} />
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
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border-dim)'
      }}
    >
      {/* Top Header: Search and Close Sidebar Only */}
      <div
        className="lumina-canvas-studio-header"
        style={{
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderBottom: '1px solid var(--border-dim)'
        }}
      >
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search nodes..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className="nexus-search-input"
            style={{
              width: '100%',
              padding: '5px 8px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid var(--border-dim)',
              background: 'var(--bg-editor)',
              color: 'var(--text-main)',
              outline: 'none',
              transition: 'border-color 0.15s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-accent)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-dim)'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {onSwitchToModal && (
            <ToolTip text="Pop out to Modal" position="bottom">
              <button
                type="button"
                className="lumina-canvas-studio-header-btn"
                onClick={onSwitchToModal}
                aria-label="Open as Modal"
                style={{
                  width: '26px',
                  height: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '5px',
                  border: '1px solid var(--border-dim)',
                  background: 'var(--bg-editor)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-accent)'
                  e.currentTarget.style.borderColor = 'var(--text-accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-main)'
                  e.currentTarget.style.borderColor = 'var(--border-dim)'
                }}
              >
                <ExternalLink size={13} />
              </button>
            </ToolTip>
          )}

          <ToolTip text="Close Sidebar" position="bottom">
            <button
              type="button"
              className="lumina-canvas-studio-header-btn"
              onClick={toggleHandler}
              aria-label="Collapse Controls"
              style={{
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '5px',
                border: '1px solid var(--border-dim)',
                background: 'var(--bg-editor)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-accent)'
                e.currentTarget.style.borderColor = 'var(--text-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-main)'
                e.currentTarget.style.borderColor = 'var(--border-dim)'
              }}
            >
              <PanelRightClose size={13} />
            </button>
          </ToolTip>
        </div>
      </div>

      {/* Controls Body */}
      <div
        className="lumina-canvas-studio-body nexus-sidebar-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* Export & Reset Row in the Body */}
        {(onExportPNG || onExportSVG || onResetLayout) && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {onExportPNG && (
              <ToolTip text="Export PNG Image" position="bottom">
                <button
                  type="button"
                  onClick={onExportPNG}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '5px 8px',
                    fontSize: '11px',
                    borderRadius: '5px',
                    border: '1px solid var(--border-dim)',
                    background: 'var(--bg-editor)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-accent)'
                    e.currentTarget.style.borderColor = 'var(--text-accent)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-main)'
                    e.currentTarget.style.borderColor = 'var(--border-dim)'
                  }}
                >
                  <Download size={12} />
                  <span>PNG</span>
                </button>
              </ToolTip>
            )}

            {onExportSVG && (
              <ToolTip text="Export SVG Vector" position="bottom">
                <button
                  type="button"
                  onClick={onExportSVG}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    padding: '5px 8px',
                    fontSize: '11px',
                    borderRadius: '5px',
                    border: '1px solid var(--border-dim)',
                    background: 'var(--bg-editor)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-accent)'
                    e.currentTarget.style.borderColor = 'var(--text-accent)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-main)'
                    e.currentTarget.style.borderColor = 'var(--border-dim)'
                  }}
                >
                  <FileCode size={12} />
                  <span>SVG</span>
                </button>
              </ToolTip>
            )}

            {onResetLayout && (
              <ToolTip text="Reset Layout Positions" position="bottom">
                <button
                  type="button"
                  onClick={onResetLayout}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '5px 8px',
                    fontSize: '11px',
                    borderRadius: '5px',
                    border: '1px solid var(--border-dim)',
                    background: 'var(--bg-editor)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--text-accent)'
                    e.currentTarget.style.borderColor = 'var(--text-accent)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-main)'
                    e.currentTarget.style.borderColor = 'var(--border-dim)'
                  }}
                >
                  <RotateCcw size={12} />
                </button>
              </ToolTip>
            )}
          </div>
        )}
        {/* Filters */}
        <div className="nexus-sidebar-section" style={{ margin: 0 }}>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '2px 0' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-main)'
              }}
            >
              <span>Show Tags</span>
              <Toggle
                checked={!settings.graphHideTags}
                onChange={(e: any) => updateSetting('graphHideTags', !e.target.checked)}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-main)'
              }}
            >
              <span>Show Unresolved Links</span>
              <Toggle
                checked={!settings.graphHideGhosts}
                onChange={(e: any) => updateSetting('graphHideGhosts', !e.target.checked)}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-main)'
              }}
            >
              <span>Show Orphans</span>
              <Toggle
                checked={!settings.graphHideOrphans}
                onChange={(e: any) => updateSetting('graphHideOrphans', !e.target.checked)}
              />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-main)'
              }}
            >
              <span>3D Sphere Mode</span>
              <Toggle
                checked={settings.graph3DMode ?? false}
                onChange={(e: any) => updateSetting('graph3DMode', e.target.checked)}
              />
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: 'var(--border-dim)' }} />

        {/* Display Sliders */}
        <div className="nexus-sidebar-section" style={{ margin: 0 }}>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '2px 0' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontWeight: 500
                }}
              >
                <span>Node Size</span>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontWeight: 500
                }}
              >
                <span>Center Force</span>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontWeight: 500
                }}
              >
                <span>Repel Force</span>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontWeight: 500
                }}
              >
                <span>Link Force</span>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontWeight: 500
                }}
              >
                <span>Highlight Link Opacity</span>
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
      <div
        className="nexus-sidebar-footer"
        style={{
          padding: '6px 12px',
          borderTop: '1px solid var(--border-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start'
        }}
      >
        <button
          className={`theme-toggle ${settings.graphAnimate !== false ? 'active' : ''}`}
          title={settings.graphAnimate !== false ? 'Stop Rotation' : 'Auto Rotate'}
          onClick={() =>
            updateSetting('graphAnimate', settings.graphAnimate === false ? true : false)
          }
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            background: 'transparent',
            border: 'none',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <RefreshCw
            size={12}
            className={settings.graphAnimate !== false ? 'spin-icon' : ''}
            color={settings.graphAnimate !== false ? 'var(--text-accent)' : 'var(--text-muted)'}
          />
        </button>
      </div>
    </aside>
  )
}

export default GraphSidebar
