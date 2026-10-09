/**
 * ============================================================================
 * Image Optimizer (`imageOptimizer.ts`)
 * ============================================================================
 * High-performance image optimization for document and bundle exports.
 * 
 * Features:
 *  - Native Skia hardware-accelerated resizing via Electron's nativeImage.
 *  - Aspect ratio preservation with high-quality resampling.
 *  - Configurable max dimensions (default 1600px width/height).
 *  - High-efficiency compression for JPEG/PNG/WebP.
 *  - Graceful fallback in non-Electron / test environments.
 *  - Skips vector formats (SVG) and animations (GIF).
 * ============================================================================
 */

export interface ImageOptimizationOptions {
  /** Maximum image width in pixels. Default: 1600 */
  maxWidth?: number
  /** Maximum image height in pixels. Default: 1600 */
  maxHeight?: number
  /** JPEG/WebP compression quality (1-100). Default: 80 */
  quality?: number
  /** If the resulting optimized buffer is larger than original, keep original. Default: true */
  alwaysKeepSmallest?: boolean
  /** Minimum byte size before optimization is attempted (skip tiny icons). Default: 16KB */
  minBytesToOptimize?: number
}

export interface OptimizedImageResult {
  buffer: Buffer
  mimeType: string
  width?: number
  height?: number
  originalSize: number
  optimizedSize: number
  optimized: boolean
  dataUrl?: string
}

export const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 80,
  alwaysKeepSmallest: true,
  minBytesToOptimize: 16 * 1024 // 16 KB
}
export const DEFAULT_IMAGE_OPTIMIZATION_OPTIONS = DEFAULT_OPTIONS

/**
 * Dynamically resolves Electron's nativeImage if running in an Electron process.
 */
function getNativeImage(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron')
    return electron.nativeImage || null
  } catch {
    return null
  }
}

/**
 * Checks if a MIME type is a vector or animated format that should not be raster-compressed.
 */
export function isPassthroughFormat(mimeType: string): boolean {
  const lower = String(mimeType || '').toLowerCase()
  return lower.includes('svg') || lower.includes('gif')
}

/**
 * Optimizes an image Buffer according to provided options.
 * If nativeImage is unavailable or image is already smaller than min threshold,
 * returns the original buffer safely.
 */
export function optimizeImageBuffer(
  inputBuffer: Buffer,
  mimeType = 'image/png',
  options: ImageOptimizationOptions = {}
): OptimizedImageResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const originalSize = inputBuffer.length

  const defaultResult: OptimizedImageResult = {
    buffer: inputBuffer,
    mimeType,
    originalSize,
    optimizedSize: originalSize,
    optimized: false
  }

  // Skip SVGs, animated GIFs, or tiny icons
  if (isPassthroughFormat(mimeType) || originalSize < opts.minBytesToOptimize) {
    return defaultResult
  }

  const nativeImage = getNativeImage()
  if (!nativeImage) {
    return defaultResult
  }

  try {
    const img = nativeImage.createFromBuffer(inputBuffer)
    if (!img || img.isEmpty()) {
      return defaultResult
    }

    const { width, height } = img.getSize()
    if (!width || !height) {
      return defaultResult
    }

    let targetWidth = width
    let targetHeight = height
    let needsResize = false

    // Maintain aspect ratio while fitting within maxWidth / maxHeight
    if (targetWidth > opts.maxWidth) {
      targetHeight = Math.round((targetHeight * opts.maxWidth) / targetWidth)
      targetWidth = opts.maxWidth
      needsResize = true
    }
    if (targetHeight > opts.maxHeight) {
      targetWidth = Math.round((targetWidth * opts.maxHeight) / targetHeight)
      targetHeight = opts.maxHeight
      needsResize = true
    }

    let processedImg = img
    if (needsResize) {
      processedImg = img.resize({
        width: targetWidth,
        height: targetHeight,
        quality: 'better'
      })
    }

    const lowerMime = mimeType.toLowerCase()
    let outBuffer: Buffer
    let outMime = mimeType

    if (lowerMime === 'image/jpeg' || lowerMime === 'image/jpg') {
      outBuffer = processedImg.toJPEG(opts.quality)
      outMime = 'image/jpeg'
    } else {
      // For PNG / WebP / BMP
      if (needsResize) {
        outBuffer = processedImg.toPNG()
      } else {
        // If not resized, check if JPEG conversion gives major savings
        outBuffer = processedImg.toPNG()
      }
    }

    // Guard: if optimized is larger, revert to original
    if (opts.alwaysKeepSmallest && outBuffer.length >= originalSize) {
      return {
        buffer: inputBuffer,
        mimeType,
        width,
        height,
        originalSize,
        optimizedSize: originalSize,
        optimized: false
      }
    }

    return {
      buffer: outBuffer,
      mimeType: outMime,
      width: targetWidth,
      height: targetHeight,
      originalSize,
      optimizedSize: outBuffer.length,
      optimized: true
    }
  } catch (err) {
    console.warn('[ImageOptimizer] Optimization failed, using original:', err)
    return defaultResult
  }
}

/**
 * Optimizes an asset representation (Buffer, ReadAssetResult, or data URL)
 * and returns both the optimized buffer and data URL.
 */
export function optimizeAssetData(
  asset: any,
  fallbackMime = 'image/png',
  options: ImageOptimizationOptions = {}
): OptimizedImageResult | null {
  if (!asset) return null

  let buffer: Buffer | null = null
  let mime = fallbackMime

  if (Buffer.isBuffer(asset)) {
    buffer = asset
  } else if (typeof asset === 'string') {
    if (asset.startsWith('data:')) {
      const match = asset.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mime = match[1]
        buffer = Buffer.from(match[2], 'base64')
      }
    } else {
      buffer = Buffer.from(asset, 'base64')
    }
  } else if (typeof asset === 'object') {
    mime = asset.mimeType || fallbackMime
    if (asset.buffer) {
      buffer = Buffer.isBuffer(asset.buffer) ? asset.buffer : Buffer.from(asset.buffer)
    } else if (asset.base64) {
      buffer = Buffer.from(asset.base64, 'base64')
    } else if (asset.dataUrl && typeof asset.dataUrl === 'string') {
      const match = asset.dataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mime = match[1]
        buffer = Buffer.from(match[2], 'base64')
      }
    }
  }

  if (!buffer || buffer.length === 0) return null

  const result = optimizeImageBuffer(buffer, mime, options)
  result.dataUrl = `data:${result.mimeType};base64,${result.buffer.toString('base64')}`
  return result
}

/**
 * Checks if a MIME type can be meaningfully raster-optimized.
 */
export function isOptimizableImageMime(mimeType?: string | null): boolean {
  if (!mimeType) return false
  const lower = mimeType.toLowerCase()
  if (isPassthroughFormat(lower)) return false
  return (
    lower.startsWith('image/jpeg') ||
    lower.startsWith('image/jpg') ||
    lower.startsWith('image/png') ||
    lower.startsWith('image/webp')
  )
}

/**
 * Optimizes a base64-encoded image string and returns an updated base64 string.
 */
export function optimizeAssetBase64(
  base64String: string,
  fallbackMime = 'image/png',
  options: ImageOptimizationOptions = {}
): { base64: string; mimeType: string; optimized: boolean } {
  if (!base64String) {
    return { base64: '', mimeType: fallbackMime, optimized: false }
  }
  const result = optimizeAssetData(base64String, fallbackMime, options)
  if (!result || !result.buffer) {
    return { base64: base64String, mimeType: fallbackMime, optimized: false }
  }
  return {
    base64: result.buffer.toString('base64'),
    mimeType: result.mimeType,
    optimized: result.optimized
  }
}

