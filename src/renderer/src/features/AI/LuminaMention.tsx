import React, { useEffect, useState, useMemo } from 'react'
import { FileText, Brain, Folder } from 'lucide-react'
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
 * searching through active workspace folders, notes, and system brain documentation.
 */
export const LuminaMention: React.FC<LuminaMentionProps> = ({
  isOpen,
  filterText,
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const notes = useWorkspaceStore((state: any) => state.notes) || []
  const folders = useWorkspaceStore((state: any) => state.folders) || []

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
    const list: any[] = []

    // Collect all explicit + implicit folder paths from workspace notes
    const folderSet = new Set<string>(Array.isArray(folders) ? folders : [])
    ;(notes || []).forEach((n: any) => {
      if (n?.folderId && typeof n.folderId === 'string') {
        const clean = n.folderId.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
        if (clean) folderSet.add(clean)
      }
    })

    Array.from(folderSet)
      .sort((a, b) => a.localeCompare(b))
      .forEach((folderPath: string) => {
        const normFolder = folderPath.toLowerCase().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
        const folderNotes = (notes || []).filter((n: any) => {
          const nf = String(n?.folderId || '')
            .toLowerCase()
            .replace(/\\/g, '/')
            .replace(/^\/+|\/+$/g, '')
          return nf === normFolder || nf.startsWith(`${normFolder}/`)
        })
        list.push({
          id: `folder:${folderPath}`,
          title: folderPath,
          name: folderPath.split('/').pop() || folderPath,
          folderId: folderPath,
          isFolder: true,
          noteCount: folderNotes.length
        })
      })

    list.push(...(notes || []))

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
  }, [notes, folders, brainDocs])

  const filteredSnippets = allItems
    .filter((item: any) => {
      if (!item.title) return false
      const query = filterText.toLowerCase()
      return (
        item.title.toLowerCase().includes(query) ||
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.folderId && String(item.folderId).toLowerCase().includes(query))
      )
    })
    .slice(0, 8)

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
    if (snippet.isFolder) {
      return <Folder size={13} style={{ color: 'var(--text-accent)' }} />
    }
    if (snippet.isBrain) {
      return <Brain size={13} style={{ color: 'var(--text-accent)' }} />
    }
    return getMentionIcon(snippet.title || snippet.name || '')
  }

  const getItemBadge = (snippet: any) => {
    if (snippet.isFolder) {
      const count = snippet.noteCount ?? 0
      return `Folder (${count})`
    }
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
