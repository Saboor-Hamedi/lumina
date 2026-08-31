import React, { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { useVaultStore } from '../../core/store/useVaultStore'
import './SlashCommandMenu.css' // We can reuse the same CSS structure

export const LuminaMention = ({ isOpen, filterText, onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const snippets = useVaultStore((state) => state.snippets)

  // Filter snippets based on filterText (up to 5 results)
  const filteredSnippets = snippets
    .filter((snippet) => {
      if (!snippet.title) return false
      return snippet.title.toLowerCase().includes(filterText.toLowerCase())
    })
    .slice(0, 5)

  useEffect(() => {
    setSelectedIndex(0)
  }, [filterText])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % filteredSnippets.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredSnippets.length) % filteredSnippets.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (filteredSnippets[selectedIndex]) {
          onSelect(filteredSnippets[selectedIndex])
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
          className={`slash-menu-item ${index === selectedIndex ? 'active' : ''}`}
          onClick={() => onSelect(snippet)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="slash-icon">
            <FileText size={14} />
          </div>
          <div className="slash-content">
            <span className="slash-label">{snippet.title}</span>
            <span className="slash-desc">Includes full file content</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default LuminaMention
