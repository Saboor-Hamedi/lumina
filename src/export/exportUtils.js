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
 * Converts all local markdown images in `content` to base64 data URIs so the
 * exported document is fully self-contained.
 *
 * Robustness:
 *  - Skips remote (http/data:) images.
 *  - Strips optional angle-brackets and decodes URI components.
 *  - Infers MIME type from the file extension (defaults to image/png).
 *  - On failure, logs and continues (never throws) so one bad image does not
 *    abort the entire export.
 *
 * @param {string} content Markdown source
 * @returns {Promise<string>} Markdown with local images replaced by data URIs
 */
export async function convertImagesToBase64(content) {
  let processedContent = content || ''
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const matches = [...processedContent.matchAll(imgRegex)]

  for (const match of matches) {
    const fullMatch = match[0]
    const alt = match[1]
    const url = match[2]

    if (url.startsWith('http') || url.startsWith('data:')) continue

    try {
      let cleanUrl = url.startsWith('/') ? url.slice(1) : url
      if (cleanUrl.startsWith('<') && cleanUrl.endsWith('>')) {
        cleanUrl = cleanUrl.slice(1, -1)
      }
      cleanUrl = decodeURIComponent(cleanUrl)

      const buffer = await WorkspaceManager.readAsset(cleanUrl)
      if (!buffer) {
        console.warn('[exportUtils] Asset not found, skipping:', cleanUrl)
        continue
      }

      let mimeType = 'image/png'
      const lowerUrl = cleanUrl.toLowerCase()
      if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) mimeType = 'image/jpeg'
      else if (lowerUrl.endsWith('.gif')) mimeType = 'image/gif'
      else if (lowerUrl.endsWith('.svg')) mimeType = 'image/svg+xml'
      else if (lowerUrl.endsWith('.webp')) mimeType = 'image/webp'

      const base64 = buffer.toString('base64')
      const dataUri = `data:${mimeType};base64,${base64}`
      processedContent = processedContent.replace(fullMatch, `![${alt}](${dataUri})`)
    } catch (e) {
      console.error('[exportUtils] Failed to convert image to base64:', url, e)
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
  const { title = 'Table of Contents', maxLevel = 3 } = opts
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

  const toc = `<nav class="toc" aria-label="Table of Contents">\n<h2 class="toc-title">${escapeHtml(title)}</h2>\n<ul class="toc-list">\n${items}\n</ul>\n</nav>`

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
