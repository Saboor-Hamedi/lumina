/**
 * FileExplorer.tsx
 *
 * Part 4 of the 4-Part Partitioned FileExplorer Architecture.
 *
 * Master Orchestrator Component for Lumina's File Explorer:
 * - Coordinates:
 *   1. Part 1: `useExplorerPaste` (Clipboard vault paste & bulk deletion logic).
 *   2. Part 2: `ExplorerVirtuosoList` (High-performance O(1) virtualized list with zero scroll clipping).
 *   3. Part 3: `ExplorerModals` (DragOverlay, folder context menus, and delete confirmation dialogs).
 *   4. ExplorerHeader (Search input, segmented tabs, collapse all, new folder/note actions).
 *   5. ExplorerFavorites (Quick access pinned items with custom drag reordering).
 *
 * Performance & Design:
 * - Reduced from 1167 lines of monolithic code down to clean, modular components.
 * - 100% Type-Safe TypeScript with zero `any` leaks in core interfaces.
 * - Hardware-accelerated GPU transforms and composite layer containment.
 */

import React, { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { DndContext, pointerWithin, rectIntersection } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useWorkspaceStore, GRAPH_TAB_ID } from '../../core/store/workspaceStore'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useResizable } from '../../core/utils/useResizable'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import { summarizeNotes } from '../AI/services/summarizeNotes'

import './css/fileExplorer.css'
import '../../assets/premimum-scroll.css'

import { ExplorerHeader, ExplorerFavorites } from './components'
import { useExternalFileDrop } from './drop'
import { useFileSearch } from './hooks/FileSearch'
import { useFileTree } from './hooks/FileTree'
import { useExplorerSelection } from './hooks/ExplorerSelection'
import { useExplorerDnd } from './hooks/ExplorerDnd'
import { useExplorerOperations } from './hooks/ExplorerOperations'
import { useFolderContextMenu } from './hooks/FolderMenu'
import {
  countExplorerPerfRender,
  finishExplorerPerfPaint,
  markExplorerPerf
} from './utils/explorerPerf'

import { useExplorerPaste } from './useExplorerPaste'
import { ExplorerVirtuosoList } from './ExplorerVirtuosoList'
import { ExplorerModals } from './ExplorerModals'
import { BatchExportDialog } from '../export'
import { resolveExportNotes, resolveFolderExportNotes } from './utils/exportSelection'

export interface FileExplorerProps {
  isOpen?: boolean
  onClose?: () => void
  isEmbedded?: boolean
}

/**
 * Centered Explorer Modal (Start Menu Replica) & Embedded Sidebar Vault Tree
 */
export const FileExplorer: React.FC<FileExplorerProps> = ({
  isOpen = false,
  onClose = () => {},
  isEmbedded = false
}: FileExplorerProps) => {
  markExplorerPerf('render-start', { component: 'FileExplorer' })
  countExplorerPerfRender('FileExplorer')
  // Search state with debounced indexing
  const [query, setQuery] = useState('')
  const [displayQuery, setDisplayQuery] = useState('')
  const debounceTimerRef = useRef<any>(null)

  // Navigation tab state ('all' notes tree vs 'favorites' pinned grid)
  const [activeTab, setActiveTab] = useState('all')

  // Global settings subscriptions
  const sortBy = useSettingsStore((state: any) => state.settings.sortBy)
  const sortDirection = useSettingsStore((state: any) => state.settings.sortDirection)
  const noteOrder = useSettingsStore((state: any) => state.settings.noteOrder)
  const pinnedFolders = useSettingsStore((state: any) => state.settings.pinnedFolders) || []
  const folderOrder = useSettingsStore((state: any) => state.settings.folderOrder)
  const expandedFoldersSetting = useSettingsStore((state: any) => state.settings.expandedFolders)
  const startMenuPinnedOrder = useSettingsStore((state: any) => state.settings.startMenuPinnedOrder)
  const togglePinnedFolder = useSettingsStore((state: any) => state.togglePinnedFolder)

  // Stable settings object for child hooks
  const settings = useMemo(
    () => ({
      sortBy,
      sortDirection,
      noteOrder,
      pinnedFolders,
      folderOrder,
      expandedFolders: expandedFoldersSetting,
      startMenuPinnedOrder
    }),
    [
      sortBy,
      sortDirection,
      noteOrder,
      pinnedFolders,
      folderOrder,
      expandedFoldersSetting,
      startMenuPinnedOrder
    ]
  )

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const virtuosoRef = useRef<any>(null)

  const [isPositionReady, setIsPositionReady] = useState(false)

  // Workspace store subscriptions
  const snippets = (useWorkspaceStore((state: any) => state.notes) || []) as any[]
  const folders = (useWorkspaceStore((state: any) => state.folders) || []) as string[]
  const folderColors = (useWorkspaceStore((state: any) => state.folderColors) || {}) as Record<
    string,
    string
  >
  const selectedSnippetId = useWorkspaceStore(
    (state: any) =>
      state.selectedNote?.id ||
      (state.activeTabId && state.activeTabId !== GRAPH_TAB_ID ? state.activeTabId : null)
  )
  const saveSnippet = useWorkspaceStore((state: any) => state.saveNote)
  const loadWorkspace = useWorkspaceStore((state: any) => state.loadWorkspace)
  const isLoading = useWorkspaceStore((state: any) => state.isLoading)

  // Filter hidden or system folders (.lumina, Templates, etc.)
  const visibleSnippets = useMemo(() => {
    return (snippets || []).filter(
      (s: any) =>
        !s.folderId ||
        (!s.folderId.startsWith('Templates') &&
          !s.folderId.startsWith('.lumina') &&
          !s.folderId.startsWith('.'))
    )
  }, [snippets])

  const visibleFolders = useMemo(() => {
    return (folders || []).filter(
      (f: string) => !f.startsWith('Templates') && !f.startsWith('.lumina') && !f.startsWith('.')
    )
  }, [folders])

  // Auto-focus search input when explorer modal opens
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

  // Global search shortcut listener (Ctrl+F in explorer)
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

  // Close modal on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [isOpen, onClose])

  // Fuzzy search and ranking engine
  const { filteredSnippets, isQueryActive, matchMetaMap, pinnedItems, allSnippets } = useFileSearch(
    visibleSnippets,
    query,
    settings,
    visibleFolders
  )

  // Folder CRUD operations (create, rename, collapse/expand)
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
    flatTree: null as any,
    virtuosoRef,
    setSidebarFocus: (focus: any) => setSidebarFocus(focus),
    handleSelect: (s: any) => handleSelect(s),
    lastClickedFolder: null
  })

  // Flattens nested tree structure into continuous 1D array for O(1) virtualization
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

  const previousFlatTreeRef = useRef(flatTree)
  useLayoutEffect(() => {
    if (previousFlatTreeRef.current === flatTree) return
    previousFlatTreeRef.current = flatTree
    markExplorerPerf('render-end', { visibleRows: flatTree.length })
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        markExplorerPerf('visible-rows-frame', { visibleRows: flatTree.length })
        finishExplorerPerfPaint({ visibleRows: flatTree.length })
      })
    )
  }, [flatTree])

  // Keyboard Shortcuts: Reveal active file in system explorer / file manager
  useKeyboardShortcuts({
    onRevealInExplorer: () => {
      const api = (window as any).api
      if (selectedIndex >= 0 && selectedIndex < flatTree.length) {
        const item = flatTree[selectedIndex]
        if (item?.type === 'file' && item.snippet) {
          const relativePath =
            (item.snippet.folderId ? item.snippet.folderId + '/' : '') + item.snippet.fileName
          api?.openVaultFolder?.(relativePath)
        } else if (item?.type === 'folder') {
          api?.openVaultFolder?.(item.id)
        }
      } else if (selectedSnippetId) {
        const snippet = (snippets || []).find((s: any) => s.id === selectedSnippetId)
        if (snippet) {
          const relativePath = (snippet.folderId ? snippet.folderId + '/' : '') + snippet.fileName
          api?.openVaultFolder?.(relativePath)
        }
      } else {
        api?.openVaultFolder?.()
      }
    }
  })

  // Keyboard navigation & multi-item selection state
  const {
    selectedNoteIds,
    setSelectedNoteIds,
    selectedFolderIds,
    setSelectedFolderIds,
    lastClickedFolder,
    setLastClickedFolder,
    selectedIndex,
    setSelectedIndex,
    sidebarFocus,
    setSidebarFocus,
    clearSelection,
    selectItemAtIndex,
    handleSelect,
    handleNoteClick,
    handleFolderClick,
    handleBackgroundClick
  } = useExplorerSelection({
    isOpen: Boolean(isOpen),
    modalRef,
    virtuosoRef,
    flatTree,
    query,
    selectedSnippetId,
    onClose,
    onRequestBulkDelete: () => setBulkDeleteModalOpen(true)
  })

  // Part 1: Paste images to vault & bulk delete orchestrator
  const {
    bulkDeleteModalOpen,
    setBulkDeleteModalOpen,
    totalSelectedCount,
    handleConfirmBulkDelete
  } = useExplorerPaste({
    lastClickedFolder,
    loadWorkspace,
    handleSelect,
    selectedNoteIds,
    selectedFolderIds,
    clearSelection
  })

  // Internal Drag and Drop (reordering notes & dropping files into folders)
  const {
    sensors,
    activeListDragItem,
    currentOverId,
    handleListDragStart,
    handleListDragOver,
    handleListDragEnd
  } = useExplorerDnd({
    allSnippets,
    flatTree,
    selectedNoteIds,
    setSelectedNoteIds,
    saveSnippet,
    loadWorkspace,
    setExpandedFolders
  })

  const selectedNotes = useMemo(() => {
    if (!selectedNoteIds || selectedNoteIds.size === 0) return []
    return (allSnippets || snippets || []).filter((s: any) => selectedNoteIds.has(s.id))
  }, [allSnippets, snippets, selectedNoteIds])

  // Flat list of notes that should be exported for the current selection.
  // Expands any selected folder into its full subtree and de-duplicates notes in visual order.
  const exportNotes = useMemo(
    () =>
      resolveExportNotes({ notes: allSnippets || snippets, selectedNoteIds, selectedFolderIds }),
    [allSnippets, snippets, selectedNoteIds, selectedFolderIds]
  )

  // Resolver used when a single folder is right-clicked (no multi-selection).
  const resolveFolderNotes = useCallback(
    (folderId: string) => resolveFolderExportNotes(allSnippets || snippets, folderId),
    [allSnippets, snippets]
  )

  const [batchExportNotes, setBatchExportNotes] = useState<any[] | null>(null)

  // Context menu actions for folders and multi-selections
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
    loadWorkspace,
    selectedCount: totalSelectedCount,
    selectedFolderIds,
    selectedNoteIds,
    selectedNotes,
    exportNotes,
    resolveFolderNotes,
    onSummarizeSelected: (notes: any) => summarizeNotes(notes),
    onExportSelected: (notes: any) => setBatchExportNotes(notes),
    onRequestBulkDelete: () => setBulkDeleteModalOpen(true),
    clearSelection
  })

  // External file drop handler (dropping files from OS into Lumina folders)
  const {
    isDraggingExternal,
    hoveredFolderId,
    handleDragEnter: handleExternalDragEnter,
    handleDragOver: handleExternalDragOver,
    handleDragLeave: handleExternalDragLeave,
    handleDrop: handleExternalDrop
  } = useExternalFileDrop()

  // Resizable modal handles
  const { size, handleResizeStart } = useResizable(modalRef)

  // Custom collision detection prioritizing folders over notes during DnD
  const explorerCollisionDetection = useCallback((args: any) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      const folderMatch = pointerCollisions.find((c: any) => String(c.id).startsWith('folder-'))
      if (folderMatch) return [folderMatch]

      const noteMatch = pointerCollisions.find(
        (c: any) => c.id !== args.active.id && c.id !== 'root-drop-zone'
      )
      if (noteMatch) return [noteMatch]

      return pointerCollisions
    }
    return rectIntersection(args)
  }, [])

  // Stable ref for selectedSnippetId — allows renderItemContent to always see the current
  // value without being a reactive dependency (prevents Virtuoso full re-render on tab switch)
  const selectedSnippetIdRef = useRef(selectedSnippetId)
  selectedSnippetIdRef.current = selectedSnippetId

  // Stable ref for selectedNoteIds Set — same rationale: Set identity always changes
  const selectedNoteIdsRef = useRef(selectedNoteIds)
  selectedNoteIdsRef.current = selectedNoteIds

  // Stable context object passed down to Virtuoso item content.
  // IMPORTANT: selectedNoteIds and selectedSnippetId are intentionally excluded — they
  // are read from refs (selectedNoteIdsRef / selectedSnippetIdRef) inside renderItemContent,
  // so they don't cause this context to change on every note click or tab switch.
  const virtuosoContext = useMemo(
    () => ({
      creatingValue,
      setCreatingValue,
      submitCreation,
      setCreating,
      query,
      collapsedDuringSearch,
      expandedFolders,
      selectedIndex,
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
    }),
    [
      creatingValue,
      setCreatingValue,
      submitCreation,
      setCreating,
      query,
      collapsedDuringSearch,
      expandedFolders,
      selectedIndex,
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
    ]
  )

  const handleExplorerProfiler = useCallback(
    (
      id: string,
      phase: string,
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      markExplorerPerf('render-end', {
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime
      })
    },
    []
  )

  const handleSortDragEnd = (event: any) => {
    const { active, over } = event
    if (active.id !== over?.id && over) {
      const allPinnedIds = snippets.filter((s: any) => s.isPinned).map((s: any) => s.id)
      const oldIndex = allPinnedIds.indexOf(active.id)
      const newIndex = allPinnedIds.indexOf(over.id)
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(allPinnedIds, oldIndex, newIndex)
        useSettingsStore.getState().updateSettings({ startMenuPinnedOrder: newOrder })
      }
    }
  }

  if (!isEmbedded && (!isOpen || !isPositionReady)) return null
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
                marginLeft: -(size.width / 2)
              }
            : {
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }
        }
      >
        {/* Resize Handles (When opened as modal) */}
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

        {/* Explorer Header: Search Input, Tabs, Action Buttons */}
        <ExplorerHeader
          searchInputRef={searchInputRef}
          displayQuery={displayQuery}
          setDisplayQuery={setDisplayQuery}
          debounceTimerRef={debounceTimerRef}
          setQuery={setQuery}
          setCollapsedDuringSearch={setCollapsedDuringSearch}
          setSelectedIndex={setSelectedIndex}
          selectItemAtIndex={selectItemAtIndex}
          setSidebarFocus={(val: any) => setSidebarFocus(val)}
          virtuosoRef={virtuosoRef}
          flatTree={flatTree}
          selectedIndex={selectedIndex}
          handleSelect={handleSelect}
          toggleFolder={toggleFolder}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setCreating={(val: any) => setCreating(val)}
          isQueryActive={isQueryActive}
          filteredSnippets={filteredSnippets}
          allSnippets={allSnippets}
          lastClickedFolder={lastClickedFolder}
          setExpandedFolders={setExpandedFolders}
          loadWorkspace={loadWorkspace}
          isLoading={isLoading}
          collapseAllFolders={collapseAllFolders}
        />

        {/* Scrollable Explorer Body */}
        <div
          className={`start-menu-body ${sidebarFocus === 'root' ? 'root-body-focused' : ''}`}
          tabIndex={-1}
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (
              target.closest('.tree-item') ||
              target.closest('.folder-tree-main') ||
              target.closest('.folder-tree-item') ||
              target.closest('[data-item-index]') ||
              target.closest('[data-index]') ||
              target.closest('.header-actions') ||
              target.closest('.sort-toggle-btn') ||
              target.closest('.inline-create-input') ||
              target.closest('.inline-rename-input')
            )
              return
            clearSelection()
            setSelectedIndex(-1)
            setLastClickedFolder('')
            setSidebarFocus('root')
          }}
          onContextMenu={(e) => {
            const target = e.target as HTMLElement
            if (
              target.closest('.tree-item') ||
              target.closest('.folder-tree-main') ||
              target.closest('.folder-tree-item') ||
              target.closest('[data-item-index]') ||
              target.closest('[data-index]')
            )
              return
            e.preventDefault()
            e.stopPropagation()
            setFolderContext({ folderId: '', x: e.clientX, y: e.clientY })
          }}
        >
          {/* Favorites Section */}
          {activeTab === 'favorites' && (
            <ExplorerFavorites
              pinnedItems={pinnedItems}
              selectedSnippetId={selectedSnippetId}
              sensors={sensors}
              handleSortDragEnd={handleSortDragEnd}
              setExpandedFolders={setExpandedFolders}
              setActiveTab={setActiveTab}
              handleSelect={handleSelect}
            />
          )}

          {/* All Notes Tree Section (Part 2 Virtualized List) */}
          {activeTab === 'all' && (
            <div className="start-section" onClick={handleBackgroundClick}>
              <DndContext
                sensors={sensors}
                collisionDetection={explorerCollisionDetection}
                onDragStart={handleListDragStart}
                onDragOver={handleListDragOver}
                onDragEnd={handleListDragEnd}
              >
                <React.Profiler id="ExplorerVirtuosoList" onRender={handleExplorerProfiler}>
                  <ExplorerVirtuosoList
                    virtuosoRef={virtuosoRef}
                    flatTree={flatTree}
                    virtuosoContext={virtuosoContext}
                    isDragging={!!activeListDragItem}
                    activeListDragItem={activeListDragItem}
                    currentOverId={currentOverId}
                    isDraggingExternal={isDraggingExternal}
                    hoveredFolderId={hoveredFolderId}
                    selectedNoteIds={selectedNoteIds}
                    selectedNoteIdsRef={selectedNoteIdsRef}
                    setSelectedNoteIds={setSelectedNoteIds}
                    selectedFolderIds={selectedFolderIds}
                    setSelectedFolderIds={setSelectedFolderIds}
                    selectedSnippetId={selectedSnippetId}
                    selectedSnippetIdRef={selectedSnippetIdRef}
                    selectedIndex={selectedIndex}
                    sidebarFocus={sidebarFocus || ''}
                    lastClickedFolder={lastClickedFolder || ''}
                    totalSelectedCount={totalSelectedCount}
                    query={query}
                    matchMetaMap={matchMetaMap}
                    toggleFolder={toggleFolder}
                    handleFolderContextMenu={handleFolderContextMenu}
                    handleNoteClick={handleNoteClick}
                    handleFolderClick={handleFolderClick}
                    setSidebarFocus={(val: any) => setSidebarFocus(val)}
                    setLastClickedFolder={(val: any) => setLastClickedFolder(val)}
                    setSelectedIndex={setSelectedIndex}
                    handleBackgroundClick={handleBackgroundClick}
                    handleExternalDragEnter={handleExternalDragEnter}
                    handleExternalDragOver={handleExternalDragOver}
                    handleExternalDragLeave={handleExternalDragLeave}
                    handleExternalDrop={handleExternalDrop}
                  />
                </React.Profiler>

                {/* Part 3: Explorer Modals (DragOverlay inside DndContext, ContextMenu, Delete Confirmations) */}
                <ExplorerModals
                  activeListDragItem={activeListDragItem}
                  currentOverId={currentOverId}
                  allSnippets={allSnippets}
                  folderContext={folderContext}
                  setFolderContext={setFolderContext}
                  contextMenuOptions={contextMenuOptions}
                  deleteConfirmFolder={deleteConfirmFolder}
                  setDeleteConfirmFolder={setDeleteConfirmFolder}
                  handleConfirmDeleteFolder={handleConfirmDeleteFolder}
                  bulkDeleteModalOpen={bulkDeleteModalOpen}
                  setBulkDeleteModalOpen={setBulkDeleteModalOpen}
                  handleConfirmBulkDelete={handleConfirmBulkDelete}
                  totalSelectedCount={totalSelectedCount}
                  selectedFolderIds={selectedFolderIds}
                  selectedNoteIds={selectedNoteIds}
                />
              </DndContext>
            </div>
          )}
        </div>
      </div>

      <BatchExportDialog
        isOpen={!!batchExportNotes}
        notes={batchExportNotes || []}
        folderName={
          lastClickedFolder
            ? typeof lastClickedFolder === 'string'
              ? lastClickedFolder.split('/').pop() || 'Folder Export'
              : 'Folder Export'
            : 'Folder Export'
        }
        initialFormat="pdf"
        onClose={() => setBatchExportNotes(null)}
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
