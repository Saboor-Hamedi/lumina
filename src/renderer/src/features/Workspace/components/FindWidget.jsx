import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Decoration } from '@codemirror/view'
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts'
import { updateSearchHighlights } from '../../Editor/hooks/useEditorExtensions'
import { applyTableSearchHighlight, clearTableSearchHighlight } from '../../table/tableCell'
import ToolTip from '../../../components/atoms/ToolTip'
import './FindWidget.css'

// ==========================================
// Pixel-Perfect VS Code Codicons as SVGs
// ==========================================

const CaseSensitiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.88 2.5h1.24l2.84 8.5H7.72l-.74-2.32H4.02l-.74 2.32H2.04L4.88 2.5zm1.74 5.04L5.5 4.09 4.38 7.54h2.24zM10.83 6.36h1.15v4.64h-1.15v-.65a1.86 1.86 0 0 1-1.44.75c-1.15 0-1.84-.85-1.84-2.07s.71-2.12 1.84-2.12c.57 0 1.07.26 1.44.73V6.36zm-.02 2.67c0-.75-.46-1.17-1.04-1.17s-1.04.42-1.04 1.17.46 1.17 1.04 1.17 1.04-.42 1.04-1.17z" />
  </svg>
)

const WholeWordIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.78 3.5h1.02l2.35 6.5H6.12l-.61-1.78H3.07l-.61 1.78H1.43L3.78 3.5zm1.44 3.86L4.29 4.72 3.37 7.36h1.85zM8.33 3.5h1.15v2.85a1.6 1.6 0 0 1 1.25-.6c1.07 0 1.77.78 1.77 2.12s-.7 2.13-1.77 2.13a1.6 1.6 0 0 1-1.25-.6V10H8.33V3.5zm1.15 4.37c0 .77.44 1.18 1.02 1.18.58 0 1.02-.41 1.02-1.18s-.44-1.17-1.02-1.17c-.58 0-1.02.4-1.02 1.17zM1.5 12.5h13v1h-13v-1z" />
  </svg>
)

const RegexIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7.32-6.5l.88.5-2.2 3.82 2.2 3.82-.88.5-2.2-3.82-2.2 3.82-.88-.5 2.2-3.82-2.2-3.82.88-.5 2.2 3.82 2.2-3.82z" />
  </svg>
)

const PreserveCaseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2.88 3.5h1.24l2.84 8.5H5.72l-.74-2.32H2.02l-.74 2.32H.04L2.88 3.5zm1.74 5.04L3.5 5.09 2.38 8.54h2.24zM8.88 3.5h2.8c1.3 0 2.07.65 2.07 1.7 0 .68-.38 1.25-.97 1.48.78.22 1.25.86 1.25 1.68 0 1.2-.95 1.89-2.32 1.89H8.88V3.5zm1.25 3.12h1.38c.6 0 .95-.28.95-.74 0-.48-.35-.74-.95-.74h-1.38v1.48zm0 2.63h1.55c.67 0 1.05-.3 1.05-.8 0-.52-.38-.82-1.05-.82h-1.55v1.62z" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M6.15 3.15L5.45 3.85L9.6 8L5.45 12.15L6.15 12.85L11 8L6.15 3.15Z" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M3.15 6.15L3.85 5.45L8 9.6L12.15 5.45L12.85 6.15L8 11L3.15 6.15Z" />
  </svg>
)

const ArrowUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M8 3.5l4.35 4.35-.7.7L8.5 5.4v7.1h-1V5.4L4.35 8.55l-.7-.7L8 3.5z" />
  </svg>
)

const ArrowDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M8 12.5l-4.35-4.35.7-.7L7.5 10.6V3.5h1v7.1l3.15-3.15.7.7L8 12.5z" />
  </svg>
)

const SelectionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3 4h10v1H3V4zm0 3h10v1H3V7zm0 3h10v1H3v-1zm0 3h10v1H3v-1z" opacity="0.4" />
    <path d="M1 2h14v12H1V2zm1 1v10h12V3H2z" />
  </svg>
)

const ReplaceOneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2.5 3h10a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 2 6.5v-3a.5.5 0 0 1 .5-.5zm.5 1v2h9V4H3zM2.5 9h5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5zm.5 1v2h4v-2H3zm7.85 1.15l1.65 1.65.7-.7L12.4 11.3h2.1v-1h-2.1l.8-.8-.7-.7-1.65 1.65-.35.35.35.35z" />
  </svg>
)

const ReplaceAllIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2h9v2H3v7H1V3a1 1 0 0 1 1-1zm3 3h9a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 1v7h9V6H5zm5.85 2.15l1.65 1.65.7-.7L12.4 8.3h1.1v-1h-1.1l.8-.8-.7-.7-1.65 1.65-.35.35.35.35z" />
  </svg>
)

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path fillRule="evenodd" clipRule="evenodd" d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z" />
  </svg>
)

// ==========================================
// VS Code FindWidget Component with ToolTips
// ==========================================

const FindWidget = ({ editorView, onClose, initialReplaceMode = false }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [isReplaceMode, setIsReplaceMode] = useState(initialReplaceMode)
  const [matchCase, setMatchCase] = useState(false)
  const [matchWholeWord, setMatchWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [preserveCase, setPreserveCase] = useState(false)
  const [findInSelection, setFindInSelection] = useState(false)
  const [matchCount, setMatchCount] = useState({ current: 0, total: 0 })
  const [matches, setMatches] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)

  const searchInputRef = useRef(null)
  const replaceInputRef = useRef(null)

  // Focus search input when widget opens
  useEffect(() => {
    if (isReplaceMode && replaceInputRef.current) {
      replaceInputRef.current.focus()
    } else if (searchInputRef.current) {
      searchInputRef.current.focus()
      searchInputRef.current.select()
    }
  }, [isReplaceMode])

  useEffect(() => {
    setIsReplaceMode(initialReplaceMode)
  }, [initialReplaceMode])

  // External event listeners
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

  // Highlight matches directly in CodeMirror and rendered tables
  useEffect(() => {
    if (!editorView) return

    const text = editorView.state.doc.toString()

    if (!searchQuery) {
      setMatches([])
      setCurrentIndex(-1)
      setMatchCount({ current: 0, total: 0 })
      editorView.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
      clearTableSearchHighlight(editorView.dom)
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

      // Directly apply CodeMirror text decorations
      const decorations = []
      const matchMark = Decoration.mark({ class: 'cm-searchMatch' })
      const selectedMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' })

      for (let i = 0; i < allMatches.length; i++) {
        const m = allMatches[i]
        decorations.push((i === idx ? selectedMark : matchMark).range(m.from, m.to))
      }

      editorView.dispatch({
        effects: updateSearchHighlights.of(Decoration.set(decorations, true))
      })

      // Highlight matching text inside rendered tables
      applyTableSearchHighlight(editorView.dom, regex)
    } catch (err) {
      console.error('[FindWidget] Search update error:', err)
      setMatches([])
      setCurrentIndex(-1)
      setMatchCount({ current: 0, total: 0 })
      editorView.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
      clearTableSearchHighlight(editorView.dom)
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

      setCurrentIndex(clamped)
      setMatchCount({ current: clamped + 1, total: matches.length })

      // Update active highlight decoration
      let pattern = searchQuery
      if (!useRegex) pattern = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (matchWholeWord) pattern = `\\b${pattern}\\b`
      try {
        const regex = new RegExp(pattern, matchCase ? 'g' : 'gi')
        const decorations = []
        const matchMark = Decoration.mark({ class: 'cm-searchMatch' })
        const selectedMark = Decoration.mark({ class: 'cm-searchMatch cm-searchMatch-selected' })

        for (let i = 0; i < matches.length; i++) {
          const m = matches[i]
          decorations.push((i === clamped ? selectedMark : matchMark).range(m.from, m.to))
        }

        view.dispatch({
          effects: updateSearchHighlights.of(Decoration.set(decorations, true))
        })
        applyTableSearchHighlight(view.dom, regex)
      } catch {}
    },
    [editorView, matches, searchQuery, matchCase, matchWholeWord, useRegex]
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
  }, [editorView, searchQuery, replaceQuery, matches, currentIndex])

  const handleReplaceAll = useCallback(() => {
    if (!editorView || !searchQuery || matches.length === 0) return
    const view = editorView
    const doc = view.state.doc
    let content = doc.toString()

    const sorted = [...matches].sort((a, b) => b.from - a.from)
    sorted.forEach((m) => {
      content = `${content.slice(0, m.from)}${replaceQuery}${content.slice(m.to)}`
    })

    view.dispatch({
      changes: { from: 0, to: doc.length, insert: content }
    })
  }, [editorView, searchQuery, replaceQuery, matches])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
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
      } else if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        setMatchCase((prev) => !prev)
      } else if (e.altKey && (e.key === 'w' || e.key === 'W')) {
        e.preventDefault()
        setMatchWholeWord((prev) => !prev)
      } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        setUseRegex((prev) => !prev)
      } else if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        setIsReplaceMode((prev) => !prev)
      } else if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        setIsReplaceMode(false)
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    },
    [handleFindNext, handleFindPrevious]
  )

  const handleReplaceKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (e.ctrlKey || e.metaKey || e.altKey) {
          handleReplaceAll()
        } else {
          handleReplaceNext()
        }
      } else if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        setIsReplaceMode((prev) => !prev)
        setTimeout(() => {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        }, 0)
      } else if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        setIsReplaceMode(false)
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    },
    [handleReplaceNext, handleReplaceAll]
  )

  useKeyboardShortcuts({
    onEscape: () => {
      setSearchQuery('')
      if (editorView) {
        editorView.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
        clearTableSearchHighlight(editorView.dom)
        editorView.focus()
      }
      onClose()
      return true
    }
  })

  // Cleanup highlights on widget close / unmount
  useEffect(() => {
    return () => {
      if (editorView) {
        editorView.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
        clearTableSearchHighlight(editorView.dom)
      }
    }
  }, [editorView])

  const hasNoResults = Boolean(searchQuery && matchCount.total === 0)

  return (
    <div className="vs-find-part" role="search">
      {/* Left Column: Expand/Collapse Replace Toggle */}
      <div className={`vs-toggle-col ${isReplaceMode ? 'expanded' : ''}`}>
        <ToolTip text={isReplaceMode ? 'Toggle Replace (Ctrl+H)' : 'Toggle Replace (Ctrl+H)'} position="bottom">
          <button
            className="vs-toggle-btn"
            onClick={() => setIsReplaceMode(!isReplaceMode)}
            aria-label="Toggle Replace (Ctrl+H)"
          >
            {isReplaceMode ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </button>
        </ToolTip>
      </div>

      {/* Center Column: Find Input & Replace Input */}
      <div className="vs-inputs-col">
        {/* Find Input */}
        <div className={`vs-input-box ${hasNoResults ? 'no-results' : ''}`}>
          <input
            ref={searchInputRef}
            type="text"
            role="searchbox"
            className="vs-text-input"
            placeholder="Find"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Find"
          />
          <div className="vs-inline-actions">
            <ToolTip text="Match Case (Alt+C)" position="bottom">
              <button
                className={`vs-action-toggle ${matchCase ? 'active' : ''}`}
                onClick={() => setMatchCase(!matchCase)}
                aria-label="Match Case (Alt+C)"
              >
                <CaseSensitiveIcon />
              </button>
            </ToolTip>
            <ToolTip text="Match Whole Word (Alt+W)" position="bottom">
              <button
                className={`vs-action-toggle ${matchWholeWord ? 'active' : ''}`}
                onClick={() => setMatchWholeWord(!matchWholeWord)}
                aria-label="Match Whole Word (Alt+W)"
              >
                <WholeWordIcon />
              </button>
            </ToolTip>
            <ToolTip text="Use Regular Expression (Alt+R)" position="bottom">
              <button
                className={`vs-action-toggle ${useRegex ? 'active' : ''}`}
                onClick={() => setUseRegex(!useRegex)}
                aria-label="Use Regular Expression (Alt+R)"
              >
                <RegexIcon />
              </button>
            </ToolTip>
          </div>
        </div>

        {/* Replace Input */}
        {isReplaceMode && (
          <div className="vs-input-box vs-replace-input-box">
            <input
              ref={replaceInputRef}
              type="text"
              className="vs-text-input"
              placeholder="Replace"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              onKeyDown={handleReplaceKeyDown}
              aria-label="Replace"
            />
            <div className="vs-inline-actions">
              <ToolTip text="Preserve Case (Alt+P)" position="bottom">
                <button
                  className={`vs-action-toggle ${preserveCase ? 'active' : ''}`}
                  onClick={() => setPreserveCase(!preserveCase)}
                  aria-label="Preserve Case (Alt+P)"
                >
                  <PreserveCaseIcon />
                </button>
              </ToolTip>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Match Counter, Navigation & Replace Actions */}
      <div className="vs-controls-col">
        {/* Row 1 Controls */}
        <div className="vs-control-row">
          <div className={`vs-count-badge ${hasNoResults ? 'no-results-text' : ''}`} aria-live="polite">
            {searchQuery
              ? matchCount.total > 0
                ? `${matchCount.current} of ${matchCount.total}`
                : 'No results'
              : ''}
          </div>

          <ToolTip text="Previous Match (Shift+Enter)" position="bottom">
            <button
              className="vs-tool-btn"
              onClick={handleFindPrevious}
              disabled={!searchQuery.trim() || !matches.length}
              aria-label="Previous Match (Shift+Enter)"
            >
              <ArrowUpIcon />
            </button>
          </ToolTip>
          <ToolTip text="Next Match (Enter)" position="bottom">
            <button
              className="vs-tool-btn"
              onClick={handleFindNext}
              disabled={!searchQuery.trim() || !matches.length}
              aria-label="Next Match (Enter)"
            >
              <ArrowDownIcon />
            </button>
          </ToolTip>
          <ToolTip text="Find in Selection (Alt+L)" position="bottom">
            <button
              className={`vs-tool-btn ${findInSelection ? 'active' : ''}`}
              onClick={() => setFindInSelection(!findInSelection)}
              aria-label="Find in Selection (Alt+L)"
            >
              <SelectionIcon />
            </button>
          </ToolTip>
          <ToolTip text="Close (Escape)" position="bottom">
            <button
              className="vs-tool-btn vs-close-icon-btn"
              onClick={onClose}
              aria-label="Close (Escape)"
            >
              <CloseIcon />
            </button>
          </ToolTip>
        </div>

        {/* Row 2 Controls (Replace Actions) */}
        {isReplaceMode && (
          <div className="vs-control-row vs-replace-control-row">
            <ToolTip text="Replace (Enter)" position="bottom">
              <button
                className="vs-tool-btn"
                onClick={handleReplaceNext}
                disabled={!searchQuery.trim() || !matches.length}
                aria-label="Replace (Enter)"
              >
                <ReplaceOneIcon />
              </button>
            </ToolTip>
            <ToolTip text="Replace All (Ctrl+Alt+Enter)" position="bottom">
              <button
                className="vs-tool-btn"
                onClick={handleReplaceAll}
                disabled={!searchQuery.trim() || !matches.length}
                aria-label="Replace All (Ctrl+Alt+Enter)"
              >
                <ReplaceAllIcon />
              </button>
            </ToolTip>
          </div>
        )}
      </div>
    </div>
  )
}

export default FindWidget
