/**
 * ============================================================================
 * Lumina Breadcrumb Dropdown Navigation (`BreadcrumbDropdown.tsx`)
 * Theme-Token-Driven Folder & File Picker Aligned with Islands UI
 * ============================================================================
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronLeft,
  Database,
  Search,
  Check,
  Copy,
  X,
  Plus,
  Image as ImageIcon,
  LayoutGrid
} from 'lucide-react'
import { useWorkspaceStore, WorkspaceNote } from '../../core/store/workspaceStore'
import { ChromePdfIcon } from '../Icons/FileIcon'
import type { FolderInput } from './utils/breadcrumbUtils'
import ToolTip from '../../components/atoms/ToolTip'
import {
  getChildFolders,
  getChildNotes,
  getFolderPath,
  isRootPath,
  normalizePath,
  createUntitledSnippet,
  SnippetItem
} from './utils/breadcrumbUtils'
import { rankSnippets } from '../../core/utils/searchRanker'
import './css/BreadcrumbDropdown.css'

export interface BreadcrumbDropdownProps {
  parentFolderId?: string | null
  currentId?: string | null
  anchorRect?: {
    top: number
    bottom: number
    left: number
    right: number
    width?: number
    height?: number
  } | null
  onClose: () => void
}

export interface DropdownFolderItem {
  id: string
  name: string
  kind: 'folder'
  itemCount: number
  folderPath?: string
}

export interface DropdownNoteItem {
  id: string
  name: string
  kind: 'note'
  snippet: SnippetItem
  folderName?: string
  relativePath?: string
}

export type DropdownItem = DropdownFolderItem | DropdownNoteItem

const getFileIcon = (fileName = '', type = ''): React.ReactElement => {
  const lower = fileName.toLowerCase()
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : ''
  if (type === 'pdf' || ext === '.pdf') {
    return <ChromePdfIcon size={13} />
  }
  if (type === 'canvas' || ext === '.canvas') {
    return <LayoutGrid size={13} className="bc-icon-canvas" />
  }
  if (type === 'image' || ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.bmp'].includes(ext)) {
    return <ImageIcon size={13} className="bc-icon-image" />
  }
  return <FileText size={13} className="bc-icon-note" />
}

export const BreadcrumbDropdown: React.FC<BreadcrumbDropdownProps> = ({
  parentFolderId,
  currentId,
  anchorRect,
  onClose
}) => {
  const folders = (useWorkspaceStore((state) => state.folders) || []) as FolderInput[]
  const notes = (useWorkspaceStore((state) => state.notes) || []) as WorkspaceNote[]
  const setSelectedNote = useWorkspaceStore((state) => state.setSelectedNote)
  const saveNote = useWorkspaceStore((state) => state.saveNote)

  const [stack, setStack] = useState<(string | null)[]>(() => [
    isRootPath(parentFolderId) ? null : normalizePath(parentFolderId)
  ])
  const currentFolderId = stack[stack.length - 1] ?? null
  const isInitialLevel = stack.length === 1

  const [searchQuery, setSearchQuery] = useState('')
  const [pathCopied, setPathCopied] = useState(false)
  const [activeNoteId, setActiveNoteId] = useState<string | null | undefined>(currentId)

  const listRef = useRef<HTMLUListElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const nextInitial = isRootPath(parentFolderId) ? null : normalizePath(parentFolderId)
    setStack([nextInitial])
    setSearchQuery('')
    setActiveNoteId(currentId)
  }, [parentFolderId, currentId])

  // Auto-focus instant filter input on open so user can type or arrow-navigate immediately
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(id)
  }, [])

  const headerTrail = useMemo(() => {
    if (isRootPath(currentFolderId)) return []
    return getFolderPath(currentFolderId, folders)
  }, [currentFolderId, folders])

  const { allFolders, allNotes } = useMemo(() => {
    const rawFolders = getChildFolders(currentFolderId, folders)
    const rawNotes = getChildNotes(currentFolderId, notes as SnippetItem[])

    const enrichedFolders: DropdownFolderItem[] = rawFolders.map((f) => {
      const subFolders = getChildFolders(f.id, folders)
      const subNotes = getChildNotes(f.id, notes as SnippetItem[])
      return {
        ...f,
        kind: 'folder' as const,
        itemCount: subFolders.length + subNotes.length
      }
    })

    const enrichedNotes: DropdownNoteItem[] = rawNotes.map((n) => ({
      id: n.id,
      name: n.name,
      kind: 'note' as const,
      snippet: n.snippet
    }))

    return { allFolders: enrichedFolders, allNotes: enrichedNotes }
  }, [currentFolderId, folders, notes])

  const items = useMemo<DropdownItem[]>(() => {
    const q = searchQuery.trim()
    if (!q) {
      return [...allFolders, ...allNotes]
    }

    const lowerQ = q.toLowerCase()

    const matchedFolders: DropdownFolderItem[] = folders
      .filter((f) => {
        const name = (typeof f === 'string' ? f : f.name || '').toLowerCase()
        const id = (typeof f === 'string' ? f : f.id || '').toLowerCase()
        return name.includes(lowerQ) || id.includes(lowerQ)
      })
      .map((f) => {
        const folderId = typeof f === 'string' ? f : f.id
        const folderName = typeof f === 'string' ? f.split('/').pop() || f : f.name || f.id
        const subFolders = getChildFolders(folderId, folders)
        const subNotes = getChildNotes(folderId, notes as SnippetItem[])
        return {
          id: folderId,
          name: folderName,
          kind: 'folder' as const,
          itemCount: subFolders.length + subNotes.length,
          folderPath: folderId
        }
      })

    const { results } = rankSnippets(notes as any[], q)
    const matchedNotes: DropdownNoteItem[] = results.map((s: any) => {
      const folderName = s.folderId ? s.folderId.split('/').pop() : ''
      const rawSnippet = notes.find((orig) => orig.id === s.id) || (s as any)
      return {
        id: s.id,
        name: s.title || s.fileName || 'Untitled',
        kind: 'note' as const,
        snippet: rawSnippet as SnippetItem,
        folderName,
        relativePath: s.relativePath || s.folderId || ''
      }
    })

    return [...matchedFolders, ...matchedNotes]
  }, [allFolders, allNotes, searchQuery, folders, notes])

  const [activeIndex, setActiveIndex] = useState<number>(() => {
    if (isInitialLevel && currentId) {
      const initialFolder = isRootPath(parentFolderId) ? null : normalizePath(parentFolderId)
      const rawFolders = getChildFolders(initialFolder, folders)
      const rawNotes = getChildNotes(initialFolder, notes as SnippetItem[])
      const all = [...rawFolders, ...rawNotes]
      const idx = all.findIndex((it) => it.id === currentId)
      return idx >= 0 ? idx : 0
    }
    return 0
  })

  const highlightId = isInitialLevel && !searchQuery ? currentId : activeNoteId

  useEffect(() => {
    if (isInitialLevel && currentId && !searchQuery) {
      const idx = items.findIndex((it) => it.id === currentId)
      setActiveIndex(idx >= 0 ? idx : 0)
    } else if (searchQuery) {
      setActiveIndex(0)
    }
  }, [currentFolderId, searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const drillIn = useCallback((folderId: string) => {
    setStack((prev) => [...prev, normalizePath(folderId)])
    setSearchQuery('')
  }, [])

  const drillOut = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
    setSearchQuery('')
  }, [])

  const jumpToStackIndex = useCallback((index: number) => {
    setStack((prev) => prev.slice(0, index + 1))
    setSearchQuery('')
  }, [])

  const handleSelectNote = useCallback(
    (snippet: SnippetItem, keepOpen = false) => {
      if (snippet && setSelectedNote) {
        setSelectedNote(snippet as any)
        setActiveNoteId(snippet.id)
      }
      if (!keepOpen) {
        onClose()
      }
    },
    [setSelectedNote, onClose]
  )

  const handleActivate = useCallback(
    (item: DropdownItem, isEnterKey = false) => {
      if (!item) return
      if (item.kind === 'folder') {
        drillIn(item.id)
      } else {
        const keepOpen = Boolean(searchQuery.trim()) && !isEnterKey ? true : false
        handleSelectNote(item.snippet, keepOpen)
      }
    },
    [drillIn, handleSelectNote, searchQuery]
  )

  const handleCopyCurrentPath = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      const pathText = isRootPath(currentFolderId) ? '/' : currentFolderId || '/'
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(pathText)
        }
        setPathCopied(true)
        setTimeout(() => setPathCopied(false), 1600)
      } catch {}
    },
    [currentFolderId]
  )

  const handleCreateNoteInFolder = useCallback(
    async (folderId: string | null, e?: React.MouseEvent) => {
      if (e) e.stopPropagation()
      const newSnippet = createUntitledSnippet(folderId ?? undefined, notes as SnippetItem[])
      if (saveNote) {
        await saveNote(newSnippet as any)
      }
      if (setSelectedNote) {
        setSelectedNote(newSnippet as any)
      }
      onClose()
    },
    [notes, saveNote, setSelectedNote, onClose]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (items[activeIndex]) {
          handleActivate(items[activeIndex], true)
        }
      } else if (e.key === 'ArrowRight') {
        if (e.ctrlKey || e.metaKey || searchQuery) return
        if (items[activeIndex]?.kind === 'folder') {
          e.preventDefault()
          drillIn(items[activeIndex].id)
        }
      } else if (e.key === 'ArrowLeft' || (e.key === 'Backspace' && !searchQuery)) {
        if (e.ctrlKey || e.metaKey) return
        if (
          stack.length > 1 &&
          (!searchInputRef.current ||
            document.activeElement !== searchInputRef.current ||
            !searchQuery)
        ) {
          e.preventDefault()
          drillOut()
        }
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [items, activeIndex, stack.length, searchQuery, handleActivate, drillIn, drillOut, onClose])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true })
  }, [onClose])

  const style = useMemo<React.CSSProperties>(() => {
    if (!anchorRect) return {}
    const width = 316
    const maxH = 340
    const gap = 4

    let top = anchorRect.bottom + gap
    let left = anchorRect.left

    const spaceBelow = window.innerHeight - anchorRect.bottom - gap
    const spaceAbove = anchorRect.top - gap

    if (spaceBelow < 220 && spaceAbove > spaceBelow) {
      top = Math.max(10, anchorRect.top - maxH - gap)
    }

    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12
    }
    if (left < 12) left = 12

    return {
      top: Math.round(top),
      left: Math.round(left),
      width,
      minWidth: width,
      maxWidth: width,
      maxHeight: maxH
    }
  }, [anchorRect])

  const isNested = stack.length > 1

  return createPortal(
    <div
      className="bc-dropdown-card"
      ref={dropdownRef}
      style={style}
      role="dialog"
      aria-label="Workspace navigation"
    >
      {/* Header bar with trail and action icons */}
      <div className="bc-header-bar">
        {isNested && (
          <ToolTip text="Go back (Left Arrow)" position="bottom">
            <button
              type="button"
              className="bc-nav-btn"
              onClick={drillOut}
              aria-label="Navigate to parent folder"
            >
              <ChevronLeft size={13} />
            </button>
          </ToolTip>
        )}

        <div
          className="bc-trail"
          title={isRootPath(currentFolderId) ? 'Workspace' : currentFolderId || 'Workspace'}
        >
          <button
            type="button"
            className={`bc-trail-item${isRootPath(currentFolderId) ? ' active' : ''}`}
            onClick={() => jumpToStackIndex(0)}
          >
            <Database size={11} className="bc-trail-root-icon" />
            <span>Workspace</span>
          </button>

          {headerTrail.map((seg, idx) => {
            const isLast = idx === headerTrail.length - 1
            return (
              <React.Fragment key={seg.id || idx}>
                <ChevronRight size={10} className="bc-trail-sep" />
                <button
                  type="button"
                  className={`bc-trail-item${isLast ? ' active' : ''}`}
                  onClick={() => jumpToStackIndex(idx + 1)}
                >
                  <Folder size={11} className="bc-trail-folder-icon" />
                  <span>{seg.name}</span>
                </button>
              </React.Fragment>
            )
          })}
        </div>

        <div className="bc-header-actions">
          <ToolTip text={`${items.length} items`} position="bottom">
            <span className="bc-count-pill">{items.length}</span>
          </ToolTip>
          <ToolTip text="New note in folder" position="bottom">
            <button
              type="button"
              className="bc-header-icon-btn"
              onClick={(e) => handleCreateNoteInFolder(currentFolderId, e)}
              aria-label="New note in folder"
            >
              <Plus size={12} />
            </button>
          </ToolTip>
          <ToolTip text={pathCopied ? 'Path copied!' : 'Copy folder path'} position="bottom">
            <button
              type="button"
              className={`bc-header-icon-btn${pathCopied ? ' copied' : ''}`}
              onClick={handleCopyCurrentPath}
              aria-label="Copy folder path"
            >
              {pathCopied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          </ToolTip>
        </div>
      </div>

      {/* Instant filter bar */}
      <div className="bc-search-box">
        <Search size={12} className="bc-search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          className="bc-search-input"
          placeholder="Filter files & folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        {searchQuery ? (
          <ToolTip text="Clear filter" position="bottom">
            <button
              type="button"
              className="bc-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear filter"
            >
              <X size={11} />
            </button>
          </ToolTip>
        ) : (
          <div className="bc-search-hints">
            <kbd className="bc-kbd-hint">Esc</kbd>
          </div>
        )}
      </div>

      {/* Scrollable list */}
      {items.length === 0 ? (
        <div className="bc-empty-notice">
          {searchQuery ? 'No matching items found' : 'Empty folder'}
        </div>
      ) : (
        <ul className="bc-items-list" ref={listRef} role="listbox">
          {items.map((item, idx) => {
            const isActive = idx === activeIndex
            const isCurrent = item.id === highlightId
            const isFolder = item.kind === 'folder'
            const noteItem = !isFolder ? (item as DropdownNoteItem) : null

            return (
              <li
                key={item.id}
                className={[
                  'bc-list-item',
                  isFolder ? 'is-folder' : 'is-note',
                  isActive ? 'is-active' : '',
                  isCurrent ? 'is-current' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleActivate(item, false)}
              >
                <span className="bc-item-leading-icon">
                  {isFolder ? (
                    <Folder size={13} className="bc-icon-folder" />
                  ) : (
                    getFileIcon(
                      String(noteItem?.snippet?.fileName || item.name || ''),
                      String(noteItem?.snippet?.type || '')
                    )
                  )}
                </span>

                <span className="bc-item-label" title={item.name}>
                  {item.name}
                </span>

                {noteItem?.folderName && Boolean(searchQuery.trim()) && (
                  <span
                    className="bc-item-folder-badge"
                    title={noteItem.relativePath || noteItem.folderName}
                  >
                    {noteItem.folderName}
                  </span>
                )}

                {isCurrent && (
                  <span className="bc-current-indicator" title="Active item">
                    active
                  </span>
                )}

                {isFolder && (
                  <span className="bc-folder-trailing">
                    <ToolTip text={`New note in ${item.name}`} position="top">
                      <button
                        type="button"
                        className="bc-item-add-note"
                        onClick={(e) => handleCreateNoteInFolder(item.id, e)}
                        aria-label={`New note in ${item.name}`}
                      >
                        <Plus size={11} />
                      </button>
                    </ToolTip>
                    {item.itemCount > 0 && (
                      <span className="bc-item-subcount">{item.itemCount}</span>
                    )}
                    <ChevronRight size={12} className="bc-item-chevron-icon" />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>,
    document.body
  )
}

BreadcrumbDropdown.displayName = 'BreadcrumbDropdown'
export default React.memo(BreadcrumbDropdown)
