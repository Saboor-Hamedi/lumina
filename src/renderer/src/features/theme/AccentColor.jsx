import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Check, RotateCcw } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import Profile from '../profile/Profile'
import ModalHeader from '../modals/ModalHeader'
import { useDraggableModal } from '../../core/utils/useDraggableModal'
import { useOpacity } from './hooks/useOpacity'
import { useSettingsStore } from '../../core/store/SettingStore'
import Toggle from '../../components/toggle'
import './css/accentcolor.css'
import '../../assets/toggle-theme.css'

const PRESET_PALETTE = [
  '#40bafa',
  '#3b82f6',
  '#2563eb',
  '#06b6d4',
  '#14b8a6',
  '#10b981',
  '#22c55e',
  '#84cc16',
  '#eab308',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#f43f5e',
  '#ec4899',
  '#d946ef',
  '#a855f7',
  '#8b5cf6',
  '#6366f1',
  '#64748b',
  '#ffffff'
]

const getContrastCheckColor = (hex) => {
  if (!hex) return '#ffffff'
  const clean = hex.replace('#', '')
  if (clean.length < 6) {
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16) || 0
      const g = parseInt(clean[1] + clean[1], 16) || 0
      const b = parseInt(clean[2] + clean[2], 16) || 0
      return (r * 299 + g * 587 + b * 114) / 1000 >= 160 ? '#09090b' : '#ffffff'
    }
    return '#ffffff'
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0
  const g = parseInt(clean.substring(2, 4), 16) || 0
  const b = parseInt(clean.substring(4, 6), 16) || 0
  return (r * 299 + g * 587 + b * 114) / 1000 >= 160 ? '#09090b' : '#ffffff'
}

const PresetSwatch = React.memo(({ preset, isSelected, isFocused, onClick, contrastColor }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`color-picker-preset-item ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`.trim()}
      style={{
        backgroundColor: preset,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      title={preset}
    >
      {isSelected && (
        <span
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.45)',
            flexShrink: 0
          }}
        >
          <Check
            size={8}
            color="#ffffff"
            strokeWidth={3.5}
          />
        </span>
      )}
    </button>
  )
})

const VerticalOpacitySlider = React.memo(({ percentage, onInput, onChange }) => {
  return (
    <div className="accent-vertical-slider-track-wrap" title={`App Transparency: ${percentage}%`}>
      <input
        type="range"
        min="70"
        max="100"
        step="1"
        value={percentage}
        onInput={onInput}
        onChange={onChange}
        className="lumina-vertical-range-slider"
        aria-label="App Transparency"
      />
    </div>
  )
})

const QuickControls = React.memo(
  ({
    enableDevTools,
    launchOnStartup,
    modernUi,
    onToggleDevTools,
    onToggleStartup,
    onToggleModernUi
  }) => {
    return (
      <div className="accent-dropdown-section">
        <div className="accent-dropdown-section-header">
          <span className="accent-dropdown-title">Quick Controls</span>
        </div>

        <div className="quick-controls-grid">
          <div className="quick-control-col" onClick={() => onToggleDevTools()}>
            <span className="quick-control-label">DevTools</span>
            <Toggle
              checked={enableDevTools}
              onChange={(e) => onToggleDevTools(e.target.checked)}
            />
          </div>

          <div className="quick-control-col" onClick={() => onToggleStartup()}>
            <span className="quick-control-label">Startup</span>
            <Toggle
              checked={launchOnStartup}
              onChange={(e) => onToggleStartup(e.target.checked)}
            />
          </div>

          <div className="quick-control-col" onClick={() => onToggleModernUi()}>
            <span className="quick-control-label">Modern UI</span>
            <Toggle
              checked={modernUi}
              onChange={(e) => onToggleModernUi(e.target.checked)}
            />
          </div>
        </div>
      </div>
    )
  }
)

export const AccentColor = ({
  isOpen,
  onClose,
  initialColor,
  defaultColor = '#40bafa',
  onSelect,
  previewProperty = null,
  title = 'Accent Color',
  variant = 'modal'
}) => {
  const startColor = useMemo(
    () => initialColor || defaultColor || '#40bafa',
    [initialColor, defaultColor]
  )

  const [localColor, setLocalColor] = useState(() => {
    return startColor.startsWith('#') ? startColor : `#${startColor}`
  })
  const [focusedIndex, setFocusedIndex] = useState(() => {
    const col = startColor
    const idx = PRESET_PALETTE.findIndex((p) => p.toLowerCase() === col.toLowerCase())
    return idx !== -1 ? idx : 0
  })

  const localColorRef = useRef(localColor)
  const initialColorRef = useRef(localColor)
  const dropdownRef = useRef(null)
  const hexInputRef = useRef(null)
  const { style: dragStyle, handleDragStart } = useDraggableModal()
  const { percentage, setOpacity } = useOpacity()
  const enableDevTools = useSettingsStore((s) => s.settings?.enableDevTools ?? true)
  const launchOnStartup = useSettingsStore((s) => s.settings?.launchOnStartup ?? false)
  const modernUi = useSettingsStore((s) => s.settings?.modernUi ?? false)
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  const handleCancel = useCallback(() => {
    if (previewProperty && initialColorRef.current) {
      document.documentElement.style.setProperty(previewProperty, initialColorRef.current)
    }
    onClose?.()
  }, [previewProperty, onClose])

  const handleEscape = useCallback(() => {
    if (variant === 'dropdown') {
      onClose?.()
    } else {
      handleCancel()
    }
  }, [variant, onClose, handleCancel])

  useKeyboardShortcuts({ onEscape: isOpen ? handleEscape : null })

  // Synchronize focusedIndex with active color when opening
  useEffect(() => {
    if (isOpen) {
      const col = localColor || initialColor || defaultColor || '#40bafa'
      const idx = PRESET_PALETTE.findIndex((p) => p.toLowerCase() === col.toLowerCase())
      setFocusedIndex(idx !== -1 ? idx : 0)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const col = initialColor || defaultColor || '#40bafa'
    const formatted = col.startsWith('#') ? col : `#${col}`
    setLocalColor(formatted)
    localColorRef.current = formatted
    initialColorRef.current = formatted
  }, [isOpen, initialColor, defaultColor])

  useEffect(() => {
    if (!isOpen || variant !== 'dropdown') return
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        if (e.target.closest && e.target.closest('.accent-titlebar-btn')) {
          return
        }
        onClose?.()
      }
    }
    document.addEventListener('pointerdown', handleClickOutside, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, { capture: true })
    }
  }, [isOpen, variant, onClose])

  const themeChangedTimerRef = useRef(null)

  const applyColor = useCallback(
    (hex, persist = false) => {
      setLocalColor(hex)
      localColorRef.current = hex
      if (previewProperty && hex) {
        document.documentElement.style.setProperty(previewProperty, hex)
        if (previewProperty === '--text-accent') {
          const clean = hex.replace('#', '')
          if (clean.length === 6) {
            const r = parseInt(clean.substring(0, 2), 16)
            const g = parseInt(clean.substring(2, 4), 16)
            const b = parseInt(clean.substring(4, 6), 16)
            document.documentElement.style.setProperty('--text-accent-rgb', `${r}, ${g}, ${b}`)
          } else if (clean.length === 3) {
            const r = parseInt(clean[0] + clean[0], 16)
            const g = parseInt(clean[1] + clean[1], 16)
            const b = parseInt(clean[2] + clean[2], 16)
            document.documentElement.style.setProperty('--text-accent-rgb', `${r}, ${g}, ${b}`)
          }
          // Debounce: notify mermaid once after the user stops picking colors
          if (themeChangedTimerRef.current) clearTimeout(themeChangedTimerRef.current)
          themeChangedTimerRef.current = setTimeout(() => {
            window.dispatchEvent(new CustomEvent('theme-changed'))
          }, 300)
        }
      }
      if (persist) {
        onSelect?.(hex)
      }
    },
    [previewProperty, onSelect]
  )

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      // If typing in the hex text input, allow normal cursor movement and typing
      if (document.activeElement === hexInputRef.current) {
        if (e.key === 'Escape' || e.key === 'Esc') {
          e.preventDefault()
          e.stopPropagation()
          handleEscape()
        }
        return
      }

      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault()
        e.stopPropagation()
        handleEscape()
        return
      }

      const total = PRESET_PALETTE.length // 20
      const cols = 5

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        setFocusedIndex((prev) => (prev + 1) % total)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        setFocusedIndex((prev) => (prev - 1 + total) % total)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setFocusedIndex((prev) => (prev + cols) % total)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setFocusedIndex((prev) => (prev - cols + total) % total)
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        if (focusedIndex >= 0 && focusedIndex < total) {
          const selectedPreset = PRESET_PALETTE[focusedIndex]
          const isDropdown = variant === 'dropdown'
          applyColor(selectedPreset, isDropdown)
          // Do NOT close dropdown on Enter; user can keep moving with arrow keys
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, handleEscape, focusedIndex, variant, applyColor])

  const contrastMap = useMemo(() => {
    const map = {}
    for (let i = 0; i < PRESET_PALETTE.length; i++) {
      const p = PRESET_PALETTE[i]
      map[p] = getContrastCheckColor(p)
    }
    return map
  }, [])

  const handleOpacityInput = useCallback((e) => {
    setOpacity(parseInt(e.target.value, 10))
  }, [setOpacity])

  const handleOpacityChange = useCallback((e) => {
    setOpacity(parseInt(e.target.value, 10))
  }, [setOpacity])

  const handleToggleDevTools = useCallback((val) => {
    const next = typeof val === 'boolean' ? val : !enableDevTools
    updateSetting('enableDevTools', next)
  }, [enableDevTools, updateSetting])

  const handleToggleStartup = useCallback((val) => {
    const next = typeof val === 'boolean' ? val : !launchOnStartup
    updateSetting('launchOnStartup', next)
  }, [launchOnStartup, updateSetting])

  const handleToggleModernUi = useCallback((val) => {
    const next = typeof val === 'boolean' ? val : !modernUi
    updateSetting('modernUi', next)
  }, [modernUi, updateSetting])

  const renderedPresets = useMemo(() => {
    const isDropdown = variant === 'dropdown'
    return PRESET_PALETTE.map((preset, index) => {
      const isSelected = localColor.toLowerCase() === preset.toLowerCase()
      const isFocused = focusedIndex === index
      return (
        <PresetSwatch
          key={preset}
          preset={preset}
          isSelected={isSelected}
          isFocused={isFocused}
          onClick={() => {
            setFocusedIndex(index)
            applyColor(preset, isDropdown)
          }}
          contrastColor={contrastMap[preset]}
        />
      )
    })
  }, [localColor, applyColor, variant, contrastMap, focusedIndex])

  if (!isOpen) return null

  const handleDone = () => {
    onSelect?.(localColorRef.current || defaultColor)
    onClose?.()
  }

  const handleReset = () => {
    applyColor(defaultColor, true)
  }

  if (variant === 'dropdown') {
    return (
      <div className="accent-dropdown-menu" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        <Profile
          accentColor={localColor || defaultColor}
          onActionComplete={onClose}
          style={{ border: 'none', background: 'transparent', height: '32px' }}
        />

        <div className="accent-dropdown-divider" />

        <div className="accent-dropdown-header">
          <span className="accent-dropdown-title">{title}</span>
          <button
            type="button"
            className="accent-dropdown-reset"
            onClick={handleReset}
            title="Reset to default accent color"
          >
            <RotateCcw size={12} className="accent-reset-icon" />
            <span>Reset</span>
          </button>
        </div>

        <div className="accent-palette-with-slider">
          <div className="color-picker-presets-grid">
            {renderedPresets}
          </div>
          <VerticalOpacitySlider
            percentage={percentage}
            onInput={handleOpacityInput}
            onChange={handleOpacityChange}
          />
        </div>

        <div className="color-picker-hex-wrapper">
          <span className="color-picker-hex-prefix">#</span>
          <input
            ref={hexInputRef}
            type="text"
            className="color-picker-hex-input"
            value={localColor.replace('#', '')}
            onChange={(e) => {
              const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6)
              const formatted = clean ? `#${clean}` : ''
              setLocalColor(formatted)
              localColorRef.current = formatted
              if (clean.length === 6 || clean.length === 3) {
                applyColor(formatted, true)
              }
            }}
            maxLength={6}
            placeholder="40BAFA"
            spellCheck={false}
          />
          <div
            className="color-picker-hex-preview"
            style={{ backgroundColor: localColor || defaultColor }}
          />
        </div>

        <div className="accent-dropdown-divider" />

        <QuickControls
          enableDevTools={enableDevTools}
          launchOnStartup={launchOnStartup}
          modernUi={modernUi}
          onToggleDevTools={handleToggleDevTools}
          onToggleStartup={handleToggleStartup}
          onToggleModernUi={handleToggleModernUi}
        />
      </div>
    )
  }

  return createPortal(
    <div className="modal-overlay color-modal-overlay" onClick={handleCancel}>
      <div className="color-modal-container" onClick={(e) => e.stopPropagation()} style={dragStyle}>
        <ModalHeader
          title={title || 'Select Color'}
          onClose={handleCancel}
          onMouseDown={handleDragStart}
          style={{ cursor: 'grab' }}
        />

        <div className="color-modal-body">
          <div className="color-modal-section">
            <div className="color-modal-section-title">CURATED PALETTE</div>
            <div className="color-picker-presets-grid">
              {renderedPresets}
            </div>
          </div>

          <div className="color-modal-section">
            <div className="color-modal-section-title">HEX COLOR CODE</div>
            <div className="color-picker-hex-wrapper">
              <span className="color-picker-hex-prefix">#</span>
              <input
                type="text"
                className="color-picker-hex-input"
                value={localColor.replace('#', '')}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6)
                  const formatted = clean ? `#${clean}` : ''
                  setLocalColor(formatted)
                  localColorRef.current = formatted
                  if (clean.length === 6 || clean.length === 3) {
                    applyColor(formatted, false)
                  }
                }}
                maxLength={6}
                placeholder="40BAFA"
                spellCheck={false}
              />
              <div
                className="color-picker-hex-preview"
                style={{ backgroundColor: localColor || defaultColor }}
              />
            </div>
          </div>

          <div className="color-picker-modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDone}
              style={{ width: '100%', fontSize: '12px', padding: '7px 0', fontWeight: '600' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default AccentColor
