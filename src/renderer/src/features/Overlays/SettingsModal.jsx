import React, { useState } from 'react'
import { X, Settings } from 'lucide-react'
import ThemeSettings from './ThemeSettings'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useToast } from '../../core/hooks/useToast'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './SettingsModal.css'

const SettingsModal = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('general')
  const [isThemeOpen, setIsThemeOpen] = useState(false)
  const { showToast } = useToast()
  const { settings, updateSetting } = useSettingsStore()

  useKeyboardShortcuts({
    onEscape: () => {
      if (isThemeOpen) {
        setIsThemeOpen(false)
        return true
      }
      onClose()
      return true
    }
  })

  const handleSwitchVault = async () => {
    try {
      if (!window.api?.selectVault) {
        showToast('❌ API Error: Restart App')
        return
      }
      const newPath = await window.api.selectVault()
      if (newPath) {
        showToast(`✓ Switched to: ${newPath}`)
        // Force refresh to reload from new vault
        setTimeout(() => window.location.reload(), 1000)
      }
    } catch (e) {
      showToast('❌ Failed to switch vault')
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container settings-container" onClick={(e) => e.stopPropagation()}>
        <header className="pane-header">
          <div className="modal-title-stack">
            <Settings size={16} />
            <span>Settings</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="settings-layout">
          <aside className="settings-sidebar">
            <button
              className={`nav-item ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
            <button
              className={`nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              Appearance
            </button>
          </aside>

          <main className="settings-body">
            {activeTab === 'general' && (
              <div className="settings-pane">
                <section>
                  <h3>Vault Configuration</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Vault Path</div>
                      <div className="row-hint">Your notes are stored as local Markdown files.</div>
                    </div>
                    <div className="row-actions">
                      <button className="btn" onClick={handleOpenFolder}>
                        Open in Explorer
                      </button>
                      <button className="btn btn-primary" onClick={handleSwitchVault}>
                        Change Location
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="settings-pane">
                <section>
                  <h3>Interface</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Base Theme</div>
                      <div className="row-hint">Choose between light, dark, and rugged tones.</div>
                    </div>
                    <button className="btn" onClick={() => setIsThemeOpen(true)}>
                      Theme Gallery
                    </button>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Font Family</div>
                      <div className="row-hint">The font used in the editor area.</div>
                    </div>
                    <select
                      value={settings.fontFamily}
                      onChange={(e) => updateSetting('fontFamily', e.target.value)}
                      className="settings-select"
                    >
                      <option value="Inter">Inter (Default)</option>
                      <option value="Roboto">Roboto</option>
                      <option value="JetBrains Mono">JetBrains Mono</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Font Size</div>
                      <div className="row-hint">Adjust the text size for readability.</div>
                    </div>
                    <div className="range-wrap">
                      <input
                        type="range"
                        min="12"
                        max="24"
                        step="1"
                        value={settings.fontSize}
                        onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
                      />
                      <span>{settings.fontSize}px</span>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Cursor Style</div>
                      <div className="row-hint">Customize the caret appearance.</div>
                    </div>
                    <select
                      value={settings.cursorStyle}
                      onChange={(e) => updateSetting('cursorStyle', e.target.value)}
                      className="settings-select"
                    >
                      <option value="smooth">Smooth Line</option>
                      <option value="block">Block</option>
                      <option value="line">Sharp Line</option>
                    </select>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Full Translucency</div>
                      <div className="row-hint">
                        Enable Acrylic backdrop blur (Windows 11). Requires restart for best
                        results.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={settings.translucency}
                        onChange={(e) => updateSetting('translucency', e.target.checked)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </section>

                <section>
                  <h3>Behavior</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Auto-Save</div>
                      <div className="row-hint">Automatically save changes while typing.</div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={settings.autoSave}
                        onChange={(e) => updateSetting('autoSave', e.target.checked)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Inline Metadata</div>
                      <div className="row-hint">
                        Show tags and properties bar inside the editor.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={settings.inlineMetadata}
                        onChange={(e) => updateSetting('inlineMetadata', e.target.checked)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>

      {isThemeOpen && <ThemeSettings isOpen={isThemeOpen} onClose={() => setIsThemeOpen(false)} />}
    </div>
  )
}

export default SettingsModal
