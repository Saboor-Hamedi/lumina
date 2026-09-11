import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  Image as ImageIcon,
  LayoutGrid
} from 'lucide-react'
import { useVaultStore } from '../../core/store/workspaceStore'
import {
  getChildFolders,
  getChildNotes,
  getFolderPath,
  isRootPath,
  normalizePath
} from './breadcrumbUtils'
import './BreadcrumbDropdown.css'

const getFileIcon = (fileName = '') => {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
  if (ext === '.canvas') {
    return <LayoutGrid size={13} className="bc-icon-canvas" />
  }
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
    return <ImageIcon size={13} className="bc-icon-image" />
  }
  return <FileText size={13} className="bc-icon-note" />
}

const BreadcrumbDropdown = ({ parentFolderId, currentId, anchorRect, onClose }) => {
  const folders = useVaultStore((state) => state.folders) || []
  const snippets = useVaultStore((state) => state.snippets) || []
  const setSelectedSnippet = useVaultStore((state) => state.setSelectedSnippet)

  // Navigation stack: array of folder IDs
  const [stack, setStack] = useState(() => [isRootPath(parentFolderId) ? null : normalizePath(parentFolderId)])
  const currentFolderId = stack[stack.length - 1]
  const isInitialLevel = stack.length === 1

  const [searchQuery, setSearchQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [pathCopied, setPathCopied] = useState(false)
  const [activeNoteId, setActiveNoteId] = useState(currentId)

  const listRef = useRef(null)
  const dropdownRef = useRef(null)
  const searchInputRef = useRef(null)

  // Current folder trail for the header breadcrumb bar
  const headerTrail = useMemo(() => {
    if (isRootPath(currentFolderId)) return []
    return getFolderPath(currentFolderId, folders)
  }, [currentFolderId, folders])

  // Direct child folders and notes of the currently inspected folder
  const { allFolders, allNotes } = useMemo(() => {
    const rawFolders = getChildFolders(currentFolderId, folders)
    const rawNotes = getChildNotes(currentFolderId, snippets)

    const enrichedFolders = rawFolders.map((f) => {
      const subFolders = getChildFolders(f.id, folders)
      const subNotes = getChildNotes(f.id, snippets)
      return {
        ...f,
        itemCount: subFolders.length + subNotes.length
      }
    })

    return { allFolders: enrichedFolders, allNotes: rawNotes }
  }, [currentFolderId, folders, snippets])

  // Filtered items based on search query
  const items = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const folderList = q
      ? allFolders.filter((f) => (f.name || '').toLowerCase().includes(q))
      : allFolders
    const noteList = q
      ? allNotes.filter((n) => (n.name || '').toLowerCase().includes(q))
      : allNotes

    return [...folderList, ...noteList]
  }, [allFolders, allNotes, searchQuery])

  // Current highlighted item
  const highlightId = isInitialLevel && !searchQuery ? currentId : activeNoteId

  // Keep active index in bounds
  useEffect(() => {
    if (isInitialLevel && currentId && !searchQuery) {
      const idx = items.findIndex((it) => it.id === currentId)
      setActiveIndex(idx >= 0 ? idx : 0)
    } else {
      setActiveIndex(0)
    }
  }, [currentFolderId, searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex]
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const drillIn = useCallback((folderId) => {
    setStack((prev) => [...prev, normalizePath(folderId)])
    setSearchQuery('')
  }, [])

  const drillOut = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
    setSearchQuery('')
  }, [])

  const jumpToStackIndex = useCallback((index) => {
    setStack((prev) => prev.slice(0, index + 1))
    setSearchQuery('')
  }, [])

  const handleSelectNote = useCallback(
    (snippet, keepOpen = false) => {
      if (snippet) {
        setSelectedSnippet(snippet)
        setActiveNoteId(snippet.id)
      }
      if (!keepOpen) {
        onClose()
      }
    },
    [setSelectedSnippet, onClose]
  )

  const handleActivate = useCallback(
    (item, isEnterKey = false) => {
      if (!item) return
      if (item.kind === 'folder') {
        drillIn(item.id)
      } else {
        // When searching, pressing Enter or clicking keeps the dropdown open unless dismissed by Escape/outside click
        const keepOpen = Boolean(searchQuery.trim()) || isEnterKey && Boolean(searchQuery)
        handleSelectNote(item.snippet, keepOpen)
      }
    },
    [drillIn, handleSelectNote, searchQuery]
  )

  const handleCopyCurrentPath = useCallback(async (e) => {
    e.stopPropagation()
    const pathText = isRootPath(currentFolderId) ? '/' : currentFolderId
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pathText)
      }
      setPathCopied(true)
      setTimeout(() => setPathCopied(false), 1600)
    } catch {}
  }, [currentFolderId])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
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
        if (items[activeIndex]?.kind === 'folder') {
          e.preventDefault()
          drillIn(items[activeIndex].id)
        }
      } else if (e.key === 'ArrowLeft' || (e.key === 'Backspace' && !searchQuery)) {
        if (stack.length > 1 && (!searchInputRef.current || document.activeElement !== searchInputRef.current || !searchQuery)) {
          e.preventDefault()
          drillOut()
        }
      }
    }

    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [items, activeIndex, stack.length, searchQuery, handleActivate, drillIn, drillOut, onClose])

  // Close on outside pointer interaction
  useEffect(() => {
    const onPointerDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, { capture: true })
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true })
  }, [onClose])

  // Floating portal layout calculation
  const style = useMemo(() => {
    if (!anchorRect) return {}
    const minW = 320
    const maxW = 480
    const maxH = 400
    const gap = 5

    let top = anchorRect.bottom + gap
    let left = anchorRect.left

    const spaceBelow = window.innerHeight - anchorRect.bottom - gap
    const spaceAbove = anchorRect.top - gap

    if (spaceBelow < 240 && spaceAbove > spaceBelow) {
      top = Math.max(10, anchorRect.top - maxH - gap)
    }

    if (left + minW > window.innerWidth - 12) {
      left = window.innerWidth - minW - 12
    }
    if (left < 12) left = 12

    return {
      top: Math.round(top),
      left: Math.round(left),
      minWidth: minW,
      maxWidth: maxW,
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
          <button
            type="button"
            className="bc-nav-btn"
            onClick={drillOut}
            aria-label="Navigate to parent folder"
            title="Go back (Left Arrow)"
          >
            <ChevronLeft size={13} />
          </button>
        )}

        <div className="bc-trail" title={isRootPath(currentFolderId) ? 'Workspace' : currentFolderId}>
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
          <span className="bc-count-pill" title={`${items.length} items`}>
            {items.length}
          </span>
          <button
            type="button"
            className={`bc-header-icon-btn${pathCopied ? ' copied' : ''}`}
            onClick={handleCopyCurrentPath}
            title={pathCopied ? 'Path copied!' : 'Copy folder path'}
            aria-label="Copy folder path"
          >
            {pathCopied ? <Check size={11} /> : <Copy size={11} />}
          </button>
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
          <button
            type="button"
            className="bc-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear filter"
          >
            <X size={11} />
          </button>
        ) : (
          <div className="bc-search-hints">
            <kbd className="bc-kbd-hint">Esc</kbd>
          </div>
        )}
      </div>

      {/* Scrollable list with invisible scrollbar */}
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
                    getFileIcon(item.name || item.snippet?.fileName)
                  )}
                </span>

                <span className="bc-item-label" title={item.name}>
                  {item.name}
                </span>

                {isCurrent && (
                  <span className="bc-current-indicator" title="Active note">
                    active
                  </span>
                )}

                {isFolder && (
                  <span className="bc-folder-trailing">
                    {item.itemCount > 0 && (
                      <span className="bc-item-subcount">
                        {item.itemCount}
                      </span>
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

export default React.memo(BreadcrumbDropdown)
