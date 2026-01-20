import React from 'react'
import { useTheme } from '../../core/hooks/useTheme'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { X, Check } from 'lucide-react'
import './ThemeSettings.css'

const ThemeSettings = ({ isOpen, onClose }) => {
  const { theme, setTheme, allThemes } = useTheme()

  useKeyboardShortcuts({
    onEscape: onClose
  })

  if (!isOpen) return null

  return (
    <div className="modal-overlay theme-overlay" onClick={onClose}>
      <div className="modal-container theme-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-title">Theme Gallery</div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="theme-grid">
          {allThemes.map((t) => (
            <div
              key={t.id}
              className={`theme-card ${theme === t.id ? 'active' : ''}`}
              onClick={() => setTheme(t.id)}
            >
              <div className="theme-preview" style={{ background: t.colors['--bg-app'] }}>
                <div className="preview-accent" style={{ background: t.colors['--text-accent'] }} />
              </div>
              <div className="theme-info">
                <span className="theme-name">{t.name}</span>
                {theme === t.id && <Check size={14} className="active-icon" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ThemeSettings
