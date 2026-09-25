/**
 * ============================================================================
 * Lumina Canvas Image Preview
 * ============================================================================
 * Resilient image renderer for canvas cards supporting:
 * - Data URLs (base64 from local machine drag-and-drop)
 * - Custom asset protocol (`asset://local/...` from workspace media)
 * - Standard web URLs (`http://`, `https://`)
 * - Automatic IPC fallback via `window.api.readAsset()` if protocol loading fails
 * - Clean error placeholder with title if the image is missing or corrupted
 * ============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { useWorkspaceStore } from '../../../../core/store/workspaceStore'

export interface CanvasImagePreviewProps {
  url?: string
  relativePath?: string
  title?: string
}

function resolveCandidateSrc(url?: string, relativePath?: string): string | undefined {
  const candidate = (url && url.trim()) || (relativePath && relativePath.trim())
  if (!candidate) return undefined

  if (
    candidate.startsWith('data:') ||
    candidate.startsWith('http://') ||
    candidate.startsWith('https://') ||
    candidate.startsWith('asset://') ||
    candidate.startsWith('file://')
  ) {
    return candidate
  }

  // Windows absolute file path (e.g. C:\... or B:\...)
  if (/^[a-zA-Z]:[\\/]/.test(candidate)) {
    return `file:///${candidate.replace(/\\/g, '/')}`
  }

  // If candidate is a snippet ID, do not try asset:// with snippet id
  if (candidate.startsWith('snippet-')) {
    return undefined
  }

  // Relative workspace path: prefix with asset://local/
  const clean = candidate.replace(/^[/\\]+/, '').replace(/\\/g, '/')
  return `asset://local/${encodeURI(clean)}`
}

function resolveCleanRelPath(relativePath?: string, url?: string): string {
  let target = (relativePath && relativePath.trim()) || (url && url.trim()) || ''
  if (!target) return ''

  target = target
    .replace(/^asset:\/\/local\//, '')
    .replace(/^asset:\/\//, '')
    .replace(/^file:\/\/\//, '')
    .replace(/^[/\\]+/, '')
    .replace(/\\/g, '/')

  if (target.startsWith('snippet-')) {
    const storeNotes =
      (useWorkspaceStore as any)?.getState?.()?.notes ||
      (useWorkspaceStore as any)?.getState?.()?.snippets ||
      []
    const found = storeNotes.find((n: any) => n.id === target)
    if (found?.relativePath) {
      target = found.relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/')
    }
  }

  return target
}

export const CanvasImagePreview: React.FC<CanvasImagePreviewProps> = ({
  url,
  relativePath,
  title
}) => {
  const [imgSrc, setImgSrc] = useState<string | undefined>(() => resolveCandidateSrc(url, relativePath))
  const [loadFailed, setLoadFailed] = useState(false)
  const [fallbackAttempted, setFallbackAttempted] = useState(false)

  const attemptIpcFallback = useCallback((cleanRel: string) => {
    if (!cleanRel || !(window as any).api?.readAsset) {
      setLoadFailed(true)
      return
    }

    setFallbackAttempted(true)
    const decodedRel = decodeURIComponent(cleanRel)
    ;(window as any).api
      .readAsset(decodedRel)
      .then((res: any) => {
        if (res?.dataUrl) {
          setImgSrc(res.dataUrl)
          setLoadFailed(false)
        } else if (res?.buffer) {
          const blob = new Blob([res.buffer], { type: res.mimeType || 'image/png' })
          setImgSrc(URL.createObjectURL(blob))
          setLoadFailed(false)
        } else if (typeof res === 'string') {
          setImgSrc(res.startsWith('data:') ? res : `data:image/png;base64,${res}`)
          setLoadFailed(false)
        } else {
          setLoadFailed(true)
        }
      })
      .catch(() => {
        setLoadFailed(true)
      })
  }, [])

  useEffect(() => {
    const initial = resolveCandidateSrc(url, relativePath)
    setImgSrc(initial)
    setFallbackAttempted(false)

    if (initial) {
      setLoadFailed(false)
    } else {
      // If initial URL cannot be formed directly (e.g. snippet ID or custom path), try readAsset immediately
      const cleanRel = resolveCleanRelPath(relativePath, url)
      if (cleanRel && (window as any).api?.readAsset) {
        attemptIpcFallback(cleanRel)
      } else {
        setLoadFailed(true)
      }
    }
  }, [url, relativePath, attemptIpcFallback])

  const handleImageError = () => {
    if (!fallbackAttempted) {
      const cleanRel = resolveCleanRelPath(relativePath, url)
      if (cleanRel) {
        attemptIpcFallback(cleanRel)
        return
      }
    }
    setLoadFailed(true)
  }

  // Fallback placeholder card if image fails to resolve
  if (loadFailed || !imgSrc) {
    return (
      <div className="lumina-canvas-image-error">
        <ImageIcon size={28} className="lumina-canvas-image-error-icon" color="var(--text-muted, #6B6559)" />
        <span className="lumina-canvas-image-error-title">Image unavailable</span>
        <button
          type="button"
          className="lumina-canvas-image-retry-btn"
          onClick={(e) => {
            e.stopPropagation()
            setFallbackAttempted(false)
            setLoadFailed(false)
            const cleanRel = resolveCleanRelPath(relativePath, url)
            if (cleanRel) {
              attemptIpcFallback(cleanRel)
            } else {
              const retrySrc = resolveCandidateSrc(url, relativePath)
              setImgSrc(retrySrc)
            }
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="lumina-canvas-node-image-wrap">
      <img
        src={imgSrc}
        alt={title || 'Canvas Image'}
        draggable={false}
        onError={handleImageError}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          userSelect: 'none',
          pointerEvents: 'none'
        }}
      />
    </div>
  )
}

export default React.memo(CanvasImagePreview)
