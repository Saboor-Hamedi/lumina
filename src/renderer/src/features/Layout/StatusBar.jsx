import React, { useState, useEffect, useMemo, useRef } from 'react'
import { BookOpen, PanelRight, Keyboard, FileText, Hash, Clock, Navigation, Compass, Settings, Shapes } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useCurrentUser } from '../../core/hooks/useCurrentUser'
import SettingDropdown from '../Navigation/components/SettingDropdown'
import ToolTip from '../../components/atoms/ToolTip'
import CapsLock from '../../components/capsLock'
import '../../assets/statusbar.css'

const StatusBar = ({
  onToggleInspector,
  onDocsClick,
  onShortcutsClick,
  onSettingsClick,
  onThemeClick
}) => {
  const selectedSnippet = useWorkspaceStore((s) => s.selectedSnippet)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1, selectedChars: 0 })
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  const settingsBtnRef = useRef(null)
  const { user, isLoggedIn } = useCurrentUser()

  const toggleDropdown = (e) => {
    if (e) e.stopPropagation()
    setIsDropdownOpen((prev) => !prev)
  }

  // Listen for active editor cursor movements and selection changes
  useEffect(() => {
    const handleCursorPos = (e) => {
      if (e.detail) {
        setCursorPos({
          line: e.detail.line || 1,
          col: e.detail.col || 1,
          selectedChars: e.detail.selectedChars || 0
        })
      }
    }

    window.addEventListener('editor-cursor-pos', handleCursorPos)
    return () => window.removeEventListener('editor-cursor-pos', handleCursorPos)
  }, [])

  // Calculate live document statistics
  const stats = useMemo(() => {
    if (!selectedSnippet || !selectedSnippet.code) {
      return { chars: 0, words: 0, readTime: '0 min' }
    }
    const text = selectedSnippet.code.trim()
    const chars = selectedSnippet.code.length
    const words = text ? text.split(/\s+/).length : 0
    const readMinutes = Math.max(1, Math.ceil(words / 200))
    return {
      chars: chars.toLocaleString(),
      words: words.toLocaleString(),
      readTime: `${readMinutes} min read`
    }
  }, [selectedSnippet?.code])

  const statusBarRef = React.useRef(null)

  // Enable invisible horizontal mouse wheel scrolling when status bar content overflows
  useEffect(() => {
    const el = statusBarRef.current
    if (!el) return

    const handleWheel = (e) => {
      // Check if content overflows horizontally
      if (el.scrollWidth > el.clientWidth) {
        // If vertical scrolling on mouse wheel, map deltaY to horizontal scrollLeft
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault()
          el.scrollLeft += e.deltaY
        }
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  return (
    <div className="status-bar" ref={statusBarRef} data-testid="status-bar">
      {/* Left utility buttons */}
      <div className="status-bar-left">
        <ToolTip
          text={
            isLoggedIn && user
              ? (user.name || user.email || 'Settings & Account')
              : 'Settings & Account (Ctrl + ,)'
          }
          position="top"
        >
          <button
            ref={settingsBtnRef}
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

        <span className="status-bar-divider" />

        <ToolTip text="Toggle Details & Outline (Ctrl + \)" position="top">
          <button className="status-bar-btn" onClick={onToggleInspector}>
            <PanelRight size={11} />
            <span>Details</span>
          </button>
        </ToolTip>

        <span className="status-bar-divider" />

        <ToolTip text="Documentation (Ctrl + D)" position="top">
          <button className="status-bar-btn" onClick={onDocsClick}>
            <BookOpen size={11} />
            <span>Docs</span>
          </button>
        </ToolTip>

        <span className="status-bar-divider status-bar-hide-sm" />

        <ToolTip text="Interactive Guide" position="top">
          <button
            className="status-bar-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('open-guide'))}
          >
            <Compass size={11} />
            <span className="status-bar-label-collapse">Guide</span>
          </button>
        </ToolTip>

        <span className="status-bar-divider status-bar-hide-sm" />

        <ToolTip text="Keyboard Shortcuts (Ctrl + /)" position="top">
          <button className="status-bar-btn" onClick={onShortcutsClick}>
            <Keyboard size={11} />
            <span className="status-bar-label-collapse">Shortcuts</span>
          </button>
        </ToolTip>

        <span className="status-bar-divider status-bar-hide-sm" />

        <ToolTip text="Inline Drawing Canvas (Ctrl + Shift + /)" position="top">
          <button
            className="status-bar-btn"
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-inline-drawing'))}
          >
            <Shapes size={11} />
            <span className="status-bar-label-collapse">Draw</span>
          </button>
        </ToolTip>
      </div>

      {/* Guaranteed open & empty center */}
      {/* Center contains exclusively the glowing CapsLock blob with no text */}
      <div className="status-bar-center">
        <CapsLock showLabel={false} />
      </div>

      {/* Right document & editor metrics */}
      <div className="status-bar-right">
        {selectedSnippet && (
          <>
            <ToolTip text="Scroll to Cursor" position="top">
              <span
                className="status-bar-item interactive"
                onClick={() => window.dispatchEvent(new CustomEvent('editor-scroll-to-cursor'))}
              >
                <Navigation size={11} />
                <span>
                  Ln {cursorPos.line}, Col {cursorPos.col}
                  {cursorPos.selectedChars > 0 && ` (${cursorPos.selectedChars} sel)`}
                </span>
              </span>
            </ToolTip>

            <span className="status-bar-divider" />

            <ToolTip text="Click to view Details & Properties" position="top">
              <span
                className="status-bar-item interactive"
                onClick={onToggleInspector}
              >
                <FileText size={11} />
                <span>{stats.words} words</span>
              </span>
            </ToolTip>

            <span className="status-bar-divider status-bar-hide-sm" />

            <ToolTip text="Click to view Details & Statistics" position="top">
              <span
                className="status-bar-item interactive status-bar-hide-sm"
                onClick={onToggleInspector}
              >
                <Hash size={11} />
                <span>{stats.chars} chars</span>
              </span>
            </ToolTip>

            <span className="status-bar-divider status-bar-hide-md" />

            <ToolTip text="Estimated Reading Time • 200 WPM" position="top">
              <span
                className="status-bar-item interactive status-bar-hide-md"
                onClick={onToggleInspector}
              >
                <Clock size={11} />
                <span>{stats.readTime}</span>
              </span>
            </ToolTip>

            <span className="status-bar-divider status-bar-hide-xs" />

            <ToolTip text="Document Format • UTF-8" position="top">
              <span className="status-bar-item status-bar-hide-xs">
                <span>Markdown</span>
                <span style={{ opacity: 0.5 }}>•</span>
                <span>UTF-8</span>
              </span>
            </ToolTip>
          </>
        )}
      </div>
    </div>
  )
}

export default React.memo(StatusBar)
