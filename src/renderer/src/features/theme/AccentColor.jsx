/**
 * AccentColor
 * System color picker used in TitleBar dropdown and Settings modal.
 * Directly customizes and live-previews application accent colors.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Check, RotateCcw } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from '../modals/ModalHeader'
import { useDraggableModal } from '../../core/utils/useDraggableModal'
import './css/accentcolor.css'

const PRESET_PALETTE = [
  '#40bafa', // Lumina Sky
  '#3b82f6', // Electric Blue
  '#2563eb', // Royal Blue
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#10b981', // Emerald
  '#22c55e', // Vibrant Green
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#ef4444', // Red
  '#f43f5e', // Rose
  '#ec4899', // Pink
  '#d946ef', // Fuchsia
  '#a855f7', // Purple
  '#8b5cf6', // Violet
  '#6366f1', // Indigo
  '#64748b', // Slate
  '#ffffff'  // Pure White
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

  const localColorRef = useRef(localColor)
  const initialColorRef = useRef(localColor)
  const dropdownRef = useRef(null)
  const hexInputRef = useRef(null)
  const { style: dragStyle, handleDragStart } = useDraggableModal()

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

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault()
        e.stopPropagation()
        handleEscape()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, handleEscape])

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
        }
      }
      if (persist) {
        onSelect?.(hex)
      }
    },
    [previewProperty, onSelect]
  )

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

        <div className="color-picker-presets-grid">
          {PRESET_PALETTE.map((preset) => {
            const isSelected = localColor.toLowerCase() === preset.toLowerCase()
            return (
              <button
                type="button"
                key={preset}
                onClick={() => applyColor(preset, true)}
                className={`color-picker-preset-item ${isSelected ? 'selected' : ''}`}
                style={{
                  backgroundColor: preset,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={preset}
              >
                {isSelected && (
                  <Check
                    size={15}
                    color={getContrastCheckColor(preset)}
                    strokeWidth={3.5}
                    style={{
                      filter:
                        getContrastCheckColor(preset) === '#ffffff'
                          ? 'drop-shadow(0px 1px 2px rgba(0,0,0,0.7))'
                          : 'none'
                    }}
                  />
                )}
              </button>
            )
          })}
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
        </div>
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
              {PRESET_PALETTE.map((preset) => {
                const isSelected = localColor.toLowerCase() === preset.toLowerCase()
                return (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => applyColor(preset, false)}
                    className={`color-picker-preset-item ${isSelected ? 'selected' : ''}`}
                    style={{
                      backgroundColor: preset,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={preset}
                  >
                    {isSelected && (
                      <Check
                        size={16}
                        color={getContrastCheckColor(preset)}
                        strokeWidth={3.5}
                        style={{
                          filter:
                            getContrastCheckColor(preset) === '#ffffff'
                              ? 'drop-shadow(0px 1px 2px rgba(0,0,0,0.7))'
                              : 'none'
                        }}
                      />
                    )}
                  </button>
                )
              })}
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
