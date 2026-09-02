import React from 'react'
import { Folder, ChevronRight, FileText, Database } from 'lucide-react'
import { useVaultStore } from '../../core/store/useVaultStore'
import ToolTip from '../../components/atoms/ToolTip'
import './Breadcrumbs.css'

export const Breadcrumbs = ({ snippet, className = '' }) => {
  const folders = useVaultStore((state) => state.folders)
  const currentSnippet = snippet || useVaultStore((state) => state.selectedSnippet)

  if (!currentSnippet) return null

  // Resolve folder hierarchy
  const folderPath = []
  let currentFolderId = currentSnippet.folderId

  while (currentFolderId && currentFolderId !== '/' && currentFolderId !== 'root') {
    const folderObj = folders?.find((f) => f.id === currentFolderId || f.name === currentFolderId)
    if (folderObj) {
      folderPath.unshift({ id: folderObj.id, name: folderObj.name })
      currentFolderId = folderObj.parentId
    } else {
      folderPath.unshift({ id: currentFolderId, name: currentFolderId })
      break
    }
  }

  const handleCopyPath = () => {
    const fullPath = [...folderPath.map((f) => f.name), currentSnippet.title || 'Untitled'].join('/')
    navigator.clipboard.writeText(fullPath)
  }

  return (
    <nav className={`editor-breadcrumbs-bar ${className}`} aria-label="Breadcrumbs">
      {/* Vault Root */}
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

      {/* Intermediate Folders */}
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

      {/* Current File */}
      <ToolTip text="Click to copy full path" position="bottom">
        <button
          type="button"
          className="breadcrumb-item active"
          onClick={handleCopyPath}
        >
          <FileText size={11.5} className="breadcrumb-icon" />
          <span>{currentSnippet.title || 'Untitled'}</span>
        </button>
      </ToolTip>
    </nav>
  )
}

export default React.memo(Breadcrumbs)
