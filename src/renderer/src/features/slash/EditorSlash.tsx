/**
 * @file EditorSlash.tsx
 * @description Native, zero-friction inline slash command palette for the Lumina Markdown Editor.
 * Rendered directly into document.body portal so coordinates accurately position
 * right below the typed '/' character without being skewed by editor transformations.
 * @module features/slash/EditorSlash
 */

import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  HelpCircle,
  Globe,
  Mail
} from 'lucide-react'
import { filterSlashCommands, type SlashCommand } from './utils/slashCommands'
import type { SlashCoords, SlashHandler } from './utils/editorSlashExtension'
import './css/editorSlash.css'

/**
 * Lucide icon component dictionary mapping icon names from command registry.
 */
const ICON_MAP: Record<string, ReactNode> = {
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
  Link: <Link size={13} />,
  Globe: <Globe size={13} />,
  Mail: <Mail size={13} />
}

/**
 * Props for the EditorSlash component.
 */
export interface EditorSlashProps {
  /** Whether the slash palette is currently visible */
  isOpen: boolean
  /** Filter query typed immediately after '/' */
  query?: string
  /** Screen bounding coordinates of the triggered '/' character */
  coords?: SlashCoords
  /** Active selection index for keyboard navigation */
  selectedIndex?: number
  /** Callback executed when a slash command is selected */
  onSelect: (command: SlashCommand) => void
  /** Callback executed when the menu is closed without selection */
  onClose?: () => void
  /** Imperative handler reference shared with CodeMirror view plugin */
  slashHandlerRef?: React.MutableRefObject<SlashHandler | any>
}

/**
 * EditorSlash Component
 *
 * Renders an inline, floating command palette directly underneath the cursor.
 */
export const EditorSlash: React.FC<EditorSlashProps> = ({
  isOpen,
  query = '',
  coords,
  selectedIndex: propSelectedIndex = 0,
  onSelect,
  slashHandlerRef
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(propSelectedIndex)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const selectedItemRef = useRef<HTMLDivElement | null>(null)

  // Filter commands in real time based on the live query typed after '/'
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

  // Smart vertical flip: flip ABOVE if space below is too small
  const shouldFlipAbove = spaceBelow < popupHeight + 16 && spaceAbove > spaceBelow

  const top = shouldFlipAbove
    ? Math.max(12, coords.top - popupHeight - 4)
    : Math.min(window.innerHeight - popupHeight - 12, coords.bottom + 4)

  // Align horizontally flush with the exact position of the '/' character
  let left = coords.left
  if (left + popupWidth > window.innerWidth - 16) {
    left = Math.max(16, window.innerWidth - popupWidth - 16)
  }
  if (left < 16) left = 16

  const style: React.CSSProperties = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    zIndex: 999999
  }

  // Group commands by category for clear visual separation
  let currentCategory: string | null = null

  return createPortal(
    <div className="editor-slash-palette" style={style} ref={menuRef}>
      {/* Live Filter Indicator */}
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
    </div>,
    document.body
  )
}

export default EditorSlash
