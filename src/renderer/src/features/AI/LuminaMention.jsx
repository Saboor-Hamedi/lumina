import React, { useEffect, useState, useMemo } from 'react'
import { FileText, Brain } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import { getBrainDocuments } from './services/brainKnowledge'
import './css/luminSlash.css'

export const LuminaMention = ({ isOpen, filterText, onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const notes = useWorkspaceStore((state) => state.notes) || []

  useKeyboardShortcuts({
    onEscape: isOpen
      ? (e) => {
          if (e) {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
          }
          onClose()
          return true
        }
      : null
  })

  const brainDocs = useMemo(() => getBrainDocuments(), [])

  const allItems = useMemo(() => {
    const list = [...(notes || [])]
    brainDocs.forEach((bd) => {
      list.push({
        id: bd.id,
        title: bd.title,
        name: bd.name,
        code: bd.content,
        isBrain: true
      })
    })
    return list
  }, [notes, brainDocs])

  const filteredSnippets = allItems
    .filter((item) => {
      if (!item.title) return false
      const query = filterText.toLowerCase()
      return item.title.toLowerCase().includes(query) || (item.name && item.name.toLowerCase().includes(query))
    })
    .slice(0, 6)

  useEffect(() => {
    setSelectedIndex(0)
  }, [filterText])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (!filteredSnippets.length) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev + 1) % filteredSnippets.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev - 1 + filteredSnippets.length) % filteredSnippets.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        if (filteredSnippets[selectedIndex]) {
          onSelect(filteredSnippets[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [isOpen, filteredSnippets, selectedIndex, onSelect, onClose])

  if (!isOpen || filteredSnippets.length === 0) return null

  return (
    <div className="slash-menu-container">
      <div
        style={{
          padding: '4px 10px',
          fontSize: '10px',
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          fontWeight: 600
        }}
      >
        Attach File Context
      </div>
      {filteredSnippets.map((snippet, index) => (
        <div
          key={snippet.id}
          className={`slash-menu-item ${index === selectedIndex ? 'highlighted' : ''}`}
          onClick={() => onSelect(snippet)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="slash-icon">
            {snippet.isBrain ? (
              <Brain size={14} style={{ color: 'var(--text-accent)' }} />
            ) : (
              <FileText size={14} />
            )}
          </div>
          <div className="slash-content">
            <span className="slash-label">{snippet.title}</span>
            <span className="slash-desc">
              {snippet.isBrain ? 'Lumina Documentation' : 'Includes full file content'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default LuminaMention
