import React, { useState, useEffect } from 'react'
import { X, Settings } from 'lucide-react'
import ThemeModal from './ThemeModal'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useToast } from '../../core/hooks/useToast'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useFontSettings } from '../../core/hooks/useFontSettings'
import './SettingsModal.css'

/**
 * SettingsModal Component
 *
 * Comprehensive settings interface with tabbed navigation for:
 * - General settings (vault, auto-save, etc.)
 * - Appearance (theme, fonts, caret customization)
 * - Keyboard shortcuts
 * - AI model configuration
 *
 * Features caret width and color customization with real-time preview
 * and validation (width: 1-10px, color: hex format).
 *
 * @param {Object} props - Component props
 * @param {Function} props.onClose - Callback to close the modal
 * @returns {JSX.Element} Settings modal component
 */
const SettingsModal = ({ onClose, onOpenTheme, initialTab = 'general' }) => {
  const [activeTab, setActiveTab] = useState(initialTab)
  const { showToast } = useToast()
  const { settings, updateSetting } = useSettingsStore()
  const { caretWidth, caretColor, caretStyle, updateCaretWidth, updateCaretColor, updateCaretStyle } = useFontSettings()

  // Update activeTab when initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  useKeyboardShortcuts({
    onEscape: onClose
  })

  const handleOpenTheme = () => {
    if (onOpenTheme) {
      onOpenTheme()
    }
  }

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
                  <h3>Active Intelligence Provider</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Primary AI Brain</div>
                      <div className="row-hint">
                        Choose which model powers chat and smart features.
                      </div>
                    </div>
                    <select
                      value={settings.activeProvider || 'deepseek'}
                      onChange={(e) => updateSetting('activeProvider', e.target.value)}
                      className="settings-select"
                    >
                      <option value="deepseek">DeepSeek (Default)</option>
                      <option value="openai">OpenAI (GPT-4o)</option>
                      <option value="anthropic">Anthropic (Claude 3.5)</option>
                      <option value="ollama">Ollama (Local / Offline)</option>
                    </select>
                  </div>
                </section>

                {/* DeepSeek Configuration */}
                {(settings.activeProvider === 'deepseek' || !settings.activeProvider) && (
                  <section style={{ marginTop: '24px', animation: 'fadeIn 0.3s' }}>
                    <h3>DeepSeek Configuration</h3>
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
                        onChange={(e) => updateSetting('deepSeekKey', e.target.value.trim() || null)}
                        placeholder="sk-..."
                      />
                    </div>
                    <div className="settings-row">
                      <div className="row-info">
                        <div className="row-label">Model</div>
                      </div>
                      <select
                        value={settings.deepSeekModel || 'deepseek-chat'}
                        onChange={(e) => updateSetting('deepSeekModel', e.target.value)}
                        className="settings-select"
                      >
                        <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                        <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
                      </select>
                    </div>
                  </section>
                )}

                {/* OpenAI Configuration */}
                {settings.activeProvider === 'openai' && (
                  <section style={{ marginTop: '24px', animation: 'fadeIn 0.3s' }}>
                    <h3>OpenAI Configuration</h3>
                    <div className="settings-row">
                      <div className="row-info">
                        <div className="row-label">API Key</div>
                        <div className="row-hint">
                          Requires GPT-4o access (starts with sk-...).
                        </div>
                      </div>
                      <input
                        type="password"
                        className="settings-select"
                        style={{ width: '240px' }}
                        value={settings.openaiKey || ''}
                        onChange={(e) => updateSetting('openaiKey', e.target.value.trim() || null)}
                        placeholder="sk-..."
                      />
                    </div>
                  </section>
                )}

                {/* Anthropic Configuration */}
                {settings.activeProvider === 'anthropic' && (
                  <section style={{ marginTop: '24px', animation: 'fadeIn 0.3s' }}>
                    <h3>Anthropic Configuration</h3>
                    <div className="settings-row">
                      <div className="row-info">
                        <div className="row-label">API Key</div>
                        <div className="row-hint">
                          Claude 3.5 Sonnet key (starts with sk-ant-...).
                        </div>
                      </div>
                      <input
                        type="password"
                        className="settings-select"
                        style={{ width: '240px' }}
                        value={settings.anthropicKey || ''}
                        onChange={(e) => updateSetting('anthropicKey', e.target.value.trim() || null)}
                        placeholder="sk-ant-..."
                      />
                    </div>
                  </section>
                )}

                {/* Ollama Configuration */}
                {settings.activeProvider === 'ollama' && (
                  <section style={{ marginTop: '24px', animation: 'fadeIn 0.3s' }}>
                    <h3>Ollama Local AI</h3>
                    <div className="settings-row">
                      <div className="row-info">
                        <div className="row-label">Server URL</div>
                        <div className="row-hint">
                          Default is http://localhost:11434/api/chat
                        </div>
                      </div>
                      <input
                        type="text"
                        className="settings-select"
                        style={{ width: '240px' }}
                        value={settings.ollamaUrl || 'http://localhost:11434/api/chat'}
                        onChange={(e) => updateSetting('ollamaUrl', e.target.value.trim())}
                        placeholder="http://localhost:11434..."
                      />
                    </div>
                  </section>
                )}

                <section style={{ marginTop: '32px' }}>
                  <h3>Image Generation (Hugging Face)</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">API Key</div>
                      <div className="row-hint">
                        Required for image generation commands.
                      </div>
                    </div>
                    <input
                      type="password"
                      className="settings-select"
                      style={{ width: '240px' }}
                      value={settings.huggingFaceKey || ''}
                      onChange={(e) => updateSetting('huggingFaceKey', e.target.value.trim() || null)}
                      placeholder="hf_..."
                    />
                  </div>
                </section>

                <section>
                  <h3>Local Features</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Semantic Indexing</div>
                      <div className="row-hint">
                        Enable RAG context for current provider.
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
                    <button className="btn" onClick={handleOpenTheme}>
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
                      <div className="row-label">Caret Style</div>
                      <div className="row-hint">Customize the caret appearance (smooth, block, or sharp).</div>
                    </div>
                    <select
                      value={caretStyle || 'smooth'}
                      onChange={(e) => updateCaretStyle(e.target.value)}
                      className="settings-select"
                    >
                      <option value="smooth">Smooth Line</option>
                      <option value="block">Block</option>
                      <option value="sharp">Sharp Line</option>
                    </select>
                  </div>
                  {/* Caret Width Control */}
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Caret Width</div>
                      <div className="row-hint">Adjust the caret width (1px - 10px).</div>
                    </div>
                    <div className="range-wrap">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={parseInt(caretWidth, 10) || 2}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10)
                          // Validate range before updating
                          if (!isNaN(value) && value >= 1 && value <= 10) {
                            updateCaretWidth(value)
                          }
                        }}
                        aria-label="Caret width slider"
                      />
                      <span>{parseInt(caretWidth, 10) || 2}px</span>
                    </div>
                  </div>
                  {/* Caret Color Control */}
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Caret Color</div>
                      <div className="row-hint">Enter hex color (with or without #, e.g., "000000" or "#ffffff"). Leave empty for theme accent.</div>
                    </div>
                    <div className="caret-color-controls">
                      <div className="caret-color-input-wrapper">
                        <span className="caret-color-hash">#</span>
                        <input
                          type="text"
                          value={caretColor ? caretColor.replace(/^#/, '') : ''}
                          onChange={(e) => {
                            let value = e.target.value.trim()
                            // Remove # if user types it
                            value = value.replace(/^#/, '')
                            // Only allow hex characters (0-9, A-F, a-f)
                            value = value.replace(/[^0-9A-Fa-f]/g, '')
                            // Limit to 6 characters
                            if (value.length > 6) value = value.slice(0, 6)
                            
                            // Update if valid hex (empty or 3 or 6 chars)
                            if (value === '' || /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(value)) {
                              const finalColor = value === '' ? '' : `#${value}`
                              updateCaretColor(finalColor)
                            }
                          }}
                          placeholder="ffffff"
                          className="caret-color-input"
                          title="Enter hex color (e.g., 000000 or ffffff)"
                          aria-label="Caret color input"
                          maxLength={6}
                        />
                      </div>
                      <button
                        onClick={() => updateCaretColor('')}
                        className="caret-color-reset"
                        title="Reset to theme accent color"
                        aria-label="Reset caret color to theme default"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Use Border-left Caret</div>
                      <div className="row-hint">Toggle using CSS `border-left` for the caret instead of a filled bar.</div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={(settings.cursor && settings.cursor.useBorderLeft) ?? true}
                        onChange={(e) => {
                          const next = { ...(settings.cursor || {}), useBorderLeft: e.target.checked }
                          updateSetting('cursor', next)
                        }}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Mirror Mode</div>
                      <div className="row-hint">
                        Enable Glassmorphism / Reflections for sidebars and panels. Premium aesthetic.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={settings.mirrorMode}
                        onChange={(e) => updateSetting('mirrorMode', e.target.checked)}
                      />
                      <span className="slider round"></span>
                    </label>
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
                    <div className="row-info">Toggle Left Sidebar</div>
                    <div className="shortcut-badge">Ctrl + B</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Toggle Inspector</div>
                    <div className="shortcut-badge">Ctrl + I</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Graph View</div>
                    <div className="shortcut-badge">Ctrl + G</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Toggle Preview</div>
                    <div className="shortcut-badge">Ctrl + \</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Next Tab</div>
                    <div className="shortcut-badge">Ctrl + Tab</div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">Previous Tab</div>
                    <div className="shortcut-badge">Ctrl + Shift + Tab</div>
                  </div>
                </section>

                <section>
                  <h3>Editor</h3>
                  <div className="settings-row">
                    <div className="row-info">Inline AI</div>
                    <div className="shortcut-badge">Ctrl + K</div>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>

    </div>
  )
}

export default SettingsModal
