import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Search, Replace, X, ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { useVaultStore } from '../../core/store/useVaultStore'
import './SearchSidebar.css'

/**
 * SearchSidebar Component
 * VSCode-style global search and replace functionality.
 * Allows searching across all notes in the vault with replace capabilities.
 */
const SearchSidebar = ({ onNavigate }) => {
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

  // Focus search input when component mounts or when search icon is clicked
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
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
      const lines = content.split('\n')
      
      lines.forEach((line, lineIndex) => {
        const matches = [...line.matchAll(pattern)]
        if (matches.length > 0) {
          matches.forEach((match) => {
            results.push({
              snippetId: snippet.id,
              snippetTitle: snippet.title || 'Untitled',
              lineIndex: lineIndex + 1,
              lineText: line,
              matchIndex: match.index,
              matchLength: match[0].length,
              matchText: match[0]
            })
          })
        }
      })
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
    }
  }, [snippets, setSelectedSnippet, onNavigate])

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
   * Replace all matches in a snippet
   */
  const replaceInSnippet = useCallback(async (snippetId, replaceText) => {
    const snippet = snippets.find((s) => s.id === snippetId)
    if (!snippet) return
    
    const pattern = buildSearchPattern(searchQuery)
    if (!pattern) return
    
    let newContent = snippet.code || ''
    
    if (useRegex) {
      try {
        newContent = newContent.replace(pattern, replaceText)
      } catch (e) {
        console.error('Regex replace error:', e)
        return
      }
    } else {
      // Simple string replace with case sensitivity
      if (matchCase) {
        newContent = newContent.replace(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replaceText)
      } else {
        // Case-insensitive replace
        const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        newContent = newContent.replace(regex, (match) => {
          // Preserve original case of first letter if needed
          if (match[0] === match[0].toUpperCase()) {
            return replaceText.charAt(0).toUpperCase() + replaceText.slice(1)
          }
          return replaceText
        })
      }
    }
    
    // Update snippet
    const { saveSnippet } = useVaultStore.getState()
    await saveSnippet({
      ...snippet,
      code: newContent
    })
    
    // Re-trigger search to update results
    setSearchQuery((prev) => prev + ' ')
    setTimeout(() => setSearchQuery((prev) => prev.trim()), 10)
  }, [snippets, searchQuery, buildSearchPattern, matchCase, useRegex])

  /**
   * Replace all matches across all files
   */
  const replaceAll = useCallback(async () => {
    if (!replaceQuery.trim() || !searchQuery.trim()) return
    
    const uniqueSnippetIds = new Set(searchResults.map((r) => r.snippetId))
    
    for (const snippetId of uniqueSnippetIds) {
      await replaceInSnippet(snippetId, replaceQuery)
    }
  }, [searchResults, replaceQuery, replaceInSnippet, searchQuery])

  /**
   * Handle keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+F or Cmd+F - focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && e.target.tagName !== 'INPUT') {
        e.preventDefault()
        if (searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }
      // Escape - clear search
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('')
        setReplaceQuery('')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
        {/* Search Input */}
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
          {searchQuery && (
            <button
              className="clear-btn"
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

        {/* Replace Input */}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  e.preventDefault()
                  replaceAll()
                }
              }}
            />
          </div>
        )}

        {/* Search Options */}
        <div className="search-options">
          <button
            className={`option-btn ${matchCase ? 'active' : ''}`}
            onClick={() => setMatchCase(!matchCase)}
            title="Match Case"
          >
            Aa
          </button>
          <button
            className={`option-btn ${matchWholeWord ? 'active' : ''}`}
            onClick={() => setMatchWholeWord(!matchWholeWord)}
            title="Match Whole Word"
          >
            Ab
          </button>
          <button
            className={`option-btn ${useRegex ? 'active' : ''}`}
            onClick={() => setUseRegex(!useRegex)}
            title="Use Regular Expression"
          >
            .*
          </button>
        </div>

        {/* Replace Actions */}
        {isReplaceMode && searchQuery && (
          <div className="replace-actions">
            <button
              className="replace-btn"
              onClick={replaceAll}
              disabled={!replaceQuery.trim() || !searchQuery.trim()}
              title="Replace All (Ctrl+Enter)"
            >
              Replace All
            </button>
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
                              onClick={() => handleResultClick(result)}
                            >
                              <span className="result-line-number">{result.lineIndex}</span>
                              <span className="result-line-text">
                                {result.lineText.substring(0, result.matchIndex)}
                                <mark className="result-match">{result.matchText}</mark>
                                {result.lineText.substring(result.matchIndex + result.matchLength)}
                              </span>
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
}

export default SearchSidebar
