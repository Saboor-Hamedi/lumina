import React, { useEffect } from 'react'
import { useTheme } from '../../core/hooks/useTheme'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useToast } from '../../core/hooks/useToast'
import { X, Check } from 'lucide-react'
import './ThemeSettings.css'

const themes = [
  {
    name: 'default',
    colors: {
      primary: '#ffffff',
      secondary: '#f6f6f6',
      tertiary: '#f2f2f2',
      text: '#1a1a1a',
      muted: '#666666',
      faint: '#999999',
      accent: '#7b61ff'
    }
  },
  {
    name: 'dark',
    colors: {
      primary: '#1e1e1e',
      secondary: '#171717',
      tertiary: '#0f0f0f',
      text: '#dfdfdf',
      muted: '#aaaaaa',
      faint: '#666666',
      accent: '#9d7cff'
    }
  },
  {
    name: 'obsidian-robust',
    colors: {
      primary: '#000000',
      secondary: '#111111',
      tertiary: '#0a0a0a',
      text: '#f0f0f0',
      muted: '#a0a0a0',
      faint: '#444444',
      accent: '#7b61ff'
    }
  },
  {
    name: 'polaris',
    colors: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      text: '#0f172a',
      muted: '#475569',
      faint: '#94a3b8',
      accent: '#0284c7'
    }
  }
]

const ThemeSettings = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme()

  useKeyboardShortcuts({
    onEscape: onClose
  })

  if (!isOpen) return null

  return (
    <div className="modal-overlay theme-overlay" onClick={onClose}>
      <div className="modal-container theme-modal" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div className="modal-title">Theme Gallery</div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="theme-grid">
          {themes.map((t) => (
            <div 
              key={t.name}
              className={`theme-card ${theme === t.name ? 'active' : ''}`}
              onClick={() => setTheme(t.name, t.colors)}
            >
              <div className="theme-preview" style={{ background: t.colors.primary }}>
                <div className="preview-accent" style={{ background: t.colors.accent }} />
              </div>
              <div className="theme-info">
                <span className="theme-name">{t.name}</span>
                {theme === t.name && <Check size={14} className="active-icon" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ThemeSettings
