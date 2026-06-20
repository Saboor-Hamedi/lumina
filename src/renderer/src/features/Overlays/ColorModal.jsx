import React from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { NOTE_COLORS } from '../../core/utils/noteColors'
import ModalHeader from './ModalHeader'
import './ColorModal.css'

const ColorModal = ({ isOpen, onClose, currentColor, onSelect }) => {
  useKeyboardShortcuts({ onEscape: onClose })
  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay color-modal-overlay" onClick={onClose}>
      <div className="color-modal-container" onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Note Color" onClose={onClose} />
        <div className="color-modal-grid">
          {NOTE_COLORS.map((c) => {
            const isActive = currentColor === c.hex
            return (
              <div
                key={c.hex || 'none'}
                className={`color-swatch-wrap ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelect(c.hex)
                  onClose()
                }}
                title={c.label}
              >
                <div
                  className="color-swatch"
                  style={{
                    background: c.hex ? `#${c.hex}` : 'var(--bg-panel)',
                    border: c.hex ? '2px solid transparent' : '2px dashed var(--border-main)'
                  }}
                >
                  {isActive && <Check size={14} className="color-swatch-check" />}
                  {!c.hex && <X size={12} className="color-swatch-none" />}
                </div>
                <span className="color-swatch-label">{c.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ColorModal
