import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from './ModalHeader'
import './ColorPickerModal.css'

const hexToRgb = (hex) => {
  const clean = (hex || '').replace('#', '')
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16)
  return isNaN(bigint)
    ? { r: 0, g: 0, b: 0 }
    : {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
      }
}

const rgbToHex = (r, g, b) => {
  const clamp = (v) => Math.max(0, Math.min(255, isNaN(v) ? 0 : v))
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  )
}

const PRESET_PALETTE = [
  '#40bafa', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#06b6d4', '#ffffff'
]

const ColorPickerModal = ({ isOpen, onClose, initialColor, defaultColor = '#40bafa', onSelect, title = 'Select Color' }) => {
  const [localColor, setLocalColor] = useState(() => {
    const col = initialColor || defaultColor
    return col.startsWith('#') ? col : `#${col}`
  })
  const localColorRef = useRef(localColor)

  useKeyboardShortcuts({ onEscape: onClose })

  useEffect(() => {
    if (!isOpen) return
    const col = initialColor || defaultColor
    const formatted = col.startsWith('#') ? col : `#${col}`
    setLocalColor(formatted)
    localColorRef.current = formatted
  }, [isOpen, initialColor, defaultColor])

  if (!isOpen) return null

  const updateColorDirectly = (hex) => {
    setLocalColor(hex)
    localColorRef.current = hex
    onSelect(hex)
  }

  const rgb = hexToRgb(localColor)

  return createPortal(
    <div className="modal-overlay color-picker-modal-overlay" onClick={onClose}>
      <div className="color-picker-modal-container" onClick={(e) => e.stopPropagation()}>
        <ModalHeader title={title} onClose={onClose} />

        <div className="color-picker-modal-body">
          {/* Presets Grid */}
          <div className="color-picker-section">
            <div className="color-picker-section-title">CURATED PALETTE</div>
            <div className="color-picker-presets-grid">
              {PRESET_PALETTE.map((preset) => {
                const isSelected = localColor.toLowerCase() === preset.toLowerCase()
                return (
                  <div
                    key={preset}
                    onClick={() => updateColorDirectly(preset)}
                    className={`color-picker-preset-item ${isSelected ? 'selected' : ''}`}
                    style={{ backgroundColor: preset }}
                    title={preset}
                  />
                )
              })}
            </div>
          </div>

          {/* Hex Input */}
          <div className="color-picker-section">
            <div className="color-picker-section-title">HEX COLOR CODE</div>
            <div className="color-picker-hex-wrapper">
              <span className="color-picker-hex-prefix">#</span>
              <input
                type="text"
                className="color-picker-hex-input"
                value={localColor.replace('#', '')}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9A-Fa-f]/g, '')
                  const formatted = `#${clean}`
                  setLocalColor(formatted)
                  localColorRef.current = formatted
                  if (clean.length === 6 || clean.length === 3) {
                    onSelect(formatted)
                  }
                }}
                maxLength={6}
                placeholder="40BAFA"
              />
            </div>
          </div>

          {/* RGB Channels */}
          <div className="color-picker-section">
            <div className="color-picker-section-title">RGB CHANNELS</div>
            <div className="color-picker-rgb-grid">
              {['r', 'g', 'b'].map((channel) => (
                <div key={channel} className="color-picker-rgb-channel">
                  <input
                    type="number"
                    min="0"
                    max="255"
                    className="color-picker-rgb-input"
                    value={rgb[channel]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0
                      const newRgb = { ...rgb, [channel]: val }
                      const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
                      updateColorDirectly(hex)
                    }}
                  />
                  <span className="color-picker-rgb-label">{channel}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="color-picker-modal-actions">
            <button
              className="btn btn-primary"
              onClick={onClose}
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

export default ColorPickerModal
