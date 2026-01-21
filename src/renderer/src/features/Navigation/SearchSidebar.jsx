import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Search,
  Replace,
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Type,
  AlignLeft,
  Regex
} from 'lucide-react'
import { useVaultStore } from '../../core/store/useVaultStore'
import './SearchSidebar.css'

/**
 * SearchSidebar Component
 * VSCode-style global search and replace functionality.
 * Allows searching across all notes in the vault with replace capabilities.
 * Memoized for performance - expensive search operations.
 */
const SearchSidebar = React.memo(({ onNavigate }) => {
  const { snippets, setSelectedSnippet } = useVaultStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [isReplaceMode, setIsReplaceMode] = useState(false)
  const [matchCase, setMatchCase] = useState(false)
  const [matchWholeWord, setMatchWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState(new Set())
  const [selectedResult, setSelectedResult] = useState(null)

  const searchInputRef = useRef(null)
  const replaceInputRef = useRef(null)

  // Focus search input when component mounts or when global search shortcut is used
  useEffect(() => {
    const handleGlobalSearchFocus = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus()
        searchInputRef.current.select()
      }
    }

    window.addEventListener('global-search-focus', handleGlobalSearchFocus)

    // Also focus on mount if this is the active tab
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }

    return () => {
      window.removeEventListener('global-search-focus', handleGlobalSearchFocus)
    }
  }, [])

  /**
   * Build regex pattern from search query
   */
  const buildSearchPattern = useCallback((query) => {
    if (!query) return null

    let pattern = query
    if (!useRegex) {
      // Escape special regex characters if not using regex
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    if (matchWholeWord) {
      pattern = `\\b${pattern}\\b`
    }

    try {
      return new RegExp(pattern, matchCase ? 'g' : 'gi')
    } catch (e) {
      return null
    }
  }, [matchCase, matchWholeWord, useRegex])

  /**
   * Search all snippets for matches
   */
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const pattern = buildSearchPattern(searchQuery)
    if (!pattern) return []

    const results = []

    snippets.forEach((snippet) => {
      const content = snippet.code || ''
      if (!content) return

      // Search in full content first
      const allMatches = [...content.matchAll(pattern)]

      if (allMatches.length > 0) {
        const lines = content.split('\n')

        allMatches.forEach((match) => {
          const matchStart = match.index
          const matchEnd = matchStart + match[0].length

          // Find which line this match is on
          let lineIndex = 0
          let currentOffset = 0

          for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + 1 // +1 for newline
            if (matchStart < currentOffset + lineLength) {
              lineIndex = i
              break
            }
            currentOffset += lineLength
          }

          const fullLine = lines[lineIndex] || ''
          const matchIndexInLine = matchStart - currentOffset

          // VS Code-style preview: only a small window around the match, not the whole paragraph
          const contextRadius = 80
          const previewStart = Math.max(0, matchIndexInLine - contextRadius)
          const previewEnd = Math.min(
            fullLine.length,
            matchIndexInLine + match[0].length + contextRadius
          )
          const previewLine = fullLine.slice(previewStart, previewEnd)
          const previewMatchIndex = matchIndexInLine - previewStart

          results.push({
            snippetId: snippet.id,
            snippetTitle: snippet.title || 'Untitled',
            lineIndex: lineIndex + 1,
            lineText: previewLine,
            matchIndex: previewMatchIndex,
            matchLength: match[0].length,
            matchText: match[0],
            absoluteStart: matchStart,
            absoluteEnd: matchEnd
          })
        })
      }
    })

    return results
  }, [snippets, searchQuery, buildSearchPattern])

  /**
   * Group results by file
   */
  const groupedResults = useMemo(() => {
    const groups = new Map()

    searchResults.forEach((result) => {
      if (!groups.has(result.snippetId)) {
        groups.set(result.snippetId, {
          snippetId: result.snippetId,
          snippetTitle: result.snippetTitle,
          matches: []
        })
      }
      groups.get(result.snippetId).matches.push(result)
    })

    return Array.from(groups.values())
  }, [searchResults])

  /**
   * Handle result click - navigate to file and highlight
   */
  const handleResultClick = useCallback((result) => {
    const snippet = snippets.find((s) => s.id === result.snippetId)
    if (snippet) {
      setSelectedSnippet(snippet)
      setSelectedResult(result)
      if (onNavigate) onNavigate()
      // Expand the file in results
      setExpandedFiles((prev) => new Set(prev).add(result.snippetId))

      // Dispatch event to editor to highlight and navigate to match
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('search-navigate', {
          detail: {
            snippetId: result.snippetId,
            start: result.absoluteStart,
            end: result.absoluteEnd,
            searchQuery: searchQuery
          }
        }))
      }, 100)
    }
  }, [snippets, setSelectedSnippet, onNavigate, searchQuery])

  /**
   * Toggle file expansion
   */
  const toggleFile = useCallback((snippetId) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(snippetId)) {
        next.delete(snippetId)
      } else {
        next.add(snippetId)
      }
      return next
    })
  }, [])

  /**
   * Replace all matches in a snippet using the same pattern as search
   */
  const replaceInSnippet = useCallback(async (snippetId, replaceText) => {
    const snippet = snippets.find((s) => s.id === snippetId)
    if (!snippet) return false

    const pattern = buildSearchPattern(searchQuery)
    if (!pattern) return false

    let newContent = snippet.code || ''
    const originalContent = newContent

    try {
      if (useRegex) {
        // For regex, use the pattern directly (replaceText may contain $1, $2, etc.)
        newContent = newContent.replace(pattern, replaceText)
      } else if (matchCase) {
        // Case-sensitive replace
        newContent = newContent.replace(pattern, replaceText)
      } else {
        // Case-insensitive replace - preserve case of first letter
        newContent = newContent.replace(pattern, (match) => {
          // Preserve original case of first letter if it was uppercase
          if (match.length > 0 && match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
            return replaceText.length > 0
              ? replaceText.charAt(0).toUpperCase() + replaceText.slice(1)
              : replaceText
          }
          return replaceText
        })
      }
    } catch (e) {
      console.error('Replace error:', e)
      return false
    }

    // Only update if content changed
    if (newContent === originalContent) return false

    // Update snippet
    const { saveSnippet } = useVaultStore.getState()
    await saveSnippet({
      ...snippet,
      code: newContent
    })

    // Let any open editor for this snippet know its content changed externally
    window.dispatchEvent(new CustomEvent('snippet-external-update', {
      detail: { snippetId: snippet.id, code: newContent }
    }))

    // Re-trigger search to update results
    setSearchQuery((prev) => prev + ' ')
    setTimeout(() => setSearchQuery((prev) => prev.trim()), 10)

    return true
  }, [snippets, searchQuery, buildSearchPattern, matchCase, useRegex])

  /**
   * Replace a single match at a specific position
   */
  const replaceSingleMatch = useCallback(async (result, replaceText) => {
    const snippet = snippets.find((s) => s.id === result.snippetId)
    if (!snippet) return false

    const content = snippet.code || ''
    const pattern = buildSearchPattern(searchQuery)
    if (!pattern) return false

    // Use the absolute positions from the result to replace the exact match
    const beforeMatch = content.substring(0, result.absoluteStart)
    const afterMatch = content.substring(result.absoluteEnd)
    const newContent = beforeMatch + replaceText + afterMatch

    // Only update if content changed
    if (newContent === content) return false

    // Update snippet
    const { saveSnippet } = useVaultStore.getState()
    await saveSnippet({
      ...snippet,
      code: newContent
    })

    // Notify any open editor so CodeMirror can refresh to the new content
    window.dispatchEvent(new CustomEvent('snippet-external-update', {
      detail: { snippetId: snippet.id, code: newContent }
    }))

    // Re-trigger search to update results
    setSearchQuery((prev) => prev + ' ')
    setTimeout(() => setSearchQuery((prev) => prev.trim()), 10)

    return true
  }, [snippets, searchQuery, buildSearchPattern])

  /**
   * Replace all matches across all files
   */
  const replaceAll = useCallback(async () => {
    if (!searchQuery.trim()) return

    const uniqueSnippetIds = new Set(searchResults.map((r) => r.snippetId))
    let replacedCount = 0

    for (const snippetId of uniqueSnippetIds) {
      const replaced = await replaceInSnippet(snippetId, replaceQuery)
      if (replaced) replacedCount++
    }

    return replacedCount > 0
  }, [searchResults, replaceQuery, replaceInSnippet, searchQuery])

  /**
   * Replace next match (VS Code style)
   */
  const replaceNext = useCallback(async () => {
    if (!searchQuery.trim() || searchResults.length === 0) return

    // Always operate on the first current match; after each replace we re-run search
    const targetResult = searchResults[0]
    await replaceSingleMatch(targetResult, replaceQuery)
  }, [searchResults, replaceQuery, replaceSingleMatch, searchQuery])

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase()
      // Escape - clear search
      if (key === 'escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('')
        setReplaceQuery('')
        // Clear highlights in editor
        window.dispatchEvent(new CustomEvent('search-clear'))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  /**
   * Clear highlights when search is cleared
   */
  useEffect(() => {
    if (!searchQuery.trim()) {
      window.dispatchEvent(new CustomEvent('search-clear'))
    } else {
      // Dispatch search query to editor for highlighting
      window.dispatchEvent(new CustomEvent('search-update', {
        detail: {
          searchQuery: searchQuery,
          pattern: buildSearchPattern(searchQuery),
          matchCase,
          matchWholeWord,
          useRegex
        }
      }))
    }
  }, [searchQuery, buildSearchPattern, matchCase, matchWholeWord, useRegex])

  const totalMatches = searchResults.length
  const totalFiles = groupedResults.length

  return (
    <div className="search-sidebar">
      <header className="pane-header">
        <div className="pane-title">SEARCH</div>
        <div className="pane-actions">
          <button
            className="icon-btn"
            onClick={() => setIsReplaceMode(!isReplaceMode)}
            title={isReplaceMode ? 'Hide Replace' : 'Show Replace'}
          >
            <Replace size={14} />
          </button>
        </div>
      </header>

      <div className="search-toolbar">
        {/* Search Input with integrated options */}
        <div className="search-input-group">
          <Search size={14} className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault()
                if (replaceInputRef.current) {
                  replaceInputRef.current.focus()
                }
              }
            }}
          />
          <div className="input-actions">
            <button
              className={`input-action-btn ${matchCase ? 'active' : ''}`}
              onClick={() => setMatchCase(!matchCase)}
              title="Match Case (Alt+C)"
            >
              <Type size={12} />
            </button>
            <button
              className={`input-action-btn ${matchWholeWord ? 'active' : ''}`}
              onClick={() => setMatchWholeWord(!matchWholeWord)}
              title="Match Whole Word (Alt+W)"
            >
              <AlignLeft size={12} />
            </button>
            <button
              className={`input-action-btn ${useRegex ? 'active' : ''}`}
              onClick={() => setUseRegex(!useRegex)}
              title="Use Regular Expression (Alt+R)"
            >
              <Regex size={12} />
            </button>
            {searchQuery && (
              <button
                className="input-action-btn clear-btn"
                onClick={() => {
                  setSearchQuery('')
                  if (searchInputRef.current) {
                    searchInputRef.current.focus()
                  }
                }}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Replace Input with integrated buttons */}
        {isReplaceMode && (
          <div className="search-input-group">
            <Replace size={14} className="search-icon" />
            <input
              ref={replaceInputRef}
              type="text"
              className="search-input"
              placeholder="Replace"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  if (e.ctrlKey || e.metaKey) {
                    // Ctrl+Enter: Replace All
                    e.preventDefault()
                    await replaceAll()
                  } else {
                    // Enter: Replace Next (VS Code style)
                    e.preventDefault()
                    await replaceNext()
                  }
                }
              }}
            />
            <div className="input-actions">
              <button
                className="input-action-btn replace-action-btn"
                onClick={replaceNext}
                disabled={!searchQuery.trim()}
                title="Replace (Enter)"
              >
                <Replace size={12} />
              </button>
              <button
                className="input-action-btn replace-action-btn replace-all-action-btn"
                onClick={replaceAll}
                disabled={!searchQuery.trim()}
                title="Replace All (Ctrl+Enter)"
              >
                <Replace size={12} />
                <span className="replace-all-badge">All</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="search-results">
        {searchQuery ? (
          totalMatches > 0 ? (
            <>
              <div className="results-header">
                <span className="results-count">
                  {totalMatches} {totalMatches === 1 ? 'match' : 'matches'} in {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
                </span>
              </div>
              <div className="results-list">
                {groupedResults.map((group) => {
                  const isExpanded = expandedFiles.has(group.snippetId)
                  return (
                    <div key={group.snippetId} className="result-group">
                      <div
                        className="result-group-header"
                        onClick={() => toggleFile(group.snippetId)}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <FileText size={12} />
                        <span className="result-file-name">{group.snippetTitle}</span>
                        <span className="result-match-count">{group.matches.length}</span>
                      </div>
                      {isExpanded && (
                        <div className="result-group-matches">
                          {group.matches.map((result, idx) => (
                            <div
                              key={`${result.snippetId}-${result.lineIndex}-${idx}`}
                              className={`result-item ${selectedResult?.snippetId === result.snippetId && selectedResult?.lineIndex === result.lineIndex ? 'selected' : ''}`}
                            >
                              <div
                                className="result-item-content"
                                onClick={() => handleResultClick(result)}
                              >
                                <span className="result-line-number">{result.lineIndex}</span>
                                <span className="result-line-text">
                                  {result.lineText.substring(0, result.matchIndex)}
                                  <mark className="result-match">{result.matchText}</mark>
                                  {result.lineText.substring(result.matchIndex + result.matchLength)}
                                </span>
                              </div>
                              {isReplaceMode && (
                                <button
                                  className="result-replace-btn"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    await replaceSingleMatch(result, replaceQuery)
                                  }}
                                  title="Replace this match"
                                  aria-label="Replace this match"
                                >
                                  <Replace size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="search-empty">
              <div className="empty-icon">🔍</div>
              <div className="empty-text">No results found</div>
            </div>
          )
        ) : (
          <div className="search-empty">
            <div className="empty-icon">🔍</div>
            <div className="empty-text">Enter a search query to find matches</div>
          </div>
        )}
      </div>
    </div>
  )
})

SearchSidebar.displayName = 'SearchSidebar'

export default SearchSidebar
