import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { FileText, FolderOpen, Loader } from 'lucide-react'
import './css/pdfViewerTab.css'

/**
 * Module-level Blob URL cache.
 * Keyed by relativePath so switching between PDF tabs is 100% instant (0ms delay)
 * without re-fetching or re-decoding.
 */
const pdfBlobCache = new Map()

/**
 * PDFViewerTab
 *
 * Renders workspace PDFs using Chromium's native PDF engine via blob URLs.
 * High-performance architecture:
 *   1. Checks in-memory cache for instant 0ms tab switching.
 *   2. Fetches binary directly via `asset://local/...` (zero IPC serialization overhead).
 *   3. Falls back gracefully to `window.api.readAsset` if needed.
 *   4. Feeds the blob URL to the <iframe> so Chromium renders it natively without
 *      triggering Windows external protocol dialogs.
 */
export const PDFViewerTab = ({ snippet }) => {
  const relPath =
    snippet?.relativePath ||
    (snippet?.folderId ? `${snippet.folderId}/${snippet.fileName}` : snippet?.fileName)

  // Direct asset:// URL for zero-copy binary streaming
  const assetUrl = useMemo(() => {
    if (!relPath) return null
    const clean = String(relPath).replace(/^[/\\]+/, '').replace(/\\/g, '/')
    const encodedSegments = clean.split('/').map(encodeURIComponent).join('/')
    return `asset://local/${encodedSegments}`
  }, [relPath])

  // If already cached, start with the cached blob URL immediately (0ms delay)
  const [blobUrl, setBlobUrl] = useState(() => (relPath ? pdfBlobCache.get(relPath) || null : null))
  const [loading, setLoading] = useState(() => !pdfBlobCache.has(relPath))
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!relPath) {
      setError('Invalid file path')
      setLoading(false)
      return
    }

    // Already cached — no work needed!
    if (pdfBlobCache.has(relPath)) {
      setBlobUrl(pdfBlobCache.get(relPath))
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    const loadBlob = async () => {
      let blob = null

      // Strategy 1: Fetch directly from custom asset:// protocol (zero-copy binary stream)
      if (assetUrl) {
        try {
          const res = await fetch(assetUrl)
          if (res.ok) {
            blob = await res.blob()
          }
        } catch {
          // Protocol fetch fallback
        }
      }

      // Strategy 2: Fallback to IPC readAsset if protocol is unavailable
      if (!blob && window.api?.readAsset) {
        try {
          const asset = await window.api.readAsset(relPath)
          if (asset?.base64) {
            const binary = atob(asset.base64)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            blob = new Blob([bytes], { type: 'application/pdf' })
          }
        } catch (err) {
          console.error('[PDFViewerTab] readAsset fallback error:', err)
        }
      }

      if (!active) return

      if (blob) {
        const url = URL.createObjectURL(blob)

        // Evict oldest entry if cache exceeds 15 PDFs to prevent memory leaks
        if (pdfBlobCache.size >= 15) {
          const oldestKey = pdfBlobCache.keys().next().value
          const oldUrl = pdfBlobCache.get(oldestKey)
          if (oldUrl) URL.revokeObjectURL(oldUrl)
          pdfBlobCache.delete(oldestKey)
        }

        pdfBlobCache.set(relPath, url)
        setBlobUrl(url)
        setLoading(false)
      } else {
        setError('Could not load PDF data')
        setLoading(false)
      }
    }

    loadBlob()

    return () => {
      active = false
    }
  }, [relPath, assetUrl])

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

      {/* Loading state (only shown on initial first fetch) */}
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

      {/* Native Chromium PDF iframe via Blob URL */}
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
