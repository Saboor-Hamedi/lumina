/**
 * Shared workspace image/binary asset URL utilities.
 * Safely converts `window.api.readAsset()` responses (Uint8Array, ArrayBuffer,
 * legacy `{ dataUrl }` / `{ buffer }`, or base64 strings) into renderable URLs.
 */

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
  ico: 'image/x-icon'
}

export function inferImageMime(pathHint: string): string {
  const clean = String(pathHint || '').split('?')[0].split('#')[0]
  const ext = clean.split('.').pop()?.toLowerCase() || ''
  return IMAGE_MIME_BY_EXT[ext] || 'image/png'
}

export function decodeAssetPath(rawPath: string): string {
  let clean = String(rawPath || '')
    .trim()
    .replace(/^asset:\/\/local\//i, '')
    .replace(/^asset:\/\//i, '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')

  try {
    clean = decodeURIComponent(clean)
  } catch {
    // Keep as-is if the path contains a literal '%'
  }
  return clean
}

export function encodeMarkdownImageUrl(relativePath: string): string {
  return String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/ /g, '%20')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

export function assetResponseToUrl(
  res: unknown,
  pathHint: string
): { url: string; isObjectUrl: boolean } | null {
  if (!res) return null

  if (typeof res === 'string') {
    const trimmed = res.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
      return { url: trimmed, isObjectUrl: false }
    }
    return { url: `data:${inferImageMime(pathHint)};base64,${trimmed}`, isObjectUrl: false }
  }

  if (typeof res === 'object') {
    const obj = res as Record<string, any>
    if (typeof obj.dataUrl === 'string' && obj.dataUrl.length > 0) {
      return { url: obj.dataUrl, isObjectUrl: false }
    }

    if (res instanceof Uint8Array) {
      if (res.byteLength === 0) return null
      const copy = new Uint8Array(res.byteLength)
      copy.set(res)
      const blobUrl = URL.createObjectURL(new Blob([copy], { type: inferImageMime(pathHint) }))
      return { url: blobUrl, isObjectUrl: true }
    }

    if (res instanceof ArrayBuffer) {
      if (res.byteLength === 0) return null
      const blobUrl = URL.createObjectURL(new Blob([res], { type: inferImageMime(pathHint) }))
      return { url: blobUrl, isObjectUrl: true }
    }

    if (ArrayBuffer.isView(res)) {
      if (res.byteLength === 0) return null
      const view = new Uint8Array(res.buffer, res.byteOffset, res.byteLength)
      const copy = new Uint8Array(view.byteLength)
      copy.set(view)
      const blobUrl = URL.createObjectURL(new Blob([copy], { type: inferImageMime(pathHint) }))
      return { url: blobUrl, isObjectUrl: true }
    }

    if (obj.buffer) {
      const mime = typeof obj.mimeType === 'string' && obj.mimeType ? obj.mimeType : inferImageMime(pathHint)
      const buf = obj.buffer
      if (buf instanceof Uint8Array || buf instanceof ArrayBuffer) {
        if (buf.byteLength === 0) return null
        const blobUrl = URL.createObjectURL(new Blob([buf as BlobPart], { type: mime }))
        return { url: blobUrl, isObjectUrl: true }
      }
    }
  }

  return null
}
