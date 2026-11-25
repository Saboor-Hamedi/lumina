/**
 * ============================================================================
 * Lumina Editor Breadcrumbs Bar (`Breadcrumbs.tsx`)
 * Docked workspace path bar with interactive folder/sibling pickers,
 * heading outline navigation, drag-and-drop move, and instant path copy.
 * ============================================================================
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Folder,
  ChevronRight,
  FileText,
  Database,
  Copy,
  Check,
  Hash,
  Image as ImageIcon,
  LayoutGrid
} from 'lucide-react'
import { useWorkspaceStore, WorkspaceNote } from '../../core/store/workspaceStore'
import { ChromePdfIcon } from '../Icons/FileIcon'
import ToolTip from '../../components/atoms/ToolTip'
import BreadcrumbDropdown from './BreadcrumbDropdown'
import BreadcrumbOutlineDropdown from './BreadcrumbOutlineDropdown'
import {
  getFolderPath,
  extractHeadings,
  findActiveHeading,
  normalizePath,
  FolderPathItem,
  HeadingItem,
  SnippetItem,
  FolderInput
} from './utils/breadcrumbUtils'
import './css/Breadcrumbs.css'

export interface BreadcrumbsProps {
  /** Optional note/snippet to render breadcrumbs for; defaults to selectedNote */
  snippet?: WorkspaceNote | SnippetItem | null
  /** Optional CSS class name appended to the container */
  className?: string
}

interface DropdownState {
  parentFolderId: string | null
  currentId: string | null
  activeSegmentKey: string
  anchorRect: {
    top: number
    bottom: number
    left: number
    right: number
    width?: number
    height?: number
  }
}

interface OutlineDropdownState {
  anchorRect: {
    top: number
    bottom: number
    left: number
    right: number
    width?: number
    height?: number
  }
}

interface BreadcrumbSegment {
  key: string
  type: 'workspace' | 'folder' | 'note' | 'outline'
  parentFolderId?: string | null
  currentId?: string | null
}

function renderActiveDocumentIcon(snippet: SnippetItem): React.ReactNode {
  const rawName = (snippet.fileName || snippet.title || '').toLowerCase()
  if (snippet.type === 'pdf' || rawName.endsWith('.pdf')) {
    return <ChromePdfIcon size={11.5} />
  }
  if (
    snippet.type === 'image' ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(rawName)
  ) {
    return <ImageIcon size={11.5} className="breadcrumb-icon is-image" />
  }
  if (snippet.type === 'canvas' || rawName.endsWith('.canvas')) {
    return <LayoutGrid size={11.5} className="breadcrumb-icon is-canvas" />
  }
  return <FileText size={11.5} className="breadcrumb-icon is-note" />
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ snippet, className = '' }) => {
  const folders = (useWorkspaceStore((state) => state.folders) || []) as FolderInput[]
  const notes = (useWorkspaceStore((state) => state.notes) || []) as WorkspaceNote[]
  const selectedNote = useWorkspaceStore((state) => state.selectedNote)
  const saveNote = useWorkspaceStore((state) => state.saveNote)
  const currentSnippet = (snippet || selectedNote) as SnippetItem | null

  const [copied, setCopied] = useState(false)
  const [dropdown, setDropdown] = useState<DropdownState | null>(null)
  const [outlineDropdown, setOutlineDropdown] = useState<OutlineDropdownState | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)
  const [cursorLine, setCursorLine] = useState<number>(1)

  useEffect(() => {
    const handleCursorPos = (e: any) => {
      if (e.detail && (!e.detail.snippetId || e.detail.snippetId === currentSnippet?.id)) {
        setCursorLine(e.detail.line || 1)
      }
    }
    window.addEventListener('editor-cursor-pos', handleCursorPos)
    return () => window.removeEventListener('editor-cursor-pos', handleCursorPos)
  }, [currentSnippet?.id])

  const headings = useMemo<HeadingItem[]>(() => {
    const isBinaryMedia =
      currentSnippet?.type === 'pdf' ||
      currentSnippet?.type === 'image' ||
      /\.(pdf|png|jpe?g|gif|webp|svg|bmp|ico|mp4|webm|mp3|wav|ogg)$/i.test(
        currentSnippet?.fileName || currentSnippet?.title || ''
      )
    if (isBinaryMedia) return []
    return extractHeadings(currentSnippet?.code || '')
  }, [currentSnippet?.code, currentSnippet?.type, currentSnippet?.fileName, currentSnippet?.title])

  const activeHeading = useMemo<HeadingItem | null>(() => {
    return findActiveHeading(headings, cursorLine)
  }, [headings, cursorLine])

  const folderPath = useMemo<FolderPathItem[]>(() => {
    return getFolderPath(currentSnippet?.folderId, folders)
  }, [currentSnippet?.folderId, folders])

  const segments = useMemo<BreadcrumbSegment[]>(() => {
    if (!currentSnippet) return []
    const rootTargetId = folderPath[0]?.id ?? currentSnippet.id
    const list: BreadcrumbSegment[] = [
      {
        key: '__workspace__',
        type: 'workspace',
        parentFolderId: null,
        currentId: rootTargetId
      }
    ]
    folderPath.forEach((folder, index) => {
      const parentId = index > 0 ? folderPath[index - 1].id : null
      list.push({
        key: folder.id,
        type: 'folder',
        parentFolderId: parentId,
        currentId: folder.id
      })
    })
    const lastFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null
    list.push({
      key: currentSnippet.id,
      type: 'note',
      parentFolderId: lastFolderId,
      currentId: currentSnippet.id
    })
    if (activeHeading) {
      list.push({
        key: '__outline__',
        type: 'outline'
      })
    }
    return list
  }, [currentSnippet, folderPath, activeHeading])

  const openDropdown = useCallback(
    (
      e: React.MouseEvent<HTMLButtonElement>,
      parentFolderId: string | null | undefined,
      currentId: string | null | undefined,
      activeSegmentKey: string
    ) => {
      const rect = e.currentTarget.getBoundingClientRect()
      setOutlineDropdown(null)
      setDropdown({
        parentFolderId: parentFolderId ?? null,
        currentId: currentId ?? null,
        activeSegmentKey,
        anchorRect: rect
      })
    },
    []
  )

  const closeDropdown = useCallback(() => setDropdown(null), [])

  const openOutlineDropdown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setDropdown(null)
    setOutlineDropdown({ anchorRect: rect })
  }, [])

  const closeOutlineDropdown = useCallback(() => setOutlineDropdown(null), [])

  const navigateSegment = useCallback(
    (direction: number) => {
      if (!segments.length) return
      const currentKey = outlineDropdown
        ? '__outline__'
        : dropdown
          ? dropdown.activeSegmentKey
          : currentSnippet?.id

      let currentIndex = segments.findIndex((s) => s.key === currentKey)
      if (currentIndex === -1) currentIndex = segments.findIndex((s) => s.type === 'note')
      if (currentIndex === -1) currentIndex = 0

      const nextIndex = Math.max(0, Math.min(segments.length - 1, currentIndex + direction))
      const targetSegment = segments[nextIndex]
      if (!targetSegment) return

      const btn = document.querySelector(`[data-bc-key="${targetSegment.key}"]`)
      const rect = btn
        ? btn.getBoundingClientRect()
        : { left: 100, top: 28, bottom: 48, right: 200, width: 100, height: 20 }

      if (targetSegment.type === 'outline') {
        setDropdown(null)
        setOutlineDropdown({ anchorRect: rect })
      } else {
        setOutlineDropdown(null)
        setDropdown({
          parentFolderId: targetSegment.parentFolderId ?? null,
          currentId: targetSegment.currentId ?? null,
          activeSegmentKey: targetSegment.key,
          anchorRect: rect
        })
      }
    },
    [segments, outlineDropdown, dropdown, currentSnippet?.id]
  )

  useEffect(() => {
    if (!dropdown && !outlineDropdown) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey
      if (isCmdOrCtrl && e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        navigateSegment(-1)
      } else if (isCmdOrCtrl && e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        navigateSegment(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [dropdown, outlineDropdown, navigateSegment])

  const handleCopyPath = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      const fullPath =
        (typeof currentSnippet?.relativePath === 'string' ? currentSnippet.relativePath : '') ||
        [...folderPath.map((f) => f.name), currentSnippet?.title || 'Untitled'].join('/')
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(fullPath)
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      } catch {}
    },
    [currentSnippet, folderPath]
  )

  const folderPathRef = useRef(folderPath)
  folderPathRef.current = folderPath
  const currentSnippetRef = useRef(currentSnippet)
  currentSnippetRef.current = currentSnippet

  useEffect(() => {
    const handleFocusBreadcrumbs = () => {
      const activeEl = document.querySelector('.breadcrumb-item.active')
      const rect = activeEl
        ? activeEl.getBoundingClientRect()
        : { left: 100, top: 28, bottom: 48, right: 200, width: 100, height: 20 }
      const fp = folderPathRef.current || []
      const lastFolderId = fp.length > 0 ? fp[fp.length - 1].id : null
      const targetId = currentSnippetRef.current?.id || (fp[0]?.id ?? null)
      setOutlineDropdown(null)
      setDropdown({
        parentFolderId: lastFolderId,
        currentId: targetId,
        activeSegmentKey: targetId || '__workspace__',
        anchorRect: rect
      })
    }
    window.addEventListener('focus-breadcrumbs', handleFocusBreadcrumbs)
    document.addEventListener('focus-breadcrumbs', handleFocusBreadcrumbs)
    return () => {
      window.removeEventListener('focus-breadcrumbs', handleFocusBreadcrumbs)
      document.removeEventListener('focus-breadcrumbs', handleFocusBreadcrumbs)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, targetKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTarget(targetKey)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent, targetKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverTarget((prev) => (prev === targetKey ? null : prev))
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetFolderId: string | null) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOverTarget(null)

      const raw = e.dataTransfer.getData('application/lumina-snippet')
      if (raw && saveNote) {
        try {
          const droppedSnippet = JSON.parse(raw)
          if (droppedSnippet && droppedSnippet.id) {
            const nextFolderId = targetFolderId ? normalizePath(targetFolderId) : ''
            if (droppedSnippet.folderId !== nextFolderId) {
              const updated = { ...droppedSnippet, folderId: nextFolderId }
              await saveNote(updated)
              window.dispatchEvent(
                new CustomEvent('show-toast', {
                  detail: {
                    message: `Moved to ${nextFolderId || 'Workspace'}`,
                    type: 'success'
                  }
                })
              )
            }
          }
        } catch (err) {
          console.error('[Breadcrumbs] Drop error:', err)
        }
      }
    },
    [saveNote]
  )

  if (!currentSnippet) return null
  if (Array.isArray(notes) && notes.length === 0 && !snippet) return null
  if (Array.isArray(notes) && notes.length > 0 && !notes.some((s) => s.id === currentSnippet.id)) {
    return null
  }

  const rootTargetId = folderPath[0]?.id ?? currentSnippet.id
  const isWorkspaceOpen = dropdown?.activeSegmentKey === '__workspace__'
  const isWorkspaceDragOver = dragOverTarget === '__workspace__'

  return (
    <nav className={`editor-breadcrumbs-bar ${className}`} aria-label="Breadcrumbs">
      {/* Workspace root button */}
      <ToolTip text="Browse workspace root" position="bottom">
        <button
          type="button"
          data-bc-key="__workspace__"
          className={[
            'breadcrumb-item',
            isWorkspaceOpen ? 'bc-open' : '',
            isWorkspaceDragOver ? 'drag-over' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={(e) => openDropdown(e, null, rootTargetId, '__workspace__')}
          onDragOver={(e) => handleDragOver(e, '__workspace__')}
          onDragLeave={(e) => handleDragLeave(e, '__workspace__')}
          onDrop={(e) => handleDrop(e, null)}
        >
          <Database size={11.5} className="breadcrumb-icon is-root" />
          <span>Workspace</span>
        </button>
      </ToolTip>

      <span className="breadcrumb-separator" aria-hidden="true">
        <ChevronRight size={11} strokeWidth={1.75} />
      </span>

      {/* Hierarchical folder segments */}
      {folderPath.map((folder, index) => {
        const parentId = index > 0 ? folderPath[index - 1].id : null
        const isFolderOpen = dropdown?.activeSegmentKey === folder.id
        const isFolderDragOver = dragOverTarget === folder.id

        return (
          <React.Fragment key={folder.id || index}>
            <ToolTip text={`Folder: ${folder.name}`} position="bottom">
              <button
                type="button"
                data-bc-key={folder.id}
                className={[
                  'breadcrumb-item',
                  isFolderOpen ? 'bc-open' : '',
                  isFolderDragOver ? 'drag-over' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={(e) => openDropdown(e, parentId, folder.id, folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={(e) => handleDragLeave(e, folder.id)}
                onDrop={(e) => handleDrop(e, folder.id)}
              >
                <Folder size={11.5} className="breadcrumb-icon is-folder" />
                <span className="breadcrumb-folder-text">{folder.name}</span>
              </button>
            </ToolTip>
            <span className="breadcrumb-separator" aria-hidden="true">
              <ChevronRight size={11} strokeWidth={1.75} />
            </span>
          </React.Fragment>
        )
      })}

      {/* Active note segment — opens sibling picker */}
      <ToolTip text={currentSnippet.title || 'Untitled'} position="bottom">
        <button
          type="button"
          data-bc-key={currentSnippet.id}
          className={`breadcrumb-item active${dropdown?.activeSegmentKey === currentSnippet.id ? ' bc-open' : ''}`}
          onClick={(e) => {
            const lastFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null
            openDropdown(e, lastFolderId, currentSnippet.id, currentSnippet.id)
          }}
        >
          {renderActiveDocumentIcon(currentSnippet)}
          <span className="breadcrumb-title-text">{currentSnippet.title || 'Untitled'}</span>
        </button>
      </ToolTip>

      {/* Outline / Heading segment */}
      {activeHeading && (
        <>
          <span className="breadcrumb-separator" aria-hidden="true">
            <ChevronRight size={11} strokeWidth={1.75} />
          </span>
          <ToolTip text={`Section: ${activeHeading.text} (Click for outline)`} position="bottom">
            <button
              type="button"
              data-bc-key="__outline__"
              className={`breadcrumb-item breadcrumb-heading-item${outlineDropdown ? ' bc-open' : ''}`}
              onClick={openOutlineDropdown}
            >
              <Hash size={11} className="breadcrumb-icon is-heading" />
              <span className="breadcrumb-heading-text">{activeHeading.text}</span>
            </button>
          </ToolTip>
        </>
      )}

      {/* Copy path button */}
      <ToolTip text={copied ? 'Copied to clipboard!' : 'Copy note path'} position="bottom">
        <button
          type="button"
          className={`breadcrumb-copy-btn${copied ? ' copied' : ''}`}
          onClick={handleCopyPath}
          aria-label="Copy note path"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </ToolTip>

      {/* Folder Sibling Dropdown portal */}
      {dropdown && (
        <BreadcrumbDropdown
          key={dropdown.activeSegmentKey || dropdown.parentFolderId || '__root__'}
          parentFolderId={dropdown.parentFolderId}
          currentId={dropdown.currentId}
          anchorRect={dropdown.anchorRect}
          onClose={closeDropdown}
        />
      )}

      {/* Heading Outline Dropdown portal */}
      {outlineDropdown && (
        <BreadcrumbOutlineDropdown
          headings={headings}
          activeHeading={activeHeading}
          anchorRect={outlineDropdown.anchorRect}
          onClose={closeOutlineDropdown}
        />
      )}
    </nav>
  )
}

Breadcrumbs.displayName = 'Breadcrumbs'
export default React.memo(Breadcrumbs)
