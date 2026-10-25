import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { Palette, PanelLeftClose, PanelLeftOpen, Square, Copy, X, Search } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { useTheme } from './hooks/useTheme'
import type { ThemeDefinition } from './hooks/themeDefinitions'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import '../modals/css/guide.css'
import '../Docs/Documentation.css'
import './css/theme.css'

export interface ThemeProps {
  isOpen?: boolean
  onClose?: () => void
}

interface ThemeSidebarItemProps {
  themeData: ThemeDefinition
  isActive: boolean
  isSelected: boolean
  onSelect: (themeId: string) => void
}

// Lightweight, ergonomic Theme Card in Flat Sidebar
const ThemeSidebarItem: React.FC<ThemeSidebarItemProps> = memo(
  ({ themeData, isActive, isSelected, onSelect }) => {
    const c = themeData.colors || ({} as Record<string, string>)
    const bgApp = c['--bg-app'] || '#121218'
    const bgSidebar = c['--bg-sidebar'] || '#16161e'
    const bgEditor = c['--bg-editor'] || '#1a1a24'
    const accent = c['--text-accent'] || '#40bafa'

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
        className={`theme-sidebar-card template-modal-card ${isSelected ? 'selected active' : ''} ${isActive ? 'current' : ''}`}
        onClick={handleClick}
      >
        <div className="theme-sidebar-card-header">
          <span className="theme-sidebar-card-name" title={themeData.name}>
            {themeData.name}
          </span>
          {isActive ? (
            <span className="theme-sidebar-badge active">ACTIVE</span>
          ) : (
            <span className="theme-sidebar-badge">{isDark ? 'DARK' : 'LIGHT'}</span>
          )}
        </div>

        <div className="theme-sidebar-card-swatches">
          <div className="theme-swatch-bar" style={{ background: bgApp }}>
            <span
              className="theme-swatch-section"
              style={{ background: bgSidebar }}
              title={`Sidebar: ${bgSidebar}`}
            />
            <span
              className="theme-swatch-section"
              style={{ background: bgEditor }}
              title={`Editor: ${bgEditor}`}
            />
            <span
              className="theme-swatch-section accent"
              style={{ background: accent }}
              title={`Accent: ${accent}`}
            />
          </div>
        </div>
      </div>
    )
  }
)

ThemeSidebarItem.displayName = 'ThemeSidebarItem'

interface ThemeContentProps {
  themeData?: ThemeDefinition
  isActive?: boolean
}

// Dedicated Right Content Preview Pane for the currently selected theme
const ThemeContent: React.FC<ThemeContentProps> = memo(({ themeData, isActive }) => {
  if (!themeData) return null
  const c = themeData.colors || ({} as Record<string, string>)

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 className="theme-detail-title">{themeData.name}</h2>
            {isActive && (
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  color: '#22c55e',
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '3px',
                  padding: '1.5px 6px',
                  letterSpacing: '0.04em'
                }}
              >
                CURRENTLY APPLIED
              </span>
            )}
          </div>
          <p className="theme-detail-desc">
            {themeData.description ||
              'Ergonomically tuned color palette designed for high legibility and long-session comfort.'}
          </p>
        </div>
      </div>

      {/* Palette Color Swatches */}
      <div>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '6px'
          }}
        >
          Color Palette
        </div>
        <div className="theme-palette-grid">
          {paletteEntries.map((p) => (
            <div key={p.key} className="theme-palette-item">
              <span className="theme-palette-swatch" style={{ background: p.val }} />
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div className="theme-palette-label">{p.label}</div>
                <div className="theme-palette-value" title={p.val}>
                  {p.val}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Realistic UI Mockup */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '6px'
          }}
        >
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
            <span
              style={{
                fontSize: '10.5px',
                color: c['--text-muted'] || '#888',
                marginLeft: '8px',
                fontWeight: 500
              }}
            >
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
              <div
                className="theme-mockup-sidebar-item"
                style={{ color: c['--text-muted'] || '#888' }}
              >
                <span>✦ Daily Note.md</span>
              </div>
              <div
                className="theme-mockup-sidebar-item"
                style={{ color: c['--text-muted'] || '#888' }}
              >
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
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: c['--text-accent'] || '#40bafa'
                }}
              >
                # Exploring Lumina
              </div>
              <div style={{ color: c['--text-muted'] || '#888', fontSize: '11px' }}>
                Lumina features seamless markdown rendering, instant keyboard navigation, and theme
                customization.
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
                <span style={{ color: c['--text-muted'] || '#888' }}>
                  `Active theme: $&#123;theme&#125;`
                </span>
                )
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

ThemeContent.displayName = 'ThemeContent'

export const Theme: React.FC<ThemeProps> = ({ isOpen = false, onClose = () => {} }) => {
  const { theme, setTheme, allThemes } = useTheme()
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string>(theme)

  const isMaximized = useSettingsStore((s: any) => s.settings?.themeModalMaximized ?? false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Esc key closes modal cleanly via Lumina's global shortcut manager
  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen && onClose) {
        onClose()
        return true
      }
      return false
    }
  })

  // Synchronize on open and scroll active theme into view
  useEffect(() => {
    if (isOpen) {
      setSelectedId(theme)
      setSearchQuery('')
      setTimeout(() => {
        const container = sidebarScrollRef.current
        if (!container) return
        const activeCard = container.querySelector<HTMLElement>(
          '.theme-sidebar-card.selected, .theme-sidebar-card.active'
        )
        if (activeCard) {
          activeCard.scrollIntoView({ block: 'nearest' })
        }
      }, 50)
    }
  }, [isOpen, theme])

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
    (themeId: string) => {
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
    const { settings, updateSettings } = useSettingsStore.getState() as any
    updateSettings({ themeModalMaximized: !(settings?.themeModalMaximized ?? false) })
  }, [])

  const scrollToItem = useCallback((idx: number) => {
    const container = sidebarScrollRef.current
    if (!container) return
    const cards = container.querySelectorAll<HTMLElement>('.theme-sidebar-card')
    const el = cards[idx]
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [])

  // Keyboard navigation (Arrow keys up/down)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const currentIndex = filteredThemes.findIndex((t) => t.id === selectedId)
        const nextIndex = Math.min(
          filteredThemes.length - 1,
          (currentIndex === -1 ? 0 : currentIndex) + 1
        )
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

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, filteredThemes, selectedId, handleSelect, scrollToItem])

  if (!isOpen) return null

  return createPortal(
    <div className="guide-modal-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className={`docs-modal-container${isMaximized ? ' maximized' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - exactly identical to Documentation / mother modal */}
        <div
          className="docs-modal-header"
          onDoubleClick={handleToggleMaximize}
          style={{ cursor: 'default' }}
        >
          <div className="docs-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ToolTip text={isSidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'} position="bottom">
              <button
                type="button"
                className="docs-sidebar-toggle-btn"
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
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 500,
                color: 'var(--text-main)',
                letterSpacing: '-0.01em',
                background: 'transparent',
                padding: 0
              }}
            >
              Theme Gallery
            </span>
            {selectedTheme && (
              <>
                <span style={{ opacity: 0.35, color: 'var(--text-muted)', fontSize: '12px' }}>/</span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 400,
                    color: 'var(--text-muted)',
                    maxWidth: '240px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    background: 'transparent',
                    padding: 0
                  }}
                  title={selectedTheme.name}
                >
                  {selectedTheme.name}
                </span>
              </>
            )}
          </div>

          <div className="docs-header-right">
            <ToolTip
              text={`${filteredThemes.length} ${filteredThemes.length === 1 ? 'theme' : 'themes'}`}
              position="bottom"
            >
              <div className="docs-header-stat">
                <Palette size={12} />
                <span>{filteredThemes.length} themes</span>
              </div>
            </ToolTip>
            <ToolTip text={isMaximized ? 'Restore Window' : 'Maximize Window'} position="bottom">
              <button
                type="button"
                className="docs-window-btn"
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
                type="button"
                className="guide-close-btn"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Modal Body: Flat Seamless Docked Sidebar + Right Rich Preview */}
        <div className={`docs-container ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <aside
            className={`docs-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}
            style={{
              width: isSidebarOpen ? '232px' : '0',
              minWidth: isSidebarOpen ? '232px' : '0'
            }}
          >
            {/* Search Header */}
            <div className="docs-sidebar-header">
              <div className="docs-search-wrapper">
                <Search size={13} className="docs-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="docs-search-input"
                  placeholder="Search themes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  spellCheck={false}
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="docs-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Themes List */}
            <div
              ref={sidebarScrollRef}
              className="docs-sidebar-scrollable"
            >
              <div
                style={{
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  color: 'var(--text-faint, rgba(255, 255, 255, 0.4))',
                  padding: '2px 4px 6px 4px',
                  fontWeight: 700,
                  letterSpacing: '0.8px'
                }}
              >
                {filteredThemes.length} {filteredThemes.length === 1 ? 'Theme' : 'Themes'}
              </div>

              <div className="theme-sidebar-grid">
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
                  <div
                    style={{
                      padding: '24px 12px',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      textAlign: 'center'
                    }}
                  >
                    No matching themes found.
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Right Preview Pane */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--bg-app)'
            }}
          >
            <ThemeContent themeData={selectedTheme} isActive={selectedTheme?.id === theme} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default memo(Theme)
