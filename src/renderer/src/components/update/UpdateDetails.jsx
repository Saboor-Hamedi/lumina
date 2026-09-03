import React, { useEffect, useState, useRef } from 'react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { Download } from 'lucide-react'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
import ToolTip from '../atoms/ToolTip'
import './UpdateDetails.css'

const UpdateDetails = () => {
  const { status, updateInfo, progress, download, install, check } = useUpdateStore()
  const [currentVersion, setCurrentVersion] = useState('1.0.0')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (window.api?.getVersion) {
      window.api.getVersion().then(setCurrentVersion)
    }
  }, [])

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
- Markdown Callouts: Bring your notes to life with colorful Note, Tip, Warning, Important, and Caution boxes (just type > [!note]).
- Instant AI on Any Note: Click "Ask AI" in the note header or press Ctrl+K to get quick answers and edits without needing to click inside the editor first.
- Adaptive Theme Overlays: Inline AI and search palettes now automatically match your active theme colors and lighting seamlessly.

Improved
- Clean Code Selection: Selecting multi-line code blocks and quotes is now straight and continuous from edge to edge without jagged steps.
- Responsive Command Palette: Quick search and note preview now stay open, readable, and responsive even on smaller or split-screen windows.
- Silky-Smooth AI Popover: Dragging the AI prompt anywhere on your screen is now buttery smooth at 60/120Hz with zero lag.
- Snappier Chat Streaming: Long conversations stream faster with zero lag on older messages and smooth auto-scrolling.

Fixed
- No More False Conflict Alerts: Rapidly editing and saving your notes will no longer trigger false external conflict prompts.
- Callouts Stay Visible on Scroll: Callout boxes keep their styling and colors intact when scrolling through long documents.
- Quote Selection Alignment: Highlighted quotes and markdown blocks now highlight cleanly from edge to edge.`
  
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
            download={download}
            check={check}
            newVersion={newVersion}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  )
}

export default UpdateDetails
