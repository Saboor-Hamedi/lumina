import React, { useEffect, useState } from 'react'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { useToast } from '../../core/hooks/useToast'

const SettingAdvanced = () => {
  const { settings, updateSetting } = useSettingsStore()
  const { status, progress, download, install, check } = useUpdateStore()
  const { showToast } = useToast()
  const [appVersion, setAppVersion] = useState('')
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')

  const formatShortcutKey = (keyString) => {
    if (!isMac) return keyString
    return keyString.replace(/Ctrl/g, '⌘').replace(/Shift/g, '⇧').replace(/Alt/g, '⌥')
  }

  useEffect(() => {
    if (window.api?.getVersion) {
      window.api.getVersion().then(setAppVersion).catch(console.error)
    }
  }, [])

  const handleSwitchVault = async () => {
    try {
      if (!window.api?.selectVault) {
        showToast('❌ API Error: Restart App')
        return
      }
      const newPath = await window.api.selectVault()
      if (newPath) {
        showToast(`✓ Switched to: ${newPath}`)
        setTimeout(() => window.location.reload(), 1000)
      }
    } catch (e) {
      showToast('❌ Failed to switch workspace')
    }
  }

  const handleOpenFolder = () => {
    if (window.api?.openVaultFolder) {
      window.api.openVaultFolder()
    } else {
      showToast('❌ API Error: Restart App')
    }
  }

  return (
    <div className="settings-pane">
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

      <section style={{ marginTop: '32px' }}>
        <h3>Workspace Configuration</h3>
        <div
          className="settings-block"
          style={{
            padding: '16px',
            background: 'var(--bg-primary)',
            borderRadius: '6px'
          }}
        >
          <div className="row-info" style={{ marginBottom: '16px' }}>
            <div className="row-label">Workspace Location</div>
            <div className="row-hint">
              This is where all your markdown notes, assets, and AI indexes are stored securely on
              your local device.
            </div>
          </div>

          <div className="vault-path-display">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="vault-icon"
            >
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
            <span className="path-text">
              {settings.vaultPath || 'No workspace selected (using default)'}
            </span>
          </div>

          <div className="vault-actions">
            <button className="btn btn-outline" onClick={handleOpenFolder}>
              Open in Explorer
            </button>
            <button className="btn btn-primary" onClick={handleSwitchVault}>
              Change Location
            </button>
          </div>
        </div>
      </section>

      <section style={{ marginTop: '32px' }}>
        <h3>System Integration</h3>

        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Launch Lumina on Startup</div>
            <div className="row-hint">
              Automatically start Lumina silently in the background when your computer boots up.
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.launchOnStartup === true}
              onChange={(e) => updateSetting('launchOnStartup', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
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
                updateSetting('graphNodeSize', parseFloat(e.target.value))
              }}
              onTouchEnd={(e) => {
                updateSetting('graphNodeSize', parseFloat(e.target.value))
              }}
            />
          </div>
        </div>

        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Show Node Texts</div>
            <div className="row-hint">Display titles on graph nodes.</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.graphShowTexts !== false && settings.graphShowTexts !== 'false'}
              onChange={(e) => updateSetting('graphShowTexts', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
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


      <section style={{ marginTop: '32px' }}>
        <h3>Developer Options</h3>
        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Enable Developer Tools</div>
            <div className="row-hint">
              Allow toggling Developer Tools (Ctrl+Shift+I / F12) in production mode.
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.enableDevTools ?? true}
              onChange={(e) => updateSetting('enableDevTools', e.target.checked)}
            />
            <span className="slider round"></span>
          </label>
        </div>
      </section>
    </div>
  )
}

export default React.memo(SettingAdvanced)
