import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, FileText, Zap } from 'lucide-react'
import { FixedSizeList as List } from '../../components/utils/VirtualList'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import './CommandPalette.css'

/**
 * Virtualized Command Palette (Obsidian Standard #5)
 * Feature: Fuzzy Match Highlighting (FB/Google Standard)
 */
const CommandPalette = ({ isOpen, onClose, items, onSelect }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useKeyboardShortcuts({
    onEscape: isOpen ? onClose : null
  })

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const filtered = useMemo(() => {
    if (!query) return items.slice(0, 50) // Show recent/all if empty

    const lowerQuery = query.toLowerCase()
    return items
      .map((item) => {
        // 1. Title Match (High Priority)
        if (item.title.toLowerCase().includes(lowerQuery)) {
          return { ...item, matchType: 'title', score: 10 }
        }
        // 2. Content Match (Lower Priority)
        const code = item.code || ''
        const codeIndex = code.toLowerCase().indexOf(lowerQuery)
        if (codeIndex !== -1) {
          // Extract text snippet around match
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
      .slice(0, 50)
  }, [items, query])

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
      if (filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex])
        onClose()
      }
    }
  }

  // Highlight matching characters (Premium Polish)
  const HighlightText = ({ text, highlight }) => {
    if (!highlight.trim()) return <span>{text}</span>
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

    return (
      <div
        style={style}
        className={`palette-item ${isActive ? 'active' : ''}`}
        onClick={() => {
          onSelect(item)
          onClose()
        }}
        onMouseEnter={() => setSelectedIndex(index)}
      >
        <FileText size={18} className="item-icon" />
        <div className="item-info">
          <div className="item-title">
            <HighlightText text={item.title || 'Untitled'} highlight={query} />
          </div>
          {item.matchSnippet && (
            <div className="item-secondary">
              <HighlightText text={item.matchSnippet} highlight={query} />
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
          <div className="palette-hint">ESC to close</div>
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
}

export default CommandPalette
