import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { Search, FileText, FileCode, Pin, PinOff, ArrowUpDown } from 'lucide-react'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core'
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createPortal } from 'react-dom'
import SidebarItem from '../Navigation/components/SidebarItem'
import './ExplorerModal.css'

/**
 * Draggable Grid Item for Pinned Snippets
 */
const SortableGridItem = ({ snippet, getIconForLanguage, onSelect, onUnpin }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: snippet.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 99 : 1
  }

  return (
    <SidebarItem
      snippet={snippet}
      variant="grid"
      onClick={() => onSelect(snippet)}
      dndProps={{ attributes, listeners, setNodeRef }}
      style={style}
    />
  )
}

/**
 * Centered Explorer Modal (Start Menu Replica)
 */
const ExplorerModal = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const searchInputRef = useRef(null)
  const modalRef = useRef(null)
  const rafRef = useRef(null)

  const [isPositionReady, setIsPositionReady] = useState(false)

  const { snippets, setSelectedSnippet, saveSnippet } = useVaultStore()
  
  const { settings, updateSetting } = useSettingsStore()
  const sortBy = settings.sortBy || 'name'
  const sortDirection = settings.sortDirection || 'asc'
  const noteOrder = settings.noteOrder || null

  const cycles = [
    { sortBy: 'name', sortDirection: 'asc' },
    { sortBy: 'name', sortDirection: 'desc' },
    { sortBy: 'modified', sortDirection: 'desc' },
    { sortBy: 'modified', sortDirection: 'asc' },
    { sortBy: 'custom', sortDirection: 'asc' },
  ]

  const handleSortToggle = (e) => {
    e.stopPropagation()
    const currentIndex = cycles.findIndex(c => c.sortBy === sortBy && c.sortDirection === sortDirection)
    const next = cycles[(currentIndex + 1) % cycles.length]
    
    const newSettings = {
      sortBy: next.sortBy,
      sortDirection: next.sortDirection
    }
    
    if (next.sortBy !== 'custom') {
      newSettings.noteOrder = null
    }
    
    useSettingsStore.getState().updateSettings(newSettings)
  }

  // Pagination limit for recommended notes
  const [limit, setLimit] = useState(10)

  // Configure sensors for drag and drop to not interfere with buttons
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  )

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setLimit(10) // Reset pagination
      setIsPositionReady(true)

      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    } else {
      setIsPositionReady(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [isOpen, onClose])

  const { pinnedSnippets, allSnippets } = useMemo(() => {
    let filtered = snippets
    if (query.trim()) {
      const q = query.toLowerCase()
      filtered = snippets.filter(s => 
        (s.title || '').toLowerCase().includes(q) || 
        (s.code || '').toLowerCase().includes(q)
      )
    }
    
    // Filter out pinned snippets from the main list first
    const unpinned = filtered.filter(s => !s.isPinned)

    // Compute pinned notes
    const dbPinned = filtered.filter(s => s.isPinned)
    const pinnedOrderMap = new Map((settings.startMenuPinnedOrder || []).map((id, i) => [id, i]))
    dbPinned.sort((a, b) => {
      const ai = pinnedOrderMap.get(a.id)
      const bi = pinnedOrderMap.get(b.id)
      if (ai !== undefined && bi !== undefined) return ai - bi
      if (ai !== undefined) return -1
      if (bi !== undefined) return 1
      return 0
    })
    const pinned = dbPinned

    // Apply sorting logic identical to FileExplorer
    let all = [...unpinned]
    if (sortBy === 'custom' && noteOrder && noteOrder.length > 0) {
      const orderMap = new Map(noteOrder.map((id, i) => [id, i]))
      all.sort((a, b) => {
        const ai = orderMap.get(a.id)
        const bi = orderMap.get(b.id)
        if (ai !== undefined && bi !== undefined) return ai - bi
        if (ai !== undefined) return -1
        if (bi !== undefined) return 1
        return (a.title || '').localeCompare(b.title || '')
      })
    } else {
      all.sort((a, b) => {
        let cmp = 0
        if (sortBy === 'name') {
          cmp = (a.title || '').localeCompare(b.title || '')
        } else if (sortBy === 'modified') {
          cmp = (a.timestamp || 0) - (b.timestamp || 0)
        }
        return sortDirection === 'asc' ? cmp : -cmp
      })
    }

    return { pinnedSnippets: pinned, allSnippets: all }
  }, [snippets, query, sortBy, sortDirection, noteOrder, settings.startMenuPinnedOrder])

  if (!isOpen || !isPositionReady) return null

  const handleSelect = (snippet) => {
    setSelectedSnippet(snippet)
    onClose()
  }

  const handleTogglePin = async (snippet) => {
    try {
      await saveSnippet({ ...snippet, isPinned: !snippet.isPinned })
    } catch (e) {
      console.error('Failed to toggle pin:', e)
    }
  }

  const handleSortDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over?.id && over) {
      const currentPinnedIds = pinnedSnippets.map(s => s.id)
      const oldIndex = currentPinnedIds.indexOf(active.id)
      const newIndex = currentPinnedIds.indexOf(over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(currentPinnedIds, oldIndex, newIndex)
        useSettingsStore.getState().updateSettings({ startMenuPinnedOrder: newOrder })
      }
    }
  }

  const getIconForLanguage = (language) => {
    switch(language) {
      case 'javascript':
      case 'typescript':
      case 'python':
      case 'html':
      case 'css':
      case 'json':
        return <FileCode size={28} className="icon-blue" />
      case 'markdown':
        return <FileText size={28} className="icon-purple" />
      default:
        return <FileText size={28} className="icon-gray" />
    }
  }

  return createPortal(
    <div 
      className="explorer-modal-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        ref={modalRef}
        className="start-menu-container" 
      >
        
        {/* Search Bar */}
        <div className="start-menu-search">
          <Search size={16} className="search-icon" />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="Search for notes"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Scrollable Body */}
        <div className="start-menu-body">
          
          {/* Pinned Section */}
          <div className="start-section">
            <div className="start-section-header">
              <h3>Favorites</h3>
            </div>
            
            {pinnedSnippets.length === 0 ? (
              <div className="empty-state">No favorite notes</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSortDragEnd}>
                <SortableContext items={pinnedSnippets.map(s => s.id)} strategy={horizontalListSortingStrategy}>
                  <div className="start-grid">
                    {pinnedSnippets.map(snippet => (
                      <SortableGridItem
                        key={snippet.id}
                        snippet={snippet}
                        getIconForLanguage={getIconForLanguage}
                        onSelect={handleSelect}
                        onUnpin={() => handleTogglePin(snippet)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Recommended / All Section */}
          <div className="start-section">
            <div className="start-section-header">
              <h3>Recommended</h3>
              <button 
                className="sort-toggle-btn"
                onClick={handleSortToggle}
                title={`Sort by ${sortBy} (${sortDirection})`}
              >
                <ArrowUpDown size={14} />
              </button>
            </div>
            
            {allSnippets.length === 0 ? (
              <div className="empty-state">No notes found</div>
            ) : (
              <div className="recommended-list">
                {allSnippets.slice(0, limit).map(snippet => (
                  <SidebarItem
                    key={snippet.id}
                    snippet={snippet}
                    onClick={() => handleSelect(snippet)}
                    isActive={false}
                  />
                ))}
                {allSnippets.length > limit && (
                  <button 
                    className="load-more-btn" 
                    onClick={() => setLimit(prev => prev + 10)}
                  >
                    Load More Notes
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>,
    document.body
  )
}

export default ExplorerModal
