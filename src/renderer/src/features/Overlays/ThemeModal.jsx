import React, { useState, useMemo } from 'react'
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
  const [searchQuery, setSearchQuery] = useState('')

  useKeyboardShortcuts({
    onEscape: onClose
  })

  if (!isOpen) return null

  const handleThemeSelect = (themeId) => {
    setTheme(themeId)
  }

  const filteredThemes = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return allThemes.filter(t => 
      t.name.toLowerCase().includes(query) || 
      (t.description && t.description.toLowerCase().includes(query))
    )
  }, [allThemes, searchQuery])

  return (
    <div className="modal-overlay theme-modal-overlay" onClick={onClose}>
      <div className="modal-container theme-modal-container" onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Appearance" icon={<Palette size={16} />} onClose={onClose} />

        <div className="theme-modal-toolbar">
          <div className="theme-search-wrapper">
            <input 
              type="text" 
              className="theme-search-input" 
              placeholder="Filter themes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="theme-modal-stats">
            Showing {filteredThemes.length} themes
          </div>
        </div>

        <div className="theme-modal-grid">
          {filteredThemes.map((t) => {
            const isActive = theme === t.id
            
            return (
              <div
                key={t.id}
                className={`theme-modal-card ${isActive ? 'active' : ''}`}
                onClick={() => handleThemeSelect(t.id)}
              >
                <div className="theme-card-header">
                  <div className="theme-title-row">
                    <span className="theme-modal-name">{t.name}</span>
                    {isActive ? (
                      <span className="theme-check-badge">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="theme-badge installed">INSTALLED</span>
                    )}
                  </div>
                  <div className="theme-modal-author">
                    By Lumina
                  </div>
                </div>
                
                <div className="theme-modal-preview-wrapper">
                  <div className="theme-modal-preview" style={{ background: t.colors['--bg-app'] }}>
                    <div 
                      className="theme-preview-sidebar" 
                      style={{ background: t.colors['--bg-sidebar'], borderRight: `1px solid ${t.colors['--border-dim']}` }}
                    >
                      <div className="theme-preview-sidebar-item" style={{ background: t.colors['--bg-active'] }} />
                      <div className="theme-preview-sidebar-item" style={{ background: t.colors['--border-subtle'] }} />
                      <div className="theme-preview-sidebar-item" style={{ background: t.colors['--border-subtle'] }} />
                    </div>
                    <div 
                      className="theme-preview-editor" 
                      style={{ background: t.colors['--bg-editor'] }}
                    >
                      <div className="theme-preview-code-line" style={{ background: t.colors['--text-accent'], width: '60%' }} />
                      <div className="theme-preview-code-line" style={{ background: t.colors['--text-main'], width: '80%' }} />
                      <div className="theme-preview-code-line" style={{ background: t.colors['--text-muted'], width: '40%' }} />
                      <div className="theme-preview-code-line" style={{ background: t.colors['--text-main'], width: '70%' }} />
                      <div className="theme-preview-code-line" style={{ background: t.colors['--icon-secondary'], width: '50%' }} />
                    </div>
                    <div 
                      className="theme-preview-badge" 
                      style={{ 
                        background: t.colors['--bg-active'], 
                        color: t.colors['--text-accent'],
                        border: `1px solid ${t.colors['--text-accent']}40`
                      }}
                    >
                      {t.id}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default ThemeModal
