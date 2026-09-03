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
    
    document.addEventListener('pointerdown', handleClickOutside, { capture: true })
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, { capture: true })
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  const newVersion = updateInfo?.version || currentVersion
  
  const rawNotes =
    updateInfo?.releaseNotes ||
    `New
- Granular Fault Isolation: Independent error boundaries for Left Sidebar, Right Inspector, Open Note Tabs, Knowledge Graph, and Welcome views with container-query responsive cards.
- Auto-Reset Update Status: Instant "Up to date" check feedback that automatically resets back to "Check for Updates" after 3 seconds.
- Vault Details & Live Stats: Click the note counter in the Explorer header to inspect real-time vault statistics, including total notes, folders, favorites, learning progress, word counts, characters, and disk storage size.
- OS-Grade Multi-Selection: Select folders and notes together using Ctrl+Click, Shift+Click continuous range selection, or Ctrl+A to select all.
- Bulk Folder & Note Deletion: Safely delete selected folders, subdirectories, and notes in bulk with a confirmation dialog.
- Interactive Mermaid & Image Lightbox: Full-screen pan & zoom modal with smooth vector scaling, 2px borders, and bottom-right floating controls.

Improved
- Micro Error Handler UI: Sleek 26px micro action buttons, 22px icon-only copy action with instant checkmark feedback, and slim scrollable code block.
- Development Mode Update Checking: Instant update status response in local development without infinite loading spinners.
- Comprehensive Test Coverage: Expanded test suites across Settings (Shortcuts, Color Picker), Workspace Manager, and App Update lifecycle with 100% pass rate.
- Stylish Mermaid Support: Custom node styling (style, classDef, colors, and HTML labels) renders accurately in both the editor and fullscreen lightbox.
- Responsive Narrow Sidebar: File explorer tabs and header actions collapse cleanly to centered icons on narrow window sizes without text wrapping.
- Refined Borderless Tooltips: Modern, subtle tooltips with 2px corner radius and deep ambient glass blur.

Fixed
- Complete Folder Deletion: Fixed folder deletion on root items and ensured folders containing hidden files or gitignore clean up completely from disk and memory.
- Breadcrumbs Path Resolution: Guaranteed full breadcrumb path display and click-to-copy synchronization for all open workspace files.
- Recursive Folder Deletion: Fixed folder deletion on root items and ensured nested folders clean up completely from disk and memory.`
  
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
