// components/terminal/TerminalPane.tsx
// A single terminal instance. Handles mounting, PTY binding, and lifecycle.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { useTerminalInstance, type PtyTransport } from '../../core/terminal/useTerminalInstance'
import type { TerminalSession } from '../../core/terminal/types'
import { openNoteInEditor } from '../AI/components/LuminaChatLink'

interface Props {
  session: TerminalSession
  visible: boolean
  /** Factory that spawns a PTY for this session (inject your backend here) */
  spawnTransport: (session: TerminalSession) => PtyTransport
  onStatus: (id: string, status: TerminalSession['status'], code?: number) => void
}

export const TerminalPane = memo(function TerminalPane({ session, visible, spawnTransport, onStatus }: Props) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Spawn the transport once per session. Recreated if the session id changes.
  const transport = useMemo(() => spawnTransport(session), [session.id, session.shell, session.cwd])

  const handleExit = useCallback(
    (code?: number) => onStatus(session.id, 'exited', code),
    [session.id, onStatus]
  )

  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true)
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })
  }, [])

  const handleOpenFilePath = useCallback((filePath: string) => {
    if (!filePath) return
    openNoteInEditor(filePath)
  }, [])

  const { focus, fit, refresh, findNext, findPrevious, clearSearch } = useTerminalInstance({
    container,
    transport,
    onExit: handleExit,
    onOpenSearch: handleOpenSearch,
    onOpenFilePath: handleOpenFilePath
  })

  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false)
    clearSearch()
    focus()
  }, [clearSearch, focus])

  useEffect(() => {
    if (isSearchOpen && searchQuery) {
      findNext(searchQuery, caseSensitive)
    } else if (isSearchOpen && !searchQuery) {
      clearSearch()
    }
  }, [isSearchOpen, searchQuery, caseSensitive, findNext, clearSearch])

  useEffect(() => {
    onStatus(session.id, 'running')
    if (visible) {
      focus()
    }
  }, [session.id, onStatus, visible, focus])

  // Refocus, refit and redraw immediately when tab transitions to visible to prevent caret lag/overlap
  const prevVisibleRef = useRef(visible)
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      requestAnimationFrame(() => {
        fit()
        refresh()
        focus()
      })
    }
    prevVisibleRef.current = visible
  }, [visible, fit, refresh, focus])

  return (
    <div
      className="lumina-term-pane"
      style={{
        position: 'absolute',
        inset: 0,
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: visible ? 1 : 0,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-editor, var(--bg-app, #0c0c0e))'
      }}
    >
      {isSearchOpen && (
        <div
          className="lumina-term-search-bar"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              handleCloseSearch()
            }
          }}
        >
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            placeholder="Find in terminal…"
            aria-label="Find in terminal"
            className="lumina-term-search-input"
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (e.shiftKey) {
                  findPrevious(searchQuery, caseSensitive)
                } else {
                  findNext(searchQuery, caseSensitive)
                }
              }
            }}
          />
          <button
            type="button"
            className={`lumina-term-search-btn${caseSensitive ? ' is-active' : ''}`}
            title="Match Case"
            aria-label="Match Case"
            onClick={() => setCaseSensitive((v) => !v)}
          >
            Aa
          </button>
          <button
            type="button"
            className="lumina-term-search-btn"
            title="Previous Match (Shift+Enter)"
            aria-label="Previous Match"
            onClick={() => findPrevious(searchQuery, caseSensitive)}
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            className="lumina-term-search-btn"
            title="Next Match (Enter)"
            aria-label="Next Match"
            onClick={() => findNext(searchQuery, caseSensitive)}
          >
            <ChevronDown size={13} />
          </button>
          <button
            type="button"
            className="lumina-term-search-btn"
            title="Close Search (Esc)"
            aria-label="Close Search"
            onClick={handleCloseSearch}
          >
            <X size={13} />
          </button>
        </div>
      )}
      <div
        ref={setContainer}
        className="lumina-term-container"
        onClick={() => focus()}
        style={{
          flex: 1,
          minHeight: 0,
          height: '100%',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--bg-editor, var(--bg-app, #0c0c0e))'
        }}
      />
    </div>
  )
})
