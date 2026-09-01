/**
 * EditorSlash.jsx
 * 
 * Floating, intelligent slash command palette for the Lumina Markdown Editor.
 * Features categorized commands, real-time interactive search input, smart boundary repositioning,
 * 2px rounded corners, and CodeMirror-synchronized arrow key navigation.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Table,
  GitFork,
  Info,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Calendar,
  Clock,
  Link,
  HelpCircle
} from 'lucide-react'
import { EDITOR_SLASH_COMMANDS } from './slashCommands'
import './editorSlash.css'

const ICON_MAP = {
  Heading1: <Heading1 size={13} />,
  Heading2: <Heading2 size={13} />,
  Heading3: <Heading3 size={13} />,
  List: <List size={13} />,
  ListOrdered: <ListOrdered size={13} />,
  CheckSquare: <CheckSquare size={13} />,
  Quote: <Quote size={13} />,
  Code: <Code size={13} />,
  Minus: <Minus size={13} />,
  Table: <Table size={13} />,
  GitFork: <GitFork size={13} />,
  Info: <Info size={13} />,
  AlertTriangle: <AlertTriangle size={13} />,
  Lightbulb: <Lightbulb size={13} />,
  Sparkles: <Sparkles size={13} />,
  Calendar: <Calendar size={13} />,
  Clock: <Clock size={13} />,
  Link: <Link size={13} />
}

export const EditorSlash = ({
  isOpen,
  query = '',
  coords,
  onSelect,
  onClose,
  slashHandlerRef
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [localQuery, setLocalQuery] = useState(query)
  const menuRef = useRef(null)
  const selectedItemRef = useRef(null)
  const searchInputRef = useRef(null)

  // Keep local query synchronized with editor query
  useEffect(() => {
    setLocalQuery(query)
  }, [query])

  // Active query is either from direct input or editor keystrokes
  const activeQuery = localQuery !== undefined ? localQuery : query

  // Filter commands fuzzily by query, keywords, and description
  const filteredCommands = useMemo(() => {
    const q = (activeQuery || '').toLowerCase().trim()
    if (!q) return EDITOR_SLASH_COMMANDS

    return EDITOR_SLASH_COMMANDS.filter((cmd) => {
      const matchLabel = cmd.label.toLowerCase().includes(q)
      const matchDesc = cmd.desc.toLowerCase().includes(q)
      const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(q))
      return matchLabel || matchDesc || matchKeywords
    })
  }, [activeQuery])

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [activeQuery])

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex])

  // Auto-focus search input immediately when menu opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
        if (searchInputRef.current && searchInputRef.current.value) {
          searchInputRef.current.select()
        }
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Bind CodeMirror keymap navigation handler to slashHandlerRef
  useEffect(() => {
    if (slashHandlerRef) {
      slashHandlerRef.current = {
        isOpen,
        onArrowDown: () => {
          if (filteredCommands.length > 0) {
            setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
          }
        },
        onArrowUp: () => {
          if (filteredCommands.length > 0) {
            setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
          }
        },
        onEnter: () => {
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex])
            return true
          }
          return false
        },
        onClose: () => {
          onClose()
        }
      }
    }
  }, [isOpen, filteredCommands, selectedIndex, onSelect, onClose, slashHandlerRef])

  // Keyboard navigation when typing directly inside search input
  const handleSearchInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredCommands.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredCommands.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
      }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (filteredCommands[selectedIndex]) {
        onSelect(filteredCommands[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Backspace' && activeQuery === '') {
      e.preventDefault()
      onClose()
    }
  }

  if (!isOpen || !coords) return null

  const popupWidth = 290
  const popupHeight = 310

  // Calculate available space in viewport
  const spaceBelow = window.innerHeight - coords.bottom
  const spaceAbove = coords.top

  // Smart flip: flip ABOVE if space below is tight and space above has more clearance
  const shouldFlipAbove = spaceBelow < popupHeight + 16 && spaceAbove > spaceBelow

  const top = shouldFlipAbove
    ? Math.max(12, coords.top - popupHeight - 4)
    : Math.min(window.innerHeight - popupHeight - 12, coords.bottom + 4)

  // Align left position precisely flush with the '/' character
  let left = coords.left
  if (left + popupWidth > window.innerWidth - 16) {
    left = Math.max(16, window.innerWidth - popupWidth - 16)
  }
  if (left < 16) left = 16

  const style = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`
  }

  // Group commands by category for neat UI presentation
  let currentCategory = null

  return (
    <div className="editor-slash-palette" style={style} ref={menuRef}>
      {/* Real Interactive Search Input */}
      <div className="editor-slash-search-row">
        <Search size={12} className="editor-slash-search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          className="editor-slash-search-input"
          placeholder="Filter commands..."
          value={activeQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          onKeyDown={handleSearchInputKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="editor-slash-search-badge">ESC</span>
      </div>

      <div className="editor-slash-list">
        {filteredCommands.length === 0 ? (
          <div className="editor-slash-empty">No matching commands for "{activeQuery}"</div>
        ) : (
          filteredCommands.map((cmd, index) => {
            const isSelected = index === selectedIndex
            const showCategoryHeader = cmd.category !== currentCategory
            if (showCategoryHeader) {
              currentCategory = cmd.category
            }

            return (
              <React.Fragment key={cmd.id}>
                {showCategoryHeader && (
                  <div className="editor-slash-category-header">{cmd.category}</div>
                )}
                <div
                  ref={isSelected ? selectedItemRef : null}
                  className={`editor-slash-item ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="editor-slash-icon-wrap">
                    {ICON_MAP[cmd.icon] || <HelpCircle size={13} />}
                  </div>
                  <div className="editor-slash-content">
                    <span className="editor-slash-label">{cmd.label}</span>
                    <span className="editor-slash-desc">{cmd.desc}</span>
                  </div>
                </div>
              </React.Fragment>
            )
          })
        )}
      </div>
    </div>
  )
}

export default EditorSlash
