import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import WorkspaceManager from '../main/workspace/workspaceManager'
import { optimizeAssetData, type ImageOptimizationOptions } from './imageOptimizer'

/**
 * ============================================================================
 * Shared Export Utilities (`exportUtils.ts`)
 * ============================================================================
 * Deduplicated helpers used by every exporter (HTML, PDF, Docs, Bundle, etc.)
 * so bug fixes and improvements live in exactly one place.
 *
 * Contents:
 *  - createMarked()          Configured Marked instance (syntax highlighting)
 *  - convertImagesToBase64() Local image → data-URI conversion (with error recovery)
 *  - setupMermaidRenderer()  Mermaid code-block → <div class="mermaid"> rendering
 *  - generateTOC()           Clickable table of contents from h1–h3 headings
 *  - slugifyHeading()       Heading text → HTML anchor id
 * ============================================================================
 */

export interface RenderMarkdownOptions {
  wikilinkMode?: 'span' | 'link'
  mermaid?: boolean
  toc?: boolean
  imageOptimization?: ImageOptimizationOptions
}

export interface RenderMarkdownResult {
  html: string
  tocHtml: string
  tocCount: number
}

export interface TocOptions {
  title?: string
  maxLevel?: number
}

export interface TocResult {
  html: string
  toc: string
  count: number
}

/**
 * Creates a pre-configured Marked instance with highlight.js syntax highlighting.
 * Mermaid code blocks are left untouched (returned as raw source).
 */
export function createMarked(): Marked {
  return new Marked(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        if (lang === 'mermaid') return code
        const language = hljs.getLanguage(lang) ? lang : 'plaintext'
        return hljs.highlight(code, { language }).value
      }
    })
  )
}

/**
 * Normalises whatever `WorkspaceManager.readAsset` returns into a data URI.
 * Automatically runs optimization (resizing & compression) when available.
 */
function assetToDataUri(
  asset: any,
  fallbackMime = 'image/png',
  optimization?: ImageOptimizationOptions
): string | null {
  if (!asset) return null

  let originalDataUrl: string | null = null
  if (typeof asset === 'string') {
    if (asset.startsWith('data:')) {
      originalDataUrl = asset
    } else {
      originalDataUrl = `data:${fallbackMime};base64,${asset}`
    }
  } else if (typeof asset === 'object') {
    if (typeof asset.dataUrl === 'string' && asset.dataUrl.startsWith('data:')) {
      originalDataUrl = asset.dataUrl
    } else if (typeof asset.base64 === 'string' && asset.base64.length > 0) {
      const mime = asset.mimeType || fallbackMime
      originalDataUrl = `data:${mime};base64,${asset.base64}`
    } else if (asset.buffer) {
      const mime = asset.mimeType || fallbackMime
      const buf = Buffer.isBuffer(asset.buffer) ? asset.buffer : Buffer.from(asset.buffer)
      originalDataUrl = `data:${mime};base64,${buf.toString('base64')}`
    }
  } else if (Buffer.isBuffer(asset)) {
    originalDataUrl = `data:${fallbackMime};base64,${asset.toString('base64')}`
  }

  if (optimization && optimization.enabled !== false) {
    const optimized = optimizeAssetData(asset, fallbackMime, optimization)
    if (optimized?.optimized && optimized.dataUrl) {
      return optimized.dataUrl
    }
  }

  return originalDataUrl
}

/** Returns true when a URL is remote or already inline and must be left alone. */
function isExternalUrl(url?: string | null): boolean {
  return /^(https?:|data:|blob:|mailto:|#)/i.test(String(url || '').trim())
}

/**
 * Turns a workspace-relative image reference into a data URI.
 * Accepts markdown-relative paths, `asset://local/...` URLs, and absolute
 * `/...` paths. Returns null for external URLs or unresolvable assets.
 */
async function resolveImageDataUri(
  rawUrl: string,
  optimization?: ImageOptimizationOptions
): Promise<string | null> {
  let cleanUrl = String(rawUrl || '').trim()
  if (!cleanUrl || isExternalUrl(cleanUrl)) return null

  if (cleanUrl.startsWith('<') && cleanUrl.endsWith('>')) cleanUrl = cleanUrl.slice(1, -1)
  if (cleanUrl.startsWith('asset://local/')) cleanUrl = cleanUrl.slice('asset://local/'.length)
  else if (cleanUrl.startsWith('asset://'))
    cleanUrl = cleanUrl.replace(/^asset:\/\//, '').replace(/^local\//, '')

  // Drop query/hash and leading slash, then decode percent-encoding.
  cleanUrl = cleanUrl.split('#')[0].split('?')[0]
  if (cleanUrl.startsWith('/')) cleanUrl = cleanUrl.slice(1)
  try {
    cleanUrl = decodeURIComponent(cleanUrl)
  } catch {
    /* keep raw */
  }
  if (!cleanUrl) return null

  const asset = await WorkspaceManager.readAsset(cleanUrl)

  let fallbackMime = 'image/png'
  const lowerUrl = cleanUrl.toLowerCase()
  if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) fallbackMime = 'image/jpeg'
  else if (lowerUrl.endsWith('.gif')) fallbackMime = 'image/gif'
  else if (lowerUrl.endsWith('.svg')) fallbackMime = 'image/svg+xml'
  else if (lowerUrl.endsWith('.webp')) fallbackMime = 'image/webp'
  else if (lowerUrl.endsWith('.bmp')) fallbackMime = 'image/bmp'
  else if (lowerUrl.endsWith('.avif')) fallbackMime = 'image/avif'

  return assetToDataUri(asset, fallbackMime, optimization)
}

/**
 * Converts all local images in `content` to base64 data URIs so the exported
 * document is fully self-contained. Handles both Markdown (`![alt](url)`) and
 * raw HTML (`<img src="...">`) image syntax.
 */
export async function convertImagesToBase64(
  content: string,
  optimization?: ImageOptimizationOptions
): Promise<string> {
  let processedContent = content || ''

  // 1. Markdown images: ![alt](url)
  const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  for (const match of [...processedContent.matchAll(mdRegex)]) {
    const [fullMatch, alt, url] = match
    if (isExternalUrl(url)) continue
    try {
      const dataUri = await resolveImageDataUri(url, optimization)
      if (dataUri) {
        processedContent = processedContent.replace(fullMatch, `![${alt}](${dataUri})`)
      }
    } catch (e) {
      console.error('[exportUtils] Failed to convert image to base64:', url, e)
    }
  }

  // 2. Raw HTML images: <img ... src="url" ...>
  const htmlRegex = /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi
  for (const match of [...processedContent.matchAll(htmlRegex)]) {
    const [fullMatch, prefix, quote, url] = match
    if (isExternalUrl(url)) continue
    try {
      const dataUri = await resolveImageDataUri(url, optimization)
      if (dataUri) {
        processedContent = processedContent.replace(
          fullMatch,
          `${prefix}${quote}${dataUri}${quote}`
        )
      }
    } catch (e) {
      console.error('[exportUtils] Failed to convert HTML image to base64:', url, e)
    }
  }

  return processedContent
}

/**
 * Registers a Mermaid renderer on a Marked instance so that ```mermaid code
 * blocks become `<div class="mermaid">…</div>` elements (later rendered by the
 * Mermaid runtime in the export template).
 */
export function setupMermaidRenderer(marked: Marked): void {
  marked.use({
    renderer: {
      code(token: any) {
        if (token.lang === 'mermaid') {
          const escaped = token.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
          return `<div class="mermaid">${escaped}</div>`
        }
        return false
      }
    }
  })
}

/**
 * Converts Obsidian-style wikilinks `[[Note]]` into anchor placeholders.
 * Exporters that want plain text can strip these; HTML/PDF exporters convert
 * them to clickable spans.
 */
export function convertWikilinks(content?: string, mode: 'span' | 'link' = 'span'): string {
  if (mode === 'link') {
    return (content || '').replace(/\[\[(.*?)\]\]/g, '<a href="#">$1</a>')
  }
  return (content || '').replace(/\[\[(.*?)\]\]/g, '<span class="wikilink">$1</span>')
}

/**
 * Generates a clickable table of contents from h1–h3 headings found in rendered
 * HTML. Each entry links to an anchor inserted before its heading.
 */
export function generateTOC(html?: string, opts: TocOptions = {}): TocResult {
  const { maxLevel = 3 } = opts
  if (!html || typeof html !== 'string') {
    return { html: html || '', toc: '', count: 0 }
  }

  const entries: Array<{ level: number; text: string; id: string }> = []
  let count = 0

  // Match h1–h3 opening tags (with optional attributes) and their inner text.
  const headingRegex = new RegExp(`<h([1-${maxLevel}])([^>]*)>([\\s\\S]*?)<\\/h\\1>`, 'g')

  const htmlWithAnchors = html.replace(headingRegex, (match, level, attrs, inner) => {
    const text = inner.replace(/<[^>]*>/g, '').trim()
    if (!text) return match

    const id = `toc-${count}-${slugifyHeading(text)}`
    count += 1
    entries.push({ level: Number(level), text, id })

    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`
  })

  if (entries.length === 0) {
    return { html: htmlWithAnchors, toc: '', count: 0 }
  }

  const items = entries
    .map((e) => {
      const indentClass = e.level === 1 ? 'toc-l1' : e.level === 2 ? 'toc-l2' : 'toc-l3'
      return `<li class="${indentClass}"><a href="#${e.id}">${escapeHtml(e.text)}</a></li>`
    })
    .join('\n')

  const toc = `<nav class="toc" aria-label="Contents">\n<ul class="toc-list">\n${items}\n</ul>\n</nav>`

  return { html: htmlWithAnchors, toc, count }
}

/**
 * Runs the full markdown → export-HTML pipeline:
 * image embedding → wikilinks → marked → optional mermaid setup → TOC.
 */
export async function renderMarkdown(
  content: string,
  opts: RenderMarkdownOptions = {}
): Promise<RenderMarkdownResult> {
  const { wikilinkMode = 'span', mermaid = false, toc = true } = opts
  const marked = createMarked()
  if (mermaid) setupMermaidRenderer(marked)

  let processedContent = await convertImagesToBase64(content || '', opts.imageOptimization)
  processedContent = convertWikilinks(processedContent, wikilinkMode)
  let html = (await marked.parse(processedContent)) as string

  let tocHtml = ''
  let tocCount = 0
  if (toc) {
    const result = generateTOC(html)
    html = result.html
    tocHtml = result.toc
    tocCount = result.count
  }

  return { html, tocHtml, tocCount }
}

/**
 * Converts heading text to a URL-safe anchor id.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

/**
 * Escapes HTML special characters in a string.
 */
export function escapeHtml(text?: string | null): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
