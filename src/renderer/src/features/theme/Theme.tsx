import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { Palette, X, Check } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { SearchInput } from '../../ui'
import { useTheme, type ThemeChangeOrigin } from './hooks/useTheme'
import type { ThemeDefinition } from './hooks/themeDefinitions'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import './css/theme.css'

export interface ThemeProps {
  isOpen?: boolean
  isEmbedded?: boolean
  onClose?: () => void
}

interface ThemeRowProps {
  themeData: ThemeDefinition
  isActive: boolean
  isSelected: boolean
  onSelect: (themeId: string, origin?: ThemeChangeOrigin) => void
}

const ThemeRow: React.FC<ThemeRowProps> = memo(({ themeData, isActive, isSelected, onSelect }) => {
  const c = themeData.colors || ({} as Record<string, string>)
  const bgShell = c['--bg-activitybar'] || c['--bg-sidebar'] || '#0b0c10'
  const bgApp = c['--bg-editor'] || c['--bg-app'] || '#14151c'
  const bgSidebar = c['--bg-sidebar'] || '#111218'
  const accent = c['--text-accent'] || '#a78bfa'
  const text = c['--text-main'] || '#eceef5'
  const border = c['--border-subtle'] || c['--border-dim'] || 'rgba(128,128,128,0.28)'

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onSelect(themeData.id, { x: e.clientX, y: e.clientY })
    },
    [onSelect, themeData.id]
  )

  return (
    <div
      data-theme-id={themeData.id}
      className={`lumina-drawer-item ${isSelected ? 'selected' : ''} ${isActive ? 'active' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      title={themeData.description || themeData.name}
    >
      <div
        className="theme-mini-island-preview"
        aria-hidden="true"
        style={{ background: bgShell, borderColor: border }}
      >
        <span className="theme-mini-sidebar" style={{ background: bgSidebar }} />
        <span className="theme-mini-editor" style={{ background: bgApp }}>
          <span className="theme-mini-accent" style={{ background: accent }} />
          <span className="theme-mini-line" style={{ background: text }} />
        </span>
      </div>
      <span className="lumina-drawer-item-label">{themeData.name}</span>
      <div className="lumina-drawer-item-meta">
        <div className="theme-drawer-swatches" aria-hidden="true">
          <span className="theme-drawer-dot" style={{ background: accent }} />
          <span className="theme-drawer-dot" style={{ background: text }} />
        </div>
        {isActive && <Check size={13} strokeWidth={2.5} style={{ color: 'var(--text-accent)' }} />}
      </div>
    </div>
  )
})

ThemeRow.displayName = 'ThemeRow'

type ThemeToneFilter = 'all' | 'dark' | 'light'

const LIGHT_THEME_IDS = new Set(['light', 'parchment', 'porcelain', 'rosePineDawn'])

export const Theme: React.FC<ThemeProps> = ({
  isOpen = false,
  isEmbedded = false,
  onClose = () => {}
}) => {
  const { theme, setTheme, allThemes } = useTheme()
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [toneFilter, setToneFilter] = useState<ThemeToneFilter>('all')
  const [selectedId, setSelectedId] = useState<string>(theme)

  const listRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const paneRef = useRef<HTMLDivElement | null>(null)

  // Esc key closes standalone modal/drawer only (never the docked left sidebar)
  useKeyboardShortcuts({
    onEscape: () => {
      if (isOpen && !isEmbedded && onClose) {
        onClose()
        return true
      }
      return false
    }
  })

  // Sync selectedId when theme changes externally
  useEffect(() => {
    setSelectedId(theme)
  }, [theme])

  // Scroll active item into view only when the sidebar opens
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      const container = listRef.current
      if (!container) return
      const activeItem = container.querySelector<HTMLElement>('.lumina-drawer-item.active')
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' })
      }
    }, 40)
    return () => clearTimeout(timer)
  }, [isOpen])

  // Pre-lowercased search index built once (no per-keystroke string allocation)
  const searchIndex = useMemo(
    () =>
      allThemes.map((t) => ({
        theme: t,
        isLight: LIGHT_THEME_IDS.has(t.id),
        haystack: `${t.name} ${t.id} ${t.description || ''}`.toLowerCase()
      })),
    [allThemes]
  )

  const filteredThemes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return searchIndex
      .filter((e) => {
        if (toneFilter === 'light' && !e.isLight) return false
        if (toneFilter === 'dark' && e.isLight) return false
        return !q || e.haystack.includes(q)
      })
      .map((e) => e.theme)
  }, [searchIndex, toneFilter, searchQuery])

  const handleSelect = useCallback(
    (themeId: string, origin?: ThemeChangeOrigin) => {
      if (!themeId) return
      setSelectedId(themeId)
      setTheme(themeId, origin)
    },
    [setTheme]
  )

  const scrollToItem = useCallback((idx: number) => {
    const container = listRef.current
    if (!container) return
    const el = container.children[idx] as HTMLElement | undefined
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [])

  // Latest values in refs so the keydown listener is bound once per open (no re-binding per keypress)
  const navRef = useRef({ filteredThemes, selectedId, theme })
  navRef.current = { filteredThemes, selectedId, theme }

  // Keyboard navigation:
  //  ↑ / ↓  → move the highlight only (cheap, no theme repaint per keypress)
  //  Enter  → apply the highlighted theme and stay in the Themes sidebar
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const { filteredThemes: list, selectedId: current, theme: active } = navRef.current
      const target = e.target as EventTarget | null
      const targetEl = target instanceof HTMLElement ? target : null
      const activeEl = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const paneEl = paneRef.current

      const isInsideThemePane = Boolean(
        paneEl &&
          ((target instanceof Node && paneEl.contains(target)) ||
            (activeEl && paneEl.contains(activeEl)))
      )

      // Never intercept keys from the Editor, Terminal, or inputs outside the Theme pane
      const isEditableOutsideTheme = Boolean(
        (targetEl &&
          !paneEl?.contains(targetEl) &&
          (targetEl.tagName === 'INPUT' ||
            targetEl.tagName === 'TEXTAREA' ||
            targetEl.isContentEditable ||
            targetEl.closest('[contenteditable="true"], .cm-editor, .xterm, .lumina-terminal'))) ||
          (activeEl &&
            !paneEl?.contains(activeEl) &&
            (activeEl.tagName === 'INPUT' ||
              activeEl.tagName === 'TEXTAREA' ||
              activeEl.isContentEditable ||
              activeEl.closest('[contenteditable="true"], .cm-editor, .xterm, .lumina-terminal')))
      )

      if (isEditableOutsideTheme) {
        return
      }
      if (
        isEmbedded &&
        !isInsideThemePane &&
        target !== window &&
        target !== document &&
        target !== document.body
      ) {
        return
      }

      const isInput = targetEl?.tagName === 'INPUT' || targetEl?.tagName === 'TEXTAREA'

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (list.length === 0) return
        e.preventDefault()
        const idx = list.findIndex((t) => t.id === current)
        const base = idx === -1 ? 0 : idx
        const next =
          e.key === 'ArrowDown' ? Math.min(list.length - 1, base + 1) : Math.max(0, base - 1)
        setSelectedId(list[next].id)
        scrollToItem(next)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (current && current !== active) setTheme(current)
      } else if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isEmbedded, setTheme, scrollToItem])

  if (!isOpen && !isEmbedded) return null

  const content = (
    <div ref={paneRef} className="lumina-sidebar-pane theme-sidebar-pane">
      {/* Sidebar Header — exactly like notes explorer */}
      <div className="lumina-drawer-header">
        <div className="lumina-drawer-header-left">
          <Palette size={14} className="lumina-drawer-header-icon" />
          <span className="lumina-drawer-title">Themes</span>
          <span className="lumina-drawer-badge">{filteredThemes.length}</span>
        </div>

        <div className="lumina-drawer-header-right">
          <ToolTip text="Close" position="bottom">
            <button
              type="button"
              className="lumina-drawer-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </ToolTip>
        </div>
      </div>

      {/* Search Bar — matching note search */}
      <SearchInput
        ref={searchInputRef}
        placeholder="Search themes..."
        value={searchQuery}
        onChange={setSearchQuery}
        autoFocus
      />

      {/* Compact All / Dark / Light Filter */}
      <div className="theme-tone-tabs" role="tablist" aria-label="Filter themes by tone">
        {(['all', 'dark', 'light'] as ThemeToneFilter[]).map((tone) => (
          <button
            key={tone}
            type="button"
            role="tab"
            aria-selected={toneFilter === tone}
            className={`theme-tone-tab ${toneFilter === tone ? 'active' : ''}`}
            onClick={() => setToneFilter(tone)}
          >
            {tone === 'all' ? 'All' : tone === 'dark' ? 'Dark' : 'Light'}
          </button>
        ))}
      </div>

      {/* Note-Tree Styled Theme Rows */}
      <div ref={listRef} className="lumina-drawer-list">
        {filteredThemes.map((t) => (
          <ThemeRow
            key={t.id}
            themeData={t}
            isActive={theme === t.id}
            isSelected={selectedId === t.id}
            onSelect={handleSelect}
          />
        ))}
        {filteredThemes.length === 0 && (
          <div className="lumina-drawer-empty">
            No themes found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  )

  // If embedded in the sidebar, return inline. If opened as overlay fallback, portal it.
  if (isEmbedded) {
    return content
  }

  return createPortal(
    <div className="lumina-side-drawer-overlay" onClick={onClose}>
      <div
        className="lumina-side-drawer-panel theme-side-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>,
    document.body
  )
}

export default React.memo(Theme)
