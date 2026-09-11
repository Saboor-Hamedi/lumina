import React, { useState, useCallback, useMemo } from 'react'
import { Folder, ChevronRight, FileText, Database, Copy, Check } from 'lucide-react'
import { useVaultStore } from '../../core/store/workspaceStore'
import ToolTip from '../../components/atoms/ToolTip'
import BreadcrumbDropdown from './BreadcrumbDropdown'
import { getFolderPath } from './breadcrumbUtils'
import './Breadcrumbs.css'

export const Breadcrumbs = ({ snippet, className = '' }) => {
  const folders = useVaultStore((state) => state.folders) || []
  const snippets = useVaultStore((state) => state.snippets) || []
  const selectedSnippet = useVaultStore((state) => state.selectedSnippet)
  const currentSnippet = snippet || selectedSnippet
  const [copied, setCopied] = useState(false)
  const [dropdown, setDropdown] = useState(null)

  if (!currentSnippet) return null
  if (Array.isArray(snippets) && snippets.length === 0 && !snippet) return null
  if (Array.isArray(snippets) && snippets.length > 0 && !snippets.some((s) => s.id === currentSnippet.id)) return null

  // Resolve hierarchical folder chain from root down to note's immediate folder
  const folderPath = useMemo(() => {
    return getFolderPath(currentSnippet.folderId, folders)
  }, [currentSnippet.folderId, folders])

  const openDropdown = useCallback((e, parentFolderId, currentId, activeSegmentKey) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setDropdown({
      parentFolderId: parentFolderId ?? null,
      currentId: currentId ?? null,
      activeSegmentKey,
      anchorRect: rect
    })
  }, [])

  const closeDropdown = useCallback(() => setDropdown(null), [])

  const handleCopyPath = useCallback(async (e) => {
    e.stopPropagation()
    const fullPath =
      currentSnippet.relativePath ||
      [...folderPath.map((f) => f.name), currentSnippet.title || 'Untitled'].join('/')
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullPath)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }, [currentSnippet, folderPath])

  const rootTargetId = folderPath[0]?.id ?? currentSnippet.id
  const isWorkspaceOpen = dropdown?.activeSegmentKey === '__workspace__'

  return (
    <nav className={`editor-breadcrumbs-bar ${className}`} aria-label="Breadcrumbs">
      {/* Workspace root button */}
      <ToolTip text="Browse workspace root" position="bottom">
        <button
          type="button"
          className={`breadcrumb-item${isWorkspaceOpen ? ' bc-open' : ''}`}
          onClick={(e) => openDropdown(e, null, rootTargetId, '__workspace__')}
        >
          <Database size={11.5} className="breadcrumb-icon" />
          <span>Workspace</span>
        </button>
      </ToolTip>

      <span className="breadcrumb-separator" aria-hidden="true">
        <ChevronRight size={11} />
      </span>

      {/* Hierarchical folder segments */}
      {folderPath.map((folder, index) => {
        const parentId = index > 0 ? folderPath[index - 1].id : null
        const isFolderOpen = dropdown?.activeSegmentKey === folder.id

        return (
          <React.Fragment key={folder.id || index}>
            <ToolTip text={`Folder: ${folder.name}`} position="bottom">
              <button
                type="button"
                className={`breadcrumb-item${isFolderOpen ? ' bc-open' : ''}`}
                onClick={(e) => openDropdown(e, parentId, folder.id, folder.id)}
              >
                <Folder size={11.5} className="breadcrumb-icon" />
                <span className="breadcrumb-folder-text">{folder.name}</span>
              </button>
            </ToolTip>
            <span className="breadcrumb-separator" aria-hidden="true">
              <ChevronRight size={11} />
            </span>
          </React.Fragment>
        )
      })}

      {/* Active note segment — opens sibling picker */}
      <ToolTip text={currentSnippet.title || 'Untitled'} position="bottom">
        <button
          type="button"
          className={`breadcrumb-item active${dropdown?.activeSegmentKey === currentSnippet.id ? ' bc-open' : ''}`}
          onClick={(e) => {
            const lastFolderId = folderPath.length > 0 ? folderPath[folderPath.length - 1].id : null
            openDropdown(e, lastFolderId, currentSnippet.id, currentSnippet.id)
          }}
        >
          <FileText size={11.5} className="breadcrumb-icon" />
          <span className="breadcrumb-title-text">{currentSnippet.title || 'Untitled'}</span>
        </button>
      </ToolTip>

      {/* Dedicated copy path button */}
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

      {/* Dropdown portal */}
      {dropdown && (
        <BreadcrumbDropdown
          parentFolderId={dropdown.parentFolderId}
          currentId={dropdown.currentId}
          anchorRect={dropdown.anchorRect}
          onClose={closeDropdown}
        />
      )}
    </nav>
  )
}

export default React.memo(Breadcrumbs)
