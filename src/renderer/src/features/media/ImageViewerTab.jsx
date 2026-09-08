import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Copy,
  Check,
  FolderOpen,
  Image as ImageIcon
} from 'lucide-react'
import { copyImageToClipboard } from './hooks/imageClipboard'
import './css/imageViewTab.css'

export const ImageViewerTab = ({ snippet }) => {
  const relPath =
    snippet?.relativePath ||
    (snippet?.folderId ? `${snippet.folderId}/${snippet.fileName}` : snippet?.fileName)

  // Direct asset:// streaming URL (zero IPC base64 overhead)
  const assetUrl = React.useMemo(() => {
    if (!relPath) return null
    const clean = String(relPath).replace(/^[/\\]+/, '').replace(/\\/g, '/')
    const encodedSegments = clean.split('/').map(encodeURIComponent).join('/')
    return `asset://local/${encodedSegments}`
  }, [relPath])

  const [imageSrc, setImageSrc] = useState(() => assetUrl)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fallbackAttempted, setFallbackAttempted] = useState(false)
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dimensions, setDimensions] = useState(null)
  const [copied, setCopied] = useState(false)

  const containerRef = useRef(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const posStartRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!relPath) {
      setLoading(false)
      setError('Invalid file path')
      setImageSrc(null)
      return
    }

    setLoading(true)
    setError(null)
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setFallbackAttempted(false)
    setImageSrc(assetUrl)
  }, [relPath, assetUrl])

  const handleImageLoad = (e) => {
    setLoading(false)
    setDimensions({
      width: e.target.naturalWidth,
      height: e.target.naturalHeight
    })
  }

  const handleImageError = () => {
    // If protocol stream fails, gracefully fallback once to IPC readAsset
    if (!fallbackAttempted && window.api?.readAsset && relPath) {
      setFallbackAttempted(true)
      window.api.readAsset(relPath)
        .then((res) => {
          if (res?.dataUrl) {
            setImageSrc(res.dataUrl)
          } else if (res) {
            setImageSrc(`data:image/png;base64,${res}`)
          } else {
            setError('Failed to load image from workspace')
            setLoading(false)
          }
        })
        .catch((err) => {
          console.error('[ImageViewerTab] Fallback readAsset error:', err)
          setError('Failed to load image from workspace')
          setLoading(false)
        })
    } else {
      setError('Failed to load image from workspace')
      setLoading(false)
    }
  }

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(8, +(prev + 0.25).toFixed(2)))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.1, +(prev - 0.25).toFixed(2)))
  }, [])

  const handleResetZoom = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current || !dimensions) return
    const container = containerRef.current.getBoundingClientRect()
    const padding = 80
    const availWidth = container.width - padding
    const availHeight = container.height - padding
    const fitScale = Math.min(availWidth / dimensions.width, availHeight / dimensions.height, 1)
    setScale(+fitScale.toFixed(2))
    setPosition({ x: 0, y: 0 })
  }, [dimensions])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85
    setScale((prev) => {
      const next = +(prev * zoomFactor).toFixed(2)
      return Math.min(Math.max(next, 0.1), 8)
    })
  }, [])

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    posStartRef.current = { ...position }
  }, [position])

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      setPosition({
        x: posStartRef.current.x + dx,
        y: posStartRef.current.y + dy
      })
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleCopyImage = useCallback(() => {
    if (!imageSrc) return
    copyImageToClipboard(imageSrc, () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [imageSrc])

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
    <div
      ref={containerRef}
      className="image-viewer-container"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleResetZoom}
    >
      <div className="image-viewer-header-info">
        {dimensions && (
          <span className="image-viewer-badge">
            {dimensions.width} × {dimensions.height} px
          </span>
        )}
        {snippet?.size && (
          <span className="image-viewer-badge">{formatFileSize(snippet.size)}</span>
        )}
        {snippet?.ext && (
          <span className="image-viewer-badge uppercase">{snippet.ext.replace('.', '')}</span>
        )}
      </div>

      <div className="image-viewer-canvas">
        {loading && !imageSrc ? (
          <div className="image-viewer-loading">
            <ImageIcon size={28} className="image-viewer-spin-icon" />
            <span>Loading image...</span>
          </div>
        ) : error ? (
          <div className="image-viewer-error">{error}</div>
        ) : (
          <img
            src={imageSrc}
            alt={snippet?.title || 'Workspace Image'}
            className="image-viewer-img"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              cursor: isDragging ? 'grabbing' : 'grab',
              opacity: loading ? 0 : 1,
              transition: 'opacity 0.15s ease'
            }}
            draggable={false}
          />
        )}
      </div>

      <div className="image-viewer-toolbar" onMouseDown={(e) => e.stopPropagation()}>
        <button className="image-viewer-btn" title="Zoom Out" onClick={handleZoomOut}>
          <ZoomOut size={14} />
        </button>
        <span className="image-viewer-zoom-text" onClick={handleResetZoom} title="Reset zoom (100%)">
          {Math.round(scale * 100)}%
        </span>
        <button className="image-viewer-btn" title="Zoom In" onClick={handleZoomIn}>
          <ZoomIn size={14} />
        </button>
        <div className="image-viewer-divider" />
        <button className="image-viewer-btn" title="Fit to Screen" onClick={handleFitToScreen}>
          <Maximize2 size={14} />
        </button>
        <button className="image-viewer-btn" title="Reset View" onClick={handleResetZoom}>
          <RotateCcw size={14} />
        </button>
        <div className="image-viewer-divider" />
        <button
          className={`image-viewer-btn ${copied ? 'copied' : ''}`}
          title="Copy Image to Clipboard"
          onClick={handleCopyImage}
        >
          {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
        </button>
        <button
          className="image-viewer-btn"
          title="Open in System Explorer"
          onClick={handleOpenInFolder}
        >
          <FolderOpen size={14} />
        </button>
      </div>
    </div>
  )
}

export default React.memo(ImageViewerTab)
