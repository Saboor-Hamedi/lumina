import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { PanelLeftClose, PanelLeftOpen, Square, Copy, X, Search } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { useTheme } from './hooks/useTheme'
import { useSettingsStore } from '../../core/store/SettingStore'
import '../modals/css/guide.css'
import '../template/css/template.css'
import './css/theme.css'

// Rich Theme Card in Sidebar matching Daily Notes (TemplateSidebarItem)
const ThemeSidebarItem = memo(({ themeData, isActive, isSelected, onSelect }) => {
  const c = themeData.colors || {}
  const bgApp = c['--bg-app'] || '#121218'
  const bgSidebar = c['--bg-sidebar'] || '#16161e'
  const bgEditor = c['--bg-editor'] || '#1a1a24'
  const accent = c['--text-accent'] || '#40bafa'
  const text = c['--text-main'] || '#ffffff'
  const border = c['--border-dim'] || 'rgba(255,255,255,0.08)'

  const isDark =
    bgApp.toLowerCase().includes('#0') ||
    bgApp.toLowerCase().includes('#1') ||
    bgApp.toLowerCase().includes('#2')

  const handleClick = useCallback(() => {
    onSelect(themeData.id)
  }, [onSelect, themeData.id])

  return (
    <div
      data-theme-id={themeData.id}
      className={`template-modal-card ${isSelected ? 'active' : ''}`}
      onClick={handleClick}
    >
      <div className="template-card-header">
        <div className="template-title-row">
          <span className="template-modal-name">{themeData.name}</span>
          {isActive ? (
            <span
              className="template-badge"
              style={{
                color: '#22c55e',
                borderColor: 'rgba(34, 197, 94, 0.4)',
                background: 'rgba(34, 197, 94, 0.1)',
                fontWeight: 700
              }}
            >
              ACTIVE
            </span>
          ) : (
            <span className="template-badge">
              {isDark ? 'DARK' : 'LIGHT'}
            </span>
          )}
        </div>
      </div>

      <div className="template-modal-preview-wrapper">
        <div
          className="template-modal-preview"
          style={{
            background: bgApp,
            borderColor: border,
            padding: '4px'
          }}
        >
          {/* Mini Workspace Window Mockup */}
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '4px',
              overflow: 'hidden',
              border: `1px solid ${border}`,
              background: bgApp
            }}
          >
            {/* Titlebar */}
            <div
              style={{
                height: '12px',
                background: bgSidebar,
                borderBottom: `1px solid ${border}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 5px',
                gap: '2.5px',
                flexShrink: 0
              }}
            >
              <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: '#ff5f56' }} />
              <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: '#ffbd2e' }} />
              <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: '#27c93f' }} />
              <div style={{ width: '22px', height: '2.5px', borderRadius: '1px', background: text, opacity: 0.25, marginLeft: '3px' }} />
            </div>

            {/* Body: Sidebar + Editor */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Sidebar */}
              <div
                style={{
                  width: '32px',
                  background: bgSidebar,
                  borderRight: `1px solid ${border}`,
                  padding: '3px 2px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2.5px',
                  flexShrink: 0
                }}
              >
                <div
                  style={{
                    height: '4px',
                    borderRadius: '1.5px',
                    background: accent,
                    opacity: 0.9,
                    width: '85%'
                  }}
                />
                <div style={{ height: '3px', borderRadius: '1.5px', background: text, opacity: 0.2, width: '70%' }} />
                <div style={{ height: '3px', borderRadius: '1.5px', background: text, opacity: 0.15, width: '55%' }} />
              </div>

              {/* Editor */}
              <div
                style={{
                  flex: 1,
                  background: bgEditor,
                  padding: '4px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2.5px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', width: '100%' }}>
                  <span style={{ width: '3px', height: '3px', borderRadius: '1px', background: accent }} />
                  <div style={{ height: '4px', borderRadius: '1px', background: accent, width: '45%' }} />
                </div>
                <div style={{ height: '3px', borderRadius: '1px', background: text, opacity: 0.4, width: '80%' }} />
                <div style={{ height: '3px', borderRadius: '1px', background: text, opacity: 0.25, width: '60%' }} />
                <div
                  style={{
                    marginTop: 'auto',
                    height: '7px',
                    borderRadius: '2px',
                    background: bgApp,
                    border: `1px solid ${border}`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 3px',
                    gap: '2px'
                  }}
                >
                  <div style={{ width: '2.5px', height: '2.5px', borderRadius: '50%', background: accent }} />
                  <div style={{ height: '2px', borderRadius: '1px', background: accent, opacity: 0.7, width: '35%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

ThemeSidebarItem.displayName = 'ThemeSidebarItem'

// Dedicated Right Content Preview Pane for the currently selected theme
const ThemeContent = memo(({ themeData, isActive, onApply }) => {
  if (!themeData) return null
  const c = themeData.colors || {}

  const paletteEntries = [
    { label: 'App', key: '--bg-app', val: c['--bg-app'] || '#121218' },
    { label: 'Editor', key: '--bg-editor', val: c['--bg-editor'] || '#1a1a24' },
    { label: 'Sidebar', key: '--bg-sidebar', val: c['--bg-sidebar'] || '#16161e' },
    { label: 'Accent', key: '--text-accent', val: c['--text-accent'] || '#40bafa' },
    { label: 'Text', key: '--text-main', val: c['--text-main'] || '#ffffff' },
    { label: 'Border', key: '--border-dim', val: c['--border-dim'] || 'rgba(255,255,255,0.08)' }
  ]

  return (
    <div className="theme-content-pane">
      {/* Top Header */}
      <div className="theme-detail-header">
        <div>
          <h2 className="theme-detail-title">{themeData.name}</h2>
          <p className="theme-detail-desc">
            {themeData.description || 'Ergonomically tuned color palette designed for high legibility and long-session comfort.'}
          </p>
        </div>
      </div>

      {/* Palette Color Swatches */}
      <div>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
          Color Palette
        </div>
        <div className="theme-palette-grid">
          {paletteEntries.map((p) => (
            <div key={p.key} className="theme-palette-item">
              <span className="theme-palette-swatch" style={{ background: p.val }} />
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div className="theme-palette-label">{p.label}</div>
                <div className="theme-palette-value" title={p.val}>{p.val}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Realistic UI Mockup */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
          Live Interface Preview
        </div>
        <div
          className="theme-mockup-window"
          style={{
            background: c['--bg-app'] || '#121218',
            borderColor: c['--border-dim'] || 'rgba(255,255,255,0.1)'
          }}
        >
          {/* Mockup Title Bar */}
          <div
            className="theme-mockup-titlebar"
            style={{
              background: c['--bg-sidebar'] || '#16161e',
              borderColor: c['--border-dim'] || 'rgba(255,255,255,0.08)'
            }}
          >
            <span className="theme-mockup-dot" style={{ background: '#ff5f56' }} />
            <span className="theme-mockup-dot" style={{ background: '#ffbd2e' }} />
            <span className="theme-mockup-dot" style={{ background: '#27c93f' }} />
            <span style={{ fontSize: '10.5px', color: c['--text-muted'] || '#888', marginLeft: '8px', fontWeight: 500 }}>
              Lumina Workspace — {themeData.name}
            </span>
          </div>

          {/* Mockup Body: Sidebar + Editor */}
          <div className="theme-mockup-body">
            <div
              className="theme-mockup-sidebar"
              style={{
                background: c['--bg-sidebar'] || '#16161e',
                borderColor: c['--border-dim'] || 'rgba(255,255,255,0.08)'
              }}
            >
              <div
                className="theme-mockup-sidebar-item"
                style={{
                  background: c['--bg-active'] || 'rgba(255,255,255,0.08)',
                  color: c['--text-accent'] || '#40bafa'
                }}
              >
                <span>✦ Overview.md</span>
              </div>
              <div className="theme-mockup-sidebar-item" style={{ color: c['--text-muted'] || '#888' }}>
                <span>✦ Daily Note.md</span>
              </div>
              <div className="theme-mockup-sidebar-item" style={{ color: c['--text-muted'] || '#888' }}>
                <span>✦ Architecture.md</span>
              </div>
            </div>

            <div
              className="theme-mockup-editor"
              style={{
                background: c['--bg-editor'] || '#1a1a24',
                color: c['--text-main'] || '#fff'
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: c['--text-accent'] || '#40bafa' }}>
                # Exploring Lumina
              </div>
              <div style={{ color: c['--text-muted'] || '#888', fontSize: '11px' }}>
                Lumina features seamless markdown rendering, instant keyboard navigation, and theme customization.
              </div>
              <div
                className="theme-mockup-codeblock"
                style={{
                  background: c['--bg-app'] || '#121218',
                  borderColor: c['--border-dim'] || 'rgba(255,255,255,0.08)',
                  color: c['--text-main'] || '#fff'
                }}
              >
                <span style={{ color: c['--text-accent'] || '#40bafa' }}>const</span> theme ={' '}
                <span style={{ color: '#a6e3a1' }}>&apos;{themeData.id}&apos;</span>
                <br />
                <span style={{ color: c['--text-accent'] || '#40bafa' }}>console</span>.log(
                <span style={{ color: c['--text-muted'] || '#888' }}>`Active theme: $&#123;theme&#125;`</span>)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

ThemeContent.displayName = 'ThemeContent'

// Main Modal matching Template.jsx & DailyNotes architecture
export const Theme = ({ isOpen = false, onClose = () => {} }) => {
  const { theme, setTheme, allThemes } = useTheme()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState(theme)

  const isMaximized = useSettingsStore((s) => s.settings.themeModalMaximized ?? false)
  const containerRef = useRef(null)
  const sidebarScrollRef = useRef(null)
  const searchInputRef = useRef(null)

  // Keep selectedId in sync with current theme only when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedId(theme)
      setSearchQuery('')
    }
  }, [isOpen])

  const filteredThemes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return allThemes
    return allThemes.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    )
  }, [allThemes, searchQuery])

  const selectedTheme = useMemo(() => {
    return allThemes.find((t) => t.id === selectedId) || filteredThemes[0] || allThemes[0]
  }, [allThemes, selectedId, filteredThemes])

  const handleSelect = useCallback(
    (themeId) => {
      if (!themeId) return
      setSelectedId(themeId)
      setTheme(themeId)
    },
    [setTheme]
  )

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  const handleToggleMaximize = useCallback(() => {
    const { settings, updateSettings } = useSettingsStore.getState()
    updateSettings({ themeModalMaximized: !(settings.themeModalMaximized ?? false) })
  }, [])

  // Container-scoped scroll for keyboard navigation only (never scrolls parent modal or window)
  const scrollToItem = useCallback((idx) => {
    const container = sidebarScrollRef.current
    if (!container) return
    const cards = container.querySelectorAll('.template-modal-card')
    const el = cards[idx]
    if (!el) return
    const elTop = el.offsetTop
    const elBottom = elTop + el.offsetHeight
    const containerTop = container.scrollTop
    const containerBottom = containerTop + container.clientHeight

    if (elTop < containerTop) {
      container.scrollTo({ top: elTop - 8, behavior: 'smooth' })
    } else if (elBottom > containerBottom) {
      container.scrollTo({ top: elBottom - container.clientHeight + 8, behavior: 'smooth' })
    }
  }, [])

  // Keyboard navigation matching Template.jsx
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const currentIndex = filteredThemes.findIndex((t) => t.id === selectedId)
        const nextIndex = Math.min(filteredThemes.length - 1, (currentIndex === -1 ? 0 : currentIndex) + 1)
        if (filteredThemes[nextIndex]) {
          handleSelect(filteredThemes[nextIndex].id)
          scrollToItem(nextIndex)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const currentIndex = filteredThemes.findIndex((t) => t.id === selectedId)
        const prevIndex = Math.max(0, (currentIndex === -1 ? 0 : currentIndex) - 1)
        if (filteredThemes[prevIndex]) {
          handleSelect(filteredThemes[prevIndex].id)
          scrollToItem(prevIndex)
        }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onClose()
      } else if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    document.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      document.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [isOpen, onClose, filteredThemes, selectedId, handleSelect, scrollToItem])

  if (!isOpen) return null

  return createPortal(
    <div className="nexus-overlay preview-overlay-glass settings-overlay guide-modal-overlay theme-modal-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className={`settings-modal theme-modal-container template-modal-container modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          flexDirection: 'column',
          width: isMaximized ? '100vw' : '900px',
          height: isMaximized ? '100vh' : '76vh',
          maxWidth: isMaximized ? 'none' : '94vw',
          minHeight: isMaximized ? 'none' : '480px',
          maxHeight: isMaximized ? 'none' : '78vh',
          transform: isMaximized ? 'none' : 'translate3d(0px, 0px, 0px)',
          transition: '0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          borderRadius: isMaximized ? '0' : '12px'
        }}
      >
        {/* Sleek Header matching Settings modal */}
        <div className="modal-header theme-modal-header template-modal-header settings-modal-header" style={{ cursor: 'default' }}>
          <div className="settings-header-left template-header-left">
            <ToolTip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
                className="control-icon settings-sidebar-toggle-btn template-sidebar-toggle-btn"
                onClick={handleToggleSidebar}
                aria-label={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose size={15} strokeWidth={2} />
                ) : (
                  <PanelLeftOpen size={15} strokeWidth={2} />
                )}
              </button>
            </ToolTip>
            <span className="settings-header-title">Theme Gallery</span>
            <span className="settings-header-divider">/</span>
            <span className="settings-header-subtitle">
              {selectedTheme?.name || 'Themes'}
            </span>
          </div>

          <div className="window-controls settings-header-right template-header-right">
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                className="control-icon control-maximize settings-window-btn template-window-btn"
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore Window' : 'Maximize Window'}
              >
                {isMaximized ? <Copy size={13} strokeWidth={2} /> : <Square size={13} strokeWidth={2} />}
              </button>
            </ToolTip>
            <ToolTip text="Close (Esc)" position="bottom">
              <button
                className="control-icon control-close settings-close-btn template-window-btn"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Main Body: Collapsible Sidebar + Rich Preview Pane */}
        <div className={`modal-body settings-layout template-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <aside className={`sidebar settings-sidebar template-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
            <div className="template-sidebar-header">
              <div className="template-search-wrapper">
                <Search size={13} className="template-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="template-search-input"
                  placeholder="Search themes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  spellCheck={false}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    className="template-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div ref={sidebarScrollRef} className="template-sidebar-scrollable">
              <div className="template-sidebar-count">
                {filteredThemes.length} {filteredThemes.length === 1 ? 'Theme' : 'Themes'}
              </div>

              <div className="template-modal-grid">
                {filteredThemes.map((t) => (
                  <ThemeSidebarItem
                    key={t.id}
                    themeData={t}
                    isActive={t.id === theme}
                    isSelected={t.id === selectedTheme?.id}
                    onSelect={handleSelect}
                  />
                ))}

                {filteredThemes.length === 0 && (
                  <div className="template-sidebar-empty">
                    No matching themes found.
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Right Preview Pane shifted when sidebar is open */}
          <div className="content settings-body template-content" style={{ overflow: 'hidden', height: '100%', display: 'flex', padding: 0 }}>
            <ThemeContent
              themeData={selectedTheme}
              isActive={selectedTheme?.id === theme}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default memo(Theme)
