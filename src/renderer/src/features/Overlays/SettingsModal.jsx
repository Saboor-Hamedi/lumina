import React, { useState, useEffect } from 'react'
import { X, Settings } from 'lucide-react'
import ThemeModal from './ThemeModal'
import ModalHeader from './ModalHeader'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useToast } from '../../core/hooks/useToast'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useFontSettings } from '../../core/hooks/useFontSettings'
import { useRef } from 'react'
import './SettingsModal.css'

const ColorPickerInput = ({ initialColor, defaultColor, onColorChange, title, ariaLabel }) => {
  const [localColor, setLocalColor] = useState(() => {
    return initialColor
      ? initialColor.startsWith('#')
        ? initialColor
        : `#${initialColor}`
      : defaultColor
  })
  const throttleRef = useRef(null)

  useEffect(() => {
    setLocalColor(
      initialColor
        ? initialColor.startsWith('#')
          ? initialColor
          : `#${initialColor}`
        : defaultColor
    )
  }, [initialColor, defaultColor])

  const handleChange = (e) => {
    const val = e.target.value
    setLocalColor(val)

    // Throttle the actual DOM/CSS variable update to ~30fps to avoid heavy layout thrashing
    if (!throttleRef.current) {
      throttleRef.current = setTimeout(() => {
        onColorChange(val)
        throttleRef.current = null
      }, 32)
    }
  }

  return (
    <div
      className="color-picker-wrapper"
      style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
    >
      <input
        type="color"
        value={localColor}
        onChange={handleChange}
        className="color-picker-input"
        title={title}
        aria-label={ariaLabel}
        style={{
          width: '40px',
          height: '40px',
          padding: '0',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          background: 'transparent'
        }}
      />
      <span style={{ fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-main)' }}>
        {localColor === defaultColor && !initialColor ? 'Default' : localColor.toUpperCase()}
      </span>
    </div>
  )
}

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
  const {
    caretWidth,
    caretColor,
    caretStyle,
    updateCaretWidth,
    updateCaretColor,
    updateCaretStyle,
    editorFontFamily,
    editorFontSize,
    updateEditorFontFamily,
    updateEditorFontSize,
    themeAccentColor,
    updateThemeAccentColor
  } = useFontSettings()

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
      <div
        className="modal-container settings-container premium-preview-card"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader title="Settings" icon={<Settings size={16} />} onClose={onClose} />

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
            <button
              className={`nav-item ${activeTab === 'type' ? 'active' : ''}`}
              onClick={() => setActiveTab('type')}
            >
              Typography
            </button>
            <button
              className={`nav-item ${activeTab === 'graph' ? 'active' : ''}`}
              onClick={() => setActiveTab('graph')}
            >
              Graph
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

            {activeTab === 'type' && (
              <div className="settings-pane">
                <section>
                  <h3>Font & Editor</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Font Family</div>
                      <div className="row-hint">The font used in the editor area.</div>
                    </div>
                    <select
                      value={editorFontFamily || settings.fontFamily || 'Inter'}
                      onChange={(e) => {
                        updateSetting('fontFamily', e.target.value)
                        updateEditorFontFamily(e.target.value)
                      }}
                      className="settings-select"
                    >
                      <option value="Inter">Inter (Default)</option>
                      <option value="Roboto">Roboto</option>
                      <option value="JetBrains Mono">JetBrains Mono</option>
                      <option value="Fira Code">Fira Code</option>
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
                        max="28"
                        step="1"
                        value={parseInt(editorFontSize) || settings.fontSize || 14}
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          updateSetting('fontSize', val)
                          updateEditorFontSize(val)
                        }}
                      />
                      <span>{parseInt(editorFontSize) || settings.fontSize || 14}px</span>
                    </div>
                  </div>
                </section>

                <section style={{ marginTop: '32px' }}>
                  <h3>Caret / Cursor</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Caret Style</div>
                      <div className="row-hint">
                        Customize the caret appearance (smooth, block, or sharp).
                      </div>
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
                          if (!isNaN(value) && value >= 1 && value <= 10) {
                            updateCaretWidth(value)
                          }
                        }}
                        aria-label="Caret width slider"
                      />
                      <span>{parseInt(caretWidth, 10) || 2}px</span>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Caret Color</div>
                      <div className="row-hint">Enter hex color. Leave empty for theme accent.</div>
                    </div>
                    <div className="caret-color-controls">
                      <ColorPickerInput
                        initialColor={caretColor}
                        defaultColor="#ffffff"
                        onColorChange={updateCaretColor}
                        title="Choose Caret Color"
                        ariaLabel="Caret color picker"
                      />
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
                      <div className="row-hint">
                        Toggle using CSS `border-left` for the caret instead of a filled bar.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={(settings.cursor && settings.cursor.useBorderLeft) ?? true}
                        onChange={(e) => {
                          const next = {
                            ...(settings.cursor || {}),
                            useBorderLeft: e.target.checked
                          }
                          updateSetting('cursor', next)
                        }}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>
                </section>

                <section style={{ marginTop: '32px' }}>
                  <h3>Typing Feedback</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Mechanical Keyboard Sound</div>
                      <div className="row-hint">
                        Play an ASMR-style mechanical click when typing.
                      </div>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={settings.typeSound || false}
                        onChange={(e) => updateSetting('typeSound', e.target.checked)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  {settings.typeSound && (
                    <div className="settings-row" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                      <div className="row-info">
                        <div className="row-label">Typing Volume</div>
                        <div className="row-hint">Adjust how loud the mechanical clicks are.</div>
                      </div>
                      <div className="range-wrap">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={settings.typeSoundVolume ?? 50}
                          onChange={(e) =>
                            updateSetting('typeSoundVolume', parseInt(e.target.value, 10))
                          }
                        />
                        <span>{settings.typeSoundVolume ?? 50}%</span>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeTab === 'graph' && (
              <div className="settings-pane">
                <section>
                  <h3>Graph Visualization</h3>

                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Node Size</div>
                      <div className="row-hint">
                        Adjust the size multiplier for all graph nodes.
                      </div>
                    </div>
                    <div className="range-wrap">
                      <input
                        type="range"
                        min="0.5"
                        max="3.0"
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
                        checked={
                          settings.graphShowTexts !== false && settings.graphShowTexts !== 'false'
                        }
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
                          (settings.graphNodeColor || '#40bafa').toLowerCase() ===
                          color.toLowerCase()
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
                        value={settings.deepSeekKey || ''}
                        onChange={(e) =>
                          updateSetting('deepSeekKey', e.target.value.trim() || null)
                        }
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
                        <div className="row-hint">Requires GPT-4o access (starts with sk-...).</div>
                      </div>
                      <input
                        type="password"
                        className="settings-select"
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
                        value={settings.anthropicKey || ''}
                        onChange={(e) =>
                          updateSetting('anthropicKey', e.target.value.trim() || null)
                        }
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
                        <div className="row-hint">Default is http://localhost:11434/api/chat</div>
                      </div>
                      <input
                        type="text"
                        className="settings-select"
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
                      <div className="row-hint">Required for image generation commands.</div>
                    </div>
                    <input
                      type="password"
                      className="settings-select"
                      value={settings.huggingFaceKey || ''}
                      onChange={(e) =>
                        updateSetting('huggingFaceKey', e.target.value.trim() || null)
                      }
                      placeholder="hf_..."
                    />
                  </div>
                </section>

                <section>
                  <h3>Local Features</h3>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Semantic Indexing</div>
                      <div className="row-hint">Enable RAG context for current provider.</div>
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
                  {/* Theme Accent Color Control */}
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Theme Accent Color</div>
                      <div className="row-hint">
                        Pick the app's accent color. Leave default for theme accent.
                      </div>
                    </div>
                    <div className="caret-color-controls">
                      <ColorPickerInput
                        initialColor={themeAccentColor}
                        defaultColor="#40bafa"
                        onColorChange={updateThemeAccentColor}
                        title="Choose Theme Accent Color"
                        ariaLabel="Theme accent color picker"
                      />
                      <button
                        onClick={() => updateThemeAccentColor('')}
                        className="caret-color-reset"
                        title="Reset to default theme color"
                        aria-label="Reset theme accent color to theme default"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="row-info">
                      <div className="row-label">Mirror Mode</div>
                      <div className="row-hint">
                        Enable Glassmorphism / Reflections for sidebars and panels. Premium
                        aesthetic.
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
