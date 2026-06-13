import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { Search, FileText, FileCode, Pin, PinOff, ArrowUpDown, RefreshCw, FolderPlus, Palette, Edit2, Trash2 } from 'lucide-react'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core'
import { SortableContext, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createPortal } from 'react-dom'
import { Virtuoso } from 'react-virtuoso'
import SidebarItem from '../Navigation/components/SidebarItem'
import { useResizable } from './useResizable'
import { ChevronRight, ChevronDown, Folder } from 'lucide-react'
import ContextMenu from './ContextMenu'
import './ExplorerModal.css'

/**
 * Draggable List Item for Recommended Snippets
 */
const SortableListItem = ({ snippet, isActive, onClick }) => {
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
    zIndex: isDragging ? 99 : 1,
    position: 'relative'
  }

  return (
    <SidebarItem
      snippet={snippet}
      variant="list"
      onClick={onClick}
      isActive={isActive}
      dndProps={{ attributes, listeners, setNodeRef }}
      style={style}
    />
  )
}

/**
 * Droppable Folder Item
 */
import { useDroppable } from '@dnd-kit/core'
import { FilePlus } from 'lucide-react'

const DroppableFolderItem = ({ 
  item, 
  isExpanded, 
  onToggle, 
  onCreateFile, 
  onCreateFolder, 
  onContextMenu,
  backgroundColor,
  isRenaming,
  renameValue,
  setRenameValue,
  submitRename,
  cancelRename
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: `folder-${item.id}` })
  
  return (
    <div 
      ref={setNodeRef}
      className={`folder-tree-item ${isOver ? 'folder-over' : ''}`}
      style={{ 
        paddingLeft: `${item.depth * 16 + 12}px`,
        backgroundColor: backgroundColor || undefined
      }}
      onClick={(e) => { if (!isRenaming) onToggle(item.id, e) }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id, e) }}
    >
      <div className="folder-tree-main">
        {isExpanded ? <ChevronDown size={14} className="folder-chevron" /> : <ChevronRight size={14} className="folder-chevron" />}
        <Folder size={14} className="folder-icon-color" />
        {isRenaming ? (
          <input
            autoFocus
            className="inline-create-input"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitRename()
              if (e.key === 'Escape') cancelRename()
            }}
            onBlur={submitRename}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="folder-name">{item.name}</span>
        )}
      </div>
      {!isRenaming && (
        <div className="folder-tree-actions" onClick={e => e.stopPropagation()}>
          <button className="folder-action-btn" onClick={(e) => onCreateFile(item.id, e)} title="New Note Here">
            <FilePlus size={14} />
          </button>
          <button className="folder-action-btn" onClick={(e) => onCreateFolder(item.id, e)} title="New Folder Here">
            <FolderPlus size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

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
  const [activeTab, setActiveTab] = useState('all')
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  
  // inline creation state
  const [creating, setCreating] = useState(null) // { type: 'file' | 'folder', parentId: string }
  const [creatingValue, setCreatingValue] = useState('')
  
  // rename state
  const [renamingFolder, setRenamingFolder] = useState(null) // folderId
  const [renamingValue, setRenamingValue] = useState('')

  // context menu
  const [folderContext, setFolderContext] = useState(null) // { x, y, folderId }
  
  const searchInputRef = useRef(null)
  const modalRef = useRef(null)
  const rafRef = useRef(null)
  const virtuosoRef = useRef(null)

  const [isPositionReady, setIsPositionReady] = useState(false)

  const { snippets, folders, folderColors, setFolderColor, setSelectedSnippet, saveSnippet, loadVault, isLoading } = useVaultStore()
  
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

    // Compute pinned notes - DO NOT FILTER BY SEARCH
    const dbPinned = snippets.filter(s => s.isPinned)
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

  // Compute Flattened Folder Tree
  const flatTree = useMemo(() => {
    if (activeTab !== 'all') return []
    if (query.trim()) {
      // If searching, just show flat results to easily find things
      return allSnippets.map(s => ({ type: 'file', snippet: s, depth: 0 }))
    }

    // Build hierarchical tree
    const root = { children: {}, files: [] }
    
    // 1. Build Folders
    folders.forEach(folderPath => {
      const parts = folderPath.split('/')
      let current = root
      let currentPath = ''
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        if (!current.children[part]) {
          current.children[part] = { id: currentPath, name: part, children: {}, files: [] }
        }
        current = current.children[part]
      })
    })

    // 2. Build Snippets
    allSnippets.forEach(snippet => {
      const folderId = snippet.folderId || ''
      if (!folderId) {
        root.files.push(snippet)
      } else {
        const parts = folderId.split('/')
        let current = root
        let currentPath = ''
        parts.forEach(part => {
          currentPath = currentPath ? `${currentPath}/${part}` : part
          if (!current.children[part]) {
            current.children[part] = { id: currentPath, name: part, children: {}, files: [] }
          }
          current = current.children[part]
        })
        current.files.push(snippet)
      }
    })

    // Flatten it
    const flat = []
    
    // Inject root level creation input at the very top!
    if (creating && !creating.parentId) {
      flat.push({ type: 'input', kind: creating.type, parentId: '', depth: 0 })
    }

    const traverse = (node, depth, parentId = '') => {
      // Sort folders alphabetically
      const folderNames = Object.keys(node.children).sort((a, b) => a.localeCompare(b))
      
      folderNames.forEach(name => {
        const folder = node.children[name]
        flat.push({ type: 'folder', id: folder.id, name: folder.name, depth })
        
        if (expandedFolders.has(folder.id)) {
          // Inject nested creation input at the very top of this folder!
          if (creating && creating.parentId === folder.id) {
            flat.push({ type: 'input', kind: creating.type, parentId: folder.id, depth: depth + 1 })
          }
          traverse(folder, depth + 1, folder.id)
        }
      })

      // Files in this level
      node.files.forEach(file => {
        flat.push({ type: 'file', snippet: file, depth })
      })
    }

    traverse(root, 0)
    return flat
  }, [allSnippets, activeTab, query, expandedFolders, creating])

  const toggleFolder = (folderId, e) => {
    e.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const { size, handleResizeStart } = useResizable(modalRef)

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
      // Use ALL pinned snippets, not just currently visible ones, so we don't lose the order
      // of pinned snippets that were hidden by search.
      const allPinnedIds = snippets.filter(s => s.isPinned).map(s => s.id)
      const oldIndex = allPinnedIds.indexOf(active.id)
      const newIndex = allPinnedIds.indexOf(over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(allPinnedIds, oldIndex, newIndex)
        useSettingsStore.getState().updateSettings({ startMenuPinnedOrder: newOrder })
      }
    }
  }

  const handleListDragEnd = async (event) => {
    const { active, over } = event
    if (active.id !== over?.id && over) {
      
      // Check if dropped into a folder
      if (String(over.id).startsWith('folder-')) {
        const targetFolderId = String(over.id).replace('folder-', '')
        const activeSnippet = allSnippets.find(s => s.id === active.id)
        if (activeSnippet && activeSnippet.folderId !== targetFolderId) {
          try {
            await saveSnippet({ ...activeSnippet, folderId: targetFolderId })
          } catch (e) {
            console.error('Failed to move snippet to folder:', e)
          }
        }
        return
      }

      // Normal reordering
      const currentListIds = allSnippets.map(s => s.id)
      const oldIndex = currentListIds.indexOf(active.id)
      const newIndex = currentListIds.indexOf(over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(currentListIds, oldIndex, newIndex)
        useSettingsStore.getState().updateSettings({ 
          noteOrder: newOrder,
          sortBy: 'custom' // Auto switch to custom sort
        })
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

  const submitCreation = async () => {
    if (!creating || !creatingValue.trim()) {
      setCreating(null)
      return
    }

    const sanitizedName = creatingValue.trim().replace(/[<>:"/\\|?*]/g, '')
    if (!sanitizedName) {
      setCreating(null)
      return
    }

    try {
      if (creating.type === 'folder') {
        const folderPath = creating.parentId ? `${creating.parentId}/${sanitizedName}` : sanitizedName
        await window.api.createFolder(folderPath)
        setExpandedFolders(prev => new Set(prev).add(folderPath))
        await loadVault()
      } else {
        const newId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
        const folderId = creating.parentId || ''
        const newSnippet = {
          id: newId,
          title: sanitizedName,
          code: `# ${sanitizedName}\n\nStart typing...`,
          language: 'markdown',
          tags: '',
          folderId: folderId,
          timestamp: Date.now()
        }
        await saveSnippet(newSnippet)
        if (folderId) setExpandedFolders(prev => new Set(prev).add(folderId))
        handleSelect(newSnippet)
      }

      if (virtuosoRef.current && !creating.parentId) {
        virtuosoRef.current.scrollToIndex({ index: 0, align: 'start' })
      }
    } catch (err) {
      console.error('Failed to create:', err)
    }
    setCreating(null)
    setCreatingValue('')
  }

  const submitRename = async () => {
    if (!renamingFolder || !renamingValue.trim()) {
      setRenamingFolder(null)
      return
    }

    const sanitizedName = renamingValue.trim().replace(/[<>:"/\\|?*]/g, '')
    if (!sanitizedName) {
      setRenamingFolder(null)
      return
    }

    try {
      const parts = renamingFolder.split('/')
      parts[parts.length - 1] = sanitizedName
      const newPath = parts.join('/')
      
      if (newPath !== renamingFolder) {
        await window.api.renameFolder(renamingFolder, newPath)
        await loadVault()
      }
    } catch (err) {
      console.error('Rename failed:', err)
    }
    setRenamingFolder(null)
  }

  return createPortal(
    <div 
      className="explorer-modal-overlay" 
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        ref={modalRef}
        className="start-menu-container"
        style={{
          width: size.width,
          height: size.height,
          marginLeft: -(size.width / 2) // keep centered natively
        }}
      >
        
        {/* Resize Handles */}
        <div className="resizer resizer-top" onMouseDown={(e) => handleResizeStart(e, ['top'])} />
        <div className="resizer resizer-left" onMouseDown={(e) => handleResizeStart(e, ['left'])} />
        <div className="resizer resizer-right" onMouseDown={(e) => handleResizeStart(e, ['right'])} />
        <div className="resizer resizer-top-left" onMouseDown={(e) => handleResizeStart(e, ['top', 'left'])} />
        <div className="resizer resizer-top-right" onMouseDown={(e) => handleResizeStart(e, ['top', 'right'])} />
        
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

        {/* Tabs */}
        <div className="explorer-tabs">
          <button 
            className={`explorer-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => { setActiveTab('all'); setCreating(null); }}
          >
            All Notes
          </button>
          <button 
            className={`explorer-tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => { setActiveTab('favorites'); setCreating(null); }}
          >
            Favorites
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="start-menu-body">
          
          {/* Pinned Section */}
          {activeTab === 'favorites' && (
          <div className="start-section">
            <div className="start-section-header">
              <h3>Favorites</h3>
            </div>
            
            {pinnedSnippets.length === 0 ? (
              <div className="empty-state">No favorite notes</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSortDragEnd}>
                <SortableContext items={pinnedSnippets.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="recommended-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {pinnedSnippets.map(snippet => (
                      <SortableListItem
                        key={snippet.id}
                        snippet={snippet}
                        onClick={() => handleSelect(snippet)}
                        isActive={false}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
          )}

          {/* Recommended / All Section */}
          {activeTab === 'all' && (
          <div className="start-section">
            <div className="start-section-header">
              <h3>{allSnippets.length} {allSnippets.length === 1 ? 'Note' : 'Notes'}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="sort-toggle-btn"
                  onClick={(e) => { 
                    e.stopPropagation()
                    setCreating({ type: 'file', parentId: '' })
                    setCreatingValue('')
                  }}
                  title="Create New Note in Root"
                >
                  <FilePlus size={14} />
                </button>
                <button 
                  className="sort-toggle-btn"
                  onClick={(e) => { 
                    e.stopPropagation()
                    setCreating({ type: 'folder', parentId: '' })
                    setCreatingValue('')
                  }}
                  title="Create New Folder in Root"
                >
                  <FolderPlus size={14} />
                </button>
                <button 
                  className="sort-toggle-btn"
                  onClick={(e) => { e.stopPropagation(); loadVault() }}
                  title="Refresh Vault"
                  disabled={isLoading}
                  style={{ opacity: isLoading ? 0.5 : 1 }}
                >
                  <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
                </button>
                <button 
                  className="sort-toggle-btn"
                  onClick={handleSortToggle}
                  title={`Sort by ${sortBy} (${sortDirection})`}
                >
                  <ArrowUpDown size={14} />
                </button>
              </div>
            </div>
            
            {allSnippets.length === 0 ? (
              <div className="empty-state">No notes found</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleListDragEnd}>
                <SortableContext items={allSnippets.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="recommended-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Virtuoso
                      ref={virtuosoRef}
                      style={{ flex: 1, height: '100%' }}
                      data={flatTree}
                      itemContent={(index, item) => {
                        if (item.type === 'input') {
                          return (
                            <div className="folder-tree-item creating-input" style={{ paddingLeft: `${item.depth * 16 + 12}px` }}>
                              {item.kind === 'folder' ? <Folder size={14} className="folder-icon-color" /> : <FileText size={14} className="icon-blue" />}
                              <input
                                autoFocus
                                value={creatingValue}
                                onChange={e => setCreatingValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') submitCreation()
                                  if (e.key === 'Escape') setCreating(null)
                                }}
                                onBlur={() => submitCreation()}
                                placeholder={`New ${item.kind}...`}
                                className="inline-create-input"
                              />
                            </div>
                          )
                        } else if (item.type === 'folder') {
                          const isExpanded = expandedFolders.has(item.id)
                          return (
                            <DroppableFolderItem 
                              item={item} 
                              isExpanded={isExpanded} 
                              backgroundColor={folderColors[item.id]}
                              isRenaming={renamingFolder === item.id}
                              renameValue={renamingValue}
                              setRenameValue={setRenamingValue}
                              submitRename={submitRename}
                              cancelRename={() => setRenamingFolder(null)}
                              onToggle={toggleFolder} 
                              onCreateFile={(id, e) => {
                                e.stopPropagation()
                                setExpandedFolders(prev => new Set(prev).add(id))
                                setCreating({ type: 'file', parentId: id })
                                setCreatingValue('')
                              }}
                              onCreateFolder={(id, e) => {
                                e.stopPropagation()
                                setExpandedFolders(prev => new Set(prev).add(id))
                                setCreating({ type: 'folder', parentId: id })
                                setCreatingValue('')
                              }}
                              onContextMenu={(id, e) => {
                                setFolderContext({ x: e.clientX, y: e.clientY, folderId: id })
                              }}
                            />
                          )
                        } else {
                          return (
                            <div style={{ paddingLeft: `${item.depth * 16}px` }}>
                              <SortableListItem
                                key={item.snippet.id}
                                snippet={item.snippet}
                                onClick={() => handleSelect(item.snippet)}
                                isActive={false}
                              />
                            </div>
                          )
                        }
                      }}
                    />
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
          )}

        </div>

      </div>

      {folderContext && (
        <ContextMenu
          x={folderContext.x}
          y={folderContext.y}
          onClose={() => setFolderContext(null)}
          options={[
            {
              label: 'Create Subfolder',
              icon: <FolderPlus size={14} />,
              onClick: () => {
                setExpandedFolders(prev => new Set(prev).add(folderContext.folderId))
                setCreating({ type: 'folder', parentId: folderContext.folderId })
                setCreatingValue('')
              }
            },
            {
              label: 'Rename',
              icon: <Edit2 size={14} />,
              onClick: () => {
                const parts = folderContext.folderId.split('/')
                setRenamingValue(parts[parts.length - 1])
                setRenamingFolder(folderContext.folderId)
              }
            },
            {
              type: 'divider'
            },
            {
              label: 'Default Color',
              icon: <div style={{ width: 14, height: 14, borderRadius: 2, border: '1px solid var(--border-color)' }} />,
              onClick: () => setFolderColor(folderContext.folderId, null)
            },
            {
              label: 'Blue',
              icon: <div style={{ width: 14, height: 14, borderRadius: 2, background: 'rgba(59, 130, 246, 0.2)' }} />,
              onClick: () => setFolderColor(folderContext.folderId, 'rgba(59, 130, 246, 0.2)')
            },
            {
              label: 'Purple',
              icon: <div style={{ width: 14, height: 14, borderRadius: 2, background: 'rgba(168, 85, 247, 0.2)' }} />,
              onClick: () => setFolderColor(folderContext.folderId, 'rgba(168, 85, 247, 0.2)')
            },
            {
              label: 'Red',
              icon: <div style={{ width: 14, height: 14, borderRadius: 2, background: 'rgba(239, 68, 68, 0.2)' }} />,
              onClick: () => setFolderColor(folderContext.folderId, 'rgba(239, 68, 68, 0.2)')
            },
            {
              label: 'Green',
              icon: <div style={{ width: 14, height: 14, borderRadius: 2, background: 'rgba(34, 197, 94, 0.2)' }} />,
              onClick: () => setFolderColor(folderContext.folderId, 'rgba(34, 197, 94, 0.2)')
            },
            {
              label: 'Orange',
              icon: <div style={{ width: 14, height: 14, borderRadius: 2, background: 'rgba(249, 115, 22, 0.2)' }} />,
              onClick: () => setFolderColor(folderContext.folderId, 'rgba(249, 115, 22, 0.2)')
            },
            {
              type: 'divider'
            },
            {
              label: 'Delete Folder',
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: async () => {
                if (window.confirm(`Are you sure you want to delete ${folderContext.folderId} and all its contents?`)) {
                  try {
                    await window.api.deleteFolder(folderContext.folderId)
                    await loadVault()
                  } catch (e) {
                    console.error(e)
                  }
                }
              }
            }
          ]}
        />
      )}
    </div>,
    document.body
  )
}

export default ExplorerModal
