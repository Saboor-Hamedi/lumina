import React, { useEffect, useState } from 'react'
import { Palette, Type, MousePointer, Check, RotateCcw } from 'lucide-react'
import { getTheme } from '../theme/hooks/themeDefinitions'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useFontSettings } from '../../core/hooks/useFontSettings'
import Toggle from '../../components/toggle'

const PRESET_PALETTE: readonly string[] = [
  '#2563eb',
  '#0284c7',
  '#0891b2',
  '#0d9488',
  '#059669',
  '#10b981',
  '#65a30d',
  '#ca8a04',
  '#d97706',
  '#ea580c',
  '#e11d48',
  '#f43f5e',
  '#db2777',
  '#c026d3',
  '#9333ea',
  '#7c3aed',
  '#6366f1',
  '#4f46e5',
  '#c2410c',
  '#475569'
]

export interface InlineColorPickerProps {
  value?: string
  defaultColor: string
  onChange: (color: string) => void
  onReset: () => void
  ariaLabel: string
}

export const InlineColorPicker: React.FC<InlineColorPickerProps> = ({
  value,
  defaultColor,
  onChange,
  onReset,
  ariaLabel
}) => {
  const displayColor = value
    ? value.startsWith('#')
      ? value
      : `#${value}`
    : ''
  const activeColor = displayColor || defaultColor
  const [hexLocal, setHexLocal] = useState(displayColor)

  useEffect(() => {
    setHexLocal(displayColor)
  }, [displayColor])

  return (
    <div className="inline-color-picker" role="group" aria-label={ariaLabel}>
      <div className="inline-color-swatches">
        {PRESET_PALETTE.map((preset) => {
          const isSelected = displayColor.toLowerCase() === preset.toLowerCase()
          return (
            <button
              key={preset}
              type="button"
              className={`inline-color-swatch${isSelected ? ' selected' : ''}`}
              style={{ backgroundColor: preset }}
              onClick={() => onChange(preset)}
              title={preset}
              aria-label={`Select ${preset}`}
            >
              {isSelected && (
                <span className="inline-color-swatch-badge">
                  <Check size={8} color="#ffffff" strokeWidth={3.5} />
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="inline-color-hex-row" title="Custom color (hex code, e.g. #ffffff)">
        <input
          className="inline-color-hex-input"
          type="text"
          spellCheck={false}
          maxLength={7}
          placeholder="#ffffff"
          value={hexLocal}
          aria-label={ariaLabel}
          onChange={(e) => {
            let clean = e.target.value.replace(/[^0-9A-Fa-f#]/g, '').slice(0, 7)
            if (clean && !clean.startsWith('#')) clean = `#${clean}`
            setHexLocal(clean)
            const hex = clean.replace('#', '')
            if (hex.length === 3 || hex.length === 6) {
              onChange(clean)
            }
          }}
        />
        <div
          className="inline-color-hex-preview"
          style={{ backgroundColor: activeColor }}
        />
        <button
          type="button"
          className="inline-color-reset"
          onClick={onReset}
          title="Reset to theme default"
          aria-label="Reset to theme default"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

export interface SettingLookAndFeelProps {
  onOpenTheme?: () => void
}

type LookSubTab = 'appearance' | 'typography' | 'cursor'

export const SettingLookAndFeel: React.FC<SettingLookAndFeelProps> = ({ onOpenTheme }) => {
  const { settings, updateSetting, resetToDefaults } = useSettingsStore()
  const currentThemeAccent = getTheme(settings.theme || 'light').colors['--text-accent'] || '#0284c7'
  const themeColors = getTheme(settings.theme || 'light').colors
  const currentCaretDefault = themeColors['--caret-color'] || currentThemeAccent
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
    updateThemeAccentColor
  } = useFontSettings()

  const handleOpenTheme = () => {
    if (onOpenTheme) {
      onOpenTheme()
    }
  }

  const currentFontSize = parseInt(
    String((settings as any).fontSize ?? editorFontSize ?? 12),
    10
  )
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
        <div className="settings-pane-actions">
          <button
            type="button"
            className="shortcuts-reset-all-btn"
            onClick={() => void resetToDefaults()}
            title="Reset settings to default"
          >
            <RotateCcw size={12} />
            <span>Reset to Defaults</span>
          </button>
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
              <Palette size={13} style={{ color: 'var(--text-accent)' }} />
              <span>Theme Gallery</span>
            </button>
          </div>

          <div className="settings-row">
            <div className="row-info">
              <div className="row-label">Theme Accent Color</div>
              <div className="row-hint">Custom highlight color.</div>
            </div>
            <div className="caret-color-controls">
              <InlineColorPicker
                value={themeAccentColor}
                defaultColor={currentThemeAccent}
                onChange={updateThemeAccentColor}
                onReset={() => updateThemeAccentColor('')}
                ariaLabel="Theme accent color picker"
              />
            </div>
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
              <option value="Inter">Inter</option>
              <option value="Vazirmatn">Vazirmatn (Arabic / Persian / Clean)</option>
              <option value="Roboto">Roboto</option>
              <option value="JetBrains Mono">JetBrains Mono (Default)</option>
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
              <InlineColorPicker
                value={caretColor}
                defaultColor={currentCaretDefault}
                onChange={updateCaretColor}
                onReset={() => updateCaretColor('')}
                ariaLabel="Caret color picker"
              />
            </div>
          </div>
        </section>

        <section style={{ marginTop: '28px' }}>
          <h3>Interface & Behavior</h3>

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
