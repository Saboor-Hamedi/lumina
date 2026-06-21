import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  Search,
  FileText,
  FileCode,
  Pin,
  PinOff,
  ArrowUpDown,
  RefreshCw,
  FolderPlus,
  Palette,
  Edit2,
  Trash2
} from 'lucide-react'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  useDraggable,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDndContext
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createPortal } from 'react-dom'
import { Virtuoso } from 'react-virtuoso'
import SidebarItem from '../Navigation/components/SidebarItem'
import { useResizable } from '../Overlays/useResizable'
import { ChevronRight, ChevronDown, Folder, ChevronsUp } from 'lucide-react'
import ConfirmModal from '../Overlays/ConfirmModal'
import ContextMenu from '../Overlays/ContextMenu'
import ToolTip from '../../components/atoms/ToolTip'
import { FixedSizeList as List } from '../../components/utils/VirtualList'
import AppVersion from '../../components/AppVersion'
import Fuse from 'fuse.js'
import './FileExplorer.css'

/**
 * Draggable List Item for Recommended Snippets
 */
const SortableListItem = React.memo(({ snippet, isActive, onClick, searchQuery }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: snippet.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 99 : 1,
    position: 'relative'
  }

  const handleClick = React.useCallback(() => {
    if (onClick) onClick(snippet)
  }, [onClick, snippet])

  return (
    <SidebarItem
      snippet={snippet}
      variant="list"
      onClick={handleClick}
      isActive={isActive}
      searchQuery={searchQuery}
      dndProps={{ attributes, listeners, setNodeRef }}
      style={style}
    />
  )
})

/**
 * Droppable Folder Item
 */
import { useDroppable } from '@dnd-kit/core'
import { FilePlus } from 'lucide-react'

const DroppableFolderItem = React.memo(
  ({
    item,
    isExpanded,
    onToggle,
    onContextMenu,
    folderColor,
    isRenaming,
    renameValue,
    setRenameValue,
    submitRename,
    cancelRename,
    isActive,
    searchQuery
  }) => {
    const { isOver, setNodeRef: setDroppableRef } = useDroppable({ id: `folder-${item.id}` })

    const highlightText = (text, query) => {
      if (!query || !text) return text
      const q = query.toLowerCase()
      const idx = text.toLowerCase().indexOf(q)
      if (idx === -1) return text
      return (
        <>
          {text.substring(0, idx)}
          <span className="cm-search-highlight">{text.substring(idx, idx + query.length)}</span>
          {text.substring(idx + query.length)}
        </>
      )
    }
    const {
      attributes,
      listeners,
      setNodeRef: setDraggableRef,
      isDragging
    } = useDraggable({
      id: `drag-folder-${item.id}`,
      data: { type: 'folder', item }
    })

    // Spring-loaded folder expansion
    useEffect(() => {
      let timer = null
      if (isOver && !isExpanded && !isRenaming) {
        timer = setTimeout(() => {
          onToggle(item.id, null)
        }, 600) // 600ms hover to expand
      }
      return () => {
        if (timer) clearTimeout(timer)
      }
    }, [isOver, isExpanded, isRenaming, item.id, onToggle])

    return (
      <div
        ref={setDroppableRef}
        className="folder-tree-item"
        style={{
          position: 'relative',
          paddingLeft: item.depth > 0 ? `${item.depth * 16 + 8}px` : '0px',
          opacity: isDragging ? 0.5 : 1
        }}
      >
        {Array.from({ length: item.depth }).map((_, i) => (
          <div
            key={`line-${i}`}
            style={{
              position: 'absolute',
              left: `${i * 16 + 12}px`,
              top: 0,
              bottom: 0,
              width: '1px',
              backgroundColor: 'var(--border-dim)'
            }}
          />
        ))}
        <div
          ref={setDraggableRef}
          className={`folder-tree-main ${isOver ? 'folder-over' : ''} ${isActive ? 'active' : ''}`}
          style={{
            cursor: 'pointer',
            userSelect: 'none',
            backgroundColor: isActive ? 'var(--bg-active)' : undefined
          }}
          {...attributes}
          {...listeners}
          onClick={(e) => {
            if (e.button !== 0) return;
            if (!isRenaming) onToggle(item.id, e);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onContextMenu(item.id, e);
          }}
        >
          {isExpanded ? (
            <ChevronDown size={14} className="folder-chevron" />
          ) : (
            <ChevronRight size={14} className="folder-chevron" />
          )}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: folderColor || undefined,
              padding: '2px 6px',
              borderRadius: '4px',
              marginLeft: '-6px'
            }}
          >
            <Folder size={14} />
            {isRenaming ? (
              <input
                autoFocus
                className="inline-create-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename()
                  if (e.key === 'Escape') cancelRename()
                }}
                onBlur={submitRename}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="folder-name">{highlightText(item.name, searchQuery)}</span>
            )}
          </div>
        </div>
      </div>
    )
  }
)

/**
 * Draggable Grid Item for Pinned Snippets
 */
const SortableGridItem = ({ snippet, getIconForLanguage, onSelect, onUnpin }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: snippet.id
  })

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
 * Wrapper to fix overlay width stretching
 */
const OverlayWrapper = ({ children }) => {
  const { active } = useDndContext()
  const width = active?.rect?.current?.initial?.width
  return (
    <div
      style={{
        width: width ? `${width}px` : 'auto',
        boxSizing: 'border-box',
        pointerEvents: 'none'
      }}
    >
      {children}
    </div>
  )
}

/**
 * Droppable Root Zone
 */
const DroppableRootZone = React.memo(() => {
  const { isOver, setNodeRef } = useDroppable({ id: 'root-drop-zone' })

  const debounceTimerRef = useRef(null)

  // Handle search with debounce
  const handleSearchChange = (e) => {
    const value = e.target.value

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer - wait 300ms before updating
    debounceTimerRef.current = setTimeout(() => {
      setQuery(value)
    }, 300)
  }
  return (
    <div
      ref={setNodeRef}
      style={{
        padding: '12px',
        margin: '4px 8px',
        border: `2px dashed ${isOver ? 'var(--accent-primary)' : 'var(--border-dim)'}`,
        borderRadius: '8px',
        textAlign: 'center',
        color: isOver ? 'var(--accent-primary)' : 'var(--text-muted)',
        background: isOver ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
        boxShadow: isOver ? '0 0 8px rgba(59, 130, 246, 0.15)' : 'none',
        transition: 'all 0.2s',
        fontSize: '13px',
        fontWeight: 500
      }}
    >
      Drop here to move to Root
    </div>
  )
})

/**
 * Centered Explorer Modal (Start Menu Replica)
 */
const FileExplorer = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('')
  const [displayQuery, setDisplayQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debounceTimerRef = useRef(null)

  const [activeTab, setActiveTab] = useState('all')
  const { settings, updateSetting } = useSettingsStore()

  const [expandedFolders, setExpandedFolders] = useState(
    () => new Set(settings.expandedFolders || [])
  )
  const [collapsedDuringSearch, setCollapsedDuringSearch] = useState(() => new Set())

  // inline creation state
  const [creating, setCreating] = useState(null) // { type: 'file' | 'folder', parentId: string }
  const [creatingValue, setCreatingValue] = useState('')

  // rename state
  const [renamingFolder, setRenamingFolder] = useState(null) // folderId
  const [renamingValue, setRenamingValue] = useState('')

  // drag state
  const [activeListDragItem, setActiveListDragItem] = useState(null) // { type: 'folder' | 'file', id, item: folderData, snippet: fileData }

  // context menu & confirm
  const [folderContext, setFolderContext] = useState(null) // { x, y, folderId }
  const [deleteConfirmFolder, setDeleteConfirmFolder] = useState(null)

  const searchInputRef = useRef(null)
  const modalRef = useRef(null)
  const rafRef = useRef(null)
  const virtuosoRef = useRef(null)

  const [isPositionReady, setIsPositionReady] = useState(false)

  const snippets = useVaultStore((state) => state.snippets)
  const folders = useVaultStore((state) => state.folders)
  const folderColors = useVaultStore((state) => state.folderColors)
  const setFolderColor = useVaultStore((state) => state.setFolderColor)
  const setSelectedSnippet = useVaultStore((state) => state.setSelectedSnippet)
  const saveSnippet = useVaultStore((state) => state.saveSnippet)
  const loadVault = useVaultStore((state) => state.loadVault)
  const isLoading = useVaultStore((state) => state.isLoading)

  const sortBy = settings.sortBy || 'name'
  const sortDirection = settings.sortDirection || 'asc'
  const noteOrder = settings.noteOrder || null

  const cycles = [
    { sortBy: 'name', sortDirection: 'asc' },
    { sortBy: 'name', sortDirection: 'desc' },
    { sortBy: 'modified', sortDirection: 'desc' },
    { sortBy: 'modified', sortDirection: 'asc' },
    { sortBy: 'custom', sortDirection: 'asc' }
  ]

  const handleSortToggle = (e) => {
    e.stopPropagation()
    const currentIndex = cycles.findIndex(
      (c) => c.sortBy === sortBy && c.sortDirection === sortDirection
    )
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
        distance: 5
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5
      }
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

  // search
  // 0. Fuse Index
  const fuseIndex = useMemo(() => {
    return new Fuse(snippets, {
      keys: [{ name: 'title', weight: 3 }],
      threshold: 0.4,
      ignoreLocation: true
    })
  }, [snippets])

  // 1. Filtered snippets (fast - runs on every keystroke)
  const filteredSnippets = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return snippets

    // 1. Fuse matches for title
    const fuseResults = fuseIndex.search(q)
    const fuseMatchedIds = new Set(fuseResults.map((r) => r.item.id))
    const results = fuseResults.map((r) => r.item)

    // 2. Fast string indexOf for content and folderId
    snippets.forEach((snippet) => {
      if (fuseMatchedIds.has(snippet.id)) return

      const folderId = snippet.folderId || ''
      if (folderId && folderId.toLowerCase().indexOf(q) !== -1) {
        results.push(snippet)
        return
      }

      const code = snippet.code || snippet.content || ''
      if (code && code.toLowerCase().indexOf(q) !== -1) {
        results.push(snippet)
      }
    })

    return results
  }, [query, fuseIndex, snippets])

  // 2. Pinned snippets (doesn't depend on search)
  const pinnedSnippets = useMemo(() => {
    const dbPinned = snippets.filter((s) => s.isPinned)
    const pinnedOrderMap = new Map((settings.startMenuPinnedOrder || []).map((id, i) => [id, i]))
    dbPinned.sort((a, b) => {
      const ai = pinnedOrderMap.get(a.id)
      const bi = pinnedOrderMap.get(b.id)
      if (ai !== undefined && bi !== undefined) return ai - bi
      if (ai !== undefined) return -1
      if (bi !== undefined) return 1
      return 0
    })
    return dbPinned
  }, [snippets, settings.startMenuPinnedOrder])

  // 3. All snippets (with sorting, uses filtered results)
  const allSnippets = useMemo(() => {
    const unpinned = filteredSnippets.filter((s) => !s.isPinned)
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
    return all
  }, [filteredSnippets, sortBy, sortDirection, noteOrder])

  // 4. Flat tree
  const flatTree = useMemo(() => {
    if (activeTab !== 'all') return []

    const q = query.trim().toLowerCase()

    // Build hierarchical tree
    const root = { children: {}, files: [] }

    // 1. Build Folders
    folders.forEach((folderPath) => {
      if (!q || folderPath.toLowerCase().includes(q)) {
        const parts = folderPath.split('/')
        let current = root
        let currentPath = ''
        parts.forEach((part) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part
          if (!current.children[part]) {
            current.children[part] = { id: currentPath, name: part, children: {}, files: [] }
          }
          current = current.children[part]
        })
      }
    })

    // 2. Build Snippets
    allSnippets.forEach((snippet) => {
      const folderId = snippet.folderId || ''
      if (!folderId) {
        root.files.push(snippet)
      } else {
        const parts = folderId.split('/')
        let current = root
        let currentPath = ''
        parts.forEach((part) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part
          if (!current.children[part]) {
            current.children[part] = { id: currentPath, name: part, children: {}, files: [] }
          }
          current = current.children[part]
        })
        current.files.push(snippet)
      }
    })

    // Flatten the tree (your existing flattening logic)
    const flat = []

    // Inject drop to root zone if dragging
    if (activeListDragItem) {
      flat.push({ type: 'root-drop', id: 'root-drop-zone', depth: 0 })
    }

    // Inject root level creation input
    if (creating && !creating.parentId) {
      flat.push({ type: 'input', kind: creating.type, parentId: '', depth: 0 })
    }

    const traverse = (node, depth, parentId = '') => {
      // Sort folders alphabetically
      const folderNames = Object.keys(node.children).sort((a, b) => a.localeCompare(b))

      folderNames.forEach((name) => {
        const folder = node.children[name]
        flat.push({ type: 'folder', id: folder.id, name: folder.name, depth })

        const isExpanded = q
          ? !collapsedDuringSearch.has(folder.id)
          : expandedFolders.has(folder.id)

        if (isExpanded) {
          // Inject nested creation input
          if (creating && creating.parentId === folder.id) {
            flat.push({ type: 'input', kind: creating.type, parentId: folder.id, depth: depth + 1 })
          }
          traverse(folder, depth + 1, folder.id)
        }
      })

      // Files in this level
      node.files.forEach((file) => {
        flat.push({ type: 'file', snippet: file, depth })
      })
    }

    traverse(root, 0)
    return flat
  }, [
    allSnippets,
    folders,
    activeTab,
    query,
    expandedFolders,
    creating,
    activeListDragItem,
    collapsedDuringSearch
  ])

  // Intelligent selection: default to the best matching note instead of a folder
  useEffect(() => {
    if (query.trim() && flatTree.length > 0) {
      const q = query.toLowerCase().trim()
      // 1. Try to find an exact matching note
      let bestIndex = flatTree.findIndex(
        (item) => item.type === 'file' && (item.snippet.title || '').toLowerCase() === q
      )
      // 2. Otherwise find the first note
      if (bestIndex === -1) {
        bestIndex = flatTree.findIndex((item) => item.type === 'file')
      }
      // 3. Fallback to folder
      if (bestIndex === -1) bestIndex = 0

      setSelectedIndex(bestIndex)
    } else if (!query.trim()) {
      setSelectedIndex(-1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // end search
  // Compute Flattened Folder Tree

  const toggleFolder = useCallback(
    (folderId, e) => {
      if (e) e.stopPropagation()
      if (query.trim()) {
        setCollapsedDuringSearch((prev) => {
          const next = new Set(prev)
          if (next.has(folderId)) next.delete(folderId)
          else next.add(folderId)
          return next
        })
      } else {
        setExpandedFolders((prev) => {
          const next = new Set(prev)
          if (next.has(folderId)) next.delete(folderId)
          else next.add(folderId)
          updateSetting('expandedFolders', Array.from(next))
          return next
        })
      }
    },
    [updateSetting, query]
  )

  const collapseAllFolders = (e) => {
    e.stopPropagation()
    setExpandedFolders(new Set())
    updateSetting('expandedFolders', [])
  }

  const cancelRename = useCallback(() => setRenamingFolder(null), [])
  const handleFolderContextMenu = useCallback((id, e) => {
    setFolderContext({ x: e.clientX, y: e.clientY, folderId: id })
  }, [])

  const { size, handleResizeStart } = useResizable(modalRef)

  const handleSelect = useCallback(
    (snippet) => {
      setSelectedSnippet(snippet)
      onClose()
    },
    [setSelectedSnippet, onClose]
  )

  if (!isOpen || !isPositionReady) return null

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
      const allPinnedIds = snippets.filter((s) => s.isPinned).map((s) => s.id)
      const oldIndex = allPinnedIds.indexOf(active.id)
      const newIndex = allPinnedIds.indexOf(over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(allPinnedIds, oldIndex, newIndex)
        useSettingsStore.getState().updateSettings({ startMenuPinnedOrder: newOrder })
      }
    }
  }

  const handleListDragStart = (event) => {
    const { active } = event
    if (String(active.id).startsWith('drag-folder-')) {
      setActiveListDragItem({ type: 'folder', id: active.id, item: active.data?.current?.item })
    } else {
      const activeSnippet = allSnippets.find((s) => s.id === active.id)
      if (activeSnippet) {
        const flatItem = flatTree.find((f) => f.type === 'file' && f.snippet.id === active.id)
        setActiveListDragItem({
          type: 'file',
          id: active.id,
          snippet: activeSnippet,
          depth: flatItem ? flatItem.depth : 0
        })
      }
    }
  }

  const handleListDragEnd = async (event) => {
    setActiveListDragItem(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    if (over.id === 'root-drop-zone') {
      if (String(active.id).startsWith('drag-folder-')) {
        const sourceFolderId = String(active.id).replace('drag-folder-', '')
        const folderName = sourceFolderId.split('/').pop()
        if (sourceFolderId !== folderName) {
          try {
            await window.api.renameFolder(sourceFolderId, folderName)
            await loadVault()
          } catch (e) {}
        }
      } else {
        const activeSnippet = allSnippets.find((s) => s.id === active.id)
        if (activeSnippet && activeSnippet.folderId !== '') {
          try {
            await saveSnippet({ ...activeSnippet, folderId: '' })
          } catch (e) {}
        }
      }
      return
    }

    if (String(active.id).startsWith('drag-folder-')) {
      const sourceFolderId = String(active.id).replace('drag-folder-', '')

      if (String(over.id).startsWith('folder-')) {
        const targetFolderId = String(over.id).replace('folder-', '')

        // Prevent moving a folder into itself or its own subfolders
        if (sourceFolderId !== targetFolderId && !targetFolderId.startsWith(sourceFolderId + '/')) {
          const folderName = sourceFolderId.split('/').pop()
          const newPath = targetFolderId ? `${targetFolderId}/${folderName}` : folderName
          try {
            await window.api.renameFolder(sourceFolderId, newPath)
            setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
            await loadVault()
          } catch (e) {
            console.error('Failed to move folder:', e)
          }
        }
      }
      return
    }

    if (active.id !== over?.id && over) {
      // Check if dropped into a folder
      if (String(over.id).startsWith('folder-')) {
        const targetFolderId = String(over.id).replace('folder-', '')
        const activeSnippet = allSnippets.find((s) => s.id === active.id)
        if (activeSnippet && activeSnippet.folderId !== targetFolderId) {
          try {
            await saveSnippet({ ...activeSnippet, folderId: targetFolderId })
            setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
          } catch (e) {
            console.error('Failed to move snippet to folder:', e)
          }
        }
        return
      }

      // Normal reordering
      const currentListIds = allSnippets.map((s) => s.id)
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
    switch (language) {
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
        const folderPath = creating.parentId
          ? `${creating.parentId}/${sanitizedName}`
          : sanitizedName
        await window.api.createFolder(folderPath)
        setExpandedFolders((prev) => new Set(prev).add(folderPath))
        await loadVault()
      } else {
        const newId = crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15)
        const folderId = creating.parentId || ''
        const newSnippet = {
          id: newId,
          title: sanitizedName,
          code: '',
          language: 'markdown',
          tags: '',
          folderId: folderId,
          timestamp: Date.now()
        }
        await saveSnippet(newSnippet)
        if (folderId) setExpandedFolders((prev) => new Set(prev).add(folderId))
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

  // search
  const handleSearchChange = (e) => {
    const value = e.target.value
    setDisplayQuery(value) // Update input immediately

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer - wait 300ms before updating query
    debounceTimerRef.current = setTimeout(() => {
      setQuery(value)
    }, 300)
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
        onClick={() => {
          setFolderContext(null)
          setSelectedIndex(-1)
        }}
        style={{
          width: size.width,
          height: size.height,
          marginLeft: -(size.width / 2) // keep centered natively
        }}
      >
        {/* Resize Handles */}
        <div className="resizer resizer-top" onMouseDown={(e) => handleResizeStart(e, ['top'])} />
        <div className="resizer resizer-left" onMouseDown={(e) => handleResizeStart(e, ['left'])} />
        <div
          className="resizer resizer-right"
          onMouseDown={(e) => handleResizeStart(e, ['right'])}
        />
        <div
          className="resizer resizer-top-left"
          onMouseDown={(e) => handleResizeStart(e, ['top', 'left'])}
        />
        <div
          className="resizer resizer-top-right"
          onMouseDown={(e) => handleResizeStart(e, ['top', 'right'])}
        />

        {/* Search Bar */}

        {/* Search Bar */}
        <div className="start-menu-search relative">
          <Search size={16} className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for notes"
            value={displayQuery}
            onChange={(e) => {
              const v = e.target.value
              setDisplayQuery(v)
              if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
              debounceTimerRef.current = setTimeout(() => {
                setQuery(v)
                setCollapsedDuringSearch(new Set())
              }, 300)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((prev) => {
                  const next = prev < 0 ? 0 : Math.min(prev + 1, flatTree.length - 1)
                  virtuosoRef.current?.scrollToIndex({ index: next, align: 'center' })
                  return next
                })
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((prev) => {
                  const next = Math.max(prev - 1, 0)
                  virtuosoRef.current?.scrollToIndex({ index: next, align: 'center' })
                  return next
                })
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (selectedIndex >= 0 && selectedIndex < flatTree.length) {
                  const item = flatTree[selectedIndex]
                  if (item?.type === 'file') {
                    handleSelect(item.snippet)
                  } else if (item?.type === 'folder') {
                    toggleFolder(item.id)
                  }
                }
              }
            }}
            className="pr-14"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
            <AppVersion />
          </div>
        </div>

        {/* Tabs */}
        <div className="explorer-tabs">
          <button
            className={`explorer-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all')
              setCreating(null)
            }}
          >
            All Notes
          </button>
          <button
            className={`explorer-tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('favorites')
              setCreating(null)
            }}
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
                <DndContext
                  sensors={sensors}
                  collisionDetection={pointerWithin}
                  onDragEnd={handleSortDragEnd}
                >
                  <SortableContext
                    items={pinnedSnippets.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div
                      className="recommended-list"
                      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                    >
                      {pinnedSnippets.map((snippet) => (
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
                <h3>
                  {allSnippets.length} {allSnippets.length === 1 ? 'Note' : 'Notes'}
                </h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <ToolTip text="Collapse All Folders">
                    <button
                      className="sort-toggle-btn"
                      onClick={collapseAllFolders}
                    >
                      <ChevronsUp size={14} />
                    </button>
                  </ToolTip>
                  <ToolTip text="Create New Note">
                    <button
                      className="sort-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        let targetFolderId = ''
                        if (selectedIndex >= 0 && selectedIndex < flatTree.length) {
                          const item = flatTree[selectedIndex]
                          if (item?.type === 'folder') {
                            targetFolderId = item.id
                            setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
                          } else if (item?.type === 'file') {
                            targetFolderId = item.snippet.folderId || ''
                            if (targetFolderId) setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
                          }
                        }
                        setCreating({ type: 'file', parentId: targetFolderId })
                        setCreatingValue('')
                      }}
                    >
                      <FilePlus size={14} />
                    </button>
                  </ToolTip>
                  <ToolTip text="Create New Folder">
                    <button
                      className="sort-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        let targetFolderId = ''
                        if (selectedIndex >= 0 && selectedIndex < flatTree.length) {
                          const item = flatTree[selectedIndex]
                          if (item?.type === 'folder') {
                            targetFolderId = item.id
                            setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
                          } else if (item?.type === 'file') {
                            targetFolderId = item.snippet.folderId || ''
                            if (targetFolderId) setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
                          }
                        }
                        setCreating({ type: 'folder', parentId: targetFolderId })
                        setCreatingValue('')
                      }}
                    >
                      <FolderPlus size={14} />
                    </button>
                  </ToolTip>
                  <ToolTip text="Refresh Vault">
                    <button
                      className="sort-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        loadVault()
                      }}
                      disabled={isLoading}
                      style={{ opacity: isLoading ? 0.5 : 1 }}
                    >
                      <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
                    </button>
                  </ToolTip>
                  <ToolTip text={`Sort by ${sortBy} (${sortDirection})`}>
                    <button
                      className="sort-toggle-btn"
                      onClick={handleSortToggle}
                    >
                      <ArrowUpDown size={14} />
                    </button>
                  </ToolTip>
                </div>
              </div>

              {flatTree.length === 0 ? (
                <div className="empty-state">No notes or folders found</div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={pointerWithin}
                  onDragStart={handleListDragStart}
                  onDragEnd={handleListDragEnd}
                >
                  <SortableContext
                    items={allSnippets.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div
                      className="recommended-list"
                      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                    >
                      <Virtuoso
                        ref={virtuosoRef}
                        style={{ flex: 1, height: '100%' }}
                        data={flatTree}
                        itemContent={(index, item) => {
                          if (item.type === 'input') {
                            return (
                              <div
                                className="folder-tree-item"
                                style={{
                                  position: 'relative',
                                  paddingLeft: item.depth > 0 ? `${item.depth * 16 + 8}px` : '0px'
                                }}
                              >
                                {Array.from({ length: item.depth }).map((_, i) => (
                                  <div
                                    key={`line-${i}`}
                                    style={{
                                      position: 'absolute',
                                      left: `${i * 16 + 12}px`,
                                      top: 0,
                                      bottom: 0,
                                      width: '1px',
                                      backgroundColor: 'var(--border-dim)'
                                    }}
                                  />
                                ))}
                                <div
                                  className="folder-tree-main creating-input"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'transparent'
                                  }}
                                >
                                  {item.kind === 'folder' ? (
                                    <Folder size={14} className="folder-icon-color" />
                                  ) : (
                                    <FileText size={14} className="icon-blue" />
                                  )}
                                  <input
                                    autoFocus
                                    value={creatingValue}
                                    onChange={(e) => setCreatingValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') submitCreation()
                                      if (e.key === 'Escape') setCreating(null)
                                    }}
                                    onBlur={() => submitCreation()}
                                    placeholder={`New ${item.kind}...`}
                                    className="inline-create-input"
                                  />
                                </div>
                              </div>
                            )
                          } else if (item.type === 'root-drop') {
                            return <DroppableRootZone />
                          } else if (item.type === 'folder') {
                            const isExpanded = query.trim()
                              ? !collapsedDuringSearch.has(item.id)
                              : expandedFolders.has(item.id)
                            const isActive = index === selectedIndex
                            return (
                              <DroppableFolderItem
                                item={item}
                                isExpanded={isExpanded}
                                isActive={isActive}
                                searchQuery={query}
                                folderColor={folderColors[item.id]}
                                isRenaming={renamingFolder === item.id}
                                renameValue={renamingValue}
                                setRenameValue={setRenamingValue}
                                submitRename={submitRename}
                                cancelRename={cancelRename}
                                onToggle={(id, e) => {
                                  setSelectedIndex(index)
                                  toggleFolder(id, e)
                                }}
                                onContextMenu={(id, e) => {
                                  setSelectedIndex(index)
                                  handleFolderContextMenu(id, e)
                                }}
                              />
                            )
                          } else {
                            return (
                              <div
                                style={{
                                  position: 'relative',
                                  paddingLeft: item.depth > 0 ? `${item.depth * 16 + 8}px` : '0px'
                                }}
                              >
                                {Array.from({ length: item.depth }).map((_, i) => (
                                  <div
                                    key={`line-${i}`}
                                    style={{
                                      position: 'absolute',
                                      left: `${i * 16 + 12}px`,
                                      top: 0,
                                      bottom: 0,
                                      width: '1px',
                                      backgroundColor: 'var(--border-dim)',
                                      zIndex: 0
                                    }}
                                  />
                                ))}
                                <SortableListItem
                                  key={item.snippet.id}
                                  snippet={item.snippet}
                                  onClick={handleSelect}
                                  isActive={index === selectedIndex}
                                  searchQuery={query}
                                />
                              </div>
                            )
                          }
                        }}
                      />
                    </div>
                  </SortableContext>
                  {createPortal(
                    <DragOverlay
                      zIndex={9999}
                      dropAnimation={{
                        sideEffects: defaultDropAnimationSideEffects({
                          styles: { active: { opacity: '0.4' } }
                        })
                      }}
                    >
                      {activeListDragItem?.type === 'folder' ? (
                        <OverlayWrapper>
                          <div
                            className="folder-tree-main"
                            style={{
                              width: 'max-content',
                              opacity: 0.8,
                              background: 'var(--bg-panel)',
                              borderRadius: '4px',
                              paddingRight: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                            }}
                          >
                            <ChevronRight size={14} className="folder-chevron" />
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: folderColors[activeListDragItem.item.id] || undefined,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                marginLeft: '-6px'
                              }}
                            >
                              <Folder size={14} />
                              <span className="folder-name">{activeListDragItem.item.name}</span>
                            </div>
                          </div>
                        </OverlayWrapper>
                      ) : activeListDragItem?.type === 'file' ? (
                        <OverlayWrapper>
                          <div
                            className="start-section"
                            style={{ margin: 0, width: 'max-content' }}
                          >
                            <div
                              style={{
                                opacity: 0.8,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                borderRadius: '4px',
                                background: 'var(--bg-panel)'
                              }}
                            >
                              <SidebarItem
                                snippet={activeListDragItem.snippet}
                                variant="list"
                                isActive={false}
                              />
                            </div>
                          </div>
                        </OverlayWrapper>
                      ) : null}
                    </DragOverlay>,
                    document.body
                  )}
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
                setExpandedFolders((prev) => new Set(prev).add(folderContext.folderId))
                setCreating({ type: 'folder', parentId: folderContext.folderId })
                setCreatingValue('')
              }
            },
            {
              label: 'Create Note',
              icon: <FilePlus size={14} />,
              onClick: () => {
                setExpandedFolders((prev) => new Set(prev).add(folderContext.folderId))
                setCreating({ type: 'file', parentId: folderContext.folderId })
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
              icon: (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    border: '1px solid var(--border-color)'
                  }}
                />
              ),
              onClick: () => setFolderColor(folderContext.folderId, null)
            },
            {
              label: 'Blue',
              icon: (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    background: 'rgba(59, 130, 246, 0.2)'
                  }}
                />
              ),
              onClick: () => setFolderColor(folderContext.folderId, 'rgba(59, 130, 246, 0.2)')
            },
            {
              label: 'Purple',
              icon: (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    background: 'rgba(168, 85, 247, 0.2)'
                  }}
                />
              ),
              onClick: () => setFolderColor(folderContext.folderId, 'rgba(168, 85, 247, 0.2)')
            },
            {
              label: 'Red',
              icon: (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    background: 'rgba(239, 68, 68, 0.2)'
                  }}
                />
              ),
              onClick: () => setFolderColor(folderContext.folderId, 'rgba(239, 68, 68, 0.2)')
            },
            {
              label: 'Green',
              icon: (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    background: 'rgba(34, 197, 94, 0.2)'
                  }}
                />
              ),
              onClick: () => setFolderColor(folderContext.folderId, 'rgba(34, 197, 94, 0.2)')
            },
            {
              label: 'Orange',
              icon: (
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    background: 'rgba(249, 115, 22, 0.2)'
                  }}
                />
              ),
              onClick: () => setFolderColor(folderContext.folderId, 'rgba(249, 115, 22, 0.2)')
            },
            {
              type: 'divider'
            },
            {
              label: 'Delete Folder',
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: () => {
                setDeleteConfirmFolder(folderContext.folderId)
              }
            }
          ]}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteConfirmFolder}
        onClose={() => setDeleteConfirmFolder(null)}
        onConfirm={async () => {
          try {
            await window.api.deleteFolder(deleteConfirmFolder)
            await loadVault()
          } catch (e) {
            console.error(e)
          }
        }}
        title="Delete Folder"
        message={`Are you sure you want to delete '${deleteConfirmFolder}' and all its contents? This action cannot be undone.`}
        confirmText="Delete Folder"
      />
    </div>,
    document.body
  )
}

export default FileExplorer
