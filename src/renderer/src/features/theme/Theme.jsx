import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useTheme } from './hooks/useTheme'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { X, Check, Palette } from 'lucide-react'
import './css/theme.css'
import ToolTip from '../../components/atoms/ToolTip'

const Theme = ({ isOpen, onClose }) => {
  const { theme, setTheme, allThemes } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const cardsRef = useRef([])

  useKeyboardShortcuts({
    onEscape: onClose
  })

  const filteredThemes = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return allThemes.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
    )
  }, [allThemes, searchQuery])

  const [focusedIndex, setFocusedIndex] = useState(() => {
    const idx = filteredThemes.findIndex((t) => t.id === theme)
    return idx !== -1 ? idx : 0
  })

  // Synchronize focusedIndex with active theme on open
  useEffect(() => {
    if (isOpen) {
      const idx = filteredThemes.findIndex((t) => t.id === theme)
      setFocusedIndex(idx !== -1 ? idx : 0)
    }
  }, [isOpen, theme])

  // Keep focusedIndex within range when filtered list updates
  useEffect(() => {
    setFocusedIndex((prev) => {
      if (filteredThemes.length === 0) return -1
      if (prev >= filteredThemes.length || prev < 0) return 0
      return prev
    })
  }, [filteredThemes])

  // Auto-scroll focused card into view smoothly
  useEffect(() => {
    if (focusedIndex >= 0 && cardsRef.current[focusedIndex]) {
      cardsRef.current[focusedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [focusedIndex])

  // 4-Way Arrow Key Navigation and Enter to Change Theme
  useEffect(() => {
    if (!isOpen) return

    const COLUMNS = 3

    const handleKeyDown = (e) => {
      const isSearchFocused = document.activeElement === searchInputRef.current

      if (e.key === 'ArrowRight') {
        if (!isSearchFocused) {
          e.preventDefault()
          setFocusedIndex((prev) => (prev < filteredThemes.length - 1 ? prev + 1 : prev))
        }
      } else if (e.key === 'ArrowLeft') {
        if (!isSearchFocused) {
          e.preventDefault()
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0))
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (isSearchFocused) {
          searchInputRef.current?.blur()
          setFocusedIndex((prev) => (prev >= 0 ? prev : 0))
        } else {
          setFocusedIndex((prev) => Math.min(filteredThemes.length - 1, prev + COLUMNS))
        }
      } else if (e.key === 'ArrowUp') {
        if (!isSearchFocused) {
          e.preventDefault()
          if (focusedIndex < COLUMNS) {
            searchInputRef.current?.focus()
          } else {
            setFocusedIndex((prev) => Math.max(0, prev - COLUMNS))
          }
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (isSearchFocused) {
          if (filteredThemes.length > 0) {
            setTheme(filteredThemes[0].id)
            setFocusedIndex(0)
          }
        } else if (filteredThemes[focusedIndex]) {
          const selectedTheme = filteredThemes[focusedIndex]
          setTheme(selectedTheme.id)
        }
      } else if (!isSearchFocused && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredThemes, focusedIndex, setTheme])

  if (!isOpen) return null

  const handleThemeSelect = (themeId) => {
    setTheme(themeId)
  }

  return (
    <div className="theme-modal-overlay" onClick={onClose}>
      <div className="theme-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="theme-modal-header" style={{ cursor: 'default' }}>
          <div className="theme-header-left">
            <span className="theme-header-title">
              Theme & Appearance
            </span>
            <span className="theme-header-divider">/</span>
            <span className="theme-header-subtitle">
              Themes
            </span>
            <span className="theme-step-counter">
              {filteredThemes.length} available
            </span>
          </div>

          <div className="theme-header-right">
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                className="theme-close-btn"
                onClick={onClose}
                aria-label="Close Themes (Esc)"
              >
                <X size={17} />
              </button>
            </ToolTip>
          </div>
        </div>

        <div className="theme-modal-toolbar">
          <div className="theme-search-wrapper">
            <input
              ref={searchInputRef}
              type="text"
              className="theme-search-input"
              placeholder="Search or filter themes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="theme-modal-stats">Showing {filteredThemes.length} of {allThemes.length}</div>
        </div>

        <div className="theme-modal-grid">
          {filteredThemes.map((t, idx) => {
            const isActive = theme === t.id
            const isFocused = focusedIndex === idx

            return (
              <div
                key={t.id}
                ref={(el) => (cardsRef.current[idx] = el)}
                className={`theme-modal-card ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`.trim()}
                onClick={() => {
                  setFocusedIndex(idx)
                  handleThemeSelect(t.id)
                }}
              >
                <div className="theme-card-header">
                  <div className="theme-title-row">
                    <span className="theme-modal-name">{t.name}</span>
                    {isActive ? (
                      <span className="theme-check-badge">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="theme-badge installed">INSTALLED</span>
                    )}
                  </div>
                </div>

                <div className="theme-modal-preview-wrapper">
                  <div className="theme-modal-preview" style={{ background: t.colors['--bg-app'] }}>
                    <div
                      className="theme-preview-sidebar"
                      style={{
                        background: t.colors['--bg-sidebar'],
                        borderRight: `1px solid ${t.colors['--border-dim']}`
                      }}
                    >
                      <div
                        className="theme-preview-sidebar-item"
                        style={{ background: t.colors['--bg-active'] }}
                      />
                      <div
                        className="theme-preview-sidebar-item"
                        style={{ background: t.colors['--border-subtle'] }}
                      />
                      <div
                        className="theme-preview-sidebar-item"
                        style={{ background: t.colors['--border-subtle'] }}
                      />
                    </div>
                    <div
                      className="theme-preview-editor"
                      style={{ background: t.colors['--bg-editor'] }}
                    >
                      <div
                        className="theme-preview-code-line"
                        style={{ background: t.colors['--text-accent'], width: '60%' }}
                      />
                      <div
                        className="theme-preview-code-line"
                        style={{ background: t.colors['--text-main'], width: '80%' }}
                      />
                      <div
                        className="theme-preview-code-line"
                        style={{ background: t.colors['--text-muted'], width: '40%' }}
                      />
                      <div
                        className="theme-preview-code-line"
                        style={{ background: t.colors['--text-main'], width: '70%' }}
                      />
                      <div
                        className="theme-preview-code-line"
                        style={{ background: t.colors['--icon-secondary'], width: '50%' }}
                      />
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

export default Theme


