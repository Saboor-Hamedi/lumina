import React, { useEffect, useState, useMemo } from 'react'
import { FileText, Brain } from 'lucide-react'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import { getBrainDocuments } from './services/brainKnowledge'
import { getMentionIcon } from './components/LuminaChatMessageRow'
import './css/luminSlash.css'

export interface LuminaMentionProps {
  isOpen: boolean
  filterText: string
  onSelect: (snippet: any) => void
  onClose: () => void
}

/**
 * LuminaMention provides a keyboard-navigable autocomplete overlay for `@` mentions,
 * searching through active workspace notes and system brain documentation.
 */
export const LuminaMention: React.FC<LuminaMentionProps> = ({
  isOpen,
  filterText,
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const notes = useWorkspaceStore((state: any) => state.notes) || []

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
    brainDocs.forEach((bd: any) => {
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
    .filter((item: any) => {
      if (!item.title) return false
      const query = filterText.toLowerCase()
      return (
        item.title.toLowerCase().includes(query) ||
        (item.name && item.name.toLowerCase().includes(query))
      )
    })
    .slice(0, 6)

  useEffect(() => {
    setSelectedIndex(0)
  }, [filterText])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!filteredSnippets.length) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex((prev) => (prev + 1) % filteredSnippets.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedIndex(
          (prev) => (prev - 1 + filteredSnippets.length) % filteredSnippets.length
        )
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

  const getItemIcon = (snippet: any) => {
    if (snippet.isBrain) {
      return <Brain size={13} style={{ color: 'var(--text-accent)' }} />
    }
    return getMentionIcon(snippet.title || snippet.name || '')
  }

  const getItemBadge = (snippet: any) => {
    if (snippet.isBrain) return 'Doc'
    const title = (snippet.title || snippet.name || '').toLowerCase()
    if (/\.(jsx?|tsx?|css|scss|py|json|html|sh|sql)$/i.test(title)) return 'Code'
    return 'Note'
  }

  if (!isOpen || filteredSnippets.length === 0) return null

  return (
    <div className="mention-menu-container">
      <div className="mention-menu-header">
        <span>Attach Context (@)</span>
        <span>{filteredSnippets.length} matches</span>
      </div>
      {filteredSnippets.map((snippet: any, index: number) => (
        <div
          key={snippet.id}
          className={`mention-menu-item ${index === selectedIndex ? 'highlighted' : ''}`}
          onClick={() => onSelect(snippet)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="mention-icon">
            {getItemIcon(snippet)}
          </div>
          <div className="mention-content">
            <span className="mention-title" title={snippet.title}>
              {snippet.title}
            </span>
            <span className={`mention-badge ${snippet.isBrain ? 'is-brain' : ''}`}>
              {getItemBadge(snippet)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default LuminaMention
