import React, { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from '../Overlays/ModalHeader'
import { EMOJI_INDEX } from './icons'
import './IconModal.css'

const IconModal = ({ isOpen, onClose, currentIcon, onSelect }) => {
  const [search, setSearch] = useState('')
  useKeyboardShortcuts({ onEscape: onClose })

  // Dragging state
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 })

  const handleDragStart = useCallback(
    (e) => {
      if (e.button !== 0) return // Only left click
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const startTop = modalPosition.top
      const startLeft = modalPosition.left

      const handleMouseMove = (moveEvent) => {
        setModalPosition({
          left: startLeft + (moveEvent.clientX - startX),
          top: startTop + (moveEvent.clientY - startY)
        })
      }

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [modalPosition]
  )

  const filteredIcons = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return EMOJI_INDEX

    // Split search terms for multi-word matching (e.g. "red apple")
    const terms = term.split(' ').filter(Boolean)
    return EMOJI_INDEX.filter((item) => {
      return terms.every((t) => item.searchString.includes(t))
    })
  }, [search])

  if (!isOpen) return null

  return createPortal(
    <div
      className="modal-overlay icon-modal-overlay"
      onClick={onClose}
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="icon-modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translate(${modalPosition.left}px, ${modalPosition.top}px)`,
          position: 'relative'
        }}
      >
        <ModalHeader
          title="Select Icon"
          onClose={onClose}
          onMouseDown={handleDragStart}
          style={{ cursor: 'move' }}
        />

        <div className="icon-modal-search">
          <Search size={14} className="icon-modal-search-icon" />
          <input
            type="text"
            placeholder="Search icons (e.g., database, user)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                onClose()
              }
            }}
            autoFocus
          />
        </div>

        <div className="icon-modal-grid">
          <div
            className={`icon-swatch-wrap ${!currentIcon ? 'active' : ''}`}
            onClick={() => {
              onSelect(null)
              onClose()
            }}
            title="Auto / Default"
          >
            <div className="icon-swatch">
              <span className="icon-auto-text">Auto</span>
            </div>
          </div>

          {filteredIcons.map((item) => {
            const isActive = currentIcon === item.char
            const IconComponent = LucideIcons[item.char]

            return (
              <div
                key={item.char + item.name}
                className={`icon-swatch-wrap ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelect(item.char)
                  onClose()
                }}
                title={item.name}
              >
                <div
                  className="icon-swatch"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {IconComponent ? (
                    <IconComponent size={20} />
                  ) : (
                    <span style={{ fontSize: '20px' }}>{item.char}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default IconModal
