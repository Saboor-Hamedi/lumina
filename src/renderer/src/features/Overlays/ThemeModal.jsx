import React, { useState } from 'react'
import { useTheme } from '../../core/hooks/useTheme'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { X, Check, Palette } from 'lucide-react'
import './ThemeModal.css'
import ModalHeader from './ModalHeader'

/**
 * ThemeModal Component
 * Beautiful theme selector modal with preview cards
 */
const ThemeModal = ({ isOpen, onClose }) => {
  const { theme, setTheme, allThemes } = useTheme()
  const [hoveredTheme, setHoveredTheme] = useState(null)

  useKeyboardShortcuts({
    onEscape: onClose
  })

  if (!isOpen) return null

  const handleThemeSelect = (themeId) => {
    setTheme(themeId)
    // Optional: close modal after selection
    // onClose()
  }

  return (
    <div className="modal-overlay theme-modal-overlay" onClick={onClose}>
      <div className="modal-container theme-modal-container" onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Choose Theme" icon={<Palette size={16} />} onClose={onClose} />

        <div className="theme-modal-grid">
          {allThemes.map((t) => {
            const isActive = theme === t.id
            const isHovered = hoveredTheme === t.id
            
            return (
              <div
                key={t.id}
                className={`theme-modal-card ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                onClick={() => handleThemeSelect(t.id)}
                onMouseEnter={() => setHoveredTheme(t.id)}
                onMouseLeave={() => setHoveredTheme(null)}
                title={t.description}
              >
                <div className="theme-modal-preview" style={{ background: t.colors['--bg-app'] }}>
                  <div 
                    className="theme-preview-sidebar" 
                    style={{ background: t.colors['--bg-sidebar'] }}
                  />
                  <div 
                    className="theme-preview-editor" 
                    style={{ background: t.colors['--bg-editor'] }}
                  >
                    <div 
                      className="theme-preview-accent" 
                      style={{ 
                        background: t.colors['--text-accent'],
                        boxShadow: `0 0 8px ${t.colors['--text-accent']}40`
                      }}
                    />
                  </div>
                  <div 
                    className="theme-preview-text" 
                    style={{ color: t.colors['--text-main'] }}
                  >
                    Aa
                  </div>
                </div>
                <div className="theme-modal-info">
                  <span className="theme-modal-name">{t.name}</span>
                  {isActive && (
                    <Check size={16} className="theme-modal-check" style={{ color: t.colors['--text-accent'] }} />
                  )}
                </div>
                {t.description && (
                  <div className="theme-modal-description">{t.description}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ThemeModal
