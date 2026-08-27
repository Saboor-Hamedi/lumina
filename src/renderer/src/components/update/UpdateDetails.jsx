import React, { useEffect, useState, useRef } from 'react'
import { useUpdateStore } from '../../core/store/useUpdateStore'
import { Download } from 'lucide-react'
import UpdateHeader from './UpdateHeader'
import UpdateFooter from './UpdateFooter'
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
  
  // Dummy parser for categorized release notes, or use default if empty
  const rawNotes = updateInfo?.releaseNotes || 'New\n- Completely redesigned Update Command Center\n- Support for automatic silent background updates\n\nFixed\n- Editor caret height bug when zooming\n- Context menu closing prematurely on hover\n\nImproved\n- Context menu performance and rendering speed'
  
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
      <button 
        className={`update-trigger-btn ${status === 'available' || status === 'downloading' || status === 'ready' ? 'has-update' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Check for updates"
      >
        <Download size={14} />
      </button>

      {isOpen && (
        <div className="update-details-dropdown" data-testid="update-details">
          <UpdateHeader currentVersion={currentVersion} newVersion={newVersion} status={status} />

          <div className="update-details-body selectable-text">
            {parsedNotes.map((category, i) => (
              <div key={i} className="release-category">
                <div className="category-title">{category.title}</div>
                <ul className="category-items">
                  {category.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            <a href="https://github.com/Saboor-Hamedi/lumina/releases" target="_blank" rel="noreferrer" className="changelog-link">
              View Full Changelog
            </a>
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
