import React, { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from '../Overlays/ModalHeader'
import { useDraggableModal } from '../Overlays/useDraggableModal'
import { EMOJI_INDEX } from './icons'
import './IconModal.css'

const IconItem = React.memo(({ item, isActive, onSelect, onClose }) => {
  const IconComponent = item.isLucide ? LucideIcons[item.char] : null
  return (
    <div
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
})

const IconModal = ({ isOpen, onClose, currentIcon, onSelect }) => {
  const [search, setSearch] = useState('')
  useKeyboardShortcuts({ onEscape: onClose })
  const { style: dragStyle, handleDragStart } = useDraggableModal()

  const stopPropagation = useCallback((e) => {
    e.stopPropagation()
  }, [])

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
        onClick={stopPropagation}
        onMouseDown={stopPropagation}
        onPointerDown={stopPropagation}
        onDoubleClick={stopPropagation}
        onKeyDown={stopPropagation}
        onKeyUp={stopPropagation}
        onContextMenu={stopPropagation}
        style={dragStyle}
      >
        <ModalHeader
          title="Select Icon"
          onClose={onClose}
          onMouseDown={handleDragStart}
          onPointerDown={stopPropagation}
          style={{ cursor: 'grab' }}
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

          {filteredIcons.map((item) => (
            <IconItem
              key={item.char + item.name}
              item={item}
              isActive={currentIcon === item.char}
              onSelect={onSelect}
              onClose={onClose}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default IconModal
