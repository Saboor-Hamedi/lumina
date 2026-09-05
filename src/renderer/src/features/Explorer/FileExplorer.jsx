import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  FileText,
  FileCode,
  Files,
  StarOff,
  Pin,
  PinOff,
  ArrowUpDown,
  Palette,
  Edit2,
  Trash2,
  Check,
  X,
  Clipboard
} from 'lucide-react'
import { useVaultStore, GRAPH_TAB_ID } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
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
import { useResizable } from '../../core/utils/useResizable'
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import ConfirmModal from '../modals/ConfirmModal'
import ContextMenu from '../modals/ContextMenu'
import ToolTip from '../../components/atoms/ToolTip'
import { FixedSizeList as List } from '../../components/utils/VirtualList'
import Version from '../../components/Version'
import Fuse from 'fuse.js'
import { rankSnippets } from '../../core/utils/searchRanker'
import './FileExplorer.css'

import {
  SortableListItem,
  DroppableFolderItem,
  SortableGridItem,
  OverlayWrapper,
  DroppableRootZone,
  NoteNumbers,
  ExplorerHeader,
  ExplorerFavorites,
  ExternalDropOverlay
} from './components'
import { useFileSearch } from './hooks/useFileSearch'
import { useFileTree } from './hooks/useFileTree'
import { useExplorerSelection } from './hooks/useExplorerSelection'
import { useExplorerDnd } from './hooks/useExplorerDnd'
import { useExplorerOperations } from './hooks/useExplorerOperations'
import { useFolderContextMenu } from './hooks/useFolderContextMenu'
import { useExternalFileDrop } from './hooks/useExternalFileDrop'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'

const VirtuosoFooter = ({ context }) => (
  <div
    style={{ height: '36px', width: '100%', minHeight: '36px', cursor: 'default' }}
    onClick={(e) => {
      e.stopPropagation()
      if (context?.handleBackgroundClick) {
        context.handleBackgroundClick(e)
      }
    }}
    onPointerDown={(e) => {
      e.stopPropagation()
      if (context?.handleBackgroundClick) {
        context.handleBackgroundClick(e)
      }
    }}
  />
)

const DroppableVirtuosoWrapper = ({
  children,
  isDragging,
  isRootFocused,
  onClick,
  onPointerDown,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop
}) => {
  const { isOver, setNodeRef } = useDroppable({ id: 'root-drop-zone' })
  const showDropHighlight = isOver && isDragging
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`recommended-list ${showDropHighlight ? 'root-drop-over' : ''} ${isRootFocused ? 'root-body-focused' : ''}`}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      {children}
    </div>
  )
}

/**
 * Centered Explorer Modal (Start Menu Replica)
 */
const FileExplorer = ({ isOpen, onClose, isEmbedded }) => {
  const [query, setQuery] = useState('')
  const [displayQuery, setDisplayQuery] = useState('')
  const debounceTimerRef = useRef(null)

  const [activeTab, setActiveTab] = useState('all')
  const sortBy = useSettingsStore((state) => state.settings.sortBy)
  const sortDirection = useSettingsStore((state) => state.settings.sortDirection)
  const noteOrder = useSettingsStore((state) => state.settings.noteOrder)
  const pinnedFolders = useSettingsStore((state) => state.settings.pinnedFolders) || []
  const folderOrder = useSettingsStore((state) => state.settings.folderOrder)
  const expandedFoldersSetting = useSettingsStore((state) => state.settings.expandedFolders)
  const startMenuPinnedOrder = useSettingsStore((state) => state.settings.startMenuPinnedOrder)
  const updateSetting = useSettingsStore((state) => state.updateSetting)
  const togglePinnedFolder = useSettingsStore((state) => state.togglePinnedFolder)
  // Build a stable settings object for hooks that need it
  const settings = React.useMemo(() => ({
    sortBy,
    sortDirection,
    noteOrder,
    pinnedFolders,
    folderOrder,
    expandedFolders: expandedFoldersSetting,
    startMenuPinnedOrder
  }), [sortBy, sortDirection, noteOrder, pinnedFolders, folderOrder, expandedFoldersSetting, startMenuPinnedOrder])

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

  const visibleSnippets = useMemo(() => {
    return snippets.filter(
      (s) =>
        !s.folderId ||
        (!s.folderId.startsWith('Templates') &&
          !s.folderId.startsWith('.lumina') &&
          !s.folderId.startsWith('.'))
    )
  }, [snippets])

  const visibleFolders = useMemo(() => {
    return folders.filter(
      (f) => !f.startsWith('Templates') && !f.startsWith('.lumina') && !f.startsWith('.')
    )
  }, [folders])

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
    settings,
    visibleFolders
  )

  const {
    expandedFolders,
    setExpandedFolders,
    collapsedDuringSearch,
    setCollapsedDuringSearch,
    creating,
    setCreating,
    creatingValue,
    setCreatingValue,
    renamingFolder,
    setRenamingFolder,
    renamingValue,
    setRenamingValue,
    toggleFolder,
    collapseAllFolders,
    cancelRename,
    submitCreation,
    submitRename
  } = useExplorerOperations({
    snippets,
    visibleFolders,
    selectedSnippetId,
    query,
    flatTree: null,
    virtuosoRef,
    setSidebarFocus: (focus) => setSidebarFocus(focus),
    handleSelect: (s) => handleSelect(s),
    lastClickedFolder: null
  })

  const flatTree = useFileTree({
    allSnippets,
    folders: visibleFolders,
    activeTab,
    query,
    expandedFolders,
    creating,
    collapsedDuringSearch,
    folderOrder: settings.folderOrder
  })

  const deleteSnippet = useVaultStore((state) => state.deleteSnippet)
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)

  const {
    selectedNoteIds,
    setSelectedNoteIds,
    selectedFolderIds,
    setSelectedFolderIds,
    lastClickedNoteId,
    setLastClickedNoteId,
    lastClickedFolder,
    setLastClickedFolder,
    selectedIndex,
    setSelectedIndex,
    sidebarFocus,
    setSidebarFocus,
    selectAll,
    clearSelection,
    handleSelect,
    handleNoteClick,
    handleFolderClick,
    handleBackgroundClick
  } = useExplorerSelection({
    isOpen,
    modalRef,
    virtuosoRef,
    flatTree,
    query,
    selectedSnippetId,
    onClose,
    onRequestBulkDelete: () => setBulkDeleteModalOpen(true)
  })

  useEffect(() => {
    const handleExplorerPaste = async (e) => {
      const activeEl = document.activeElement
      if (
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'INPUT' ||
        activeEl?.closest('.cm-editor') ||
        activeEl?.closest('.ai-chat-input')
      ) {
        return
      }

      const items = Array.from(e.clipboardData?.items || [])
      const fileFromItems = items
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter(Boolean)

      const directFiles = Array.from(e.clipboardData?.files || []).filter((f) =>
        f.type.startsWith('image/')
      )

      const imageFiles = fileFromItems.length > 0 ? fileFromItems : directFiles

      if (imageFiles.length > 0) {
        e.preventDefault()
        e.stopPropagation()

        const targetFolder = lastClickedFolder || ''

        for (const file of imageFiles) {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)
            const ext = file.type.split('/')[1] || 'png'
            const filename =
              file.name && file.name !== 'image.png' && file.name !== 'image.jpeg'
                ? file.name
                : `Pasted image ${Date.now()}.${ext}`

            const result = await window.api?.saveVaultImage?.(
              uint8Array,
              targetFolder,
              filename
            )

            await loadVault()

            if (result?.relativePath) {
              const freshSnippets = useVaultStore.getState().snippets || []
              const targetSnippet = freshSnippets.find(
                (s) =>
                  s.relativePath === result.relativePath ||
                  (s.fileName === result.fileName && (s.folderId || '') === (result.folderId || ''))
              )
              if (targetSnippet) {
                handleSelect(targetSnippet)
              }
            }
          } catch (err) {
            console.error('Failed to paste image to vault:', err)
          }
        }
      }
    }

    window.addEventListener('paste', handleExplorerPaste)
    return () => window.removeEventListener('paste', handleExplorerPaste)
  }, [lastClickedFolder, loadVault, handleSelect])

  const totalSelectedCount = selectedNoteIds.size + selectedFolderIds.size

  const handleConfirmBulkDelete = useCallback(async () => {
    try {
      const deletedFolderIds = Array.from(selectedFolderIds)
      const deletedSnippetIds = Array.from(selectedNoteIds)

      if (window.api?.bulkDelete) {
        await window.api.bulkDelete({
          folderIds: deletedFolderIds,
          snippetIds: deletedSnippetIds
        })
      } else {
        for (const folderId of deletedFolderIds) {
          await window.api?.deleteFolder?.(folderId).catch(() => {})
        }
        for (const noteId of deletedSnippetIds) {
          await deleteSnippet(noteId, true).catch(() => {})
        }
      }

      if (deletedFolderIds.length > 0) {
        const currentPinnedFolders = useSettingsStore.getState().settings.pinnedFolders || []
        const newPinnedFolders = currentPinnedFolders.filter(
          (fId) => !deletedFolderIds.some((df) => fId === df || fId.startsWith(`${df}/`))
        )
        if (newPinnedFolders.length !== currentPinnedFolders.length) {
          useSettingsStore.getState().updateSettings({ pinnedFolders: newPinnedFolders })
        }
      }

      clearSelection()
      await loadVault()
    } catch (err) {
      console.error('Failed to execute bulk deletion:', err)
    } finally {
      setBulkDeleteModalOpen(false)
    }
  }, [selectedFolderIds, selectedNoteIds, deleteSnippet, clearSelection, loadVault])

  const {
    sensors,
    activeListDragItem,
    setActiveListDragItem,
    handleListDragStart,
    handleListDragEnd
  } = useExplorerDnd({
    allSnippets,
    flatTree,
    selectedNoteIds,
    saveSnippet,
    loadVault,
    setExpandedFolders
  })

  const {
    folderContext,
    setFolderContext,
    deleteConfirmFolder,
    setDeleteConfirmFolder,
    handleFolderContextMenu,
    contextMenuOptions,
    handleConfirmDeleteFolder
  } = useFolderContextMenu({
    pinnedFolders,
    setExpandedFolders,
    setCreating,
    setCreatingValue,
    setRenamingFolder,
    setRenamingValue,
    loadVault,
    selectedCount: totalSelectedCount,
    onRequestBulkDelete: () => setBulkDeleteModalOpen(true),
    clearSelection
  })

  const {
    isDraggingExternal,
    hoveredFolderId,
    handleDragEnter: handleExternalDragEnter,
    handleDragOver: handleExternalDragOver,
    handleDragLeave: handleExternalDragLeave,
    handleDrop: handleExternalDrop
  } = useExternalFileDrop()

  const { size, handleResizeStart } = useResizable(modalRef)

  const renderItemContent = useCallback((index, item, context) => {
    if (item.type === 'input') {
      return (
        <div
          className="folder-tree-item"
          style={{
            position: 'relative',
            paddingLeft: `${item.depth * 10 + (item.kind === 'folder' ? 0 : 10)}px`
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
      return null
    } else if (item.type === 'folder') {
      const isExpanded = context.query?.trim()
        ? !context.collapsedDuringSearch?.has(item.id)
        : context.expandedFolders?.has(item.id)
      const isMultiSelected = selectedFolderIds.has(item.id)
      const isActive =
        isMultiSelected ||
        (sidebarFocus === 'folder' && (lastClickedFolder === item.id || index === selectedIndex))
      return (
        <div
          style={{
            position: 'relative',
            paddingLeft: `${item.depth * 10}px`
          }}
        >
          <DroppableFolderItem
            item={item}
            isExpanded={isExpanded}
            isActive={isActive}
            searchQuery={context.query}
            folderColor={context.folderColors?.[item.id]}
            isRenaming={context.renamingFolder === item.id}
            renameValue={context.renamingValue}
            setRenameValue={context.setRenamingValue}
            submitRename={context.submitRename}
            cancelRename={context.cancelRename}
            isPinned={context.pinnedFolders?.includes(item.id)}
            onTogglePin={context.togglePinnedFolder}
            isExternalOver={hoveredFolderId === item.id}
            onExternalDragEnter={(e) => handleExternalDragEnter(e, item.id)}
            onExternalDragOver={(e) => handleExternalDragOver(e, item.id)}
            onExternalDrop={(e) => handleExternalDrop(e, item.id)}
            onToggle={(id, e) => {
              if (e?.ctrlKey || e?.metaKey || e?.shiftKey) {
                handleFolderClick(id, index, e)
              } else {
                handleFolderClick(id, index, e)
                toggleFolder(id, e)
              }
            }}
            onContextMenu={(id, e) => {
              if (totalSelectedCount > 1 && (selectedFolderIds.has(id) || selectedNoteIds.size > 0)) {
                handleFolderContextMenu(id, e)
              } else {
                setSidebarFocus('folder')
                setLastClickedFolder(id)
                setSelectedIndex(index)
                handleFolderContextMenu(id, e)
              }
            }}
          />
        </div>
      )
    } else {
      const isMultiSelected = selectedNoteIds.has(item.snippet.id)
      const isNoteActive =
        (sidebarFocus === 'note' || sidebarFocus === 'multi') &&
        (isMultiSelected ||
          (selectedNoteIds.size === 0 && selectedFolderIds.size === 0 && item.snippet.id === selectedSnippetId) ||
          index === selectedIndex)
      const filePaddingLeft = `${item.depth * 10 + 18}px`

      return (
        <div
          style={{
            position: 'relative',
            paddingLeft: filePaddingLeft
          }}
        >
          <SortableListItem
            key={item.snippet.id}
            snippet={item.snippet}
            onClick={(snippet, e) => handleNoteClick(snippet, index, e)}
            onContextMenu={
              totalSelectedCount > 1 && (selectedNoteIds.has(item.snippet.id) || selectedFolderIds.size > 0)
                ? (snippet, e) => handleFolderContextMenu(snippet.id, e)
                : undefined
            }
            isActive={isNoteActive}
            searchQuery={query}
            matchSnippet={matchMetaMap?.get(item.snippet.id)?.matchSnippet || ''}
            depth={item.depth}
          />
        </div>
      )
    }
  }, [
    sidebarFocus,
    lastClickedFolder,
    selectedNoteIds,
    selectedFolderIds,
    selectedSnippetId,
    selectedIndex,
    totalSelectedCount,
    hoveredFolderId,
    query,
    matchMetaMap,
    toggleFolder,
    handleFolderContextMenu,
    handleNoteClick,
    handleFolderClick,
    handleExternalDragEnter,
    handleExternalDragOver,
    handleExternalDrop
  ])

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
        onPointerDown={handleBackgroundClick}
        onClick={(e) => {
          setFolderContext(null)
          handleBackgroundClick(e)
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

        {/* Explorer Header: Search, Tabs, Action Buttons */}
        <ExplorerHeader
          searchInputRef={searchInputRef}
          displayQuery={displayQuery}
          setDisplayQuery={setDisplayQuery}
          debounceTimerRef={debounceTimerRef}
          setQuery={setQuery}
          setCollapsedDuringSearch={setCollapsedDuringSearch}
          setSelectedIndex={setSelectedIndex}
          setSidebarFocus={setSidebarFocus}
          virtuosoRef={virtuosoRef}
          flatTree={flatTree}
          selectedIndex={selectedIndex}
          handleSelect={handleSelect}
          toggleFolder={toggleFolder}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setCreating={setCreating}
          isQueryActive={isQueryActive}
          filteredSnippets={filteredSnippets}
          allSnippets={allSnippets}
          lastClickedFolder={lastClickedFolder}
          setExpandedFolders={setExpandedFolders}
          loadVault={loadVault}
          isLoading={isLoading}
          collapseAllFolders={collapseAllFolders}
        />

        {/* Scrollable Body */}
        <div
          className="start-menu-body"
          tabIndex={-1}
          onClick={(e) => {
            if (e.target.closest('.virtuoso-row') || e.target.closest('.tree-item')) return
            clearSelection()
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
            <ExplorerFavorites
              pinnedItems={pinnedItems}
              sensors={sensors}
              handleSortDragEnd={handleSortDragEnd}
              setExpandedFolders={setExpandedFolders}
              setActiveTab={setActiveTab}
              handleSelect={handleSelect}
            />
          )}

          {/* All Notes Section */}
          {activeTab === 'all' && (
            <div
              className="start-section"
              onClick={handleBackgroundClick}
            >

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
                  <DroppableVirtuosoWrapper
                    isDragging={!!activeListDragItem}
                    isRootFocused={sidebarFocus === 'root'}
                    onClick={handleBackgroundClick}
                    onDragEnter={(e) => handleExternalDragEnter(e, '')}
                    onDragOver={(e) => handleExternalDragOver(e, '')}
                    onDragLeave={handleExternalDragLeave}
                    onDrop={(e) => handleExternalDrop(e, '')}
                  >
                    {isDraggingExternal && !hoveredFolderId && (
                      <ExternalDropOverlay targetName="Vault Root" />
                    )}
                    {flatTree.length === 0 ? (
                      <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        No notes or folders found
                      </div>
                    ) : (
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
                          selectedNoteIds,
                          lastClickedFolder,
                          sidebarFocus,
                          setSidebarFocus,
                          setLastClickedFolder,
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
                          handleNoteClick,
                          handleSelect,
                          handleBackgroundClick
                        }}
                        components={{
                          Footer: VirtuosoFooter
                        }}
                        itemContent={renderItemContent}
                      />
                    )}
                  </DroppableVirtuosoWrapper>
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
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'var(--bg-panel, #1e1e2e)',
                            border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            fontWeight: 500,
                            pointerEvents: 'none',
                            transform: 'translate3d(0, 0, 0)'
                          }}
                        >
                          <Folder size={14} fill="#e8a825" color="#e8a825" />
                          <span>{activeListDragItem.item?.name || 'Folder'}</span>
                        </div>
                      ) : activeListDragItem?.type === 'file' ? (
                        <OverlayWrapper>
                          <div
                            className="start-section"
                            style={{
                              width: '220px',
                              maxWidth: '220px',
                              overflow: 'hidden',
                              position: 'relative'
                            }}
                          >
                            <div
                              style={{
                                opacity: 0.95,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                                borderRadius: '6px',
                                background: 'var(--bg-panel, #1e1e2e)',
                                border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                                overflow: 'hidden'
                              }}
                            >
                              <SidebarItem
                                snippet={activeListDragItem.snippet}
                                variant="list"
                                isActive={false}
                                searchQuery=""
                              />
                            </div>
                            {activeListDragItem.count > 1 && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '-6px',
                                  right: '-6px',
                                  background: 'var(--text-accent, #6366f1)',
                                  color: '#ffffff',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                                  zIndex: 10
                                }}
                              >
                                +{activeListDragItem.count}
                              </span>
                            )}
                          </div>
                        </OverlayWrapper>
                      ) : null}
                    </DragOverlay>,
                    document.body
                  )}
                </DndContext>
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
        onConfirm={handleConfirmDeleteFolder}
        title="Delete Folder"
        message={`Are you sure you want to delete '${deleteConfirmFolder}' and all its contents? This action cannot be undone.`}
        confirmText="Delete Folder"
      />

      <ConfirmModal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title={`Delete ${totalSelectedCount} Selected ${totalSelectedCount === 1 ? 'Item' : 'Items'}?`}
        message={`Are you sure you want to permanently delete ${selectedFolderIds.size > 0 ? `${selectedFolderIds.size} folder${selectedFolderIds.size > 1 ? 's' : ''}` : ''}${selectedFolderIds.size > 0 && selectedNoteIds.size > 0 ? ' and ' : ''}${selectedNoteIds.size > 0 ? `${selectedNoteIds.size} note${selectedNoteIds.size > 1 ? 's' : ''}` : ''} and all nested files? This action cannot be undone.`}
        confirmText="Delete All"
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
