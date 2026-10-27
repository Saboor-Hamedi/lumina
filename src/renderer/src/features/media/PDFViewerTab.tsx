import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Loader } from 'lucide-react'
import { ChromePdfIcon } from '../Icons/FileIcon'
import { PDFToolbar, type PDFThemeMode } from './PDFToolbar'
import type { Snippet } from '../../core/editor/types'
import './css/pdfViewerTab.css'

export interface PDFViewerTabProps {
  snippet?: Partial<Snippet> | any
}

/**
 * Module-level Blob URL cache.
 * Keyed by relativePath so switching between PDF tabs is 100% instant (0ms delay)
 * without re-fetching or re-decoding.
 */
const pdfBlobCache = new Map<string, string>()

/**
 * PDFViewerTab
 *
 * Renders workspace PDFs using Chromium's native PDF engine via blob URLs.
 * High-performance architecture:
 *   1. Checks in-memory cache for instant 0ms tab switching.
 *   2. Reads binary directly via Electron IPC `window.api.readAsset`.
 *   3. Falls back gracefully to `fetch(assetUrl)` if IPC is unavailable.
 *   4. Feeds the blob URL to the <iframe> so Chromium renders it natively with
 *      all its native toolbar features (zoom, download, print, page navigation).
 *   5. Wraps the native viewer in customizable reading themes (Original, Dark, Sepia)
 *      controlled via the bottom-right floating pill toolbar with zero screen clutter.
 */
export const PDFViewerTab: React.FC<PDFViewerTabProps> = ({ snippet }) => {
  const relPath =
    snippet?.relativePath ||
    (snippet?.folderId ? `${snippet.folderId}/${snippet.fileName}` : snippet?.fileName)

  // Direct asset:// URL for zero-copy binary streaming fallback
  const assetUrl = useMemo(() => {
    if (!relPath) return null
    const clean = String(relPath).replace(/^[/\\]+/, '').replace(/\\/g, '/')
    const encodedSegments = clean.split('/').map(encodeURIComponent).join('/')
    return `asset://local/${encodedSegments}`
  }, [relPath])

  // If already cached, start with the cached blob URL immediately (0ms delay)
  const [blobUrl, setBlobUrl] = useState<string | null>(() => (relPath ? pdfBlobCache.get(relPath) || null : null))
  const [loading, setLoading] = useState<boolean>(() => !pdfBlobCache.has(relPath || ''))
  const [error, setError] = useState<string | null>(null)

  // Preferred viewing theme mode: original, dark, sepia (defaults to dark to match theme)
  const [theme, setTheme] = useState<PDFThemeMode>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('lumina-pdf-theme') : null
    if (saved === 'dark' || saved === 'sepia' || saved === 'original') {
      return saved
    }
    return 'dark'
  })

  const handleSetTheme = useCallback((newTheme: PDFThemeMode) => {
    setTheme(newTheme)
    try {
      localStorage.setItem('lumina-pdf-theme', newTheme)
    } catch {}
  }, [])

  useEffect(() => {
    if (!relPath) {
      setError('Invalid file path')
      setLoading(false)
      return
    }

    // Already cached — no work needed!
    if (pdfBlobCache.has(relPath)) {
      setBlobUrl(pdfBlobCache.get(relPath) || null)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    const loadBlob = async () => {
      let blob: Blob | null = null

      // Strategy 1: Direct IPC readAsset (fastest, zero web-fetch scheme restriction)
      if ((window as any).api?.readAsset) {
        try {
          const asset = await (window as any).api.readAsset(relPath)
          if (asset?.buffer) {
            blob = new Blob([asset.buffer], { type: 'application/pdf' })
          } else if (asset?.base64) {
            const binary = atob(asset.base64)
            const len = binary.length
            const bytes = new Uint8Array(len)
            for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
            blob = new Blob([bytes], { type: 'application/pdf' })
          }
        } catch (err) {
          console.warn('[PDFViewerTab] readAsset IPC error:', err)
        }
      }

      // Strategy 2: Fallback to custom asset:// protocol fetch if IPC was unavailable or failed
      if (!blob && assetUrl) {
        try {
          const res = await fetch(assetUrl)
          if (res.ok) {
            blob = await res.blob()
          }
        } catch (fetchErr) {
          console.warn('[PDFViewerTab] asset protocol fetch error:', fetchErr)
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
          if (oldestKey) {
            const oldUrl = pdfBlobCache.get(oldestKey)
            if (oldUrl) URL.revokeObjectURL(oldUrl)
            pdfBlobCache.delete(oldestKey)
          }
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
    const openFn = (window as any).api?.openWorkspaceFolder || (window as any).api?.openVaultFolder
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
          <ChromePdfIcon size={28} />
          <span>{error}</span>
        </div>
      )}

      {/* Native Chromium PDF iframe via Blob URL wrapped with dynamic theme filter */}
      {!loading && !error && blobUrl && (
        <div className={`pdf-viewer-frame-wrapper theme-${theme}`}>
          <iframe
            src={blobUrl}
            title={snippet?.title || 'PDF Document'}
            className="pdf-viewer-frame"
          />
        </div>
      )}

      {/* Floating toolbar — open/close expandable panel with theme selector in the bottom right */}
      <PDFToolbar
        snippet={snippet}
        onOpenInFolder={handleOpenInFolder}
        currentTheme={theme}
        onSetTheme={handleSetTheme}
      />
    </div>
  )
}

export default React.memo(PDFViewerTab)
