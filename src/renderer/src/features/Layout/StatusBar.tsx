/**
 * =========================================================================
 * StatusBar Component (`StatusBar.tsx`)
 * =========================================================================
 *
 * System bottom status bar for Lumina.
 *
 * Architecture & Features:
 * - Registry-driven: every element (actions, center blob, metrics)
 *   is declared in `STATUS_BAR_ITEM_META` and can be individually toggled.
 * - Right-click anywhere on the bar opens a rich, VS Code-style menu that lets
 *   the user show/hide any item. Visibility is persisted to settings.json
 *   (`statusBarItems`), staying open while toggling multiple items.
 * - Left utility tray: Settings & profile dropdown, inspector toggle, canvas drawer.
 * - Center status area: Minimalist glowing CapsLock blob.
 * - Right live metrics: cursor coordinates, selection, word/char counts, reading time, language & encoding.
 * - Horizontal mouse wheel scrolling for overflow safety.
 * - Memoized and optimized for 120 FPS typing performance.
 * =========================================================================
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  FileText,
  Hash,
  Navigation,
  Settings,
  Type,
  FileCode,
  TextSelect
} from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useCurrentUser } from '../../core/hooks/useCurrentUser'
import { useSettingsStore } from '../../core/store/SettingStore'
import Version from '../../components/Version'
import SettingDropdown from '../Navigation/components/SettingDropdown'
import ToolTip from '../../components/atoms/ToolTip'
import CapsLock from '../../components/capsLock'
import StatusbarMenu from './StatusbarMenu'

export interface StatusBarProps {
  /** Toggle right inspector sidebar */
  onToggleInspector?: () => void
  /** Open application settings dialog */
  onSettingsClick?: () => void
  /** Open theme picker */
  onThemeClick?: () => void
  /** Smoothly hide status bar during Zen Mode */
  isZenHidden?: boolean
}

interface CursorPosition {
  line: number
  col: number
  selectedChars: number
}

type StatusBarGroup = 'left' | 'center' | 'right'

export interface StatusBarItemMeta {
  id: string
  label: string
  group: StatusBarGroup
  menuGroup: string
  icon: React.ReactNode
  defaultVisible: boolean
  responsiveClass?: string
}

/**
 * Single source of truth for every toggleable status-bar element.
 * Order here drives both the rendered layout order and the context-menu order.
 */
const STATUS_BAR_ITEM_META: StatusBarItemMeta[] = [
  {
    id: 'capslock',
    label: 'Caps Lock Indicator',
    group: 'center',
    menuGroup: 'Editor',
    icon: <Type size={14} />,
    defaultVisible: true
  },
  {
    id: 'account',
    label: 'Settings',
    group: 'left',
    menuGroup: 'Settings',
    icon: <Settings size={14} />,
    defaultVisible: true
  },
  {
    id: 'version',
    label: "Version & What's New",
    group: 'left',
    menuGroup: 'Settings',
    icon: null,
    defaultVisible: true
  },
  {
    id: 'cursor',
    label: 'Cursor Position',
    group: 'right',
    menuGroup: 'Document',
    icon: <Navigation size={14} />,
    defaultVisible: true
  },
  {
    id: 'selection',
    label: 'Selection',
    group: 'right',
    menuGroup: 'Document',
    icon: <TextSelect size={14} />,
    defaultVisible: true
  },
  {
    id: 'words',
    label: 'Word Count',
    group: 'right',
    menuGroup: 'Document',
    icon: <FileText size={14} />,
    defaultVisible: true
  },
  {
    id: 'chars',
    label: 'Character Count',
    group: 'right',
    menuGroup: 'Document',
    icon: <Hash size={14} />,
    defaultVisible: true,
    responsiveClass: 'status-bar-hide-sm'
  },
  {
    id: 'encoding',
    label: 'Encoding',
    group: 'right',
    menuGroup: 'Document',
    icon: <FileCode size={14} />,
    defaultVisible: true,
    responsiveClass: 'status-bar-hide-xs'
  }
]

export const StatusBar: React.FC<StatusBarProps> = ({
  onToggleInspector,
  onSettingsClick,
  onThemeClick,
  isZenHidden = false
}) => {
  const selectedSnippet = useWorkspaceStore((s) => {
    const direct = s.selectedNote || (s as any).selectedSnippet
    if (direct) return direct
    const activeId = s.activeTabId
    if (!activeId) return null
    return (s.notes || []).find((n: any) => n.id === activeId) || null
  })
  const openReleaseNotesTab = useWorkspaceStore((s) => s.openReleaseNotesTab)
  const [cursorPos, setCursorPos] = useState<CursorPosition>({ line: 1, col: 1, selectedChars: 0 })
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false)
  const [imgError, setImgError] = useState<boolean>(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null)
  const { user, isLoggedIn } = useCurrentUser()
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  const statusBarItems = useSettingsStore((s) => s.settings.statusBarItems) as
    | Record<string, boolean>
    | null
    | undefined
  const updateSetting = useSettingsStore((s) => s.updateSetting)

  // Resolve item visibility. Absent keys fall back to the item default, so newly
  // added status bar items remain visible for users with a saved preference map.
  const visibleMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    const stored = statusBarItems && typeof statusBarItems === 'object' ? statusBarItems : null
    for (const item of STATUS_BAR_ITEM_META) {
      map[item.id] = stored && item.id in stored ? stored[item.id] !== false : item.defaultVisible
    }
    return map
  }, [statusBarItems])

  const isVisible = useCallback((id: string) => visibleMap[id] !== false, [visibleMap])

  const toggleItem = useCallback(
    (id: string) => {
      const base = statusBarItems && typeof statusBarItems === 'object' ? statusBarItems : {}
      updateSetting('statusBarItems', { ...base, [id]: !isVisible(id) })
    },
    [statusBarItems, isVisible, updateSetting]
  )

  const shortcutFor = useCallback(
    (id: string): string | undefined => {
      if (id === 'account') return isMac ? '⌘,' : 'Ctrl + ,'
      return undefined
    },
    [isMac]
  )

  const toggleDropdown = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setIsDropdownOpen((prev) => !prev)
  }, [])

  // Listen for active editor cursor movements and selection changes
  useEffect(() => {
    const handleCursorPos = (e: Event) => {
      const customEvent = e as CustomEvent<CursorPosition>
      if (customEvent.detail) {
        setCursorPos({
          line: customEvent.detail.line || 1,
          col: customEvent.detail.col || 1,
          selectedChars: customEvent.detail.selectedChars || 0
        })
      }
    }

    window.addEventListener('editor-cursor-pos', handleCursorPos)
    return () => window.removeEventListener('editor-cursor-pos', handleCursorPos)
  }, [])

  // Calculate live document statistics
  const stats = useMemo(() => {
    if (!selectedSnippet || !selectedSnippet.code) {
      return { chars: '0', words: '0' }
    }
    const text = selectedSnippet.code.trim()
    const chars = selectedSnippet.code.length
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    return {
      chars: chars.toLocaleString(),
      words: words.toLocaleString()
    }
  }, [selectedSnippet?.id, selectedSnippet?.code])

  const statusBarRef = useRef<HTMLDivElement | null>(null)
  const scrollableRef = useRef<HTMLDivElement | null>(null)

  // Enable invisible horizontal mouse wheel scrolling when status bar content overflows
  useEffect(() => {
    const el = scrollableRef.current
    const bar = statusBarRef.current
    if (!el || !bar) return

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault()
          el.scrollLeft += e.deltaY
        }
      }
    }

    bar.addEventListener('wheel', handleWheel, { passive: false })
    return () => bar.removeEventListener('wheel', handleWheel)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  const leftItems = STATUS_BAR_ITEM_META.filter((item) => item.group === 'left' && isVisible(item.id))
  const rightItems = STATUS_BAR_ITEM_META.filter(
    (item) => item.group === 'right' && isVisible(item.id)
  )

  const renderLeftItem = (id: string): React.ReactNode => {
    switch (id) {
      case 'account':
        return (
          <>
            <ToolTip
              text={
                isLoggedIn && user
                  ? user.name || user.email || 'Settings & Account'
                  : 'Settings & Account (Ctrl + ,)'
              }
              position="top"
            >
              <button
                ref={settingsBtnRef}
                type="button"
                className={`status-bar-btn status-bar-profile-btn ${isDropdownOpen ? 'active' : ''}`}
                onClick={toggleDropdown}
                data-testid="status-bar-settings-btn"
              >
                {isLoggedIn && user?.picture && !imgError ? (
                  <img
                    src={user.picture}
                    alt=""
                    onError={() => setImgError(true)}
                    style={{
                      width: '13px',
                      height: '13px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <Settings size={12} />
                )}
                <span>{isLoggedIn && user?.name ? user.name.split(' ')[0] : 'Settings'}</span>
              </button>
            </ToolTip>

            <SettingDropdown
              isOpen={isDropdownOpen}
              onClose={() => setIsDropdownOpen(false)}
              onSettingsClick={onSettingsClick}
              onThemeClick={onThemeClick}
              anchorRef={settingsBtnRef}
            />
          </>
        )
      case 'version':
        return (
          <ToolTip text="What's New — Open Release Notes" position="top">
            <button
              type="button"
              className="status-bar-btn"
              onClick={() => openReleaseNotesTab?.()}
              data-testid="status-bar-version-btn"
            >
              <Version />
            </button>
          </ToolTip>
        )
      default:
        return null
    }
  }

  const renderRightItem = (item: StatusBarItemMeta): React.ReactNode => {
    const responsive = item.responsiveClass ? ` ${item.responsiveClass}` : ''
    switch (item.id) {
      case 'cursor':
        return (
          <ToolTip text="Scroll to Cursor" position="top">
            <span
              className="status-bar-item interactive lualine-pos-badge"
              onClick={() => window.dispatchEvent(new CustomEvent('editor-scroll-to-cursor'))}
            >
              <Navigation size={11} />
              <span>
                Ln {cursorPos.line}, Col {cursorPos.col}
              </span>
            </span>
          </ToolTip>
        )
      case 'selection':
        return (
          <ToolTip text="Selected characters" position="top">
            <span className={`status-bar-item${responsive}`}>
              <TextSelect size={11} />
              <span>
                {cursorPos.selectedChars > 0 ? `${cursorPos.selectedChars} selected` : '0 sel'}
              </span>
            </span>
          </ToolTip>
        )
      case 'words':
        return (
          <ToolTip text="Click to view Details & Properties" position="top">
            <span className="status-bar-item interactive" onClick={onToggleInspector}>
              <FileText size={11} />
              <span>{stats.words} words</span>
            </span>
          </ToolTip>
        )
      case 'chars':
        return (
          <ToolTip text="Click to view Details & Statistics" position="top">
            <span
              className={`status-bar-item interactive${responsive}`}
              onClick={onToggleInspector}
            >
              <Hash size={11} />
              <span>{stats.chars} chars</span>
            </span>
          </ToolTip>
        )
      case 'encoding':
        return (
          <ToolTip text="Text Encoding" position="top">
            <span className={`status-bar-item${responsive}`}>
              <FileCode size={11} />
              <span>UTF-8</span>
            </span>
          </ToolTip>
        )
      default:
        return null
    }
  }

  return (
    <div
      className={`status-bar${isZenHidden ? ' zen-hidden' : ''}`}
      ref={statusBarRef}
      data-testid="status-bar"
      onContextMenu={handleContextMenu}
    >
      {/* Scrollable Status Bar Body */}
      <div className="status-bar-body" ref={scrollableRef}>
        {/* Left utility buttons */}
        <div className="status-bar-left">
          {leftItems.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <span className="status-bar-divider" />}
              {renderLeftItem(item.id)}
            </React.Fragment>
          ))}
        </div>

        {/* Guaranteed open & empty center */}
        <div className="status-bar-center">{isVisible('capslock') && <CapsLock showLabel={false} />}</div>

        {/* Right document & editor metrics */}
        <div className="status-bar-right">
          {(() => {
            const visibleRendered = rightItems
              .map((item) => ({ item, node: renderRightItem(item) }))
              .filter((entry) => entry.node !== null)

            return visibleRendered.map(({ item, node }, index) => {
              const dividerClass = item.responsiveClass
                ? `status-bar-divider ${item.responsiveClass}`
                : 'status-bar-divider'
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && <span className={dividerClass} />}
                  {node}
                </React.Fragment>
              )
            })
          })()}
        </div>
      </div>

      {contextMenu && (
        <StatusbarMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={STATUS_BAR_ITEM_META}
          isVisible={isVisible}
          shortcutFor={shortcutFor}
          onToggle={toggleItem}
          onClose={closeContextMenu}
        />
      )}
    </div>
  )
}

export default React.memo(StatusBar)
