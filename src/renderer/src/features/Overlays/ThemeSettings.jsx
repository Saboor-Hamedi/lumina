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
                <div 
                  className="preview-sidebar" 
                  style={{ background: t.colors['--bg-sidebar'], borderRight: `1px solid ${t.colors['--border-dim']}` }}
                >
                  <div className="preview-sidebar-item" style={{ background: t.colors['--bg-active'] }} />
                  <div className="preview-sidebar-item" style={{ background: t.colors['--border-subtle'] }} />
                </div>
                <div 
                  className="preview-editor" 
                  style={{ background: t.colors['--bg-editor'] }}
                >
                  <div className="preview-code-line" style={{ background: t.colors['--text-accent'], width: '60%' }} />
                  <div className="preview-code-line" style={{ background: t.colors['--text-main'], width: '80%' }} />
                  <div className="preview-code-line" style={{ background: t.colors['--text-muted'], width: '40%' }} />
                  <div className="preview-code-line" style={{ background: t.colors['--text-main'], width: '70%' }} />
                </div>
                <div 
                  className="preview-badge" 
                  style={{ 
                    background: t.colors['--bg-active'], 
                    color: t.colors['--text-accent'],
                    border: `1px solid ${t.colors['--text-accent']}40`
                  }}
                >
                  Aa
                </div>
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
