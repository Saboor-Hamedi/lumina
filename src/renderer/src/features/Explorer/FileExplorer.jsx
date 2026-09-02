import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  Search,
  FileText,
  FileCode,
  Files,
  NotebookText,
  Star,
  StarOff,
  Pin,
  PinOff,
  ArrowUpDown,
  RefreshCw,
  FolderPlus,
  Palette,
  Edit2,
  Trash2,
  Check,
  X,
  FilePlus,
  Clipboard
} from 'lucide-react'
import { useVaultStore, GRAPH_TAB_ID } from '../../core/store/useVaultStore'
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
import { ChevronRight, ChevronDown, Folder, FolderOpen, ChevronsUp } from 'lucide-react'
import ConfirmModal from '../Overlays/Modals/ConfirmModal'
import ContextMenu from '../Overlays/ContextMenu'
import ToolTip from '../../components/atoms/ToolTip'
import { FixedSizeList as List } from '../../components/utils/VirtualList'
import AppVersion from '../../components/AppVersion'
import Fuse from 'fuse.js'
import { rankSnippets } from '../../core/utils/searchRanker'
import './FileExplorer.css'

import {
  SortableListItem,
  DroppableFolderItem,
  SortableGridItem,
  OverlayWrapper,
  DroppableRootZone,
  NoteNumbers
} from './components'
import { useFileSearch } from './hooks/useFileSearch'
import { useFileTree } from './hooks/useFileTree'
import { useContextMenu } from '../Navigation/hooks/useContextMenu'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'

const VirtuosoFooter = () => <div style={{ height: '24px' }} />

/**
 * Centered Explorer Modal (Start Menu Replica)
 */
const FileExplorer = ({ isOpen, onClose, isEmbedded }) => {
  const [query, setQuery] = useState('')
  const [displayQuery, setDisplayQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const debounceTimerRef = useRef(null)

  const [activeTab, setActiveTab] = useState('all')
  const { settings, updateSetting, togglePinnedFolder } = useSettingsStore()
  const pinnedFolders = settings.pinnedFolders || []

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

  // Track last clicked/selected folder for "New Note" sidebar button
  const [lastClickedFolder, setLastClickedFolder] = useState(null)
  const [sidebarFocus, setSidebarFocus] = useState(null) // null | 'root' | 'folder'

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
  const selectedSnippetId = useVaultStore(
    (state) =>
      state.selectedSnippet?.id ||
      (state.activeTabId && state.activeTabId !== GRAPH_TAB_ID ? state.activeTabId : null)
  )
  const saveSnippet = useVaultStore((state) => state.saveSnippet)
  const loadVault = useVaultStore((state) => state.loadVault)
  const isLoading = useVaultStore((state) => state.isLoading)
  const clipboard = useVaultStore((state) => state.clipboard)
  const setClipboard = useVaultStore((state) => state.setClipboard)

  // Hide system folders (like Templates) from the main sidebar and note count
  const visibleSnippets = useMemo(() => {
    return snippets.filter((s) => !s.folderId || !s.folderId.startsWith('Templates'))
  }, [snippets])

  const visibleFolders = useMemo(() => {
    return folders.filter((f) => !f.startsWith('Templates'))
  }, [folders])

  const clickedInExplorerRef = useRef(0)
  const lastScrolledSnippetRef = useRef(null)
  const lastAutoExpandedSnippetRef = useRef(null)
  const expandedFoldersRef = useRef(expandedFolders)

  useEffect(() => {
    expandedFoldersRef.current = expandedFolders
  }, [expandedFolders])

  useEffect(() => {
    setSidebarFocus(null)
  }, [isOpen])

  useKeyboardShortcuts({
    onRevealInExplorer: () => {
      if (selectedIndex >= 0 && selectedIndex < flatTree.length) {
        const item = flatTree[selectedIndex]
        if (item?.type === 'file' && item.snippet) {
          const relativePath =
            (item.snippet.folderId ? item.snippet.folderId + '/' : '') + item.snippet.fileName
          window.api?.openVaultFolder?.(relativePath)
        } else if (item?.type === 'folder') {
          window.api?.openVaultFolder?.(item.id)
        }
      } else if (selectedSnippetId) {
        // Fallback to currently selected note if nothing is highlighted in tree
        const snippet = allSnippets.find((s) => s.id === selectedSnippetId)
        if (snippet) {
          const relativePath = (snippet.folderId ? snippet.folderId + '/' : '') + snippet.fileName
          window.api?.openVaultFolder?.(relativePath)
        }
      } else {
        // Fallback to root
        window.api?.openVaultFolder?.()
      }
    }
  })

  const contextMenuOptions = useContextMenu({
    item: folderContext?.folderId || null,
    type: folderContext?.folderId ? 'folder' : 'body',
    callbacks: {
      onCreateNote: () => {
        if (folderContext?.folderId) {
          setExpandedFolders((prev) => new Set(prev).add(folderContext.folderId))
        }
        setCreating({ type: 'file', parentId: folderContext?.folderId || null })
        setCreatingValue('')
      },
      onCreateFolder: () => {
        if (folderContext?.folderId) {
          setExpandedFolders((prev) => new Set(prev).add(folderContext.folderId))
        }
        setCreating({ type: 'folder', parentId: folderContext?.folderId || null })
        setCreatingValue('')
      },
      onRename: () => {
        if (folderContext?.folderId) {
          const parts = folderContext.folderId.split('/')
          setRenamingValue(parts[parts.length - 1])
          setRenamingFolder(folderContext.folderId)
        }
      },
      onDelete: () => {
        if (folderContext?.folderId) {
          setDeleteConfirmFolder(folderContext.folderId)
        }
      },
      onClose: () => setFolderContext(null),
      isFolderPinned: folderContext?.folderId
        ? pinnedFolders.includes(folderContext.folderId)
        : false
    }
  })

  useEffect(() => {
    setSidebarFocus(null)
  }, [selectedSnippetId])

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
    const handleFocus = () => {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
          searchInputRef.current.select()
        }
      }, 50)
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
          searchInputRef.current.select()
        }
      }, 150)
    }
    window.addEventListener('global-search-focus', handleFocus)
    return () => window.removeEventListener('global-search-focus', handleFocus)
  }, [])

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

  const { filteredSnippets, isQueryActive, matchMetaMap, pinnedItems, allSnippets } = useFileSearch(
    visibleSnippets,
    query,
    settings
  )

  const flatTree = useFileTree({
    allSnippets,
    folders: visibleFolders,
    activeTab,
    query,
    expandedFolders,
    creating,
    activeListDragItem,
    collapsedDuringSearch
  })

  useEffect(() => {
    if (creating) {
      // Find index of input
      const idx = flatTree.findIndex((item) => item.type === 'input')
      if (idx !== -1 && virtuosoRef.current) {
        // Small timeout to allow virtuoso to measure items
        setTimeout(() => {
          virtuosoRef.current?.scrollToIndex({ index: idx, align: 'center' })
        }, 50)
      }
    }
  }, [creating, flatTree])

  // Auto-expand parent folders of active snippet only when switching to a different snippet
  useEffect(() => {
    if (!selectedSnippetId) return
    if (lastAutoExpandedSnippetRef.current === selectedSnippetId) return
    const activeSnippet = snippets.find((s) => s.id === selectedSnippetId)
    if (!activeSnippet || !activeSnippet.folderId) {
      lastAutoExpandedSnippetRef.current = selectedSnippetId
      return
    }

    lastAutoExpandedSnippetRef.current = selectedSnippetId

    const foldersToExpand = []
    const parts = activeSnippet.folderId.split('/')
    let currentPath = ''

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      foldersToExpand.push(currentPath)
    }

    const currentSet = expandedFoldersRef.current
    const next = new Set(currentSet)
    let changed = false

    for (const id of foldersToExpand) {
      if (!next.has(id)) {
        next.add(id)
        changed = true
      }
    }

    if (changed) {
      setExpandedFolders(next)
      updateSetting('expandedFolders', Array.from(next))
    }
  }, [selectedSnippetId, snippets, updateSetting])

  // Auto-scroll to active snippet
  useEffect(() => {
    if (!selectedSnippetId || !virtuosoRef.current || flatTree.length === 0) return
    if (lastScrolledSnippetRef.current === selectedSnippetId) return

    const idx = flatTree.findIndex(
      (item) => item.type === 'file' && item.snippet && item.snippet.id === selectedSnippetId
    )

    // Do not auto-scroll if the selection was just made by clicking inside this explorer
    // BUT we must still set it as visually active!
    if (Date.now() - clickedInExplorerRef.current < 200) {
      lastScrolledSnippetRef.current = selectedSnippetId
      if (idx !== -1) setSelectedIndex(idx)
      return
    }

    if (idx !== -1) {
      lastScrolledSnippetRef.current = selectedSnippetId
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({ index: idx, align: 'center', behavior: 'smooth' })
        setSelectedIndex(idx)
      }, 50)
    }
  }, [selectedSnippetId, flatTree])

  useEffect(() => {
    const handleTriggerNewNote = () => {
      let targetFolderId = lastClickedFolder
      if (targetFolderId === null) {
        const selectedSnippetId = useVaultStore.getState().selectedSnippet?.id
        const snippets = useVaultStore.getState().snippets
        const activeSnippet = snippets.find((s) => s.id === selectedSnippetId)
        targetFolderId = activeSnippet?.folderId || ''
      }

      if (targetFolderId) {
        setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
      }
      setCreating({ type: 'file', parentId: targetFolderId })
      setCreatingValue('')
    }

    window.addEventListener('trigger-new-note', handleTriggerNewNote)
    return () => window.removeEventListener('trigger-new-note', handleTriggerNewNote)
  }, [lastClickedFolder, setExpandedFolders, setCreating, setCreatingValue])

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
      setLastClickedFolder(folderId)
      if (query.trim()) {
        setCollapsedDuringSearch((prev) => {
          const next = new Set(prev)
          if (next.has(folderId)) next.delete(folderId)
          else next.add(folderId)
          return next
        })
      } else {
        const currentSet = expandedFoldersRef.current
        const next = new Set(currentSet)
        if (next.has(folderId)) next.delete(folderId)
        else next.add(folderId)

        setExpandedFolders(next)
        updateSetting('expandedFolders', Array.from(next))
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
      clickedInExplorerRef.current = Date.now()
      setLastClickedFolder(snippet.folderId || '')
      onClose?.()

      setTimeout(() => {
        React.startTransition(() => {
          setSelectedSnippet(snippet)
        })
      }, 15)
    },
    [setSelectedSnippet, onClose]
  )

  const renderItemContent = useCallback((index, item, context) => {
    if (item.type === 'input') {
      return (
        <div
          className="folder-tree-item"
          style={{
            position: 'relative',
            paddingLeft: `${item.depth * 12}px`
          }}
        >
          <div
            className="folder-tree-main creating-input"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'transparent',
              marginLeft: '5px',
              paddingLeft: '1px'
            }}
          >
            {item.kind === 'folder' ? (
              <Folder size={14} fill="#e8a825" color="#e8a825" className="folder-icon-color" />
            ) : (
              <FileText size={14} className="icon-blue" />
            )}
            <input
              autoFocus
              className="inline-create-input"
              defaultValue={context.creatingValue}
              onKeyDown={(e) => {
                if (e.key === 'Enter') context.submitCreation(e.target.value)
                if (e.key === 'Escape') context.setCreating(null)
              }}
              onBlur={(e) => context.submitCreation(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder={`New ${item.kind}...`}
            />
          </div>
        </div>
      )
    } else if (item.type === 'root-drop') {
      return <DroppableRootZone />
    } else if (item.type === 'folder') {
      const isExpanded = context.query.trim()
        ? !context.collapsedDuringSearch.has(item.id)
        : context.expandedFolders.has(item.id)
      const isActive = index === context.selectedIndex
      return (
        <DroppableFolderItem
          item={item}
          isExpanded={isExpanded}
          isActive={isActive}
          searchQuery={context.query}
          folderColor={context.folderColors[item.id]}
          isRenaming={context.renamingFolder === item.id}
          renameValue={context.renamingValue}
          setRenameValue={context.setRenamingValue}
          submitRename={context.submitRename}
          cancelRename={context.cancelRename}
          isPinned={context.pinnedFolders.includes(item.id)}
          onTogglePin={context.togglePinnedFolder}
          onToggle={(id, e) => {
            context.setSidebarFocus('folder')
            context.setSelectedIndex(index)
            context.toggleFolder(id, e)
          }}
          onContextMenu={(id, e) => {
            context.setSidebarFocus('folder')
            context.setSelectedIndex(index)
            context.handleFolderContextMenu(id, e)
          }}
        />
      )
    } else {
      return (
        <div
          style={{
            position: 'relative',
            paddingLeft: `${item.depth * 12}px`
          }}
        >
          <SortableListItem
            key={item.snippet.id}
            snippet={item.snippet}
            onClick={context.handleSelect}
            isActive={
              item.snippet.id === context.selectedSnippetId ||
              index === context.selectedIndex
            }
            searchQuery={context.query}
            matchSnippet={context.matchMetaMap?.get(item.snippet.id)?.matchSnippet || ''}
            depth={item.depth}
          />
        </div>
      )
    }
  }, [])

  if (!isEmbedded && (!isOpen || !isPositionReady)) return null

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

  const submitCreation = async (value) => {
    const valToUse = typeof value === 'string' ? value : creatingValue
    if (!creating || !valToUse.trim()) {
      setCreating(null)
      return
    }

    const sanitizedName = valToUse.trim().replace(/[<>:"/\\|?*]/g, '')
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

  const submitRename = async (value) => {
    const valToUse = typeof value === 'string' ? value : renamingValue
    if (!renamingFolder || !valToUse.trim()) {
      setRenamingFolder(null)
      return
    }

    const sanitizedName = valToUse.trim().replace(/[<>:"/\\|?*]/g, '')
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

  if (!isOpen && !isEmbedded) return null

  const content = (
    <>
      <div
        ref={modalRef}
        className={isEmbedded ? 'explorer-embedded-container' : 'start-menu-container'}
        onClick={() => {
          setFolderContext(null)
          setSelectedIndex(-1)
        }}
        style={
          !isEmbedded
            ? {
                width: size.width,
                height: size.height,
                marginLeft: -(size.width / 2) // keep centered natively
              }
            : {
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }
        }
      >
        {/* Resize Handles */}
        {!isEmbedded && (
          <>
            <div
              className="resizer resizer-top"
              onMouseDown={(e) => handleResizeStart(e, ['top'])}
            />
            <div
              className="resizer resizer-left"
              onMouseDown={(e) => handleResizeStart(e, ['left'])}
            />
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
          </>
        )}

        {/* Search Bar */}

        {/* Search Bar */}
        <div className="start-menu-search relative">
          <Search size={12} className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search notes..."
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
            className="w-full"
          />
        </div>

        {/* Segmented Tabs */}
        <div className="explorer-segmented-tabs">
          <button
            className={`segmented-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('all')
              setCreating(null)
            }}
          >
            <NotebookText size={12} />
            <span>All Notes</span>
          </button>
          <button
            className={`segmented-tab ${activeTab === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('favorites')
              setCreating(null)
            }}
          >
            <Star size={12} />
            <span>Favorites</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          className="start-menu-body"
          tabIndex={-1}
          onClick={(e) => {
            if (e.target.closest('.virtuoso-row') || e.target.closest('.tree-item')) return
            setSelectedIndex(-1)
            setLastClickedFolder('')
            setSidebarFocus('root')
          }}
          onContextMenu={(e) => {
            if (e.target.closest('.virtuoso-row') || e.target.closest('.tree-item')) return
            e.preventDefault()
            e.stopPropagation()
            setFolderContext({ folderId: '', x: e.clientX, y: e.clientY })
          }}
        >
          {/* Favorites Section */}
          {activeTab === 'favorites' && (
            <div className="start-section" style={{ flex: 1, minHeight: 0, paddingBottom: '16px' }}>
              {pinnedItems.length === 0 ? (
                <div className="empty-state">No favorite notes or folders</div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={pointerWithin}
                  onDragEnd={handleSortDragEnd}
                >
                  <SortableContext
                    items={pinnedItems.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div
                      className="recommended-list"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        overflowY: 'auto'
                      }}
                    >
                      {pinnedItems.map((item) => (
                        <div
                          key={item.id}
                          className="favorite-item-wrapper"
                          style={{ position: 'relative' }}
                        >
                          <SortableListItem
                            snippet={item}
                            onClick={() => {
                              if (item.itemType === 'folder') {
                                setExpandedFolders((prev) => new Set(prev).add(item.id))
                                setActiveTab('all')
                              } else {
                                handleSelect(item)
                              }
                            }}
                            isActive={false}
                          />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}

          {/* All Notes Section */}
          {activeTab === 'all' && (
            <div className="start-section">
              <div className="start-section-header">
                <div className="section-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isQueryActive && <h3>Search Results</h3>}
                  <NoteNumbers
                    count={isQueryActive ? filteredSnippets.length : allSnippets.length}
                    total={allSnippets.length}
                    isQueryActive={isQueryActive}
                  />
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '4px' }}>
                  <ToolTip text="New Note">
                    <button
                      className="sort-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.dispatchEvent(new CustomEvent('trigger-new-note'))
                      }}
                    >
                      <FilePlus size={14} />
                    </button>
                  </ToolTip>
                  <ToolTip text="New Folder">
                    <button
                      className="sort-toggle-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCreating({ type: 'folder', parentId: null })
                      }}
                    >
                      <FolderPlus size={14} />
                    </button>
                  </ToolTip>
                  <ToolTip text="Refresh Explorer">
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
                  <ToolTip text="Collapse Folders in Explorer">
                    <button className="sort-toggle-btn" onClick={collapseAllFolders}>
                      <ChevronsUp size={14} />
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
                        overscan={400}
                        computeItemKey={(index, item) => {
                          if (item.type === 'file') return item.snippet.id
                          if (item.type === 'folder') return item.id
                          if (item.type === 'input') return `input-${item.parentId}`
                          if (item.type === 'root-drop') return 'root-drop-zone'
                          return index
                        }}
                        context={{
                          creatingValue,
                          setCreatingValue,
                          submitCreation,
                          setCreating,
                          query,
                          collapsedDuringSearch,
                          expandedFolders,
                          selectedIndex,
                          selectedSnippetId,
                          lastClickedFolder,
                          sidebarFocus,
                          setSidebarFocus,
                          folderColors,
                          renamingFolder,
                          renamingValue,
                          setRenamingValue,
                          submitRename,
                          cancelRename,
                          pinnedFolders,
                          togglePinnedFolder,
                          setSelectedIndex,
                          toggleFolder,
                          handleFolderContextMenu,
                          handleSelect
                        }}
                        components={{
                          Footer: VirtuosoFooter
                        }}
                        itemContent={renderItemContent}
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
                              <Folder
                                size={14}
                                fill={folderColors[activeListDragItem.item.id] || '#e8a825'}
                                color={folderColors[activeListDragItem.item.id] || '#e8a825'}
                              />
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
          options={contextMenuOptions}
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
    </>
  )

  if (isEmbedded) return content

  return createPortal(
    <div
      className="explorer-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {content}
    </div>,
    document.body
  )
}

export default React.memo(FileExplorer)
