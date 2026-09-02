import React, { useEffect, useState, useRef } from 'react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { Download } from 'lucide-react'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
import ToolTip from '../atoms/ToolTip'
import './UpdateDetails.css'

const UpdateDetails = () => {
  const { status, updateInfo, progress, download, install } = useUpdateStore()
  const [currentVersion, setCurrentVersion] = useState('1.0.0')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (window.api?.getVersion) {
      window.api.getVersion().then(setCurrentVersion)
    }
  }, [])

  // Automatically download if available
  useEffect(() => {
    if (status === 'available') {
      download()
    }
  }, [status, download])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    const handleWindowBlur = () => setIsOpen(false)
    
    // Use pointerdown and capture phase to guarantee it fires before CodeMirror or other elements stop propagation
    document.addEventListener('pointerdown', handleClickOutside, { capture: true })
    window.addEventListener('blur', handleWindowBlur) // Close if window loses focus
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, { capture: true })
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  const newVersion = updateInfo?.version || currentVersion
  
  // Categorized release notes parser with latest version highlights
  const rawNotes =
    updateInfo?.releaseNotes ||
    `New
- Native Mark-Based Wikilinks: Seamless text selection and instant editing across all internal links
- Multi-Format List Auto-Continuation: Smart continuation on Enter for numbered (1., 1-, 1)), lettered (a), a-, A.), and bullet (- , * , +) lists
- Invisible Horizontal Table Scrolling: Tables with many columns now pan smoothly with zero scrollbar clutter
- Dynamic Headings Block Cursor: Caret height and width dynamically adapt to heading font sizes and hide cleanly during text selection
- Hierarchical Nested Lists: Tab / Shift-Tab indentation with progressive bullet styling (• ➔ ◦ ➔ ▪)

Improved
- Document Selection: Fixed line and heading selection to wrap tightly around text without full-width bleeding or newline spill
- Fold Placeholders: Minimal, transparent heading collapse indicator that cleanly hides nested wikilinks
- IconPicker Shortcut: Dedicated shortcut restricted to Ctrl + Shift + . (Cmd + Shift + .)
- Clean Link Typography: Removed trailing external link icons from all internal note wikilinks
- Table Column Layout: Natural column sizing preventing squished columns on wide data tables

Fixed
- Eliminated RangeError: Invalid child in posBefore when clicking, dragging, or double-clicking wikilinks
- Resolved caret snapping and mousedown event hijacking inside CodeMirror
- Cleaned up selection layer overlapping with resting caret blocks`
  
  const parseNotes = (text) => {
    const categories = []
    let currentCategory = null
    
    text.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (!trimmed) return
      
      const cleanLine = trimmed.replace(/^[^\w\s-]/, '').trim()
      
      if (!cleanLine.startsWith('-') && !cleanLine.startsWith('•')) {
        currentCategory = { title: cleanLine, items: [] }
        categories.push(currentCategory)
      } else if (currentCategory) {
        currentCategory.items.push(cleanLine.replace(/^[-•]\s*/, ''))
      } else {
        categories.push({ title: 'Updates', items: [cleanLine.replace(/^[-•]\s*/, '')] })
      }
    })
    return categories.length > 0 ? categories : [{ title: 'Notes', items: [text] }]
  }

  const parsedNotes = parseNotes(rawNotes)

  return (
    <div className="update-details-container" ref={dropdownRef}>
      <ToolTip text="Check for updates" position="bottom">
        <button 
          className={`update-trigger-btn ${status === 'available' || status === 'downloading' || status === 'ready' ? 'has-update' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Download size={14} />
        </button>
      </ToolTip>

      {isOpen && (
        <div className="update-details-dropdown" data-testid="update-details">
          <UpdateHeader currentVersion={currentVersion} newVersion={newVersion} status={status} />

          <div className="update-details-body selectable-text">
            {parsedNotes.map((category, i) => {
              const catKey = category.title.toLowerCase()
              const isNew = catKey.includes('new')
              const isFixed = catKey.includes('fix')
              const isImproved = catKey.includes('improv')

              return (
                <div
                  key={i}
                  className={`release-category release-category-${isNew ? 'new' : isFixed ? 'fixed' : isImproved ? 'improved' : 'default'}`}
                >
                  <div className="category-header">
                    <span
                      className={`category-badge badge-${isNew ? 'new' : isFixed ? 'fixed' : isImproved ? 'improved' : 'default'}`}
                    >
                      {category.title}
                    </span>
                  </div>
                  <ul className="category-items">
                    {category.items.map((item, j) => {
                      const colonIdx = item.indexOf(':')
                      if (colonIdx !== -1) {
                        const title = item.slice(0, colonIdx)
                        const desc = item.slice(colonIdx + 1)
                        return (
                          <li key={j} className="release-item">
                            <span className="release-bullet">•</span>
                            <span className="release-text">
                              <strong className="release-item-title">{title}:</strong>
                              <span className="release-item-desc">{desc}</span>
                            </span>
                          </li>
                        )
                      }
                      return (
                        <li key={j} className="release-item">
                          <span className="release-bullet">•</span>
                          <span className="release-text">{item}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
            <div className="changelog-footer">
              <a
                href="https://github.com/Saboor-Hamedi/lumina/releases"
                target="_blank"
                rel="noreferrer"
                className="changelog-link"
              >
                View Full Changelog
              </a>
            </div>
          </div>

          <UpdateFooter 
            status={status} 
            progress={progress} 
            install={install} 
            onClose={() => setIsOpen(false)} 
          />
        </div>
      )}
    </div>
  )
}

export default UpdateDetails
