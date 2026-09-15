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

import React, { useState, useEffect } from 'react'
import { Image as ImageIcon } from 'lucide-react'

export interface CanvasImagePreviewProps {
  url?: string
  relativePath?: string
  title?: string
}

export const CanvasImagePreview: React.FC<CanvasImagePreviewProps> = ({
  url,
  relativePath,
  title
}) => {
  const [imgSrc, setImgSrc] = useState<string | undefined>(url)
  const [loadFailed, setLoadFailed] = useState(false)
  const [fallbackAttempted, setFallbackAttempted] = useState(false)

  useEffect(() => {
    setImgSrc(url)
    setLoadFailed(false)
    setFallbackAttempted(false)
  }, [url])

  const handleImageError = () => {
    // If protocol URL or initial URL fails, attempt IPC readAsset fallback
    const targetPath =
      relativePath ||
      (url && !url.startsWith('http') && !url.startsWith('data:')
        ? url.replace(/^asset:\/\/local\//, '')
        : null)

    if (!fallbackAttempted && targetPath && (window as any).api?.readAsset) {
      setFallbackAttempted(true)
      const cleanRel = decodeURIComponent(targetPath).replace(/^[/\\]+/, '')
      ;(window as any).api
        .readAsset(cleanRel)
        .then((res: any) => {
          if (res?.dataUrl) {
            setImgSrc(res.dataUrl)
          } else if (res?.buffer) {
            const blob = new Blob([res.buffer], { type: res.mimeType || 'image/png' })
            setImgSrc(URL.createObjectURL(blob))
          } else {
            setLoadFailed(true)
          }
        })
        .catch(() => {
          setLoadFailed(true)
        })
    } else {
      setLoadFailed(true)
    }
  }

  // Fallback placeholder card if image fails to resolve
  if (loadFailed || !imgSrc) {
    return (
      <div className="lumina-canvas-image-error">
        <ImageIcon size={32} color="var(--text-muted, #94a3b8)" />
        <span className="lumina-canvas-image-error-title">Image</span>
        <span className="lumina-canvas-image-error-hint">Could not load preview</span>
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
