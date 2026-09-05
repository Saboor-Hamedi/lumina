/**
 * SettingColorPicker (Unified General Color Picker)
 * System color picker used in SettingsModal. Changing colors here affects app theming, notes, and carets.
 */
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from '../modals/ModalHeader'
import { useDraggableModal } from '../../core/utils/useDraggableModal'
import './SettingColorPicker.css'

const PRESET_PALETTE = [
  '#40bafa',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#ffffff'
]

const SettingColorPicker = ({
  isOpen,
  onClose,
  initialColor,
  defaultColor = '#40bafa',
  onSelect,
  previewProperty = null,
  title = 'Select Color'
}) => {
  const startColor = initialColor || defaultColor || '#40bafa'

  const [localColor, setLocalColor] = useState(() => {
    return startColor.startsWith('#') ? startColor : `#${startColor}`
  })

  const localColorRef = useRef(localColor)
  const initialColorRef = useRef(localColor)
  const { style: dragStyle, handleDragStart } = useDraggableModal()

  const handleCancel = () => {
    if (previewProperty && initialColorRef.current) {
      document.documentElement.style.setProperty(previewProperty, initialColorRef.current)
    }
    onClose()
  }

  useKeyboardShortcuts({ onEscape: handleCancel })

  useEffect(() => {
    if (!isOpen) return
    const col = initialColor || defaultColor || '#40bafa'
    const formatted = col.startsWith('#') ? col : `#${col}`
    setLocalColor(formatted)
    localColorRef.current = formatted
    initialColorRef.current = formatted
  }, [isOpen, initialColor, defaultColor])

  if (!isOpen) return null

  const updateColorDirectly = (hex) => {
    setLocalColor(hex)
    localColorRef.current = hex
    if (previewProperty && hex) {
      document.documentElement.style.setProperty(previewProperty, hex)
    }
  }

  const handleDone = () => {
    onSelect(localColorRef.current || defaultColor)
    onClose()
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
          {/* Curated Palette Grid */}
          <div className="color-modal-section">
            <div className="color-modal-section-title">CURATED PALETTE</div>
            <div className="color-picker-presets-grid">
              {PRESET_PALETTE.map((preset) => {
                const isSelected = localColor.toLowerCase() === preset.toLowerCase()
                return (
                  <div
                    key={preset}
                    onClick={() => updateColorDirectly(preset)}
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
                        color={preset.toLowerCase() === '#10b981' ? '#ffffff' : '#10b981'}
                        strokeWidth={3.5}
                        style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.6))' }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Hex Color Code Input */}
          <div className="color-modal-section">
            <div className="color-modal-section-title">HEX COLOR CODE</div>
            <div className="color-picker-hex-wrapper">
              <span className="color-picker-hex-prefix">#</span>
              <input
                type="text"
                className="color-picker-hex-input"
                value={localColor.replace('#', '')}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, '')
                  const formatted = clean ? `#${clean}` : ''
                  setLocalColor(formatted)
                  localColorRef.current = formatted
                  if (previewProperty && (clean.length === 6 || clean.length === 3)) {
                    document.documentElement.style.setProperty(previewProperty, formatted)
                  }
                }}
                maxLength={6}
                placeholder="40BAFA"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="color-picker-modal-actions">
            <button
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

export default SettingColorPicker
