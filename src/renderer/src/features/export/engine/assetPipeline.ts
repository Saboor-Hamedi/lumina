import { invoke } from '@tauri-apps/api/core'
import { safeFileName, type CollectedLocalAsset } from './types'

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif'
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length))
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

function normalizeAssetRelativePath(rawUrl: string): string | null {
  let clean = String(rawUrl || '').trim()
  if (!clean) return null
  if (/^(https?:|data:|blob:|mailto:|#)/i.test(clean)) return null
  if (clean.startsWith('<') && clean.endsWith('>')) clean = clean.slice(1, -1).trim()
  if (clean.startsWith('asset://local/')) clean = clean.slice('asset://local/'.length)
  else if (clean.startsWith('asset://')) clean = clean.replace(/^asset:\/\//, '')
  else if (clean.startsWith('http://asset.localhost/'))
    clean = clean.slice('http://asset.localhost/'.length)
  else if (clean.startsWith('https://asset.localhost/'))
    clean = clean.slice('https://asset.localhost/'.length)

  clean = clean.split('#')[0].split('?')[0].replace(/\\/g, '/').replace(/^\/+/, '')
  try {
    clean = decodeURIComponent(clean)
  } catch {
    /* keep raw string if malformed URI */
  }
  return clean || null
}

function inferMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return MIME_BY_EXT[ext] || 'image/png'
}

async function readWorkspaceAssetBytes(relativePath: string): Promise<Uint8Array | null> {
  try {
    const api = (typeof window !== 'undefined' ? (window as any).api : null) as any
    if (typeof api?.readAsset === 'function') {
      const res = await api.readAsset(relativePath)
      if (res instanceof Uint8Array && res.length > 0) return res
      if (res instanceof ArrayBuffer && res.byteLength > 0) return new Uint8Array(res)
      if (ArrayBuffer.isView(res) && res.byteLength > 0) {
        return new Uint8Array(res.buffer, res.byteOffset, res.byteLength)
      }
      if (Array.isArray(res) && res.length > 0) return new Uint8Array(res)
    }
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      const raw = await invoke<unknown>('read_asset_bytes', { relativePath })
      const bytes =
        raw instanceof Uint8Array
          ? raw
          : raw instanceof ArrayBuffer
            ? new Uint8Array(raw)
            : ArrayBuffer.isView(raw)
              ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
              : Array.isArray(raw)
                ? new Uint8Array(raw)
                : null
      if (bytes && bytes.length > 0) {
        return bytes
      }
    }
  } catch {
    /* ignore missing or unreadable local asset */
  }
  return null
}

async function optimizeImageBytes(
  bytes: Uint8Array,
  mime: string
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return { bytes, mime }
  }
  if (mime === 'image/svg+xml' || mime === 'image/gif' || bytes.length < 32 * 1024) {
    return { bytes, mime }
  }

  try {
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const blob = new Blob([copy.buffer], { type: mime })
    const objectUrl = URL.createObjectURL(blob)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Image load failed'))
        img.src = objectUrl
      })

      const maxDim = 1600
      const srcW = img.naturalWidth || img.width
      const srcH = img.naturalHeight || img.height
      if (!srcW || !srcH) return { bytes, mime }

      let targetW = srcW
      let targetH = srcH
      if (srcW > maxDim || srcH > maxDim) {
        const ratio = Math.min(maxDim / srcW, maxDim / srcH)
        targetW = Math.max(1, Math.round(srcW * ratio))
        targetH = Math.max(1, Math.round(srcH * ratio))
      } else if (bytes.length < 250 * 1024) {
        return { bytes, mime }
      }

      const canvas = document.createElement('canvas')
      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')
      if (!ctx) return { bytes, mime }
      ctx.drawImage(img, 0, 0, targetW, targetH)

      const outMime = mime === 'image/jpeg' ? 'image/jpeg' : 'image/png'
      const outBlob = await new Promise<Blob | null>((resolve) => {
        if (typeof canvas.toBlob !== 'function') {
          resolve(null)
          return
        }
        canvas.toBlob(resolve, outMime, outMime === 'image/jpeg' ? 0.86 : undefined)
      })
      if (!outBlob) return { bytes, mime }

      const outBuf = new Uint8Array(await outBlob.arrayBuffer())
      if (outBuf.length > 0 && outBuf.length < bytes.length) {
        return { bytes: outBuf, mime: outMime }
      }
      return { bytes, mime }
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    return { bytes, mime }
  }
}

export async function collectLocalAssets(
  markdown: string,
  optimizeImages: boolean
): Promise<CollectedLocalAsset[]> {
  const urls = new Set<string>()
  const mdRegex = /!\[[^\]]*\]\(([^)]+)\)/g
  for (const m of markdown.matchAll(mdRegex)) {
    if (m[1]) urls.add(m[1].trim())
  }
  const htmlRegex = /<img\b[^>]*\bsrc\s*=\s*(["'])([^"']+)\1/gi
  for (const m of markdown.matchAll(htmlRegex)) {
    if (m[2]) urls.add(m[2].trim())
  }

  const assets: CollectedLocalAsset[] = []
  const usedNames = new Set<string>()

  for (const rawUrl of urls) {
    const relPath = normalizeAssetRelativePath(rawUrl)
    if (!relPath) continue
    const rawBytes = await readWorkspaceAssetBytes(relPath)
    if (!rawBytes) continue

    const mime = inferMimeType(relPath)
    const processed = optimizeImages
      ? await optimizeImageBytes(rawBytes, mime)
      : { bytes: rawBytes, mime }

    const baseName = relPath.split('/').pop() || 'asset.png'
    let uniqueName = safeFileName(baseName)
    let counter = 1
    while (usedNames.has(uniqueName.toLowerCase())) {
      const dot = baseName.lastIndexOf('.')
      const stem = dot > 0 ? baseName.slice(0, dot) : baseName
      const ext = dot > 0 ? baseName.slice(dot) : ''
      uniqueName = `${safeFileName(stem)}_${counter}${ext}`
      counter += 1
    }
    usedNames.add(uniqueName.toLowerCase())

    assets.push({
      originalUrl: rawUrl,
      relativePath: relPath,
      filename: uniqueName,
      mime: processed.mime,
      bytes: processed.bytes
    })
  }

  return assets
}

export async function embedImagesAsDataUri(
  markdown: string,
  optimizeImages: boolean
): Promise<string> {
  const assets = await collectLocalAssets(markdown, optimizeImages)
  if (assets.length === 0) return markdown

  const dataUriMap = new Map<string, string>()
  for (const asset of assets) {
    dataUriMap.set(asset.originalUrl, `data:${asset.mime};base64,${uint8ToBase64(asset.bytes)}`)
  }

  let out = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, url) => {
    const uri = dataUriMap.get(String(url).trim())
    return uri ? `![${alt}](${uri})` : full
  })

  out = out.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi, (full, prefix, quote, url) => {
    const uri = dataUriMap.get(String(url).trim())
    return uri ? `${prefix}${quote}${uri}${quote}` : full
  })

  return out
}

export function rewriteMarkdownAssetLinks(
  markdown: string,
  assets: CollectedLocalAsset[],
  prefix = './assets/'
): string {
  if (assets.length === 0) return markdown
  const map = new Map<string, string>()
  for (const asset of assets) {
    map.set(asset.originalUrl, `${prefix}${asset.filename}`)
  }

  let out = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, url) => {
    const next = map.get(String(url).trim())
    return next ? `![${alt}](${next})` : full
  })

  out = out.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi, (full, pre, quote, url) => {
    const next = map.get(String(url).trim())
    return next ? `${pre}${quote}${next}${quote}` : full
  })

  return out
}
