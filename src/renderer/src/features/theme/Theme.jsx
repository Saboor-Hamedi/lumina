import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useTheme } from './hooks/useTheme'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { X, Check, Palette, Square, Copy } from 'lucide-react'
import './css/theme.css'
// Memoized theme card component to avoid re-rendering all 63 cards on keystrokes/focus shifts
const ThemeCard = React.memo(
  ({ themeData, isActive, isFocused, onSelect, setCardRef }) => {
    return (
      <div
        ref={setCardRef}
        className={`theme-modal-card ${isActive ? 'active' : ''} ${isFocused ? 'focused' : ''}`.trim()}
        onClick={onSelect}
      >
        <div className="theme-card-header">
          <div className="theme-title-row">
            <span className="theme-modal-name">{themeData.name}</span>
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
          <div className="theme-modal-preview" style={{ background: themeData.colors['--bg-app'] }}>
            <div
              className="theme-preview-sidebar"
              style={{
                background: themeData.colors['--bg-sidebar'],
                borderRight: `1px solid ${themeData.colors['--border-dim']}`
              }}
            >
              <div
                className="theme-preview-sidebar-item"
                style={{ background: themeData.colors['--bg-active'] }}
              />
              <div
                className="theme-preview-sidebar-item"
                style={{ background: themeData.colors['--border-subtle'] }}
              />
              <div
                className="theme-preview-sidebar-item"
                style={{ background: themeData.colors['--border-subtle'] }}
              />
            </div>
            <div
              className="theme-preview-editor"
              style={{ background: themeData.colors['--bg-editor'] }}
            >
              <div
                className="theme-preview-code-line"
                style={{ background: themeData.colors['--text-accent'], width: '60%' }}
              />
              <div
                className="theme-preview-code-line"
                style={{ background: themeData.colors['--text-main'], width: '80%' }}
              />
              <div
                className="theme-preview-code-line"
                style={{ background: themeData.colors['--text-muted'], width: '40%' }}
              />
              <div
                className="theme-preview-code-line"
                style={{ background: themeData.colors['--text-main'], width: '70%' }}
              />
              <div
                className="theme-preview-code-line"
                style={{ background: themeData.colors['--icon-secondary'], width: '50%' }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  },
  (prev, next) =>
    prev.isActive === next.isActive &&
    prev.isFocused === next.isFocused &&
    prev.themeData === next.themeData &&
    prev.onSelect === next.onSelect
)

import ToolTip from '../../components/atoms/ToolTip'

const Theme = ({ isOpen, onClose }) => {
  const { theme, setTheme, allThemes } = useTheme()

  const [searchQuery, setSearchQuery] = useState('')
  const isMaximized = useSettingsStore((s) => s.settings.themeModalMaximized ?? false)
  const searchInputRef = useRef(null)
  const cardsRef = useRef([])
  const modalContainerRef = useRef(null)
  const posRef = useRef({ x: 0, y: 0 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const initialPosRef = useRef({ x: 0, y: 0 })
  const wasOpenRef = useRef(false)

  const handleToggleMaximize = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ themeModalMaximized: !(settings.themeModalMaximized ?? false) })
  }, [])

  useEffect(() => {
    if (isMaximized) {
      posRef.current = { x: 0, y: 0 }
      if (modalContainerRef.current) {
        modalContainerRef.current.style.transform = 'none'
      }
    }
  }, [isMaximized, isOpen])

  // Direct GPU-accelerated 0-latency drag handler
  const handleDragStart = useCallback((e) => {
    if (e.button !== 0 || isMaximized) return
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    e.preventDefault()
    e.stopPropagation()

    isDraggingRef.current = true
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    initialPosRef.current = { x: posRef.current.x, y: posRef.current.y }
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current || !modalContainerRef.current) return
      const deltaX = moveEvent.clientX - dragStartRef.current.x
      const deltaY = moveEvent.clientY - dragStartRef.current.y
      const nextX = initialPosRef.current.x + deltaX
      const nextY = initialPosRef.current.y + deltaY
      posRef.current = { x: nextX, y: nextY }
      modalContainerRef.current.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove, { capture: true })
      window.removeEventListener('mouseup', handleMouseUp, { capture: true })
    }

    window.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true })
    window.addEventListener('mouseup', handleMouseUp, { capture: true })
  }, [])

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

  // Synchronize focusedIndex with active theme and reset position ONLY on modal open transition
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const idx = filteredThemes.findIndex((t) => t.id === theme)
      setFocusedIndex(idx !== -1 ? idx : 0)
      setSearchQuery('')
      posRef.current = { x: 0, y: 0 }
      if (modalContainerRef.current) {
        modalContainerRef.current.style.transform = 'translate3d(0px, 0px, 0)'
      }
      wasOpenRef.current = true
    } else if (!isOpen) {
      wasOpenRef.current = false
    }
  }, [isOpen])

  // Keep focusedIndex within range when filtered list updates
  useEffect(() => {
    setFocusedIndex((prev) => {
      if (filteredThemes.length === 0) return -1
      if (prev >= filteredThemes.length || prev < 0) return 0
      return prev
    })
  }, [filteredThemes])

  // Auto-scroll focused card into view instantly without delay
  useEffect(() => {
    if (focusedIndex >= 0 && cardsRef.current[focusedIndex]) {
      cardsRef.current[focusedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'auto'
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

  const handleThemeSelect = useCallback(
    (themeId) => {
      setTheme(themeId)
    },
    [setTheme]
  )


  return (
    <div className="theme-modal-overlay" onClick={onClose}>
      <div
        ref={modalContainerRef}
        className={`theme-modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: isMaximized
            ? 'none'
            : (posRef.current.x !== 0 || posRef.current.y !== 0)
              ? `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`
              : undefined,
          position: 'relative',
          willChange: 'transform, opacity'
        }}

      >
        <div
          className="theme-modal-header"
          onMouseDown={handleDragStart}
          style={{ cursor: isMaximized ? 'default' : 'grab' }}
        >
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
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                className="theme-window-btn"
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? (
                  <Copy size={13} strokeWidth={2} />
                ) : (
                  <Square size={13} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
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
          {filteredThemes.map((t, idx) => (
            <ThemeCard
              key={t.id}
              themeData={t}
              isActive={theme === t.id}
              isFocused={focusedIndex === idx}
              setCardRef={(el) => (cardsRef.current[idx] = el)}
              onSelect={() => {
                setFocusedIndex(idx)
                handleThemeSelect(t.id)
              }}
            />
          ))}
        </div>

      </div>
    </div>
  )
}

export default Theme


