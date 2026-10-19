/**
 * =========================================================================
 * StatusBar Component (`StatusBar.tsx`)
 * =========================================================================
 *
 * System bottom status bar for Lumina.
 *
 * Architecture & Features:
 * - Registry-driven: every element (mode badge, actions, center blob, metrics)
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
  PanelRight,
  FileText,
  Hash,
  Navigation,
  Settings,
  LayoutGrid,
  BookOpen,
  Keyboard,
  Compass,
  Monitor,
  Type,
  FileCode,
  Clock,
  TextSelect
} from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useCurrentUser } from '../../core/hooks/useCurrentUser'
import { useSettingsStore } from '../../core/store/SettingStore'
import SettingDropdown from '../Navigation/components/SettingDropdown'
import ToolTip from '../../components/atoms/ToolTip'
import CapsLock from '../../components/capsLock'
import StatusbarMenu from './StatusbarMenu'
import '../../assets/statusbar.css'

export interface StatusBarProps {
  /** Toggle right inspector sidebar */
  onToggleInspector?: () => void
  /** Open application settings dialog */
  onSettingsClick?: () => void
  /** Open theme picker */
  onThemeClick?: () => void
  /** Open documentation */
  onDocsClick?: () => void
  /** Open keyboard shortcuts dialog */
  onShortcutsClick?: () => void
  /** Open guide */
  onGuideClick?: () => void
}

interface CursorPosition {
  line: number
  col: number
  selectedChars: number
}

type StatusBarGroup = 'mode' | 'left' | 'center' | 'right'

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
    id: 'mode',
    label: 'Editor Mode',
    group: 'mode',
    menuGroup: 'Editor',
    icon: <Monitor size={14} />,
    defaultVisible: true
  },
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
    id: 'details',
    label: 'Details',
    group: 'left',
    menuGroup: 'Settings',
    icon: <PanelRight size={14} />,
    defaultVisible: true
  },
  {
    id: 'canvas',
    label: 'Canvas',
    group: 'left',
    menuGroup: 'Settings',
    icon: <LayoutGrid size={14} />,
    defaultVisible: true
  },
  {
    id: 'docs',
    label: 'Documentation',
    group: 'left',
    menuGroup: 'Settings',
    icon: <BookOpen size={14} />,
    defaultVisible: true
  },
  {
    id: 'shortcuts',
    label: 'Keyboard Shortcuts',
    group: 'left',
    menuGroup: 'Settings',
    icon: <Keyboard size={14} />,
    defaultVisible: true
  },
  {
    id: 'guide',
    label: 'Guide',
    group: 'left',
    menuGroup: 'Settings',
    icon: <Compass size={14} />,
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
    id: 'readTime',
    label: 'Reading Time',
    group: 'right',
    menuGroup: 'Document',
    icon: <Clock size={14} />,
    defaultVisible: true,
    responsiveClass: 'status-bar-hide-xs'
  },
  {
    id: 'language',
    label: 'Language Mode',
    group: 'right',
    menuGroup: 'Document',
    icon: <Type size={14} />,
    defaultVisible: true,
    responsiveClass: 'status-bar-hide-xs'
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
  onDocsClick,
  onShortcutsClick,
  onGuideClick
}) => {
  const selectedSnippet = useWorkspaceStore((s) => s.selectedNote || (s as any).selectedSnippet)
  const [cursorPos, setCursorPos] = useState<CursorPosition>({ line: 1, col: 1, selectedChars: 0 })
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false)
  const [imgError, setImgError] = useState<boolean>(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null)
  const { user, isLoggedIn } = useCurrentUser()
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  const userShortcuts = useSettingsStore((s) => s.settings.shortcuts) || {}
  const statusBarItems = useSettingsStore((s) => s.settings.statusBarItems) as
    | Record<string, boolean>
    | null
    | undefined
  const updateSetting = useSettingsStore((s) => s.updateSetting)
  const inspectorShortcut = userShortcuts.toggleInspector || (isMac ? '⌘I' : 'Ctrl + I')
  const rawCanvas = userShortcuts.canvasDrawer || userShortcuts.canvas
  const canvasShortcut =
    rawCanvas && rawCanvas !== 'Ctrl + Shift + /'
      ? rawCanvas
      : isMac
        ? '⌘⇧;'
        : 'Ctrl + Shift + ;'

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
      if (id === 'details') return inspectorShortcut
      if (id === 'canvas') return canvasShortcut
      return undefined
    },
    [isMac, inspectorShortcut, canvasShortcut]
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
      return { chars: '0', words: '0', readTime: '0 min read' }
    }
    const text = selectedSnippet.code.trim()
    const chars = selectedSnippet.code.length
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    const readTime = Math.max(1, Math.ceil(words / 200)) + ' min read'
    return {
      chars: chars.toLocaleString(),
      words: words.toLocaleString(),
      readTime
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
      case 'details':
        return (
          <ToolTip text={`Toggle Details (${inspectorShortcut})`} position="top">
            <button type="button" className="status-bar-btn" onClick={onToggleInspector}>
              <PanelRight size={11} />
              <span>Details</span>
            </button>
          </ToolTip>
        )
      case 'canvas':
        return (
          <ToolTip text={`Canvas (${canvasShortcut})`} position="top">
            <button
              type="button"
              className="status-bar-btn"
              onClick={() => window.dispatchEvent(new CustomEvent('open-canvas-tab'))}
            >
              <LayoutGrid size={11} />
              <span className="status-bar-label-collapse">Canvas</span>
            </button>
          </ToolTip>
        )
      case 'docs':
        return (
          <ToolTip text="Documentation" position="top">
            <button type="button" className="status-bar-btn" onClick={onDocsClick}>
              <BookOpen size={11} />
              <span>Docs</span>
            </button>
          </ToolTip>
        )
      case 'shortcuts':
        return (
          <ToolTip text="Keyboard Shortcuts" position="top">
            <button type="button" className="status-bar-btn" onClick={onShortcutsClick}>
              <Keyboard size={11} />
              <span>Shortcuts</span>
            </button>
          </ToolTip>
        )
      case 'guide':
        return (
          <ToolTip text="Guide" position="top">
            <button type="button" className="status-bar-btn" onClick={onGuideClick}>
              <Compass size={11} />
              <span>Guide</span>
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
        if (cursorPos.selectedChars <= 0) return null
        return (
          <ToolTip text="Selected characters" position="top">
            <span className={`status-bar-item${responsive}`}>
              <TextSelect size={11} />
              <span>{cursorPos.selectedChars} selected</span>
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
      case 'readTime':
        return (
          <ToolTip text="Reading Time" position="top">
            <span className={`status-bar-item${responsive}`}>
              <span>{stats.readTime}</span>
            </span>
          </ToolTip>
        )
      case 'language':
        return (
          <ToolTip text="Language Mode" position="top">
            <span className={`status-bar-item${responsive}`}>
              <Type size={11} />
              <span>Markdown</span>
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
      className="status-bar"
      ref={statusBarRef}
      data-testid="status-bar"
      onContextMenu={handleContextMenu}
    >
      {/* Lualine Mode Badge — Completely static on the left (never shakes or jitters) */}
      {isVisible('mode') && (
        <div
          className="lualine-mode-badge"
          data-mode={cursorPos.selectedChars > 0 ? 'visual' : 'normal'}
        >
          {cursorPos.selectedChars > 0 ? 'VISUAL' : 'NORMAL'}
        </div>
      )}

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
          {selectedSnippet &&
            rightItems.map((item, index) => {
              const rendered = renderRightItem(item)
              if (!rendered) return null
              const dividerClass = item.responsiveClass
                ? `status-bar-divider ${item.responsiveClass}`
                : 'status-bar-divider'
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && <span className={dividerClass} />}
                  {rendered}
                </React.Fragment>
              )
            })}
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
