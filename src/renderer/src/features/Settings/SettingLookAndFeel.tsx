import React, { useState } from 'react'
import { Palette, Type, MousePointer } from 'lucide-react'
import AccentColor from '../theme/AccentColor'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useFontSettings } from '../../core/hooks/useFontSettings'
import Toggle from '../../components/toggle'

export interface ColorPickerInputProps {
  initialColor?: string
  defaultColor: string
  onColorChange: (color: string) => void
  previewProperty: string
  title: string
  ariaLabel: string
}

export const ColorPickerInput: React.FC<ColorPickerInputProps> = ({
  initialColor,
  defaultColor,
  onColorChange,
  previewProperty,
  title,
  ariaLabel
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const displayColor = initialColor
    ? initialColor.startsWith('#')
      ? initialColor
      : `#${initialColor}`
    : defaultColor

  return (
    <>
      <div
        className="caret-color-reset"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(true)
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '28px',
          padding: '1px',
          cursor: 'pointer',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
        title={title}
        aria-label={ariaLabel}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: displayColor,
            borderRadius: '3px',
            boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.15)'
          }}
        />
      </div>

      <AccentColor
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialColor={displayColor}
        defaultColor={defaultColor}
        onSelect={onColorChange}
        previewProperty={previewProperty}
        title={title}
      />
    </>
  )
}

export interface SettingLookAndFeelProps {
  onOpenTheme?: () => void
}

type LookSubTab = 'appearance' | 'typography' | 'cursor'

export const SettingLookAndFeel: React.FC<SettingLookAndFeelProps> = ({ onOpenTheme }) => {
  const { settings, updateSetting } = useSettingsStore()
  const [activeSubTab, setActiveSubTab] = useState<LookSubTab>('appearance')

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
    updateThemeAccentColor,
    useBorderLeft,
    updateUseBorderLeft
  } = useFontSettings()

  const handleOpenTheme = () => {
    if (onOpenTheme) {
      onOpenTheme()
    }
  }

  const currentFontSize = parseInt(String(editorFontSize || settings.fontSize || 14), 10)
  const currentCaretWidth = parseInt(String(caretWidth || 2), 10)

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <div className="settings-pane-header-info">
          <h2 className="settings-pane-title">Look & Feel</h2>
          <p className="settings-pane-subtitle">
            Theme accents, typography styles, cursor physics, and sound preferences.
          </p>
        </div>
      </div>

      {/* Segmented Sub-tabs */}
      <div className="settings-subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'appearance'}
          className={`settings-subtab ${activeSubTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('appearance')}
        >
          <Palette size={13} />
          <span>Theme & Accent</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'typography'}
          className={`settings-subtab ${activeSubTab === 'typography' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('typography')}
        >
          <Type size={13} />
          <span>Typography</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === 'cursor'}
          className={`settings-subtab ${activeSubTab === 'cursor' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('cursor')}
        >
          <MousePointer size={13} />
          <span>Cursor & Sound</span>
        </button>
      </div>

      {/* ── Sub-Tab 1: Appearance & Accent ── */}
      <div style={{ display: activeSubTab === 'appearance' ? 'block' : 'none' }}>
        <section>
          <h3>Appearance</h3>
          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Base Theme</div>
              <div className="row-hint">Color themes and palette gallery.</div>
            </div>
            <button className="btn btn-secondary" onClick={handleOpenTheme} type="button">
              Theme Gallery
            </button>
          </div>

          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Theme Accent Color</div>
              <div className="row-hint">Custom highlight color.</div>
            </div>
            <div className="caret-color-controls">
              <ColorPickerInput
                initialColor={themeAccentColor}
                defaultColor="#40bafa"
                onColorChange={updateThemeAccentColor}
                previewProperty="--text-accent"
                title="Choose Theme Accent Color"
                ariaLabel="Theme accent color picker"
              />
              <button
                type="button"
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
              <div className="row-label">Note Title Input</div>
              <div className="row-hint">Show editable title field inside the note editor.</div>
            </div>
            <Toggle
              checked={settings.inlineTitle !== false}
              onChange={(e) => updateSetting('inlineTitle', e.target.checked)}
            />
          </div>

          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Editor Action Buttons</div>
              <div className="row-hint">Show quick tool buttons inside the editor header.</div>
            </div>
            <Toggle
              checked={settings.inlineMetadata !== false}
              onChange={(e) => updateSetting('inlineMetadata', e.target.checked)}
            />
          </div>
        </section>
      </div>

      {/* ── Sub-Tab 2: Typography & Fonts ── */}
      <div style={{ display: activeSubTab === 'typography' ? 'block' : 'none' }}>
        <section>
          <h3>Typography</h3>
          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Font Family</div>
              <div className="row-hint">Font face used across note editing surfaces.</div>
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
              <option value="Vazirmatn">Vazirmatn (Arabic / Persian / Clean)</option>
              <option value="Roboto">Roboto</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Fira Code">Fira Code</option>
              <option value="System Default">System Default</option>
            </select>
          </div>

          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Font Size</div>
              <div className="row-hint">Text scale in pixels.</div>
            </div>
            <div className="range-wrap">
              <input
                type="range"
                min="12"
                max="28"
                step="1"
                value={currentFontSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10)
                  updateSetting('fontSize', val)
                  updateEditorFontSize(val)
                }}
              />
              <span>{currentFontSize}px</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Auto-Save</div>
              <div className="row-hint">Save content changes automatically as you type.</div>
            </div>
            <Toggle
              checked={settings.autoSave}
              onChange={(e) => updateSetting('autoSave', e.target.checked)}
            />
          </div>
        </section>
      </div>

      {/* ── Sub-Tab 3: Cursor & Sound ── */}
      <div style={{ display: activeSubTab === 'cursor' ? 'block' : 'none' }}>
        <section>
          <h3>Caret & Cursor</h3>
          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Caret Style</div>
              <div className="row-hint">Cursor animation shape and behavior.</div>
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
              <div className="row-hint">Cursor thickness (1px to 10px).</div>
            </div>
            <div className="range-wrap">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={currentCaretWidth}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10)
                  if (!isNaN(value) && value >= 1 && value <= 10) {
                    updateCaretWidth(value)
                  }
                }}
                aria-label="Caret width slider"
              />
              <span>{currentCaretWidth}px</span>
            </div>
          </div>

          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Caret Color</div>
              <div className="row-hint">Custom cursor color. Leave empty for theme accent.</div>
            </div>
            <div className="caret-color-controls">
              <ColorPickerInput
                initialColor={caretColor}
                defaultColor="#ffffff"
                onColorChange={updateCaretColor}
                previewProperty="--caret-color"
                title="Choose Caret Color"
                ariaLabel="Caret color picker"
              />
              <button
                type="button"
                onClick={() => updateCaretColor('')}
                className="caret-color-reset"
                title="Reset to theme accent color"
                aria-label="Reset caret color to theme default"
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        <section style={{ marginTop: '28px' }}>
          <h3>Interface & Behavior</h3>

          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Active Line Left Border</div>
              <div className="row-hint">
                Show a colored left border on the line where the cursor is currently placed.
              </div>
            </div>
            <Toggle
              checked={useBorderLeft ?? ((settings.cursor && settings.cursor.useBorderLeft) ?? true)}
              onChange={(e) => {
                const checked = e.target.checked
                if (typeof updateUseBorderLeft === 'function') {
                  updateUseBorderLeft(checked)
                }
                const next = {
                  ...(settings.cursor || {}),
                  useBorderLeft: checked
                }
                updateSetting('cursor', next)
              }}
            />
          </div>

          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Mechanical Keyboard Sound</div>
              <div className="row-hint">Play tactile mechanical audio feedback when typing.</div>
            </div>
            <Toggle
              checked={settings.typeSound || false}
              onChange={(e) => updateSetting('typeSound', e.target.checked)}
            />
          </div>

          {settings.typeSound && (
            <div className="settings-row" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <div className="row-info">
                <div className="row-label">Typing Volume</div>
                <div className="row-hint">Sound effects volume level.</div>
              </div>
              <div className="range-wrap">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.typeSoundVolume ?? 50}
                  onChange={(e) => updateSetting('typeSoundVolume', parseInt(e.target.value, 10))}
                />
                <span>{settings.typeSoundVolume ?? 50}%</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default React.memo(SettingLookAndFeel)
