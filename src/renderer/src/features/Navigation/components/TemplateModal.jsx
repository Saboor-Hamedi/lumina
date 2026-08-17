import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FileText } from 'lucide-react'
import { useKeyboardShortcuts } from '../../../core/hooks/useKeyboardShortcuts'
import ModalHeader from '../../Overlays/ModalHeader'
import './TemplateModal.css'

const TemplateModal = ({ isOpen, onClose, templates, onSelectTemplate }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)

  // Prepend a blank note option so users always have a way out
  const allOptions = useMemo(() => {
    return [
      { id: 'blank', title: 'Blank Note', code: '' },
      ...templates
    ]
  }, [templates])

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return allOptions.filter((t) => t.title?.toLowerCase().includes(query))
  }, [allOptions, searchQuery])

  // Reset focus when search changes
  React.useEffect(() => {
    setFocusedIndex(0)
  }, [searchQuery])

  useKeyboardShortcuts({
    onEscape: onClose
  })

  // Handle local keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => Math.min(prev + 1, filteredTemplates.length - 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredTemplates[focusedIndex]) {
        onSelectTemplate(filteredTemplates[focusedIndex])
        onClose()
      }
    }
  }

  // Parses template markdown into visual wireframe lines
  const renderWireframe = (code) => {
    if (!code) return <div className="template-preview-line template-preview-text" />
    
    const lines = code.split('\n').slice(0, 8) // only care about first ~8 lines
    return lines.map((line, i) => {
      const trimmed = line.trim()
      
      if (trimmed === '') {
        return <div key={i} className="template-preview-gap" />
      }
      if (trimmed.startsWith('# ')) {
        return <div key={i} className="template-preview-h1" />
      }
      if (trimmed.startsWith('## ')) {
        return <div key={i} className="template-preview-h2" />
      }
      if (trimmed.startsWith('- [ ]') || trimmed.startsWith('* [ ]')) {
        return (
          <div key={i} className="template-preview-list-item">
            <div className="template-preview-checkbox" />
            <div className="template-preview-list-text" style={{ width: Math.random() * 40 + 40 + '%' }} />
          </div>
        )
      }
      if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed)) {
        return (
          <div key={i} className="template-preview-list-item">
            <div className="template-preview-bullet" />
            <div className="template-preview-list-text" style={{ width: Math.random() * 40 + 40 + '%' }} />
          </div>
        )
      }
      if (trimmed.startsWith('>')) {
        return (
          <div key={i} className="template-preview-list-item" style={{ paddingLeft: '2px', borderLeft: '2px solid var(--text-muted)' }}>
            <div className="template-preview-list-text" style={{ width: '90%' }} />
          </div>
        )
      }
      if (trimmed.startsWith('|')) {
        return (
          <div key={i} className="template-preview-table-row">
            <div className="template-preview-table-cell" />
            <div className="template-preview-table-cell" />
            <div className="template-preview-table-cell" />
          </div>
        )
      }
      
      // Standard text line
      const widthClass = trimmed.length > 50 ? 'long' : trimmed.length < 15 ? 'short' : ''
      return <div key={i} className={`template-preview-line template-preview-text ${widthClass}`} />
    })
  }

  return createPortal(
    <div className="template-modal-overlay" onClick={onClose}>
      <div className="template-modal-container" onClick={(e) => e.stopPropagation()}>
        <ModalHeader title="Select Daily Note Template" icon={<FileText size={16} />} onClose={onClose} />

        <div className="template-modal-toolbar">
          <input
            type="text"
            className="template-search-input"
            placeholder="Search templates (Use arrow keys)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="template-modal-stats">Showing {filteredTemplates.length} templates</div>
        </div>

        <div className="template-modal-grid">
          {filteredTemplates.map((t, index) => (
            <div
              key={t.id}
              className={`template-modal-card ${index === focusedIndex ? 'focused' : ''}`}
              onClick={() => {
                onSelectTemplate(t)
                onClose()
              }}
              onMouseEnter={() => setFocusedIndex(index)}
            >
              <div className="template-card-header">
                <div className="template-card-icon">
                  <FileText size={14} />
                </div>
                <span className="template-modal-name">{t.title?.replace('.md', '')}</span>
              </div>
              <div className="template-card-body">
                {t.id === 'blank' 
                  ? <div style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4 }}>Start with a completely empty daily note. No predefined structure.</div> 
                  : renderWireframe(t.code)}
              </div>
            </div>
          ))}
          {filteredTemplates.length === 0 && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              No templates found.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default TemplateModal
