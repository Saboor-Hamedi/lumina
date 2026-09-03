import React, { useState, useCallback } from 'react'
import { Folder, ChevronRight, FileText, Database, Check } from 'lucide-react'
import { useVaultStore } from '../../core/store/workspaceStore'
import ToolTip from '../../components/atoms/ToolTip'
import './Breadcrumbs.css'

export const Breadcrumbs = ({ snippet, className = '' }) => {
  const folders = useVaultStore((state) => state.folders)
  const snippets = useVaultStore((state) => state.snippets) || []
  const selectedSnippet = useVaultStore((state) => state.selectedSnippet)
  const currentSnippet = snippet || selectedSnippet
  const [copied, setCopied] = useState(false)

  if (!currentSnippet) return null
  if (Array.isArray(snippets) && snippets.length === 0 && !snippet) return null
  if (Array.isArray(snippets) && snippets.length > 0 && !snippets.some((s) => s.id === currentSnippet.id)) return null

  const folderPath = []
  let currentFolderId = currentSnippet.folderId
  const visited = new Set()
  let depth = 0

  while (
    currentFolderId &&
    currentFolderId !== '/' &&
    currentFolderId !== 'root' &&
    !visited.has(currentFolderId) &&
    depth < 50
  ) {
    visited.add(currentFolderId)
    depth++
    const folderObj = folders?.find((f) => f.id === currentFolderId || f.name === currentFolderId)
    if (folderObj) {
      folderPath.unshift({ id: folderObj.id, name: folderObj.name })
      currentFolderId = folderObj.parentId
    } else {
      folderPath.unshift({ id: currentFolderId, name: currentFolderId })
      break
    }
  }

  const handleCopyPath = useCallback(async () => {
    const fullPath =
      currentSnippet.relativePath ||
      [...folderPath.map((f) => f.name), currentSnippet.title || 'Untitled'].join('/')

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullPath)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      console.error('Failed to copy path:', err)
    }
  }, [currentSnippet, folderPath])

  return (
    <nav className={`editor-breadcrumbs-bar ${className}`} aria-label="Breadcrumbs">
      <ToolTip text="Vault Root" position="bottom">
        <button
          type="button"
          className="breadcrumb-item"
          onClick={() => window.dispatchEvent(new CustomEvent('focus-explorer-root'))}
        >
          <Database size={11.5} className="breadcrumb-icon" />
          <span>Vault</span>
        </button>
      </ToolTip>

      <span className="breadcrumb-separator" aria-hidden="true">
        <ChevronRight size={11} />
      </span>

      {folderPath.map((folder, index) => (
        <React.Fragment key={folder.id || index}>
          <ToolTip text={`Folder: ${folder.name}`} position="bottom">
            <button
              type="button"
              className="breadcrumb-item"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('reveal-folder-in-explorer', { detail: folder.id })
                )
              }}
            >
              <Folder size={11.5} className="breadcrumb-icon" />
              <span>{folder.name}</span>
            </button>
          </ToolTip>
          <span className="breadcrumb-separator" aria-hidden="true">
            <ChevronRight size={11} />
          </span>
        </React.Fragment>
      ))}

      <ToolTip text={copied ? 'Copied to clipboard!' : 'Click to copy path'} position="bottom">
        <button
          type="button"
          className={`breadcrumb-item active ${copied ? 'copied' : ''}`}
          onClick={handleCopyPath}
        >
          {copied ? (
            <Check size={11.5} className="breadcrumb-icon" />
          ) : (
            <FileText size={11.5} className="breadcrumb-icon" />
          )}
          <span>{currentSnippet.title || 'Untitled'}</span>
        </button>
      </ToolTip>
    </nav>
  )
}

export default React.memo(Breadcrumbs)
