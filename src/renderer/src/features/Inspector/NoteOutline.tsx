import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { List, Search, X, Hash } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import './Backlinks/Backlinks.css'

export interface HeadingItem {
  level: number
  text: string
  line: number
}

export interface NoteOutlineProps {
  note?: {
    id?: string
    title?: string
    code?: string
    [key: string]: any
  } | null
  snippet?: any
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const NoteOutline: React.FC<NoteOutlineProps> = React.memo(({ note: propNote, snippet }) => {
  const note = propNote || snippet
  const [headings, setHeadings] = useState<HeadingItem[]>([])
  const [filterQuery, setFilterQuery] = useState('')

  // Defer outline extraction off the immediate tab-switch frame (VS Code style Level 3 computation)
  useEffect(() => {
    if (!note || !note.code) {
      setHeadings([])
      return
    }

    const timer = setTimeout(() => {
      const lines = note.code.split('\n')
      const extracted: HeadingItem[] = []
      lines.forEach((line: string, index: number) => {
        const match = line.match(/^(#{1,6})\s+(.*)/)
        if (match) {
          extracted.push({
            level: match[1].length,
            text: match[2].trim(),
            line: index + 1
          })
        }
      })
      setHeadings(extracted)
    }, 16) // Yields to let the active tab paint in < 16ms

    return () => clearTimeout(timer)
  }, [note?.id, note?.code])

  const filteredHeadings = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (!q) return headings
    return headings.filter((h) => h.text.toLowerCase().includes(q))
  }, [headings, filterQuery])

  const handleNavigateToHeading = useCallback((line: number) => {
    window.dispatchEvent(
      new CustomEvent('editor-scroll-to-line', { detail: { line } })
    )
  }, [])

  const renderHighlightedText = (text: string, query: string) => {
    if (!query) return text
    const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="backlink-match">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  if (!note) {
    return (
      <div className="note-outline-container">
        <div className="outline-empty-state">
          <List size={22} className="outline-empty-icon" />
          <span>Select a note to inspect outline</span>
        </div>
      </div>
    )
  }

  return (
    <div className="note-outline-container">
      {/* Search Filter Bar */}
      <div className="outline-filter-bar">
        <div className="outline-search-input-wrap">
          <Search size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="outline-search-input"
            placeholder="Filter outline..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
          {filterQuery && (
            <button
              type="button"
              className="outline-action-btn"
              onClick={() => setFilterQuery('')}
              title="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="outline-scroll-area premimum-scrollbar">
        <div className="outline-section">
          <div className="outline-section-header">
            <div className="outline-section-title-wrap">
              <Hash size={12} style={{ color: 'var(--text-accent)' }} />
              <span>Headings</span>
            </div>
            <span className="outline-count-badge">
              {headings.length}
            </span>
          </div>

          <div className="outline-items-list">
            {headings.length === 0 ? (
              <div className="outline-empty-state" style={{ padding: '16px 8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  No headings found in this note
                </span>
              </div>
            ) : filteredHeadings.length === 0 ? (
              <div className="outline-empty-state" style={{ padding: '16px 8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  No matching headings found
                </span>
              </div>
            ) : (
              filteredHeadings.map((h, i) => {
                const indentPadding = `${(h.level - 1) * 10}px`

                return (
                  <div
                    key={i}
                    className="outline-item-card"
                    onClick={() => handleNavigateToHeading(h.line)}
                    title={`Jump to line ${h.line}: "${h.text}"`}
                  >
                    <div
                      className="outline-card-header"
                      style={{ paddingLeft: `calc(8px + ${indentPadding})` }}
                    >
                      <div className="outline-title-wrap">
                        <span className="outline-level-badge">H{h.level}</span>
                        <ToolTip text={h.text} position="top" delay={400}>
                          <span className="outline-heading-title">
                            {renderHighlightedText(h.text, filterQuery.trim())}
                          </span>
                        </ToolTip>
                      </div>

                      <div className="outline-card-meta">
                        <span className="outline-line-num">L{h.line}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

NoteOutline.displayName = 'NoteOutline'
export default NoteOutline
