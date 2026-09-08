import React, { useState, useEffect, useCallback } from 'react'
import { FileText, FolderOpen, Loader } from 'lucide-react'
import './css/pdfViewerTab.css'

/**
 * PDFViewerTab
 *
 * Renders a workspace PDF file using Chromium's native PDF engine.
 * Flow:
 *   1. Calls `window.api.readAsset` to get the raw base64 from the main process.
 *   2. Converts base64 → Uint8Array → Blob (application/pdf).
 *   3. Creates a temporary blob URL and hands it to an <iframe>.
 *   4. Revokes the blob URL when the component unmounts or the file changes.
 *
 * Kept entirely separate from ImageViewerTab — no shared state or logic.
 */
export const PDFViewerTab = ({ snippet }) => {
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    let createdUrl = null

    setLoading(true)
    setError(null)
    setBlobUrl(null)

    // Resolve the relative path the same way ImageViewerTab does
    const relPath =
      snippet?.relativePath ||
      (snippet?.folderId ? `${snippet.folderId}/${snippet.fileName}` : snippet?.fileName)

    if (!relPath) {
      setError('Invalid file path')
      setLoading(false)
      return
    }

    window.api
      ?.readAsset?.(relPath)
      .then((res) => {
        if (!active) return

        const base64 = res?.base64
        if (!base64) {
          setError('Could not read PDF data')
          setLoading(false)
          return
        }

        // Decode base64 → binary → Blob so Chromium's PDF plugin can render it
        const binaryStr = atob(base64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i)
        }
        const blob = new Blob([bytes], { type: 'application/pdf' })
        createdUrl = URL.createObjectURL(blob)

        if (active) {
          setBlobUrl(createdUrl)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!active) return
        console.error('[PDFViewerTab] Failed to load PDF:', err)
        setError('Failed to load PDF from workspace')
        setLoading(false)
      })

    return () => {
      active = false
      // Always revoke the blob URL to avoid memory leaks
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [snippet?.relativePath, snippet?.folderId, snippet?.fileName])

  /** Open the containing folder in the system explorer */
  const handleOpenInFolder = useCallback(() => {
    const relFolder = snippet?.folderId || ''
    const openFn = window.api?.openWorkspaceFolder || window.api?.openVaultFolder
    openFn?.(relFolder)
  }, [snippet?.folderId])

  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="pdf-viewer-container">
      {/* Top-right info badges — file size and extension */}
      <div className="pdf-viewer-header-info">
        {snippet?.size && (
          <span className="pdf-viewer-badge">{formatFileSize(snippet.size)}</span>
        )}
        <span className="pdf-viewer-badge uppercase">PDF</span>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="pdf-viewer-loading">
          <Loader size={28} className="pdf-viewer-spin-icon" />
          <span>Loading PDF...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="pdf-viewer-error">
          <FileText size={28} />
          <span>{error}</span>
        </div>
      )}

      {/* Native Chromium PDF renderer via blob URL */}
      {!loading && !error && blobUrl && (
        <iframe
          src={blobUrl}
          title={snippet?.title || 'PDF Document'}
          className="pdf-viewer-frame"
        />
      )}

      {/* Floating toolbar — open in folder button */}
      <div className="pdf-viewer-toolbar">
        <button
          className="pdf-viewer-btn"
          title="Open Containing Folder"
          onClick={handleOpenInFolder}
        >
          <FolderOpen size={14} />
        </button>
      </div>
    </div>
  )
}

export default React.memo(PDFViewerTab)
