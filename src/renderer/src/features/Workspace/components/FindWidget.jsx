import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Replace, X, ChevronUp, ChevronDown, Type, AlignLeft, Regex } from 'lucide-react'
import './FindWidget.css'

const FindWidget = ({ editorView, onClose, initialReplaceMode = false }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [isReplaceMode, setIsReplaceMode] = useState(initialReplaceMode)
  const [matchCase, setMatchCase] = useState(false)
  const [matchWholeWord, setMatchWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [matchCount, setMatchCount] = useState({ current: 0, total: 0 })
  const [matches, setMatches] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)

  const searchInputRef = useRef(null)
  const replaceInputRef = useRef(null)

  // Focus search input when widget opens, or replace input if replace mode is enabled
  useEffect(() => {
    if (isReplaceMode && replaceInputRef.current) {
      replaceInputRef.current.focus()
    } else if (searchInputRef.current) {
      searchInputRef.current.focus()
      searchInputRef.current.select()
    }
  }, [isReplaceMode])

  // Update replace mode when initialReplaceMode prop changes
  useEffect(() => {
    setIsReplaceMode(initialReplaceMode)
  }, [initialReplaceMode])

  // Listen for external focus/search query events
  useEffect(() => {
    const handleFocusSearch = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus()
        searchInputRef.current.select()
      }
    }

    const handleSetQuery = (e) => {
      const { query } = e.detail || {}
      if (query && searchInputRef.current) {
        setSearchQuery(query)
        searchInputRef.current.focus()
        searchInputRef.current.select()
      }
    }

    const handleToggleReplace = () => {
      setIsReplaceMode((prev) => {
        const next = !prev
        // After state updates, focus the appropriate input
        setTimeout(() => {
          if (next && replaceInputRef.current) {
            replaceInputRef.current.focus()
            replaceInputRef.current.select()
          } else if (!next && searchInputRef.current) {
            searchInputRef.current.focus()
            searchInputRef.current.select()
          }
        }, 0)
        return next
      })
    }

    window.addEventListener('find-widget-focus-search', handleFocusSearch)
    window.addEventListener('find-widget-set-query', handleSetQuery)
    window.addEventListener('find-widget-toggle-replace', handleToggleReplace)
    return () => {
      window.removeEventListener('find-widget-focus-search', handleFocusSearch)
      window.removeEventListener('find-widget-set-query', handleSetQuery)
      window.removeEventListener('find-widget-toggle-replace', handleToggleReplace)
    }
  }, [])

  // Compute matches and update highlights when query/options change
  useEffect(() => {
    if (!editorView) return

    const text = editorView.state.doc.toString()

    if (!searchQuery) {
      setMatches([])
      setCurrentIndex(-1)
      setMatchCount({ current: 0, total: 0 })
      window.dispatchEvent(new CustomEvent('search-clear'))
      return
    }

    let pattern = searchQuery
    if (!useRegex) {
      pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
    if (matchWholeWord) {
      pattern = `\\b${pattern}\\b`
    }

    try {
      const regex = new RegExp(pattern, matchCase ? 'g' : 'gi')
      const allMatches = [...text.matchAll(regex)].map((m) => ({
        from: m.index,
        to: m.index + m[0].length
      }))

      setMatches(allMatches)

      const selection = editorView.state.selection.main
      let idx = -1
      if (allMatches.length > 0) {
        const pos = selection.from
        idx = allMatches.findIndex((m) => m.from <= pos && m.to >= pos)
        if (idx === -1) idx = 0
      }

      setCurrentIndex(idx)
      setMatchCount({
        current: idx === -1 ? 0 : idx + 1,
        total: allMatches.length
      })

      // Notify editor to draw highlights (reuses global search highlighter)
      window.dispatchEvent(
        new CustomEvent('search-update', {
          detail: {
            searchQuery,
            pattern: new RegExp(pattern, matchCase ? 'g' : 'gi'),
            matchCase,
            matchWholeWord,
            useRegex
          }
        })
      )
    } catch (err) {
      console.error('[FindWidget] Search update error:', err)
      setMatches([])
      setCurrentIndex(-1)
      setMatchCount({ current: 0, total: 0 })
      window.dispatchEvent(new CustomEvent('search-clear'))
    }
  }, [editorView, searchQuery, matchCase, matchWholeWord, useRegex])

  const jumpToMatch = useCallback(
    (index) => {
      if (!editorView || !matches.length) return
      const clamped = ((index % matches.length) + matches.length) % matches.length
      const match = matches[clamped]
      const view = editorView
      const docLength = view.state.doc.length
      const from = Math.max(0, Math.min(match.from, docLength))
      const to = Math.max(from, Math.min(match.to, docLength))

      view.dispatch({
        selection: { anchor: from, head: to },
        scrollIntoView: true
      })
      view.focus()

      setCurrentIndex(clamped)
      setMatchCount({ current: clamped + 1, total: matches.length })
    },
    [editorView, matches]
  )

  const handleFindNext = useCallback(() => {
    if (!editorView || !searchQuery || matches.length === 0) return
    const nextIndex = currentIndex === -1 ? 0 : currentIndex + 1
    jumpToMatch(nextIndex)
  }, [editorView, searchQuery, matches.length, currentIndex, jumpToMatch])

  const handleFindPrevious = useCallback(() => {
    if (!editorView || !searchQuery || matches.length === 0) return
    const prevIndex = currentIndex === -1 ? matches.length - 1 : currentIndex - 1
    jumpToMatch(prevIndex)
  }, [editorView, searchQuery, matches.length, currentIndex, jumpToMatch])

  const handleReplaceNext = useCallback(() => {
    if (!editorView || !searchQuery || matches.length === 0) return
    const index = currentIndex === -1 ? 0 : currentIndex
    const match = matches[index]
    const view = editorView
    const doc = view.state.doc
    const docLength = doc.length
    const from = Math.max(0, Math.min(match.from, docLength))
    const to = Math.max(from, Math.min(match.to, docLength))

    const tr = view.state.update({
      changes: { from, to, insert: replaceQuery },
      selection: { anchor: from + replaceQuery.length }
    })
    view.dispatch(tr)

    // Recompute matches after replace
    setTimeout(() => {
      if (!view || !view.state) return
      const newText = view.state.doc.toString()
      let pattern = searchQuery
      if (!useRegex) pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (matchWholeWord) pattern = `\\b${pattern}\\b`
      try {
        const regex = new RegExp(pattern, matchCase ? 'g' : 'gi')
        const allMatches = [...newText.matchAll(regex)].map((m) => ({
          from: m.index,
          to: m.index + m[0].length
        }))
        setMatches(allMatches)
        const newIndex = Math.min(index, allMatches.length - 1)
        setCurrentIndex(allMatches.length ? newIndex : -1)
        setMatchCount({
          current: allMatches.length ? newIndex + 1 : 0,
          total: allMatches.length
        })
      } catch {
        setMatches([])
        setCurrentIndex(-1)
        setMatchCount({ current: 0, total: 0 })
      }
    }, 0)
  }, [editorView, searchQuery, replaceQuery, matches, currentIndex, matchCase, matchWholeWord, useRegex])

  const handleReplaceAll = useCallback(() => {
    if (!editorView || !searchQuery || matches.length === 0) return
    const view = editorView
    const doc = view.state.doc
    let content = doc.toString()

    // Apply replacements from end to start to keep indices valid
    const sorted = [...matches].sort((a, b) => b.from - a.from)
    sorted.forEach((m) => {
      content = `${content.slice(0, m.from)}${replaceQuery}${content.slice(m.to)}`
    })

    view.dispatch({
      changes: { from: 0, to: doc.length, insert: content }
    })

    setMatches([])
    setCurrentIndex(-1)
    setMatchCount({ current: 0, total: 0 })
    window.dispatchEvent(new CustomEvent('search-clear'))
  }, [editorView, searchQuery, replaceQuery, matches])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setSearchQuery('')
        window.dispatchEvent(new CustomEvent('search-clear'))
        onClose()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (e.shiftKey) {
          handleFindPrevious()
        } else {
          handleFindNext()
        }
      } else if (e.key === 'F3') {
        e.preventDefault()
        if (e.shiftKey) {
          handleFindPrevious()
        } else {
          handleFindNext()
        }
      }
    },
    [handleFindNext, handleFindPrevious, onClose]
  )

  const handleReplaceKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.ctrlKey || e.metaKey) {
          handleReplaceAll()
        } else {
          handleReplaceNext()
        }
      }
    },
    [handleReplaceNext, handleReplaceAll]
  )

  return (
    <div className="find-widget">
      <div className="find-widget-content">
        {/* Left column: search + replace inputs (same width) */}
        <div className="find-inputs-container">
          {/* Search Input */}
          <div className="find-input-group">
            <Search size={12} className="find-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="find-input"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="find-input-actions">
              <button
                className={`find-action-btn ${matchCase ? 'active' : ''}`}
                onClick={() => setMatchCase(!matchCase)}
                title="Match Case"
              >
                <Type size={11} />
              </button>
              <button
                className={`find-action-btn ${matchWholeWord ? 'active' : ''}`}
                onClick={() => setMatchWholeWord(!matchWholeWord)}
                title="Match Whole Word"
              >
                <AlignLeft size={11} />
              </button>
              <button
                className={`find-action-btn ${useRegex ? 'active' : ''}`}
                onClick={() => setUseRegex(!useRegex)}
                title="Use Regular Expression"
              >
                <Regex size={11} />
              </button>
              {searchQuery && (
                <button
                  className="find-action-btn"
                  onClick={() => {
                    setSearchQuery('')
                    searchInputRef.current?.focus()
                  }}
                  title="Clear"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="find-match-count">
                {matchCount.total > 0
                  ? `${matchCount.current} of ${matchCount.total}`
                  : 'No results'}
              </div>
            )}
          </div>

          {/* Replace Input - Dropdown (same width as search) */}
          {isReplaceMode && (
            <div className="find-replace-row">
              <div className="find-input-group">
                <Replace size={12} className="find-icon" />
                <input
                  ref={replaceInputRef}
                  type="text"
                  className="find-input"
                  placeholder="Replace"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  onKeyDown={handleReplaceKeyDown}
                />
                <div className="find-input-actions">
                  <button
                    className="find-action-btn replace-action-btn"
                    onClick={handleReplaceNext}
                    disabled={!searchQuery.trim()}
                    title="Replace (Enter)"
                  >
                    <Replace size={11} />
                  </button>
                  <button
                    className="find-action-btn replace-action-btn replace-all-action-btn"
                    onClick={handleReplaceAll}
                    disabled={!searchQuery.trim()}
                    title="Replace All (Ctrl+Enter)"
                  >
                    <Replace size={11} />
                    <span className="replace-all-badge">All</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: navigation + toggle + close (fixed) */}
        <div className="find-controls">
          <div className="find-navigation">
            <button
              className="find-nav-btn"
              onClick={handleFindPrevious}
              disabled={!searchQuery.trim() || !matches.length}
              title="Previous (Shift+Enter)"
            >
              <ChevronUp size={12} />
            </button>
            <button
              className="find-nav-btn"
              onClick={handleFindNext}
              disabled={!searchQuery.trim() || !matches.length}
              title="Next (Enter)"
            >
              <ChevronDown size={12} />
            </button>
          </div>
          <button
            className="find-toggle-btn"
            onClick={() => setIsReplaceMode(!isReplaceMode)}
            title={isReplaceMode ? 'Hide Replace' : 'Show Replace (Ctrl+H)'}
          >
            <Replace size={12} />
          </button>
          <button
            className="find-close-btn"
            onClick={onClose}
            title="Close (Esc)"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default FindWidget
