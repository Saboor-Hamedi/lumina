import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import * as LucideIcons from 'lucide-react'
import { Search, X } from 'lucide-react'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import ModalHeader from './ModalHeader'
import './IconModal.css'

// Filter out non-icon exports from lucide-react
const allIconNames = Object.keys(LucideIcons).filter(name => {
  return /^[A-Z]/.test(name) && name !== 'createLucideIcon' && typeof LucideIcons[name] === 'object' && LucideIcons[name].$$typeof
})

const IconModal = ({ isOpen, onClose, currentIcon, onSelect }) => {
  const [search, setSearch] = useState('')
  useKeyboardShortcuts({ onEscape: onClose })
  
  const filteredIcons = useMemo(() => {
    const term = search.toLowerCase()
    let matches = allIconNames
    if (term) {
      matches = matches.filter(name => name.toLowerCase().includes(term))
    }
    // Limit to 150 to keep the modal lightweight and responsive
    return matches.slice(0, 150)
  }, [search])

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay icon-modal-overlay" onClick={onClose}>
      <div className="icon-modal-container" onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Select Icon" onClose={onClose} />
        
        <div className="icon-modal-search">
          <Search size={14} className="icon-modal-search-icon" />
          <input
            type="text"
            placeholder="Search icons (e.g., database, user)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="icon-modal-grid">
          <div 
            className={`icon-swatch-wrap ${!currentIcon ? 'active' : ''}`}
            onClick={() => { onSelect(null); onClose() }}
            title="Auto / Default"
          >
            <div className="icon-swatch">
              <span className="icon-auto-text">Auto</span>
            </div>
          </div>

          {filteredIcons.map(iconName => {
            const Icon = LucideIcons[iconName]
            if (!Icon) return null
            const isActive = currentIcon === iconName
            return (
              <div
                key={iconName}
                className={`icon-swatch-wrap ${isActive ? 'active' : ''}`}
                onClick={() => { onSelect(iconName); onClose() }}
                title={iconName}
              >
                <div className="icon-swatch">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
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
