import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import WorkspaceManager from '../main/workspace/workspaceManager.js'

/**
 * ============================================================================
 * Shared Export Utilities (`exportUtils.js`)
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

/**
 * Creates a pre-configured Marked instance with highlight.js syntax highlighting.
 * Mermaid code blocks are left untouched (returned as raw source).
 */
export function createMarked() {
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
 * The manager currently returns a `ReadAssetResult` object
 * (`{ buffer, base64, dataUrl, mimeType }`), but older/alternate shapes
 * (a raw Buffer, a base64 string, or an existing data URL) are handled too.
 *
 * @param {any} asset
 * @param {string} fallbackMime
 * @returns {string|null} data URI, or null when it cannot be resolved
 */
function assetToDataUri(asset, fallbackMime = 'image/png') {
  if (!asset) return null
  if (typeof asset === 'string') {
    if (asset.startsWith('data:')) return asset
    return `data:${fallbackMime};base64,${asset}`
  }
  if (typeof asset === 'object') {
    if (typeof asset.dataUrl === 'string' && asset.dataUrl.startsWith('data:')) return asset.dataUrl
    const mime = asset.mimeType || fallbackMime
    if (typeof asset.base64 === 'string' && asset.base64.length > 0) {
      return `data:${mime};base64,${asset.base64}`
    }
    if (asset.buffer) {
      const buf = Buffer.isBuffer(asset.buffer) ? asset.buffer : Buffer.from(asset.buffer)
      return `data:${mime};base64,${buf.toString('base64')}`
    }
  }
  if (Buffer.isBuffer(asset)) {
    return `data:${fallbackMime};base64,${asset.toString('base64')}`
  }
  return null
}

/** Returns true when a URL is remote or already inline and must be left alone. */
function isExternalUrl(url) {
  return /^(https?:|data:|blob:|mailto:|#)/i.test(String(url || '').trim())
}

/**
 * Turns a workspace-relative image reference into a data URI.
 * Accepts markdown-relative paths, `asset://local/...` URLs, and absolute
 * `/...` paths. Returns null for external URLs or unresolvable assets.
 *
 * @param {string} rawUrl
 * @returns {Promise<string|null>}
 */
async function resolveImageDataUri(rawUrl) {
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

  return assetToDataUri(asset, fallbackMime)
}

/**
 * Converts all local images in `content` to base64 data URIs so the exported
 * document is fully self-contained. Handles both Markdown (`![alt](url)`) and
 * raw HTML (`<img src="...">`) image syntax.
 *
 * Robustness:
 *  - Skips remote (http/data/blob) images.
 *  - Resolves `asset://local/...`, absolute `/...`, and relative workspace paths.
 *  - On failure, logs and continues (never throws) so one bad image cannot abort
 *    the entire export.
 *
 * @param {string} content Markdown source (may include raw HTML)
 * @returns {Promise<string>} Content with local images replaced by data URIs
 */
export async function convertImagesToBase64(content) {
  let processedContent = content || ''

  // 1. Markdown images: ![alt](url)
  const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  for (const match of [...processedContent.matchAll(mdRegex)]) {
    const [fullMatch, alt, url] = match
    if (isExternalUrl(url)) continue
    try {
      const dataUri = await resolveImageDataUri(url)
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
      const dataUri = await resolveImageDataUri(url)
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
 *
 * @param {Marked} marked
 */
export function setupMermaidRenderer(marked) {
  marked.use({
    renderer: {
      code(token) {
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
 *
 * @param {string} content
 * @param {'span'|'link'} mode
 * @returns {string}
 */
export function convertWikilinks(content, mode = 'span') {
  if (mode === 'link') {
    return (content || '').replace(/\[\[(.*?)\]\]/g, '<a href="#">$1</a>')
  }
  return (content || '').replace(/\[\[(.*?)\]\]/g, '<span class="wikilink">$1</span>')
}

/**
 * Generates a clickable table of contents from h1–h3 headings found in rendered
 * HTML. Each entry links to an anchor inserted before its heading.
 *
 * @param {string} html Rendered HTML body
 * @param {object} [opts]
 * @param {string} [opts.title='Table of Contents'] Heading text for the TOC block
 * @param {number} [opts.maxLevel=3] Deepest heading level to include (1–3)
 * @returns {{ html: string, toc: string, count: number }}
 *   - html: the input HTML with anchor ids injected before each heading
 *   - toc:  a standalone `<nav class="toc">…</nav>` block
 *   - count: number of headings found
 */
export function generateTOC(html, opts = {}) {
  const { maxLevel = 3 } = opts
  if (!html || typeof html !== 'string') {
    return { html: html || '', toc: '', count: 0 }
  }

  const entries = []
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
 *
 * @param {string} content Markdown source
 * @param {object} [opts]
 * @param {'span'|'link'} [opts.wikilinkMode='span']
 * @param {boolean} [opts.mermaid=false] Register the mermaid renderer
 * @param {boolean} [opts.toc=true] Generate a table of contents
 * @returns {Promise<{ html: string, tocHtml: string, tocCount: number }>}
 */
export async function renderMarkdown(content, opts = {}) {
  const { wikilinkMode = 'span', mermaid = false, toc = true } = opts
  const marked = createMarked()
  if (mermaid) setupMermaidRenderer(marked)

  let processedContent = await convertImagesToBase64(content || '')
  processedContent = convertWikilinks(processedContent, wikilinkMode)
  let html = await marked.parse(processedContent)

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
 * @param {string} text
 * @returns {string}
 */
export function slugifyHeading(text) {
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
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
