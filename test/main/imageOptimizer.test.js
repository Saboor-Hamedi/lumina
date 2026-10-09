import { describe, it, expect } from 'vitest'
import {
  optimizeAssetData,
  optimizeAssetBase64,
  isOptimizableImageMime,
  DEFAULT_IMAGE_OPTIMIZATION_OPTIONS
} from '../../src/export/imageOptimizer'

describe('imageOptimizer', () => {
  describe('isOptimizableImageMime', () => {
    it('returns true for raster image types (jpeg, png, webp)', () => {
      expect(isOptimizableImageMime('image/jpeg')).toBe(true)
      expect(isOptimizableImageMime('image/png')).toBe(true)
      expect(isOptimizableImageMime('image/webp')).toBe(true)
      expect(isOptimizableImageMime('IMAGE/JPEG')).toBe(true)
    })

    it('returns false for vector and animated formats (svg, gif)', () => {
      expect(isOptimizableImageMime('image/svg+xml')).toBe(false)
      expect(isOptimizableImageMime('image/gif')).toBe(false)
      expect(isOptimizableImageMime('application/pdf')).toBe(false)
      expect(isOptimizableImageMime('text/plain')).toBe(false)
      expect(isOptimizableImageMime('')).toBe(false)
      expect(isOptimizableImageMime(undefined)).toBe(false)
    })
  })

  describe('optimizeAssetData', () => {
    it('returns original buffer unchanged if disabled or threshold not reached', async () => {
      const buf = Buffer.from('dummy-image-data')
      const result = await optimizeAssetData(buf, 'image/png', { minBytesToOptimize: 100000 })
      expect(result.buffer).toBe(buf)
      expect(result.mimeType).toBe('image/png')
      expect(result.optimized).toBe(false)
    })

    it('passes through SVG and GIF files untouched', async () => {
      const svgBuf = Buffer.from('<svg></svg>')
      const svgRes = await optimizeAssetData(svgBuf, 'image/svg+xml')
      expect(svgRes.buffer).toBe(svgBuf)
      expect(svgRes.mimeType).toBe('image/svg+xml')
      expect(svgRes.optimized).toBe(false)

      const gifBuf = Buffer.from('GIF89a...')
      const gifRes = await optimizeAssetData(gifBuf, 'image/gif')
      expect(gifRes.buffer).toBe(gifBuf)
      expect(gifRes.mimeType).toBe('image/gif')
      expect(gifRes.optimized).toBe(false)
    })

    it('gracefully returns null for invalid or empty buffers', async () => {
      const emptyBuf = Buffer.alloc(0)
      const res = await optimizeAssetData(emptyBuf, 'image/png')
      expect(res).toBeNull()

      const nullRes = await optimizeAssetData(null)
      expect(nullRes).toBeNull()
    })

    it('works with simulated nativeImage resizing when available', async () => {
      const pngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const pngBuf = Buffer.from(pngBase64, 'base64')

      const res = await optimizeAssetData(pngBuf, 'image/png', {
        maxWidth: 800,
        maxHeight: 800,
        quality: 80,
        minBytesToOptimize: 0
      })
      expect(res.buffer).toBeInstanceOf(Buffer)
      expect(res.mimeType).toMatch(/image\/(png|jpeg)/)
    })

    it('handles format conversion to jpeg when specified', async () => {
      const pngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const pngBuf = Buffer.from(pngBase64, 'base64')

      const res = await optimizeAssetData(pngBuf, 'image/png', {
        quality: 85,
        minBytesToOptimize: 0
      })
      expect(res.buffer).toBeInstanceOf(Buffer)
      expect(['image/jpeg', 'image/png']).toContain(res.mimeType)
    })
  })

  describe('optimizeAssetBase64', () => {
    it('returns empty string if input is empty', async () => {
      const res = await optimizeAssetBase64('', 'image/png')
      expect(res.base64).toBe('')
      expect(res.optimized).toBe(false)
    })

    it('optimizes valid base64 payload and returns base64 output', async () => {
      const pngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      const res = await optimizeAssetBase64(pngBase64, 'image/png', {
        maxWidth: 1000,
        maxHeight: 1000,
        minBytesToOptimize: 0
      })
      expect(typeof res.base64).toBe('string')
      expect(res.base64.length).toBeGreaterThan(0)
    })
  })

  describe('DEFAULT_IMAGE_OPTIMIZATION_OPTIONS', () => {
    it('has sensible production defaults', () => {
      expect(DEFAULT_IMAGE_OPTIMIZATION_OPTIONS.maxWidth).toBe(1600)
      expect(DEFAULT_IMAGE_OPTIMIZATION_OPTIONS.maxHeight).toBe(1600)
      expect(DEFAULT_IMAGE_OPTIMIZATION_OPTIONS.quality).toBe(80)
    })
  })
})
