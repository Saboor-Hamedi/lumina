import React, { useState, useEffect, useMemo } from 'react'
import { BookOpen, PanelRight, Keyboard, FileText, Hash, Clock, Navigation } from 'lucide-react'
import { useVaultStore } from '../../../core/store/useVaultStore'
import ToolTip from '../../../components/atoms/ToolTip'
import '../../../assets/statusbar.css'

const StatusBar = ({
  onToggleInspector,
  onDocsClick,
  onShortcutsClick
}) => {
  const selectedSnippet = useVaultStore((s) => s.selectedSnippet)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1, selectedChars: 0 })

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

  return (
    <div className="status-bar" data-testid="status-bar">
      {/* Left utility buttons */}
      <div className="status-bar-left">
        <ToolTip text="Toggle Details & Outline (Ctrl + \)" position="top">
          <button className="status-bar-btn" onClick={onToggleInspector}>
            <PanelRight size={12} />
            <span>Details</span>
          </button>
        </ToolTip>

        <span className="status-bar-divider" />

        <ToolTip text="Documentation (Ctrl + D)" position="top">
          <button className="status-bar-btn" onClick={onDocsClick}>
            <BookOpen size={12} />
            <span>Docs</span>
          </button>
        </ToolTip>

        <span className="status-bar-divider" />

        <ToolTip text="Keyboard Shortcuts (Ctrl + /)" position="top">
          <button className="status-bar-btn" onClick={onShortcutsClick}>
            <Keyboard size={12} />
            <span>Shortcuts</span>
          </button>
        </ToolTip>
      </div>

      {/* Right document & editor metrics */}
      <div className="status-bar-right">
        {selectedSnippet && (
          <>
            <ToolTip text="Cursor Position • Line & Column" position="top">
              <span className="status-bar-item">
                <Navigation size={11} style={{ opacity: 0.7 }} />
                <span>
                  Ln {cursorPos.line}, Col {cursorPos.col}
                  {cursorPos.selectedChars > 0 && ` (${cursorPos.selectedChars} sel)`}
                </span>
              </span>
            </ToolTip>

            <span className="status-bar-divider" />

            <ToolTip text="Total Document Words" position="top">
              <span className="status-bar-item">
                <FileText size={11} style={{ opacity: 0.7 }} />
                <span>{stats.words} words</span>
              </span>
            </ToolTip>

            <span className="status-bar-divider" />

            <ToolTip text="Total Document Characters" position="top">
              <span className="status-bar-item">
                <Hash size={11} style={{ opacity: 0.7 }} />
                <span>{stats.chars} chars</span>
              </span>
            </ToolTip>

            <span className="status-bar-divider" />

            <ToolTip text="Estimated Reading Time • 200 WPM" position="top">
              <span className="status-bar-item">
                <Clock size={11} style={{ opacity: 0.7 }} />
                <span>{stats.readTime}</span>
              </span>
            </ToolTip>

            <span className="status-bar-divider" />

            <ToolTip text="Document Format • UTF-8" position="top">
              <span className="status-bar-item">
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
