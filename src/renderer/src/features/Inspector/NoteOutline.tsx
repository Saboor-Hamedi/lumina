import React, { useState, useEffect } from 'react'
import './NoteDetails.css'

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

export const NoteOutline: React.FC<NoteOutlineProps> = React.memo(({ note: propNote, snippet }) => {
  const note = propNote || snippet
  const [headings, setHeadings] = useState<HeadingItem[]>([])

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
            text: match[2],
            line: index + 1
          })
        }
      })
      setHeadings(extracted)
    }, 16) // Yields to let the active tab paint in < 16ms

    return () => clearTimeout(timer)
  }, [note?.id, note?.code])

  if (!note) {
    return (
      <div className="details-modal-body" style={{ height: '100%', overflowY: 'auto' }}>
        <div
          className="panel-empty"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)'
          }}
        >
          No note selected
        </div>
      </div>
    )
  }

  if (headings.length === 0) {
    return (
      <div className="details-modal-body" style={{ height: '100%', overflowY: 'auto' }}>
        <div
          className="panel-empty"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)'
          }}
        >
          No headings found in this note.
        </div>
      </div>
    )
  }

  return (
    <div className="note-outline">
      <ul className="outline-tree">
        {headings.map((h, i) => (
          <li
            key={i}
            className="outline-item"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('editor-scroll-to-line', { detail: { line: h.line } })
              )
            }}
          >
            <div
              className="outline-item-content"
              style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
            >
              {h.level > 1 && (
                <div
                  className="outline-item-indent-guide"
                  style={{ left: `${(h.level - 2) * 16 + 8}px` }}
                />
              )}
              <span className="outline-level-indicator">H{h.level}</span>
              <span className="outline-text">{h.text}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
})

NoteOutline.displayName = 'NoteOutline'
export default NoteOutline
