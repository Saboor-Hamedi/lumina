import React from 'react'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useUpdateStore } from '../../core/store/UpdateSetting'
import Toggle from '../../components/toggle'
import { useAppVersion } from './hook/useAppVersion'

/**
 * SettingAdvanced Component
 * Displays system-level settings, application auto-updates,
 * global desktop integration, interactive graph visualization tweaks, and developer tooling.
 */
export const SettingAdvanced: React.FC = () => {
  const { settings, updateSetting } = useSettingsStore()
  const { status, progress, download, install, check } = useUpdateStore()
  const appVersion = useAppVersion()
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')

  const formatShortcutKey = (keyString: string) => {
    if (!isMac) return keyString
    return keyString.replace(/Ctrl/g, '⌘').replace(/Shift/g, '⇧').replace(/Alt/g, '⌥')
  }

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">Advanced</h2>
          <p className="settings-pane-subtitle">
            System updates, window behavior, graph engine, and devtools.
          </p>
        </div>
      </div>

      {/* App Updates Section */}
      <section>
        <h3>App Updates</h3>
        <div
          className="settings-block"
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            background: 'var(--bg-primary)',
            borderRadius: '6px'
          }}
        >
          <div
            className="update-info"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              userSelect: 'text'
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: '600' }}>
              Version {appVersion || '...'}
            </div>

            {status === 'available' || status === 'ready' || status === 'downloading' ? (
              <div style={{ fontSize: '10px', color: 'var(--text-accent)' }}>
                {status === 'downloading'
                  ? `Downloading update... ${Math.round(progress?.percent || 0)}%`
                  : 'New version available!'}
              </div>
            ) : (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {status === 'not-available'
                  ? 'No update.'
                  : status === 'error'
                    ? 'Update failed. Please try again.'
                    : 'Check to see if there are any updates available.'}
              </div>
            )}
          </div>

          <button
            type="button"
            className={`btn btn-primary update-action-btn ${status === 'checking' || status === 'downloading' ? 'pulse-opacity' : ''}`}
            onClick={() => {
              if (status === 'available') download()
              else if (status === 'ready') install()
              else check()
            }}
            disabled={status === 'downloading' || status === 'checking'}
          >
            <span>{status === 'ready' ? 'Install & Restart' : 'Update'}</span>
          </button>
        </div>
      </section>

      {/* System Integration Section */}
      <section style={{ marginTop: '32px' }}>
        <h3>System Integration</h3>

        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Launch Lumina on Startup</div>
            <div className="row-hint">
              Automatically start Lumina silently in the background when your computer boots up.
            </div>
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
              Summon the Command Palette from anywhere on your computer (requires restart to apply
              changes).
            </div>
          </div>
          <div className="shortcut-badge" style={{ fontSize: '13px' }}>
            {formatShortcutKey('Ctrl+Space')}
          </div>
        </div>
      </section>

      {/* Graph Visualization Section */}
      <section style={{ marginTop: '32px' }}>
        <h3>Graph Visualization</h3>
        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Node Size</div>
            <div className="row-hint">Adjust the size multiplier for all graph nodes.</div>
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
            <div className="row-hint">Display titles on graph nodes.</div>
          </div>
          <Toggle
            checked={settings.graphShowTexts !== false && (settings.graphShowTexts as unknown) !== 'false'}
            onChange={(e) => updateSetting('graphShowTexts', e.target.checked)}
          />
        </div>

        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Graph Accent Color</div>
            <div className="row-hint">Choose the primary color for nodes.</div>
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

      {/* Developer Options Section */}
      <section style={{ marginTop: '32px' }}>
        <h3>Developer Options</h3>
        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Enable Developer Tools</div>
            <div className="row-hint">
              Allow toggling Developer Tools (Ctrl+Shift+I / F12) in production mode.
            </div>
          </div>
          <Toggle
            checked={settings.enableDevTools ?? true}
            onChange={(e) => updateSetting('enableDevTools', e.target.checked)}
          />
        </div>
      </section>
    </div>
  )
}

export default React.memo(SettingAdvanced)
