import React, { useMemo } from 'react'
import './SnippetDetails.css'

const SnippetOutline = ({ snippet }) => {
  const headings = useMemo(() => {
    if (!snippet || !snippet.code) return []
    const lines = snippet.code.split('\n')
    const extracted = []
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.*)/)
      if (match) {
        extracted.push({
          level: match[1].length,
          text: match[2],
          line: index + 1 // 1-indexed for the editor
        })
      }
    })
    return extracted
  }, [snippet?.code])

  if (!snippet) {
    return <div className="inspector-empty">No note selected for outline.</div>
  }
  
  return (
    <div className="snippet-outline">
      {headings.length === 0 ? (
        <div className="outline-empty">No headings found in this note.</div>
      ) : (
        <ul className="outline-tree">
          {headings.map((h, i) => (
            <li 
              key={i} 
              className="outline-item"
              onClick={() => {
                // Dispatch event to scroll the editor to this line
                window.dispatchEvent(new CustomEvent('editor-scroll-to-line', { detail: { line: h.line } }))
              }}
            >
              <div 
                className="outline-item-content"
                style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
              >
                {/* Render vertical guide lines for deep nesting */}
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
      )}
    </div>
  )
}

export default SnippetOutline
