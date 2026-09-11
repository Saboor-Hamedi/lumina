import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { FileText, Loader } from 'lucide-react'
import { PDFToolbar } from './PDFToolbar'
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
          if (asset?.buffer) {
            // Direct zero-copy binary buffer without string serialization overhead
            blob = new Blob([asset.buffer], { type: 'application/pdf' })
          } else if (asset?.base64) {
            // Efficient base64 to Uint8Array decoding fallback
            const binary = atob(asset.base64)
            const len = binary.length
            const bytes = new Uint8Array(len)
            for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
            blob = new Blob([bytes], { type: 'application/pdf' })
          }
        } catch (err) {
          console.error('[PDFViewerTab] readAsset fallback error:', err)
        }
      }

      if (!active) return

      if (blob) {
        // Revoke any previous URL for the same path
        const existingUrl = pdfBlobCache.get(relPath)
        if (existingUrl) {
          URL.revokeObjectURL(existingUrl)
          pdfBlobCache.delete(relPath)
        }

        // Evict oldest entries if cache exceeds 6 PDFs to prevent memory bloat
        while (pdfBlobCache.size >= 6) {
          const oldestKey = pdfBlobCache.keys().next().value
          const oldUrl = pdfBlobCache.get(oldestKey)
          if (oldUrl) URL.revokeObjectURL(oldUrl)
          pdfBlobCache.delete(oldestKey)
        }

        const url = URL.createObjectURL(blob)
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

  return (
    <div className="pdf-viewer-container">
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

      {/* Floating toolbar — open/close expandable panel */}
      <PDFToolbar snippet={snippet} onOpenInFolder={handleOpenInFolder} />
    </div>
  )
}

export default React.memo(PDFViewerTab)
