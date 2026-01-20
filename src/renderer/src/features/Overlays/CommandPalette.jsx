import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search,
  FileText,
  Zap,
  Sparkles,
  FileCode,
  FileJson,
  Hash,
  ImageIcon,
  Plus,
  Network
} from 'lucide-react'
import { FixedSizeList as List } from '../../components/utils/VirtualList'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useAIStore } from '../../core/store/useAIStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import './CommandPalette.css'

/**
 * Virtualized Command Palette (Obsidian Standard #5)
 * Feature: Fuzzy Match + Semantic AI Search
 * Memoized for performance - expensive search/filter operations.
 */
const CommandPalette = React.memo(({
  isOpen,
  onClose,
  items,
  onSelect,
  onNew,
  onToggleSettings,
  onToggleGraph
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [aiResults, setAiResults] = useState([])
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const { searchNotes, isModelReady, modelLoadingProgress, aiError } = useAIStore()
  const { dirtySnippetIds } = useVaultStore()

  useKeyboardShortcuts({
    onEscape: isOpen ? onClose : null
  })

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setAiResults([])
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // AI Search Debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Allow shorter queries for AI if the user paused?
      // Keep > 2 for perf, but lower threshold
      if (query.trim().length > 2) {
        // Lower threshold to 0.45 to catch "food" -> "pasta"
        const results = await searchNotes(query, 0.45)
        setAiResults(results)
      } else {
        setAiResults([])
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  const filtered = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim()

    // 0. System Actions (Show if query starts with > or matches)
    const isActionQuery = lowerQuery.startsWith('>')
    const actionQuery = isActionQuery ? lowerQuery.slice(1).trim() : lowerQuery

    const systemActions = [
      {
        id: 'action-settings',
        title: 'Settings: Open Configuration',
        matchType: 'action',
        action: 'settings'
      },
      { id: 'action-new', title: 'Note: Create New Snippet', matchType: 'action', action: 'new' },
      {
        id: 'action-graph',
        title: 'Graph: Open Knowledge Nexus',
        matchType: 'action',
        action: 'graph'
      }
    ].filter((a) => !actionQuery || a.title.toLowerCase().includes(actionQuery))

    if (!lowerQuery && !isActionQuery) return [...systemActions, ...items.slice(0, 50)]

    // 1. Text Matches
    const textMatches = items
      .map((item) => {
        // Title Match
        if (item.title.toLowerCase().includes(lowerQuery)) {
          return { ...item, matchType: 'title', score: 10 }
        }
        // Content Match
        const code = item.code || item.content || ''
        const codeIndex = code.toLowerCase().indexOf(lowerQuery)

        if (codeIndex !== -1) {
          const start = Math.max(0, codeIndex - 20)
          const end = Math.min(code.length, codeIndex + lowerQuery.length + 40)
          const snippet =
            (start > 0 ? '...' : '') + code.slice(start, end) + (end < code.length ? '...' : '')
          return { ...item, matchType: 'content', matchSnippet: snippet, score: 5 }
        }
        return null
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)

    // 2. Semantic Matches
    const existingIds = new Set(textMatches.map((i) => i.id))
    const semanticMatches = aiResults
      .filter((r) => !existingIds.has(r.id))
      .map((r) => {
        const item = items.find((i) => i.id === r.id)
        if (!item) return null
        return {
          ...item,
          matchType: 'semantic',
          score: r.score * 4,
          matchSnippet: 'Semantic Match'
        }
      })
      .filter(Boolean)

    const results = [...textMatches, ...semanticMatches]

    if (isActionQuery) return systemActions
    return [...systemActions, ...results].slice(0, 50)
  }, [items, query, aiResults])

  useEffect(() => {
    if (selectedIndex >= filtered.length && filtered.length > 0) {
      setSelectedIndex(filtered.length - 1)
    }
  }, [filtered.length, selectedIndex])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(selectedIndex, 'auto')
    }
  }, [selectedIndex])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter') {
      const item = filtered[selectedIndex]
      if (item) {
        if (item.matchType === 'action') {
          if (item.action === 'settings') onToggleSettings?.()
          else if (item.action === 'new') onNew?.()
          else if (item.action === 'graph') onToggleGraph?.()
        } else {
          onSelect(item)
        }
        onClose()
      }
    }
  }

  // Highlight matching characters
  const HighlightText = ({ text, highlight }) => {
    if (!highlight.trim() || text === 'Semantic Match') return <span>{text}</span>
    const regex = new RegExp(`(${highlight})`, 'gi')
    const parts = text.split(regex)
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="palette-match">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    )
  }

  const Row = ({ index, style }) => {
    const item = filtered[index]
    const isActive = index === selectedIndex
    const isSemantic = item.matchType === 'semantic'
    const isAction = item.matchType === 'action'

    return (
      <div
        style={style}
        className={`palette-item ${isActive ? 'active' : ''} ${isAction ? 'is-action' : ''}`}
        onClick={() => {
          if (isAction) {
            if (item.action === 'settings') onToggleSettings?.()
            else if (item.action === 'new') onNew?.()
            else if (item.action === 'graph') onToggleGraph?.()
          } else {
            onSelect(item)
          }
          onClose()
        }}
        onMouseMove={() => {
          if (selectedIndex !== index) setSelectedIndex(index)
        }}
      >
        {isSemantic ? (
          <Sparkles size={18} className="item-icon semantic" />
        ) : isAction ? (
          (() => {
            if (item.action === 'settings')
              return <Zap size={18} className="item-icon action-icon" />
            if (item.action === 'new') return <Plus size={18} className="item-icon action-icon" />
            if (item.action === 'graph')
              return <Network size={18} className="item-icon action-icon" />
            return <Zap size={18} className="item-icon action-icon" />
          })()
        ) : (
          (() => {
            const lang = (item.language || 'markdown').toLowerCase()
            const title = (item.title || '').toLowerCase()
            if (
              ['javascript', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'python', 'py'].includes(lang)
            )
              return <FileCode size={18} className="item-icon" />
            if (lang === 'json') return <FileJson size={18} className="item-icon" />
            if (lang === 'markdown' || lang === 'md' || title.endsWith('.md'))
              return <Hash size={18} className="item-icon" />
            if (['png', 'jpg', 'jpeg', 'gif', 'svg'].some((ext) => title.endsWith('.' + ext)))
              return <ImageIcon size={18} className="item-icon" />
            return <FileText size={18} className="item-icon" />
          })()
        )}

        <div className="item-info">
          <div className="item-title">
            <HighlightText text={item.title || 'Untitled'} highlight={query} />
            {dirtySnippetIds.includes(item.id) && (
              <div className="dirty-indicator" style={{ marginLeft: '8px' }} />
            )}
          </div>
          {item.matchSnippet && (
            <div className={`item-secondary ${isSemantic ? 'semantic-badge' : ''}`}>
              {isSemantic ? (
                '✨ AI Match'
              ) : (
                <HighlightText text={item.matchSnippet} highlight={query} />
              )}
            </div>
          )}
        </div>
        {isActive && <Zap size={14} className="item-zap" />}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette-container" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input-wrap">
          <Search size={18} className="palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search notes..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
          />
          <div className="palette-hint">
            {aiError ? (
              <span style={{ color: 'var(--text-error)' }}>⚠️ AI Error: {aiError}</span>
            ) : (!isModelReady || modelLoadingProgress < 100) && query.length > 2 ? (
              <span className="loading-status" style={{ color: 'var(--text-accent)' }}>
                {modelLoadingProgress > 0
                  ? `AI Loading ${Math.round(modelLoadingProgress)}%...`
                  : 'AI Initializing...'}
              </span>
            ) : (
              'ESC to close'
            )}
          </div>
        </div>

        <div
          className="palette-results"
          style={{ height: filtered.length > 0 ? Math.min(filtered.length * 48, 440) : 100 }}
        >
          {filtered.length > 0 ? (
            <List
              ref={listRef}
              height={Math.min(filtered.length * 48, 440)}
              itemCount={filtered.length}
              itemSize={48}
              width="100%"
            >
              {Row}
            </List>
          ) : (
            <div className="palette-empty">No matching notes found</div>
          )}
        </div>

        <div className="palette-footer">
          <div className="footer-tip">
            <span>
              <kbd>↑</kbd> <kbd>↓</kbd> to navigate
            </span>
            <span>
              <kbd>↵</kbd> to open
            </span>
          </div>
          <div className="footer-tip">
            <span>
              <kbd>ESC</kbd> to dismiss
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

CommandPalette.displayName = 'CommandPalette'

export default CommandPalette
