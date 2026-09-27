import React, { useState } from 'react'
import { SlidersHorizontal, Share2 } from 'lucide-react'
import { useSettingsStore } from '../../core/store/SettingStore'
import Toggle from '../../components/toggle'
import SettingUpdateBar from './SettingUpdateBar'

type AdvancedSubTab = 'system' | 'graph'

/**
 * SettingAdvanced Component
 * Displays system-level settings, graph visualization properties,
 * and developer tooling, with a fixed sticky update bar at the bottom.
 */
export const SettingAdvanced: React.FC = () => {
  const { settings, updateSetting } = useSettingsStore()
  const [activeSubTab, setActiveSubTab] = useState<AdvancedSubTab>('system')
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')

  const formatShortcutKey = (keyString: string) => {
    if (!isMac) return keyString
    return keyString.replace(/Ctrl/g, '⌘').replace(/Shift/g, '⇧').replace(/Alt/g, '⌥')
  }

  return (
    <div className="settings-pane settings-pane-with-sticky-footer">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">Advanced</h2>
          <p className="settings-pane-subtitle">
            System integration, graph visualizer, and developer tools.
          </p>
        </div>
      </div>

      {/* Segmented Sub-tabs */}
      <div className="settings-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'system'}
          className={`settings-subtab ${activeSubTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('system')}
        >
          <SlidersHorizontal size={13} />
          <span>System & Dev</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'graph'}
          className={`settings-subtab ${activeSubTab === 'graph' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('graph')}
        >
          <Share2 size={13} />
          <span>Graph</span>
        </button>
      </div>

      <div className="settings-pane-content-grow">
        {/* System & Developer Options */}
        <div style={{ display: activeSubTab === 'system' ? 'block' : 'none' }}>
          <section>
            <h3>System Integration</h3>

            <div className="settings-row">
              <div className="row-info">
                <div className="row-label">Launch Lumina on Startup</div>
                <div className="row-hint">Start Lumina silently in background on boot.</div>
              </div>
              <Toggle
                checked={settings.launchOnStartup === true}
                onChange={(e) => updateSetting('launchOnStartup', e.target.checked)}
              />
            </div>

            <div className="settings-row">
              <div className="row-info">
                <div className="row-label">Global Spotlight Shortcut</div>
                <div className="row-hint">
                  Summon the Command Palette globally from any desktop application.
                </div>
              </div>
              <div className="shortcut-badge" style={{ fontSize: '13px' }}>
                {formatShortcutKey('Ctrl+Space')}
              </div>
            </div>
          </section>

          <section style={{ marginTop: '28px' }}>
            <h3>Developer Options</h3>
            <div className="settings-row">
              <div className="row-info">
                <div className="row-label">Enable Developer Tools</div>
                <div className="row-hint">Allow opening DevTools (F12) in production.</div>
              </div>
              <Toggle
                checked={settings.enableDevTools ?? true}
                onChange={(e) => updateSetting('enableDevTools', e.target.checked)}
              />
            </div>
          </section>
        </div>

        {/* Graph Visualization Options */}
        <div style={{ display: activeSubTab === 'graph' ? 'block' : 'none' }}>
          <section>
            <h3>Graph Visualization</h3>
            <div className="settings-row">
              <div className="row-info">
                <div className="row-label">Node Size</div>
                <div className="row-hint">Adjust node radius multiplier.</div>
              </div>
              <div className="range-wrap">
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  defaultValue={settings.graphNodeSize || 1.5}
                  onMouseUp={(e) => {
                    updateSetting('graphNodeSize', parseFloat((e.target as HTMLInputElement).value))
                  }}
                  onTouchEnd={(e) => {
                    updateSetting('graphNodeSize', parseFloat((e.target as HTMLInputElement).value))
                  }}
                />
              </div>
            </div>

            <div className="settings-row">
              <div className="row-info">
                <div className="row-label">Show Node Texts</div>
                <div className="row-hint">Display note labels on graph nodes.</div>
              </div>
              <Toggle
                checked={settings.graphShowTexts !== false && (settings.graphShowTexts as unknown) !== 'false'}
                onChange={(e) => updateSetting('graphShowTexts', e.target.checked)}
              />
            </div>

            <div className="settings-row">
              <div className="row-info">
                <div className="row-label">Graph Accent Color</div>
                <div className="row-hint">Primary color theme for knowledge nodes.</div>
              </div>
              <div className="color-picker-row" style={{ display: 'flex', gap: '12px' }}>
                {['#40bafa', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6'].map((color) => {
                  const isSelected =
                    (settings.graphNodeColor || '#40bafa').toLowerCase() === color.toLowerCase()
                  return (
                    <div
                      key={color}
                      onClick={() => updateSetting('graphNodeColor', color.toLowerCase())}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: color,
                        cursor: 'pointer',
                        border: isSelected ? '3px solid #ffffff' : '3px solid transparent',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s ease',
                        opacity: isSelected ? 1 : 0.6,
                        transform: isSelected ? 'scale(1.1)' : 'scale(1)'
                      }}
                    />
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Extracted Bottom Fixed Sticky Update Bar */}
      <SettingUpdateBar />
    </div>
  )
}

export default React.memo(SettingAdvanced)
