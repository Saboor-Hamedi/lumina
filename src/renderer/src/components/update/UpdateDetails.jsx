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
- Explorer Hook Architecture: Extracted FileExplorer into focused hooks (useExplorerSelection, useExplorerDnd, useExplorerOperations, useFolderContextMenu) and components (ExplorerHeader, ExplorerFavorites) — FileExplorer.jsx reduced from 1,400+ to ~830 lines
- Folder Rename via Keyboard: Select a folder in the explorer and press Ctrl+R (Cmd+R on Mac) to rename it inline using the unified RenameModal, same as renaming notes
- Drag Overlay Width Constraint: Note drag previews are now capped to sidebar width (~220px) with text ellipsis so long titles no longer overflow during drag

Improved
- Folder Nesting via Drag & Drop: Dropping a folder onto another folder now reliably nests it; dropping onto the root zone correctly moves it back to root level
- Explorer Indentation Precision: Root folders sit at 0px, subfolders at 10px depth steps, root notes at 10px, and subfolder notes at depth×10+10px — all consistent
- Folder Creation Order: New folders always append to the bottom of the list and are never sorted alphabetically, preserving your custom drag order
- Drag Hover Stability: Folders no longer auto-expand or shift during a drag pass — only explicit drops trigger expand
- Path Normalization on Windows: All vault folder paths are normalized from backslash to forward slash preventing tree hierarchy bugs on Windows
- Performance: Eliminated redundant re-renders in explorer by splitting large monolithic state into scoped hooks with stable references

Fixed
- activeListDragItem Reference Error: Resolved undefined variable crash caused by hook initialization order in FileExplorer
- expandedFolders Before Initialization: Fixed temporal dead zone error by reordering useExplorerOperations before useFileTree call
- Duplicate State Declarations: Removed leftover inline expandedFolders, creating, renamingFolder state blocks that conflicted with extracted hooks
- Context Menu Premature Access: Moved useContextMenu call below hook initialization so setExpandedFolders and setCreating are available
- Folder Drop Inside Another Folder: Fixed logic where same-level drag IDs were misidentified, blocking nesting; now correctly targets folder-{id} drop zones`
  
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
