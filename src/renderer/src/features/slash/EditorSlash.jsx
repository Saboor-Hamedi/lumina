/**
 * EditorSlash.jsx
 * 
 * Native, zero-friction inline slash command palette for the Lumina Markdown Editor.
 * Focus remains 100% in the editor while typing; CodeMirror keymap coordinates seamless
 * arrow browsing, selection, and instant markdown replacement.
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
import { EDITOR_SLASH_COMMANDS, filterSlashCommands } from './slashCommands'
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
  selectedIndex: propSelectedIndex = 0,
  onSelect,
  onClose,
  slashHandlerRef
}) => {
  const [selectedIndex, setSelectedIndex] = useState(propSelectedIndex)
  const menuRef = useRef(null)
  const selectedItemRef = useRef(null)

  // Filter commands fuzzily based on the live query typed in CodeMirror
  const filteredCommands = useMemo(() => filterSlashCommands(query), [query])

  // Sync selection index with CodeMirror's live navigation
  useEffect(() => {
    setSelectedIndex(propSelectedIndex)
  }, [propSelectedIndex])

  // Auto-scroll selected item into view smoothly
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex])

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
      {/* Clean Live Filter Indicator */}
      <div className="editor-slash-search-row">
        <Search size={12} className="editor-slash-search-icon" />
        <span className="editor-slash-search-text">
          {query ? `Filtering: /${query}` : 'Type to filter...'}
        </span>
        <span className="editor-slash-search-badge">ESC</span>
      </div>

      <div className="editor-slash-list">
        {filteredCommands.length === 0 ? (
          <div className="editor-slash-empty">No matching commands for "/{query}"</div>
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
                  onMouseEnter={() => {
                    setSelectedIndex(index)
                    if (slashHandlerRef?.current) {
                      slashHandlerRef.current.selectedIndex = index
                    }
                  }}
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
