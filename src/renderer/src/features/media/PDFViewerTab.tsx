import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { PulseLoader } from '../../components/PulseLoader'
import { ChromePdfIcon } from '../Icons/FileIcon'
import { useSettingsStore } from '../../core/store/SettingStore'
import { PDFToolbar, type PDFThemeMode } from './PDFToolbar'
import { usePdfIndexStatus } from './pdf'
import type { Snippet } from '../../core/editor/types'
import './css/pdfViewerTab.css'

export interface PDFViewerTabProps {
  snippet?: Partial<Snippet> | any
}

const LIGHT_APP_THEMES = new Set([
  'light',
  'porcelain',
  'rosePineDawn',
  'matchaLatte',
  'mintCondition'
])

/**
 * Maps Lumina's active workspace theme to the matching PDF page appearance.
 * - Light themes (`light`, `porcelain`, etc.) -> `'original'` (clean white pages)
 * - Warm vellum (`parchment`) -> `'sepia'`
 * - All dark themes -> `'dark'`
 */
function resolvePdfThemeFromApp(appTheme?: string): PDFThemeMode {
  if (!appTheme) return 'dark'
  if (appTheme === 'parchment') return 'sepia'
  if (LIGHT_APP_THEMES.has(appTheme)) return 'original'
  return 'dark'
}

/**
 * Module-level Blob URL cache.
 * Keyed by relativePath so switching between PDF tabs is 100% instant (0ms delay)
 * without re-fetching or re-decoding.
 */
const pdfBlobCache = new Map<string, string>()

export const PDFViewerTab: React.FC<PDFViewerTabProps> = ({ snippet }) => {
  const storeTheme = useSettingsStore((state) => state.settings?.theme)
  const activeDomTheme =
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-theme') || undefined
      : undefined
  const appTheme = storeTheme || activeDomTheme

  const relPath =
    snippet?.relativePath ||
    (snippet?.folderId ? `${snippet.folderId}/${snippet.fileName}` : snippet?.fileName)

  const indexStatus = usePdfIndexStatus(relPath)

  // Direct asset:// URL for zero-copy binary streaming fallback
  const assetUrl = useMemo(() => {
    if (!relPath) return null
    const clean = String(relPath).replace(/^[/\\]+/, '').replace(/\\/g, '/')
    const encodedSegments = clean.split('/').map(encodeURIComponent).join('/')
    return `asset://local/${encodedSegments}`
  }, [relPath])

  // If already cached, start with the cached blob URL immediately (0ms delay)
  const [blobUrl, setBlobUrl] = useState<string | null>(() =>
    relPath ? pdfBlobCache.get(relPath) || null : null
  )
  const [loading, setLoading] = useState<boolean>(() => !pdfBlobCache.has(relPath || ''))
  const [error, setError] = useState<string | null>(null)

  // Sync PDF reading surface with active app theme automatically; allow session override via toolbar
  const [theme, setTheme] = useState<PDFThemeMode>(() => resolvePdfThemeFromApp(appTheme))

  useEffect(() => {
    try {
      localStorage.removeItem('lumina-pdf-theme')
    } catch {
      // Ignore storage cleanup errors
    }
  }, [])

  useEffect(() => {
    setTheme(resolvePdfThemeFromApp(appTheme))
  }, [appTheme])

  useEffect(() => {
    const onThemeChanged = (e: Event) => {
      const nextThemeId = (e as CustomEvent<{ themeId?: string }>).detail?.themeId
      if (nextThemeId) {
        setTheme(resolvePdfThemeFromApp(nextThemeId))
      }
    }
    window.addEventListener('theme-changed', onThemeChanged)
    return () => window.removeEventListener('theme-changed', onThemeChanged)
  }, [])

  const handleSetTheme = useCallback((newTheme: PDFThemeMode) => {
    setTheme(newTheme)
  }, [])

  useEffect(() => {
    if (!relPath) {
      setError('Invalid file path')
      setLoading(false)
      return
    }

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
        const existingUrl = pdfBlobCache.get(relPath)
        if (existingUrl) {
          URL.revokeObjectURL(existingUrl)
          pdfBlobCache.delete(relPath)
        }

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

  const handleOpenInFolder = useCallback(() => {
    const relFolder = snippet?.folderId || ''
    const openFn = (window as any).api?.openWorkspaceFolder || (window as any).api?.openVaultFolder
    openFn?.(relFolder)
  }, [snippet?.folderId])

  return (
    <div className="pdf-viewer-container">
      {loading && (
        <div className="pdf-viewer-loading">
          <PulseLoader message="Loading document…" delayMs={0} />
        </div>
      )}

      {!loading && error && (
        <div className="pdf-viewer-error">
          <ChromePdfIcon size={28} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && blobUrl && (
        <div className={`pdf-viewer-frame-wrapper theme-${theme}`}>
          <iframe
            src={blobUrl}
            title={snippet?.title || 'PDF Document'}
            className="pdf-viewer-frame"
          />
        </div>
      )}

      <PDFToolbar
        snippet={snippet}
        onOpenInFolder={handleOpenInFolder}
        currentTheme={theme}
        onSetTheme={handleSetTheme}
        indexStatus={indexStatus}
      />
    </div>
  )
}

export default React.memo(PDFViewerTab)
