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
          <button className="modal-close" onClick={onClose} title="Close">
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
            <button
              className={`nav-item ${activeTab === 'shortcuts' ? 'active' : ''}`}
              onClick={() => setActiveTab('shortcuts')}
            >
              Shortcuts
            </button>
            <button
              className={`nav-item ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              AI Models
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

            {activeTab === 'ai' && (
              <div className="settings-pane">
                <section>
                  <h3>DeepSeek Integration</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">API Key</div>
                      <div className="row-hint">
                        Enter your DeepSeek API key (starts with sk-...).
                      </div>
                    </div>
                    <input
                      type="password"
                      className="settings-select"
                      style={{ width: '240px' }}
                      value={settings.deepSeekKey || ''}
                      onChange={(e) => updateSetting('deepSeekKey', e.target.value)}
                      placeholder="sk-..."
                    />
                  </div>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Model</div>
                      <div className="row-hint">
                        Select the model to use for chat and generation.
                      </div>
                    </div>
                    <select
                      value={settings.deepSeekModel || 'deepseek-chat'}
                      onChange={(e) => updateSetting('deepSeekModel', e.target.value)}
                      className="settings-select"
                    >
                      <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                      <option value="deepseek-coder">DeepSeek Coder</option>
                    </select>
                  </div>
                </section>
                <section>
                  <h3>Local Intelligence (Offline)</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Context Indexing</div>
                      <div className="row-hint">
                        Automatically index notes for semantic search (RAG).
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={settings.enableLocalAI ?? true}
                        onChange={(e) => updateSetting('enableLocalAI', e.target.checked)}
                      />
                      <span className="slider round"></span>
                    </label>
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

            {activeTab === 'shortcuts' && (
              <div className="settings-pane">
                <section>
                  <h3>General</h3>
                  <div className="settings-row">
                    <div className="row-info">Settings</div>
                    <div className="shortcut-badge">Ctrl + ,</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Command Palette</div>
                    <div className="shortcut-badge">Ctrl + P</div>
                  </div>
                </section>

                <section>
                  <h3>File</h3>
                  <div className="settings-row">
                    <div className="row-info">New Note</div>
                    <div className="shortcut-badge">Ctrl + N</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Save</div>
                    <div className="shortcut-badge">Ctrl + S</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Close Tab</div>
                    <div className="shortcut-badge">Ctrl + W</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Close Window</div>
                    <div className="shortcut-badge">Ctrl + Shift + W</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info" style={{ color: '#ef4444' }}>
                      Delete Note
                    </div>
                    <div className="shortcut-badge">Ctrl + Shift + D</div>
                  </div>
                </section>

                <section>
                  <h3>Navigation</h3>
                  <div className="settings-row">
                    <div className="row-info">Graph View</div>
                    <div className="shortcut-badge">Ctrl + G</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Toggle Inspector</div>
                    <div className="shortcut-badge">Ctrl + I</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Toggle Preview</div>
                    <div className="shortcut-badge">Ctrl + \</div>
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
