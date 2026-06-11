import React, { useState, useMemo, useRef, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  RefreshCw,
  Star,
  FolderOpen,
  ArrowUpDown
} from 'lucide-react'
import { DndContext, DragOverlay, closestCenter, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import SidebarItem from './components/SidebarItem'
import { FixedSizeList as List } from '../../components/utils/VirtualList'
import { AutoSizer } from '../../components/utils/AutoSizer'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import './FileExplorer.css'

const DraggableRow = React.memo(({ snippet, isActive, onClick, style }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: snippet.id,
    data: { snippet }
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <SidebarItem
        snippet={snippet}
        isActive={isActive}
      />
    </div>
  )
})

DraggableRow.displayName = 'DraggableRow'

const FileExplorer = React.memo(({ onNavigate }) => {
  const { settings, updateSetting } = useSettingsStore()
  const sortBy = settings.sortBy || 'name'
  const sortDirection = settings.sortDirection || 'asc'
  const noteOrder = settings.noteOrder || null
  const collapsedSections = settings.sidebarCollapsedSections || {
    pinned: false,
    recent: false,
    all: false
  }

  const {
    snippets,
    selectedSnippet,
    setSelectedSnippet,
    isLoading,
    searchQuery,
    setSearchQuery,
    loadVault,
    saveSnippet,
    reorderSnippets
  } = useVaultStore()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  const [activeSection, setActiveSection] = useState('all')
  const [activeDragId, setActiveDragId] = useState(null)
  const treeRef = useRef(null)
  const listRef = useRef(null)

  const handleSelect = (snippet, section = 'all') => {
    setSelectedSnippet(snippet)
    setActiveSection(section)
    if (onNavigate) onNavigate()
  }

  const [isRefreshing, setIsRefreshing] = useState(false)

  const cycles = [
    { sortBy: 'name', sortDirection: 'asc' },
    { sortBy: 'name', sortDirection: 'desc' },
    { sortBy: 'modified', sortDirection: 'desc' },
    { sortBy: 'modified', sortDirection: 'asc' },
    { sortBy: 'custom', sortDirection: 'asc' },
  ]

  const handleSortToggle = () => {
    const currentIndex = cycles.findIndex(c => c.sortBy === sortBy && c.sortDirection === sortDirection)
    const next = cycles[(currentIndex + 1) % cycles.length]
    updateSetting('sortBy', next.sortBy)
    updateSetting('sortDirection', next.sortDirection)
    if (next.sortBy !== 'custom') {
      updateSetting('noteOrder', null)
    }
  }

  const toggleSection = (section) => {
    updateSetting('sidebarCollapsedSections', {
      ...collapsedSections,
      [section]: !collapsedSections[section]
    })
  }

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      await loadVault()
      setTimeout(() => setIsRefreshing(false), 800)
    } catch (error) {
      console.error('Failed to refresh vault:', error)
      setIsRefreshing(false)
    }
  }

  const handleNew = async () => {
    try {
      const newSnippet = {
        id: crypto.randomUUID(),
        title: 'New Notes',
        code: '',
        language: 'markdown',
        timestamp: Date.now(),
        isPinned: false
      }
      await saveSnippet(newSnippet)
      handleSelect(newSnippet, 'all')
    } catch (error) {
      console.error('Failed to create new note:', error)
    }
  }

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return snippets.filter((s) => (s.title || '').toLowerCase().includes(query))
  }, [snippets, searchQuery])

  const sorted = useMemo(() => {
    if (sortBy === 'custom' && noteOrder && noteOrder.length > 0) {
      const orderMap = new Map(noteOrder.map((id, i) => [id, i]))
      const items = [...filtered]
      items.sort((a, b) => {
        const ai = orderMap.get(a.id)
        const bi = orderMap.get(b.id)
        if (ai !== undefined && bi !== undefined) return ai - bi
        if (ai !== undefined) return -1
        if (bi !== undefined) return 1
        return (a.title || '').localeCompare(b.title || '')
      })
      return items
    }

    const items = [...filtered]
    items.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') {
        cmp = (a.title || '').localeCompare(b.title || '')
      } else if (sortBy === 'modified') {
        cmp = (a.timestamp || 0) - (b.timestamp || 0)
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return items
  }, [filtered, sortBy, sortDirection, noteOrder])

  const pinnedItems = useMemo(() => sorted.filter((s) => s.isPinned), [sorted])
  const unpinned = useMemo(() => sorted.filter((s) => !s.isPinned), [sorted])

  const isCustomSort = sortBy === 'custom'

  const handleDragStart = useCallback((event) => {
    setActiveDragId(event.active.id)
  }, [])

  const handleDragEnd = useCallback((event) => {
    setActiveDragId(null)

    const { active, over } = event
    if (!active || !over || active.id === over.id) return

    const items = unpinned
    const oldIndex = items.findIndex(s => s.id === active.id)
    const newIndex = items.findIndex(s => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex)

    if (sortBy !== 'custom') {
      updateSetting('sortBy', 'custom')
    }
    reorderSnippets(reordered.map(s => s.id))
  }, [unpinned, sortBy, updateSetting, reorderSnippets])

  const activeDragSnippet = useMemo(
    () => activeDragId ? snippets.find(s => s.id === activeDragId) : null,
    [activeDragId, snippets]
  )

  const Row = useCallback(({ index, style }) => {
    const snippet = unpinned[index]
    if (!snippet) return null

    return (
      <DraggableRow
        snippet={snippet}
        isActive={selectedSnippet?.id === snippet.id && activeSection === 'all'}
        onClick={() => handleSelect(snippet, 'all')}
        style={style}
      />
    )
  }, [unpinned, selectedSnippet, activeSection])

  const listContent = (
    <div
      className="section-items"
      style={{ flex: 1, minHeight: 0, position: 'relative' }}
      ref={treeRef}
    >
      {isLoading ? (
        [1, 2, 3, 4].map((i) => (
          <div key={i} className="tree-item skeleton-item">
            <div className="skeleton skeleton-icon" />
            <div className="skeleton skeleton-text" />
          </div>
        ))
      ) : unpinned.length > 0 ? (
        <SortableContext items={unpinned.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={listRef}
                height={height}
                itemCount={unpinned.length}
                itemSize={34}
                width={width}
                className="virtual-list"
              >
                {Row}
              </List>
            )}
          </AutoSizer>
        </SortableContext>
      ) : (
        <div className="tree-empty">
          <div className="empty-icon">📭</div>
          No notes found
        </div>
      )}
    </div>
  )

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
    >
      <div className="sidebar-pane">
        <header className="pane-header">
          <div className="pane-actions pane-actions-left">
            <button className="icon-btn sort-btn" onClick={handleSortToggle} title={`Sort: ${sortBy === 'custom' ? 'Custom' : sortBy === 'name' ? 'Name' : 'Modified'} ${sortBy !== 'custom' ? (sortDirection === 'asc' ? '↑' : '↓') : ''}`}>
              <ArrowUpDown size={13} />
              <span className="sort-label">
                {sortBy === 'custom' ? 'Custom' : `${sortBy === 'name' ? 'Name' : 'Modified'} ${sortDirection === 'asc' ? '↑' : '↓'}`}
              </span>
            </button>
          </div>
          <div className="pane-actions pane-actions-right">
            <button className="icon-btn" onClick={handleRefresh} title="Refresh Vault (Sync Disk)">
              <RefreshCw size={14} className={isRefreshing ? 'rotating' : ''} />
            </button>
            <button className="icon-btn" onClick={handleNew} title="New Note">
              <Plus size={16} />
            </button>
          </div>
        </header>

        <div className="explorer-toolbar">
          <div className="explorer-search">
            <Search size={12} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="explorer-tree">
          {pinnedItems.length > 0 && (
            <div className="tree-section">
              <div className="section-header" onClick={() => toggleSection('pinned')}>
                {collapsedSections.pinned ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <Star size={14} className="section-icon" />
                <span>PINNED</span>
              </div>
              {!collapsedSections.pinned && (
                <div className="section-static-items">
                  {pinnedItems.map((item) => (
                    <SidebarItem
                      key={item.id}
                      snippet={item}
                      isActive={selectedSnippet?.id === item.id && activeSection === 'pinned'}
                      onClick={() => handleSelect(item, 'pinned')}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            className="tree-section"
            style={{
              flex: collapsedSections.all ? '0 0 auto' : 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}
          >
            <div className="section-header" onClick={() => toggleSection('all')}>
              {collapsedSections.all ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <FolderOpen size={14} className="section-icon" />
              <span>ALL NOTES</span>
              <span className="count-badge">{sorted.length}</span>
            </div>

            {!collapsedSections.all && listContent}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragSnippet ? (
          <div className="drag-overlay-item">
            <SidebarItem snippet={activeDragSnippet} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
})

FileExplorer.displayName = 'FileExplorer'

export default FileExplorer
