import React, { useState } from 'react'
import SettingColorPicker from './SettingColorPicker'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useFontSettings } from '../../core/hooks/useFontSettings'

export const ColorPickerInput = ({
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

      <SettingColorPicker
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

const SettingLookAndFeel = ({ onOpenTheme }) => {
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

  const handleOpenTheme = () => {
    if (onOpenTheme) {
      onOpenTheme()
    }
  }

  return (
    <div className="settings-pane">
      <section>
        <h3>Appearance</h3>
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
              previewProperty="--text-accent"
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
        <h3>Caret & Cursor</h3>
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
              previewProperty="--caret-color"
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
      </section>

      <section style={{ marginTop: '32px' }}>
        <h3>Interface & Behavior</h3>

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
              Enable Acrylic backdrop blur (Windows 11). Requires restart for best results.
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

        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Active Line Left Border</div>
            <div className="row-hint">
              Show a colored left border on the line where the cursor is currently placed.
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

        <div className="settings-row">
          <div className="row-info">
            <div className="row-label">Mechanical Keyboard Sound</div>
            <div className="row-hint">Play an ASMR-style mechanical click when typing.</div>
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
                onChange={(e) => updateSetting('typeSoundVolume', parseInt(e.target.value, 10))}
              />
              <span>{settings.typeSoundVolume ?? 50}%</span>
            </div>
          </div>
        )}

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
            <div className="row-hint">Show tags and properties bar inside the editor.</div>
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
  )
}

export default React.memo(SettingLookAndFeel)
