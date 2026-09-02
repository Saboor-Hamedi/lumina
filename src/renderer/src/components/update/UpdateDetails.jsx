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
- Editor Breadcrumbs Header: Minimalist, responsive breadcrumb bar below the tab bar showing active folder hierarchy and quick navigation
- Ultra-Fast Note & Folder Hover Previews: Exterior preview cards with live word count, reading time, folder badges, tags, clean markdown preview, and folder contents list
- Status Bar Interactive Actions: Clickable line/col indicators to instantly jump and center cursor, word/char counters, and live indexing status
- Modal Lightbox for Images & Mermaid: Fullscreen preview with smooth zoom controls, docked toolbar, and immediate Escape key closing
- Refined Properties Inspector: Tabbed Right Sidebar with dedicated 0.5px subtle tab borders, live note outline navigation, and stats overview

Improved
- Exterior Tooltip Anchor: Explorer tooltips float cleanly outside the left sidebar onto the editor canvas with accurate speech-bubble arrow pointers
- Fast Cursor Tracking: 25ms instant warm-up tracking when sweeping cursor across files and folders
- Suppressed Browser Default Tooltips: Cleaned native HTML tooltips across Mermaid diagrams, image embeds, and Markdown table toolbars
- Invisible Horizontal Table Scrolling: Tables with many columns pan smoothly with zero scrollbar clutter
- Dynamic Heading Block Cursor: Caret height and width adapt to heading font sizes and hide cleanly during text selection

Fixed
- Sidebar Focus & Selection: Fixed note deselection when interacting with empty root areas in the explorer sidebar
- Right Sidebar Tab Underlines: Removed 2px thick purple pseudo-element bleed from the inspector tabs
- Note Preview Word Counting: Resolved word count reading from note markdown code body
- Modal Lightbox Escape Dismissal: Guaranteed instant closing of image and Mermaid lightboxes on Escape`
  
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
