import { Marked, type Tokens } from 'marked'
import hljs from '../../core/code/hljsCore'
import katex from 'katex'
import hljsLightCss from 'highlight.js/styles/github.min.css?raw'
import { invoke } from '@tauri-apps/api/core'

export interface ExportResult {
  success: boolean
  filePath?: string
  bundleDir?: string | null
  isZip?: boolean
  canceled?: boolean
  total?: number
  exported?: number
  failed?: number
  combined?: boolean
  outputDir?: string
  error?: string
  failures?: Array<{ id: string; title: string; error: string }>
}

export interface BatchExportNoteInput {
  id?: string
  title?: string
  content?: string
}

export interface BatchExportProgress {
  phase: 'start' | 'rendering' | 'merging' | 'done' | 'error' | 'complete'
  current: number
  total: number
  title?: string
  filePath?: string
  error?: string
}

export interface ExportPayload {
  title?: string
  content?: string
  language?: string
  toc?: boolean
  compressZip?: boolean
  optimizeImages?: boolean
  stripMarkdown?: boolean
  includeTitle?: boolean
  theme?: Record<string, string>
  format?: string
  notes?: BatchExportNoteInput[]
}

export interface BatchExportPayload {
  notes: BatchExportNoteInput[]
  format: string
  toc?: boolean
  title?: string
  compressZip?: boolean
  archiveTitle?: string
  optimizeImages?: boolean
  stripMarkdown?: boolean
  includeTitle?: boolean
  theme?: Record<string, string>
  outputDir?: string
  filePath?: string
}

export interface PreviewResult {
  html: string
  format: string
  truncated: boolean
}

const DEFAULT_THEME: Record<string, string> = {
  'bg-app': '#0e0f15',
  'bg-panel': '#13141c',
  'bg-sidebar': '#13141c',
  'bg-editor': '#161822',
  'bg-card': '#1a1c27',
  'bg-active': 'rgba(255, 255, 255, 0.06)',
  'text-main': '#f1f5f9',
  'text-muted': '#94a3b8',
  'text-faint': '#475569',
  'text-accent': '#6366f1',
  'border-dim': '#1e202e',
  'border-card': '#26293a',
  'border-subtle': 'rgba(255, 255, 255, 0.12)',
  'font-sans':
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  'font-mono': "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace"
}

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

const batchProgressListeners = new Set<(progress: BatchExportProgress) => void>()

function emitBatchProgress(progress: BatchExportProgress): void {
  batchProgressListeners.forEach((cb) => {
    try {
      cb(progress)
    } catch {
      /* ignore subscriber errors */
    }
  })
}

export function onBatchExportProgress(
  callback: (progress: BatchExportProgress) => void
): () => void {
  batchProgressListeners.add(callback)
  return () => {
    batchProgressListeners.delete(callback)
  }
}

export function safeFileName(name?: string): string {
  const cleaned = String(name || 'Untitled')
    .split('')
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 120)
  return cleaned || 'Untitled'
}

export function escapeHtml(text?: string | null): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/h[1-6]>|<\/div>|<\/li>|<\/blockquote>|<\/tr>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]*>?/gm, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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

export interface CollectedLocalAsset {
  originalUrl: string
  relativePath: string
  filename: string
  mime: string
  bytes: Uint8Array
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

async function embedImagesAsDataUri(
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

function renderMathExpressions(markdown: string): string {
  const codePlaceholders: string[] = []
  let text = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`/g, (match) => {
    const token = `\u0000LMCODE_${codePlaceholders.length}\u0000`
    codePlaceholders.push(match)
    return token
  })

  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try {
      const mathml = katex.renderToString(String(expr).trim(), {
        displayMode: true,
        throwOnError: false,
        output: 'mathml'
      })
      return `\n<div class="math-block">${mathml}</div>\n`
    } catch {
      return `\n<pre class="math-fallback">${escapeHtml(String(expr).trim())}</pre>\n`
    }
  })

  text = text.replace(/(^|[^\\])\$(?!\s)([^$\n]+?)\$/g, (full, prefix, inner) => {
    const expr = String(inner)
    if (expr.endsWith(' ') || expr.endsWith('\\')) return full
    try {
      const mathml = katex.renderToString(expr.trim(), {
        displayMode: false,
        throwOnError: false,
        output: 'mathml'
      })
      return `${prefix}<span class="math-inline">${mathml}</span>`
    } catch {
      return full
    }
  })

  return text.replace(/\u0000LMCODE_(\d+)\u0000/g, (_, idx) => codePlaceholders[Number(idx)] ?? '')
}

export function convertWikilinks(
  content: string,
  mode: 'span' | 'link' | 'plain' = 'span'
): string {
  return (content || '').replace(/\[\[([^[\]]+)\]\]/g, (_, rawTarget) => {
    const parts = String(rawTarget).split('|')
    const display = (parts[1] ?? parts[0] ?? '').trim()
    if (mode === 'plain') return display
    if (mode === 'link') return `<a href="#wikilink">${escapeHtml(display)}</a>`
    return `<span class="wikilink">${escapeHtml(display)}</span>`
  })
}

export function generateTOC(
  html: string,
  opts: { maxLevel?: number; minEntries?: number } = {}
): { html: string; toc: string; count: number } {
  const { maxLevel = 3, minEntries = 2 } = opts
  if (!html) return { html: '', toc: '', count: 0 }

  const entries: Array<{ level: number; text: string; id: string }> = []
  let count = 0
  const headingRegex = new RegExp(`<h([1-${maxLevel}])([^>]*)>([\\s\\S]*?)<\\/h\\1>`, 'g')

  const htmlWithAnchors = html.replace(headingRegex, (match, level, attrs, inner) => {
    const text = String(inner).replace(/<[^>]*>/g, '').trim()
    if (!text) return match
    const id = `toc-${count}-${slugifyHeading(text) || 'section'}`
    count += 1
    entries.push({ level: Number(level), text, id })
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`
  })

  if (entries.length < minEntries) {
    return { html: htmlWithAnchors, toc: '', count: entries.length }
  }

  const items = entries
    .map((e) => {
      const cls = e.level === 1 ? 'toc-l1' : e.level === 2 ? 'toc-l2' : 'toc-l3'
      return `<li class="${cls}"><a href="#${e.id}">${escapeHtml(e.text)}</a></li>`
    })
    .join('\n')

  return {
    html: htmlWithAnchors,
    toc: `<nav class="toc" aria-label="Contents">\n<ul class="toc-list">\n${items}\n</ul>\n</nav>`,
    count
  }
}

function createExportMarked(mermaidEnabled: boolean): Marked {
  const m = new Marked({ gfm: true, breaks: false })
  m.use({
    renderer: {
      code({ text, lang }: Tokens.Code) {
        const cleanLang = (lang || '').trim().split(/\s+/)[0] || ''
        if (mermaidEnabled && cleanLang.toLowerCase() === 'mermaid') {
          return `<div class="mermaid">${escapeHtml(text)}</div>\n`
        }
        const language = cleanLang && hljs.getLanguage(cleanLang) ? cleanLang : 'plaintext'
        let highlighted = ''
        try {
          highlighted = hljs.highlight(text, { language }).value
        } catch {
          highlighted = escapeHtml(text)
        }
        return `<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>\n`
      }
    }
  })
  return m
}

function sanitizeRenderedHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<\/?(object|embed)\b[^>]*>/gi, '')
    .replace(/<[a-zA-Z][^>]*>/g, (tag) =>
      tag
        .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(\b(?:href|src)\s*=\s*)(["'])\s*(?:javascript|vbscript):[^"']*\2/gi, '$1$2#$2')
    )
}

async function svgElementToPngDataUrl(svgEl: SVGSVGElement): Promise<string | null> {
  if (
    typeof document === 'undefined' ||
    typeof XMLSerializer === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    return null
  }
  try {
    const viewBox = svgEl.viewBox?.baseVal
    const widthAttr = parseFloat(svgEl.getAttribute('width') || '0')
    const heightAttr = parseFloat(svgEl.getAttribute('height') || '0')
    const width = Math.max(
      1,
      Math.ceil((viewBox && viewBox.width) || widthAttr || 600)
    )
    const height = Math.max(
      1,
      Math.ceil((viewBox && viewBox.height) || heightAttr || 360)
    )

    const canvas = document.createElement('canvas')
    canvas.width = width * 2
    canvas.height = height * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.scale(2, 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    if (!svgEl.getAttribute('width')) svgEl.setAttribute('width', String(width))
    if (!svgEl.getAttribute('height')) svgEl.setAttribute('height', String(height))

    const serialized = new XMLSerializer().serializeToString(svgEl)
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG image load failed'))
      img.src = svgUrl
    })
    ctx.drawImage(img, 0, 0, width, height)
    const png = canvas.toDataURL('image/png')
    return png.startsWith('data:image/png') ? png : null
  } catch {
    return null
  }
}

function applyMonochromePrintStyling(svgEl: SVGSVGElement): void {
  try {
    svgEl
      .querySelectorAll(
        '.node rect, .node circle, .node ellipse, .node polygon, .node path, .mindmap-node rect, .cluster rect, rect.actor, .actor, rect.note, .note, rect.task, .task, rect.labelBox, .labelBkg, .label-container, rect'
      )
      .forEach((node) => {
        const el = node as SVGElement
        el.style.setProperty('fill', 'transparent', 'important')
        el.style.setProperty('stroke', '#000000', 'important')
        el.style.setProperty('stroke-width', '1px', 'important')
      })

    svgEl
      .querySelectorAll('text, tspan, p, span, .label text, .edgeLabel text, .nodeLabel')
      .forEach((node) => {
        const el = node as HTMLElement
        el.style.setProperty('color', '#000000', 'important')
        el.style.setProperty('fill', '#000000', 'important')
        el.style.setProperty('stroke', 'none', 'important')
      })

    svgEl
      .querySelectorAll(
        '.edgePath path, .mindmap-edges path, path.link, path.edge, .flowchart-link, .messageLine0, .messageLine1, .edgeLine, .transition'
      )
      .forEach((node) => {
        const el = node as SVGElement
        el.style.setProperty('stroke', '#000000', 'important')
        el.style.setProperty('stroke-width', '1px', 'important')
        el.style.setProperty('fill', 'none', 'important')
      })

    svgEl.querySelectorAll('marker path, marker polygon, marker circle').forEach((node) => {
      const el = node as SVGElement
      el.style.setProperty('fill', '#000000', 'important')
      el.style.setProperty('stroke', '#000000', 'important')
    })

    svgEl.style.maxWidth = '100%'
    svgEl.style.maxHeight = '9.5cm'
    svgEl.style.height = 'auto'
  } catch {
    /* ignore in minimal DOM environments */
  }
}

let mermaidSeq = 0

export async function renderMermaidBlocksInHtml(
  html: string,
  mode: 'print' | 'docs' | 'dark' | 'light'
): Promise<string> {
  if (!html.includes('class="mermaid"') || typeof DOMParser === 'undefined') {
    return html
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html')
    const blocks = Array.from(doc.querySelectorAll('.mermaid'))
    if (blocks.length === 0) return html

    const { default: mermaid } = await import('mermaid')

    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: mode === 'dark' ? 'dark' : 'default'
      })
    } catch {
      /* continue with fallback on failure */
    }

    for (const block of blocks) {
      const source = (block.textContent || '').trim()
      if (!source) continue

      const renderId = `lumina-export-mmd-${++mermaidSeq}`
      try {
        const rendered = await mermaid.render(renderId, source)
        const svgMarkup = rendered?.svg || ''
        if (!svgMarkup.includes('<svg')) {
          throw new Error('No SVG output generated')
        }

        const svgDoc = parser.parseFromString(svgMarkup, 'image/svg+xml')
        const svgEl = svgDoc.querySelector('svg') as SVGSVGElement | null
        if (!svgEl) {
          block.innerHTML = svgMarkup
          continue
        }

        if (mode === 'print' || mode === 'docs') {
          applyMonochromePrintStyling(svgEl)
        }

        if (mode === 'docs') {
          const pngUrl = await svgElementToPngDataUrl(svgEl)
          if (pngUrl) {
            const img = doc.createElement('img')
            img.src = pngUrl
            img.alt = 'Mermaid diagram'
            img.style.maxWidth = '100%'
            img.style.height = 'auto'
            img.style.display = 'block'
            img.style.margin = '6pt auto'
            block.innerHTML = ''
            block.appendChild(img)
            continue
          }
        }

        block.innerHTML = new XMLSerializer().serializeToString(svgEl)
      } catch {
        block.innerHTML =
          '<div class="mermaid-error">Diagram could not be rendered cleanly in this environment</div>'
      } finally {
        if (typeof document !== 'undefined') {
          document.getElementById(`d${renderId}`)?.remove()
          document.getElementById(renderId)?.remove()
        }
      }
    }

    return doc.body.innerHTML
  } catch {
    return html
  }
}

export async function renderMarkdownForExport(
  content: string,
  opts: {
    wikilinkMode?: 'span' | 'link' | 'plain'
    mermaidMode?: 'print' | 'docs' | 'dark' | 'light' | 'none'
    toc?: boolean
    optimizeImages?: boolean
  } = {}
): Promise<{ html: string; tocHtml: string; tocCount: number }> {
  const {
    wikilinkMode = 'span',
    mermaidMode = 'none',
    toc = true,
    optimizeImages = true
  } = opts

  let processed = await embedImagesAsDataUri(content || '', optimizeImages)
  processed = renderMathExpressions(processed)
  processed = convertWikilinks(processed, wikilinkMode)

  const marked = createExportMarked(mermaidMode !== 'none')
  let html = sanitizeRenderedHtml((await marked.parse(processed)) as string)

  if (mermaidMode !== 'none') {
    html = await renderMermaidBlocksInHtml(html, mermaidMode)
  }

  let tocHtml = ''
  let tocCount = 0
  if (toc) {
    const res = generateTOC(html)
    html = res.html
    tocHtml = res.toc
    tocCount = res.count
  }

  return { html, tocHtml, tocCount }
}

function normalizeTheme(theme?: Record<string, string>): Record<string, string> {
  const merged = { ...DEFAULT_THEME }
  if (theme && typeof theme === 'object') {
    for (const key of Object.keys(DEFAULT_THEME)) {
      const v = theme[key]
      if (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 120) {
        merged[key] = v.trim()
      }
    }
  }
  return merged
}

function isLightColorHexOrRgb(bg: string): boolean {
  const trimmed = bg.trim()
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1)
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('')
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
      }
    }
  }
  const m = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (m) {
    const r = Number(m[1])
    const g = Number(m[2])
    const b = Number(m[3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
  }
  return false
}

function themeVarsCss(theme?: Record<string, string>): string {
  const tokens = normalizeTheme(theme)
  const decls = Object.entries(tokens)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n')
  return `:root {\n${decls}\n}`
}

const SHARED_SCROLLBAR_CSS = `
html { scrollbar-width: thin; scrollbar-color: rgba(148, 163, 184, 0.28) transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover { background: rgba(148, 163, 184, 0.45); background-clip: padding-box; }
::-webkit-scrollbar-corner { background: transparent; }
`

export function buildPDFDocument(
  title?: string,
  htmlBody: string = '',
  tocHtml: string = ''
): string {
  const safeTitle = title || 'Untitled'
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(safeTitle)}</title>
  <style>
${hljsLightCss}
${SHARED_SCROLLBAR_CSS}
@page {
  size: A4;
  margin: 22mm 20mm 24mm 20mm;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #0b0d12; }
body {
  font-family: 'Times New Roman', Times, serif;
  line-height: 1.5;
  color: #1e293b;
  font-size: 12pt;
  text-align: justify;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  padding: 32px 24px;
  min-height: 100vh;
}
.page {
  width: 100%;
  max-width: 760px;
  min-height: 1040px;
  margin: 12px auto 32px auto;
  background: #ffffff;
  padding: 52px 60px 60px 60px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.42);
}
@media print {
  html, body { background: #ffffff; }
  body { padding: 0; min-height: auto; }
  .page {
    width: auto;
    max-width: none;
    min-height: auto;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
}
h1, h2, h3, h4, h5, h6 {
  color: #0f172a;
  font-weight: 700;
  line-height: 1.25;
  page-break-after: avoid;
  break-after: avoid;
}
h1 { font-size: 15pt; margin-top: 0; margin-bottom: 8pt; color: #0f172a; }
h2 { font-size: 12.5pt; margin: 14pt 0 6pt; color: #1e293b; }
h3, h4 { font-size: 11.5pt; margin: 11pt 0 5pt; color: #334155; }
p {
  margin: 6pt 0;
  color: #1e293b;
  text-align: justify;
  text-justify: inter-word;
  hyphens: auto;
  orphans: 3;
  widows: 3;
}
ul, ol { margin: 6pt 0 10pt; padding-left: 18pt; }
li { margin: 3pt 0; color: #1e293b; }
hr { border: none; height: 1px; background: #cbd5e1; margin: 14pt 0; }
a { color: #2563eb; text-decoration: none; }
code {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 9.5pt;
  color: #be123c;
  background: transparent;
}
pre {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10pt 12pt;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
  margin: 10pt 0;
  break-inside: auto;
}
pre code, pre code.hljs, .hljs {
  background: transparent !important;
  color: #1e293b;
  padding: 0;
  border: none;
  font-size: 9pt;
  line-height: 1.45;
}
blockquote {
  border-left: 2.5px solid #cbd5e1;
  padding: 2pt 0 2pt 12pt;
  margin: 8pt 0;
  color: #475569;
  font-style: italic;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 12pt auto;
  font-size: 10pt;
  table-layout: fixed;
  word-break: break-word;
  border: 1px solid #94a3b8;
}
thead { display: table-header-group; }
tr { break-inside: avoid; }
th, td {
  border: 1px solid #cbd5e1;
  padding: 4pt 6pt;
  text-align: left;
  vertical-align: top;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
th { background: #f1f5f9; font-weight: 700; color: #0f172a; }
tbody tr:nth-child(even) { background: #f8fafc; }
img {
  display: block;
  max-width: 100%;
  max-height: 9.5cm;
  width: auto;
  height: auto;
  margin: 10pt auto;
  border-radius: 4px;
}
.mermaid { display: flex; justify-content: center; align-items: center; margin: 12pt 0; break-inside: avoid; }
.mermaid svg { max-width: 100% !important; max-height: 9.5cm !important; width: auto !important; height: auto !important; }
.mermaid-error {
  padding: 8pt 10pt;
  font-size: 9.5pt;
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  text-align: center;
}
.wikilink { color: #1d4ed8; font-weight: 500; }
.math-block { margin: 10pt 0; text-align: center; }
.toc { margin: 0 0 16pt; }
.toc-title {
  font-size: 13pt;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 6pt;
  padding-bottom: 3pt;
  border-bottom: 1px solid #cbd5e1;
}
.toc-list { list-style: none; padding: 0; margin: 0; }
.toc-list li { margin: 2pt 0; font-size: 10.5pt; }
.toc-l2 { padding-left: 14pt; }
.toc-l3 { padding-left: 28pt; font-size: 10pt; }
.note-divider {
  border: none;
  border-top: 1px dashed #cbd5e1;
  margin: 22pt 0;
  page-break-before: auto;
}
  </style>
</head>
<body>
  <div class="page">
    ${tocHtml ? `<div class="toc"><div class="toc-title">Table of Contents</div>${tocHtml}</div>` : ''}
    ${htmlBody}
  </div>
</body>
</html>`
}

export function buildDocsDocument(
  title?: string,
  htmlBody: string = '',
  tocHtml: string = '',
  isPreview: boolean = false
): string {
  const safeTitle = title || 'Untitled'
  const docsBody = htmlBody
    .replace(/<blockquote\b[^>]*>/gi, '<div class="export-quote">')
    .replace(/<\/blockquote>/gi, '</div>')

  const wrapperStart = isPreview ? '<div class="page">' : '<div class="word-doc">'
  const wrapperEnd = '</div>'

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(safeTitle)}</title>
  <style>
${hljsLightCss}
${isPreview ? SHARED_SCROLLBAR_CSS : ''}
@page { size: A4; margin: 25mm 22mm 26mm 22mm; }
body {
  font-family: 'Times New Roman', serif;
  line-height: 1.5;
  color: #1e293b;
  background: ${isPreview ? '#0b0d12' : '#ffffff'};
  padding: ${isPreview ? '32px 24px' : '0'};
  margin: 0;
  font-size: 12pt;
  text-align: justify;
}
${
  isPreview
    ? `.page {
  width: 100%;
  max-width: 760px;
  min-height: 1040px;
  margin: 12px auto 32px auto;
  background: #ffffff;
  padding: 52px 60px 60px 60px;
  border-radius: 4px;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.42);
}`
    : ''
}
h1, h2, h3, h4, h5, h6 {
  color: #0f172a;
  font-family: 'Times New Roman', serif;
  margin-top: 12pt;
  margin-bottom: 6pt;
  font-weight: 700;
  line-height: 1.25;
  text-align: left;
}
h1 { margin-top: 0; font-size: 14pt; }
h2 { font-size: 12.5pt; }
h3, h4 { font-size: 12pt; color: #334155; }
p { margin: 6pt 0; color: #334155; text-align: justify; }
ul, ol { margin: 6pt 0 10pt; padding-left: 20pt; }
li { margin: 2pt 0; }
code {
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 10pt;
  color: #be123c;
  background: transparent;
}
pre {
  background: #f8fafc;
  padding: 10pt 12pt;
  border: 1px solid #e2e8f0;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 10pt 0;
}
pre code, .hljs { background: transparent !important; color: #1e293b; padding: 0; }
.export-quote {
  border: none;
  padding: 0 0 0 12pt;
  margin: 6pt 0;
  color: #475569;
  font-style: italic;
}
table {
  border-collapse: collapse;
  margin: 12pt auto;
  width: 100%;
  table-layout: fixed;
  mso-table-lspace: 0pt;
  mso-table-rspace: 0pt;
  font-size: 10pt;
  border: 1px solid #94a3b8;
}
th, td {
  border: 1px solid #cbd5e1;
  padding: 3pt 5pt;
  mso-padding-alt: 3pt 5pt 3pt 5pt;
  text-align: left;
  vertical-align: top;
  line-height: 1.2;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
th { background: #f1f5f9; font-weight: 700; }
img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 8pt auto;
}
.toc { margin: 0 0 14pt; }
.toc-title { font-size: 13pt; font-weight: 700; margin-bottom: 4pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 3pt; }
.toc-list { list-style: none; padding: 0; margin: 0; }
.toc-list li { margin: 2pt 0; font-size: 10.5pt; }
.toc-l2 { padding-left: 14pt; }
.toc-l3 { padding-left: 28pt; }
  </style>
</head>
<body>
  ${wrapperStart}
    ${tocHtml ? `<div class="toc"><div class="toc-title">Table of Contents</div>${tocHtml}</div>` : ''}
    ${docsBody}
  ${wrapperEnd}
</body>
</html>`
}

function formatWebsiteCodeLang(rawClassAttr: string): string {
  const m = rawClassAttr.match(/language-([a-z0-9_+-]+)/i)
  const lang = (m?.[1] || '').toLowerCase()
  if (!lang || lang === 'plaintext' || lang === 'text' || lang === 'txt') return 'CODE'
  return lang.toUpperCase()
}

function enhanceWebsiteHtml(htmlBody: string): string {
  if (!htmlBody) return ''
  let out = htmlBody.replace(
    /<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi,
    (_, attrs = '', inner = '') => {
      const langLabel = formatWebsiteCodeLang(attrs)
      return `<div class="code-card"><div class="code-card-head"><span class="code-lang">${escapeHtml(langLabel)}</span><button type="button" class="code-copy-btn" data-copy-code aria-label="Copy code">Copy</button></div><pre><code${attrs}>${inner}</code></pre></div>`
    }
  )
  out = out.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tableHtml) => {
    return `<div class="table-scroll">${tableHtml}</div>`
  })
  return out
}

function computeReadingStats(htmlBody: string): { words: number; minutes: number } {
  const plain = htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!plain) return { words: 0, minutes: 0 }
  const words = plain.split(' ').length
  return { words, minutes: Math.max(1, Math.round(words / 220)) }
}

function shouldShowArticleHeroTitle(title: string, htmlBody: string): boolean {
  const trimmed = (htmlBody || '').trimStart()
  const h1Match = trimmed.match(/^<h1\b[^>]*>([\s\S]*?)<\/h1>/i)
  if (!h1Match) return true
  const firstHeadingText = h1Match[1].replace(/<[^>]+>/g, '').trim().toLowerCase()
  return firstHeadingText !== title.trim().toLowerCase()
}

export function buildCleanHTMLDocument(
  title?: string,
  htmlBody: string = '',
  tocHtml: string = '',
  theme?: Record<string, string>
): string {
  const safeTitle = (title || 'Untitled').trim() || 'Untitled'
  const useCustomTheme = Boolean(theme && Object.keys(theme).length > 0)
  const tokens = normalizeTheme(theme)
  const defaultLight = useCustomTheme ? isLightColorHexOrRgb(tokens['bg-editor']) : false
  const initialTheme: 'light' | 'dark' = defaultLight ? 'light' : 'dark'

  const customPolarityOverride = useCustomTheme
    ? `
html[data-theme="${initialTheme}"] {
  --site-bg: ${tokens['bg-editor']};
  --site-surface: ${tokens['bg-panel']};
  --site-surface-alt: ${tokens['bg-card']};
  --site-hover: ${tokens['bg-active']};
  --site-ink: ${tokens['text-main']};
  --site-muted: ${tokens['text-muted']};
  --site-accent: ${tokens['text-accent']};
  --site-border: ${tokens['border-card']};
}`
    : ''

  const enhancedBody = enhanceWebsiteHtml(htmlBody)
  const stats = computeReadingStats(htmlBody)
  const showHeroTitle = shouldShowArticleHeroTitle(safeTitle, enhancedBody)
  const hasToc = Boolean(tocHtml && tocHtml.trim().length > 0)
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date())

  const script = `<script>
(function () {
  var root = document.documentElement;
  var autoSystem = ${useCustomTheme ? 'false' : 'true'};
  try {
    var stored = localStorage.getItem('lumina-export-theme');
    if (stored === 'light' || stored === 'dark') {
      root.setAttribute('data-theme', stored);
    } else if (autoSystem && window.matchMedia) {
      root.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    }
  } catch (err) {}

  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || typeof target.closest !== 'function') return;

    var themeBtn = target.closest('[data-theme-toggle]');
    if (themeBtn) {
      var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('lumina-export-theme', next); } catch (err) {}
      return;
    }

    var printBtn = target.closest('[data-print-doc]');
    if (printBtn && typeof window.print === 'function') {
      window.print();
      return;
    }

    var copyBtn = target.closest('[data-copy-code]');
    if (copyBtn) {
      var card = copyBtn.closest('.code-card');
      var codeEl = card && card.querySelector('pre code');
      var text = codeEl ? (codeEl.textContent || '') : '';
      if (!text) return;
      var finish = function () {
        copyBtn.textContent = 'Copied';
        copyBtn.classList.add('is-copied');
        setTimeout(function () {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('is-copied');
        }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(finish).catch(function () {});
      }
    }
  });

  if (typeof IntersectionObserver !== 'undefined') {
    var headings = Array.prototype.slice.call(document.querySelectorAll('.article-body h1[id], .article-body h2[id], .article-body h3[id]'));
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.site-toc a[href^="#"]'));
    if (headings.length > 0 && tocLinks.length > 0) {
      var setActive = function (id) {
        for (var i = 0; i < tocLinks.length; i++) {
          var active = tocLinks[i].getAttribute('href') === '#' + id;
          tocLinks[i].classList.toggle('is-active', active);
        }
      };
      var observer = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting && entries[i].target && entries[i].target.id) {
            setActive(entries[i].target.id);
            break;
          }
        }
      }, { rootMargin: '-84px 0px -70% 0px', threshold: 0.01 });
      for (var j = 0; j < headings.length; j++) {
        observer.observe(headings[j]);
      }
      setActive(headings[0].id);
    }
  }
})();
</script>`

  return `<!DOCTYPE html>
<html lang="en" data-theme="${initialTheme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(safeTitle)}</title>
  <style>
${SHARED_SCROLLBAR_CSS}
:root,
html[data-theme="dark"] {
  --site-bg: #0b0d13;
  --site-surface: #12151f;
  --site-surface-alt: #181c29;
  --site-header-bg: rgba(11, 13, 19, 0.82);
  --site-hover: rgba(255, 255, 255, 0.06);
  --site-ink: #edf1f7;
  --site-muted: #94a3b8;
  --site-faint: #64748b;
  --site-accent: #60a5fa;
  --site-accent-soft: rgba(96, 165, 250, 0.14);
  --site-border: rgba(255, 255, 255, 0.1);
  --site-code-bg: #111520;
  --hljs-kw: #ff7b72;
  --hljs-str: #a5d6ff;
  --hljs-fn: #d2a8ff;
  --hljs-cmt: #8b949e;
  --hljs-num: #79c0ff;
  --hljs-type: #ffa657;
  --font-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
}
html[data-theme="light"] {
  --site-bg: #ffffff;
  --site-surface: #f8fafc;
  --site-surface-alt: #f1f5f9;
  --site-header-bg: rgba(255, 255, 255, 0.86);
  --site-hover: rgba(15, 23, 42, 0.05);
  --site-ink: #0f172a;
  --site-muted: #475569;
  --site-faint: #64748b;
  --site-accent: #2563eb;
  --site-accent-soft: rgba(37, 99, 235, 0.08);
  --site-border: rgba(15, 23, 42, 0.1);
  --site-code-bg: #f8fafc;
  --hljs-kw: #cf222e;
  --hljs-str: #0a3069;
  --hljs-fn: #8250df;
  --hljs-cmt: #6e7781;
  --hljs-num: #0550ae;
  --hljs-type: #953800;
}
${customPolarityOverride}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; background: var(--site-bg); }
body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  background: var(--site-bg);
  color: var(--site-ink);
  font-size: 16px;
  line-height: 1.72;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.site-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--site-bg);
  color: var(--site-ink);
}
.site-header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--site-header-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--site-border);
}
.site-header-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.site-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  text-decoration: none;
  color: var(--site-ink);
  font-weight: 600;
  font-size: 14px;
  letter-spacing: -0.01em;
}
.site-brand-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--site-accent);
  box-shadow: 0 0 0 3px var(--site-accent-soft);
  flex-shrink: 0;
}
.site-brand-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.site-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.site-meta-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--site-muted);
  background: var(--site-surface);
  border: 1px solid var(--site-border);
}
.site-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border-radius: 7px;
  border: 1px solid var(--site-border);
  background: var(--site-surface);
  color: var(--site-ink);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.site-action-btn:hover {
  background: var(--site-hover);
  border-color: var(--site-accent);
}
html[data-theme="dark"] .theme-icon-moon { display: none; }
html[data-theme="light"] .theme-icon-sun { display: none; }
.site-main {
  flex: 1;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: 40px 24px 72px;
}
.site-layout {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}
.site-layout.has-toc {
  max-width: 1060px;
}
.container {
  width: 100%;
  min-width: 0;
  margin: 0 auto;
}
.article-hero {
  margin-bottom: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--site-border);
}
.article-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--site-muted);
  margin-bottom: 10px;
}
.meta-dot { opacity: 0.45; }
.article-hero-title {
  margin: 0;
  font-size: clamp(1.85rem, 3.2vw, 2.45rem);
  font-weight: 750;
  line-height: 1.18;
  letter-spacing: -0.025em;
  color: var(--site-ink);
}
.article-body > h1:first-child {
  margin-top: 0;
  font-size: clamp(1.85rem, 3.2vw, 2.45rem);
  font-weight: 750;
  line-height: 1.18;
  letter-spacing: -0.025em;
}
.site-toc {
  display: none;
}
.toc-mobile {
  margin: 0 0 28px;
  background: var(--site-surface);
  border: 1px solid var(--site-border);
  border-radius: 10px;
  padding: 12px 16px;
}
.toc-mobile summary {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--site-muted);
  cursor: pointer;
  list-style: none;
}
.toc-mobile .toc { margin-top: 10px; }
@media (min-width: 960px) {
  .site-layout.has-toc {
    display: grid;
    grid-template-columns: minmax(0, 740px) 232px;
    justify-content: center;
    align-items: start;
    gap: 52px;
  }
  .toc-mobile { display: none; }
  .site-toc {
    display: block;
    position: sticky;
    top: 80px;
    max-height: calc(100vh - 104px);
    overflow-y: auto;
    padding-left: 16px;
    border-left: 1px solid var(--site-border);
  }
}
.toc-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--site-muted);
  margin-bottom: 10px;
}
.toc-list { list-style: none; padding: 0; margin: 0; }
.toc-list li { margin: 4px 0; font-size: 13px; line-height: 1.45; }
.toc-list a {
  display: block;
  color: var(--site-muted);
  text-decoration: none;
  padding: 2px 0;
  transition: color 0.12s ease;
}
.toc-list a:hover,
.toc-list a.is-active {
  color: var(--site-accent);
  font-weight: 500;
}
.toc-l2 { padding-left: 12px; }
.toc-l3 { padding-left: 24px; font-size: 12.5px; }
.article-body h1,
.article-body h2,
.article-body h3,
.article-body h4,
.article-body h5,
.article-body h6 {
  color: var(--site-ink);
  font-weight: 700;
  line-height: 1.28;
  letter-spacing: -0.015em;
  margin-top: 1.8em;
  margin-bottom: 0.6em;
  scroll-margin-top: 80px;
}
.article-body h2 {
  font-size: 1.45rem;
  padding-bottom: 0.35em;
  border-bottom: 1px solid var(--site-border);
}
.article-body h3 { font-size: 1.18rem; }
.article-body p { margin: 0 0 1.15em; color: var(--site-ink); }
.article-body ul, .article-body ol { margin: 0.6em 0 1.2em; padding-left: 1.55em; }
.article-body li { margin: 0.35em 0; }
.article-body a { color: var(--site-accent); text-decoration: none; font-weight: 500; }
.article-body a:hover { text-decoration: underline; text-underline-offset: 3px; }
.article-body hr {
  border: none;
  height: 1px;
  background: var(--site-border);
  margin: 2.2em 0;
}
.article-body :not(pre) > code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--site-surface);
  border: 1px solid var(--site-border);
  padding: 2px 6px;
  border-radius: 5px;
  color: var(--site-accent);
}
.code-card {
  margin: 1.4em 0;
  background: var(--site-code-bg);
  border: 1px solid var(--site-border);
  border-radius: 10px;
  overflow: hidden;
}
.code-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 14px;
  background: var(--site-surface);
  border-bottom: 1px solid var(--site-border);
}
.code-lang {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--site-muted);
}
.code-copy-btn {
  padding: 3px 9px;
  border-radius: 5px;
  border: 1px solid var(--site-border);
  background: transparent;
  color: var(--site-muted);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.code-copy-btn:hover,
.code-copy-btn.is-copied {
  color: var(--site-accent);
  border-color: var(--site-accent);
  background: var(--site-accent-soft);
}
.code-card pre {
  margin: 0;
  padding: 16px 18px;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 13.5px;
  line-height: 1.62;
  background: transparent;
  color: var(--site-ink);
}
.code-card pre code, .hljs {
  font-family: var(--font-mono);
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  color: var(--site-ink);
}
.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-section { color: var(--hljs-kw); }
.hljs-string, .hljs-regexp, .hljs-meta .hljs-string { color: var(--hljs-str); }
.hljs-title, .hljs-title.function_, .hljs-title.class_ { color: var(--hljs-fn); }
.hljs-comment, .hljs-quote { color: var(--hljs-cmt); font-style: italic; }
.hljs-number, .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-params { color: var(--hljs-num); }
.hljs-built_in, .hljs-type, .hljs-symbol { color: var(--hljs-type); }
.article-body blockquote {
  border-left: 3px solid var(--site-accent);
  background: var(--site-surface);
  padding: 12px 18px;
  margin: 1.4em 0;
  border-radius: 0 10px 10px 0;
  color: var(--site-muted);
}
.article-body blockquote p:last-child { margin-bottom: 0; }
.table-scroll {
  width: 100%;
  overflow-x: auto;
  margin: 1.5em 0;
  border: 1px solid var(--site-border);
  border-radius: 10px;
  background: var(--site-surface);
}
.table-scroll table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14.5px;
}
.table-scroll th, .table-scroll td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--site-border);
  border-right: 1px solid var(--site-border);
  text-align: left;
  vertical-align: top;
}
.table-scroll th:last-child, .table-scroll td:last-child { border-right: none; }
.table-scroll tr:last-child td { border-bottom: none; }
.table-scroll th {
  font-weight: 600;
  background: var(--site-surface-alt);
  color: var(--site-ink);
}
.article-body img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1.4em auto;
  border-radius: 10px;
  border: 1px solid var(--site-border);
}
.mermaid {
  display: flex;
  justify-content: center;
  margin: 1.4em 0;
  padding: 16px;
  background: var(--site-surface);
  border: 1px solid var(--site-border);
  border-radius: 10px;
}
.mermaid svg { max-width: 100% !important; height: auto !important; }
.mermaid-error {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
  color: #f87171;
  font-size: 13px;
}
.wikilink {
  color: var(--site-accent);
  background: var(--site-accent-soft);
  padding: 1px 6px;
  border-radius: 5px;
  font-weight: 500;
}
.math-block { margin: 1.2em 0; text-align: center; overflow-x: auto; }
.site-footer {
  border-top: 1px solid var(--site-border);
  background: var(--site-surface);
}
.site-footer-inner {
  max-width: 1120px;
  margin: 0 auto;
  padding: 18px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
  color: var(--site-muted);
}
.back-to-top {
  color: var(--site-accent);
  text-decoration: none;
  font-weight: 500;
}
.back-to-top:hover { text-decoration: underline; }
@media (max-width: 640px) {
  .site-main { padding: 24px 16px 48px; }
  .site-header-inner { padding: 10px 16px; }
  .site-meta-pill, .site-action-label { display: none; }
}
@media print {
  .site-header, .site-toc, .toc-mobile, .code-copy-btn, .site-footer { display: none !important; }
  html, body, .site-shell { background: #ffffff !important; color: #0f172a !important; }
  .site-main { max-width: none; padding: 0; }
}
  </style>
</head>
<body>
  <div id="top" class="site-shell">
    <header class="site-header">
      <div class="site-header-inner">
        <a class="site-brand" href="#top">
          <span class="site-brand-dot" aria-hidden="true"></span>
          <span class="site-brand-title">${escapeHtml(safeTitle)}</span>
        </a>
        <div class="site-header-actions">
          ${stats.words > 0 ? `<span class="site-meta-pill">${stats.minutes} min read</span>` : ''}
          <button type="button" class="site-action-btn" data-theme-toggle aria-label="Toggle color theme" title="Toggle light or dark theme">
            <span class="theme-icon-sun" aria-hidden="true">☀</span>
            <span class="theme-icon-moon" aria-hidden="true">☾</span>
            <span class="site-action-label">Theme</span>
          </button>
          <button type="button" class="site-action-btn" data-print-doc aria-label="Print document" title="Print">
            <span>Print</span>
          </button>
        </div>
      </div>
    </header>

    <main class="site-main">
      <div class="site-layout${hasToc ? ' has-toc' : ''}">
        <article class="container">
          <header class="article-hero">
            <div class="article-meta">
              <span>${escapeHtml(dateLabel)}</span>
              ${stats.words > 0 ? `<span class="meta-dot" aria-hidden="true">•</span><span>${stats.words.toLocaleString()} words</span><span class="meta-dot" aria-hidden="true">•</span><span>${stats.minutes} min read</span>` : ''}
            </div>
            ${showHeroTitle ? `<h1 class="article-hero-title">${escapeHtml(safeTitle)}</h1>` : ''}
          </header>
          ${hasToc ? `<details class="toc-mobile"><summary>On this page</summary>${tocHtml}</details>` : ''}
          <div class="article-body">
            ${enhancedBody}
          </div>
        </article>
        ${hasToc ? `<aside class="site-toc" aria-label="On this page"><div class="toc-title">On this page</div>${tocHtml}</aside>` : ''}
      </div>
    </main>

    <footer class="site-footer">
      <div class="site-footer-inner">
        <span>${escapeHtml(safeTitle)}</span>
        <a class="back-to-top" href="#top">Back to top ↑</a>
      </div>
    </footer>
  </div>
${script}
</body>
</html>`
}

export function buildSourcePreview(
  content: string,
  theme?: Record<string, string>,
  mode: 'markdown' | 'text' = 'markdown',
  title?: string
): string {
  const tokens = normalizeTheme(theme)
  const cssClass = mode === 'markdown' ? 'md' : 'txt'
  const extraCss =
    mode === 'markdown'
      ? `.md { width: 100%; max-width: 820px; margin: 0 auto; font-family: var(--font-mono); font-size: 13px; line-height: 1.75; color: var(--text-main); white-space: pre-wrap; word-wrap: break-word; tab-size: 2; }`
      : `.txt { width: 100%; max-width: 820px; margin: 0 auto; font-family: var(--font-sans); font-size: 13.5px; line-height: 1.8; color: var(--text-main); white-space: pre-wrap; word-wrap: break-word; }`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || 'Preview')}</title>
  <style>
${themeVarsCss(tokens)}
${SHARED_SCROLLBAR_CSS}
* { box-sizing: border-box; }
html, body { background: var(--bg-editor); color: var(--text-main); margin: 0; padding: 24px; min-height: 100%; }
${extraCss}
  </style>
</head>
<body>
  <pre class="${cssClass}">${escapeHtml(content || '')}</pre>
</body>
</html>`
}

export async function buildPlainText(
  title: string | undefined,
  content: string,
  opts: { stripMarkdown?: boolean; includeTitle?: boolean } = {}
): Promise<string> {
  const { stripMarkdown = true, includeTitle = true } = opts
  const source = content || ''

  let body = source
  if (stripMarkdown) {
    const cleaned = convertWikilinks(source, 'plain')
    const marked = createExportMarked(false)
    const html = (await marked.parse(cleaned)) as string
    body = htmlToPlainText(html)
  }

  if (includeTitle && title && title.trim()) {
    const cleanTitle = title.trim()
    const firstLine = body.split(/\r?\n/)[0]?.trim() || ''
    const firstPlain = firstLine.replace(/^#+\s*/, '').trim()
    if (firstPlain.toLowerCase() !== cleanTitle.toLowerCase()) {
      const underline = '='.repeat(Math.min(cleanTitle.length, 48))
      return body ? `${cleanTitle}\n${underline}\n\n${body}` : `${cleanTitle}\n${underline}`
    }
  }

  return body
}

function mergeBatchMarkdown(notes: BatchExportNoteInput[]): string {
  return notes
    .map((n) => {
      const text = (n.content || '').trim()
      const noteTitle = (n.title || '').trim()
      if (noteTitle) {
        const firstLine = text.split(/\r?\n/)[0]?.trim() || ''
        const headingMatch = firstLine.match(/^#+\s*(.+)$/)
        if (headingMatch && headingMatch[1].trim().toLowerCase() === noteTitle.toLowerCase()) {
          return text
        }
        if (firstLine.startsWith('#')) {
          return text
        }
        return text ? `# ${noteTitle}\n\n${text}` : `# ${noteTitle}`
      }
      return text
    })
    .filter(Boolean)
    .join('\n\n---\n\n')
}

export async function buildPreviewDocument(payload: ExportPayload): Promise<PreviewResult> {
  const format = (payload?.format || 'pdf').toLowerCase()
  const title = payload?.title || 'Untitled'
  const includeToc = payload?.toc ?? true
  const optimizeImages = payload?.optimizeImages ?? true
  const stripMarkdown = payload?.stripMarkdown ?? true
  const includeTitle = payload?.includeTitle ?? true
  const theme = payload?.theme

  let effectiveMarkdown = payload?.content || ''
  if (Array.isArray(payload?.notes) && payload.notes.length > 0) {
    effectiveMarkdown = mergeBatchMarkdown(payload.notes)
  }

  let html = ''
  if (format === 'pdf' || format === 'docs' || format === 'html') {
    const themeTokens = normalizeTheme(theme)
    const mermaidMode =
      format === 'pdf'
        ? 'print'
        : format === 'docs'
          ? 'docs'
          : isLightColorHexOrRgb(themeTokens['bg-editor'])
            ? 'light'
            : 'dark'

    const rendered = await renderMarkdownForExport(effectiveMarkdown, {
      wikilinkMode: format === 'docs' ? 'link' : 'span',
      mermaidMode,
      toc: includeToc,
      optimizeImages
    })

    if (format === 'pdf') {
      html = buildPDFDocument(title, rendered.html, rendered.tocHtml)
    } else if (format === 'docs') {
      html = buildDocsDocument(title, rendered.html, rendered.tocHtml, true)
    } else {
      html = buildCleanHTMLDocument(title, rendered.html, rendered.tocHtml, theme)
    }
  } else if (format === 'markdown' || format === 'markdown-bundle' || format === 'zip') {
    html = buildSourcePreview(effectiveMarkdown, theme, 'markdown', title)
  } else if (format === 'text') {
    const plain = await buildPlainText(title, effectiveMarkdown, { stripMarkdown, includeTitle })
    html = buildSourcePreview(plain, theme, 'text', title)
  } else {
    throw new Error(`Unsupported preview format: ${format}`)
  }

  const MAX_LEN = 2_500_000
  const truncated = html.length > MAX_LEN
  return {
    html: truncated ? html.slice(0, MAX_LEN) : html,
    format,
    truncated
  }
}

export async function exportPreview(payload: ExportPayload): Promise<PreviewResult> {
  return buildPreviewDocument(payload)
}

function resolveHtmlMermaidMode(theme?: Record<string, string>): 'light' | 'dark' {
  if (!theme || Object.keys(theme).length === 0) return 'dark'
  return isLightColorHexOrRgb(normalizeTheme(theme)['bg-editor']) ? 'light' : 'dark'
}

export async function formatCopyableContent(payload: ExportPayload): Promise<string> {
  const format = (payload?.format || 'markdown').toLowerCase()
  const title = payload?.title || 'Untitled'
  const content = payload?.content || ''

  if (format === 'text') {
    return buildPlainText(title, content, {
      stripMarkdown: payload?.stripMarkdown ?? true,
      includeTitle: payload?.includeTitle ?? true
    })
  }
  if (format === 'html') {
    const rendered = await renderMarkdownForExport(content, {
      wikilinkMode: 'span',
      mermaidMode: resolveHtmlMermaidMode(payload?.theme),
      toc: payload?.toc ?? true,
      optimizeImages: payload?.optimizeImages ?? true
    })
    return buildCleanHTMLDocument(title, rendered.html, rendered.tocHtml, payload?.theme)
  }
  return content
}

async function pickSavePath(
  title: string,
  defaultName: string,
  filterName: string,
  extensions: string[]
): Promise<string | null> {
  return invoke<string | null>('export_pick_save_path', {
    title,
    defaultName,
    filterName,
    extensions
  })
}

async function pickExportDirectory(title: string): Promise<string | null> {
  return invoke<string | null>('export_pick_directory', { title })
}

export async function exportHTML(payload: ExportPayload): Promise<ExportResult> {
  const {
    title = 'Untitled',
    content = '',
    toc = true,
    optimizeImages = true,
    theme
  } = payload || {}
  if (!content) throw new Error('No content provided')

  const filePath = await pickSavePath('Export as HTML', `${safeFileName(title)}.html`, 'HTML Document', ['html', 'htm'])
  if (!filePath) return { success: false, canceled: true }

  const rendered = await renderMarkdownForExport(content, {
    wikilinkMode: 'span',
    mermaidMode: resolveHtmlMermaidMode(theme),
    toc,
    optimizeImages
  })
  const html = buildCleanHTMLDocument(title, rendered.html, rendered.tocHtml, theme)
  return invoke<ExportResult>('export_write_file', { filePath, content: html, bytes: null })
}

export async function exportPDF(payload: ExportPayload): Promise<ExportResult> {
  const { title = 'Untitled', content = '', toc = true, optimizeImages = true } = payload || {}
  if (!content) throw new Error('No content provided')

  const filePath = await pickSavePath('Export as PDF', `${safeFileName(title)}.pdf`, 'PDF Document', ['pdf'])
  if (!filePath) return { success: false, canceled: true }

  const rendered = await renderMarkdownForExport(content, {
    wikilinkMode: 'span',
    mermaidMode: 'print',
    toc,
    optimizeImages
  })
  const html = buildPDFDocument(title, rendered.html, rendered.tocHtml)
  return invoke<ExportResult>('export_render_pdf', { html, filePath, landscape: false })
}

export async function exportDocs(payload: ExportPayload): Promise<ExportResult> {
  const { title = 'Untitled', content = '', toc = true, optimizeImages = true } = payload || {}
  if (!content) throw new Error('No content provided')

  const filePath = await pickSavePath('Export as Word Document', `${safeFileName(title)}.doc`, 'Word Document', ['doc'])
  if (!filePath) return { success: false, canceled: true }

  const rendered = await renderMarkdownForExport(content, {
    wikilinkMode: 'link',
    mermaidMode: 'docs',
    toc,
    optimizeImages
  })
  const docHtml = buildDocsDocument(title, rendered.html, rendered.tocHtml, false)
  return invoke<ExportResult>('export_write_file', { filePath, content: docHtml, bytes: null })
}

export async function exportMarkdown(payload: ExportPayload): Promise<ExportResult> {
  const { title = 'Untitled', content = '' } = payload || {}
  if (!content) throw new Error('No content provided')

  const filePath = await pickSavePath('Export as Markdown', `${safeFileName(title)}.md`, 'Markdown Files', ['md', 'markdown'])
  if (!filePath) return { success: false, canceled: true }

  return invoke<ExportResult>('export_write_file', { filePath, content, bytes: null })
}

export async function exportText(payload: ExportPayload): Promise<ExportResult> {
  const {
    title = 'Untitled',
    content = '',
    stripMarkdown = true,
    includeTitle = true
  } = payload || {}
  if (!content) throw new Error('No content provided')

  const filePath = await pickSavePath('Export as Plain Text', `${safeFileName(title)}.txt`, 'Text Files', ['txt'])
  if (!filePath) return { success: false, canceled: true }

  const plain = await buildPlainText(title, content, { stripMarkdown, includeTitle })
  return invoke<ExportResult>('export_write_file', { filePath, content: plain, bytes: null })
}

export async function exportMarkdownBundle(payload: ExportPayload): Promise<ExportResult> {
  const {
    title = 'Untitled',
    content = '',
    compressZip = false,
    optimizeImages = true
  } = payload || {}
  if (!content) throw new Error('No content provided')

  const safeTitle = safeFileName(title)
  const assets = await collectLocalAssets(content, optimizeImages)

  if (compressZip) {
    const filePath = await pickSavePath(
      'Export as ZIP Archive',
      `${safeTitle}.zip`,
      'ZIP Archive',
      ['zip']
    )
    if (!filePath) return { success: false, canceled: true }

    const rewritten = rewriteMarkdownAssetLinks(content, assets, './assets/')
    const entries: Array<{ name: string; text?: string; bytes?: number[] }> = [
      { name: `${safeTitle}.md`, text: rewritten }
    ]
    for (const asset of assets) {
      entries.push({ name: `assets/${asset.filename}`, bytes: Array.from(asset.bytes) })
    }
    return invoke<ExportResult>('export_write_zip', { filePath, entries })
  }

  const filePath = await pickSavePath(
    'Export Markdown Bundle',
    `${safeTitle}.md`,
    'Markdown Bundle',
    ['md', 'markdown']
  )
  if (!filePath) return { success: false, canceled: true }

  const rewritten = rewriteMarkdownAssetLinks(content, assets, './assets/')
  const rustAssets = assets.map((a) => ({
    filename: a.filename,
    bytes: Array.from(a.bytes)
  }))

  return invoke<ExportResult>('export_write_markdown_bundle', {
    filePath,
    markdown: rewritten,
    assets: rustAssets
  })
}

export async function exportZip(payload: ExportPayload): Promise<ExportResult> {
  return exportMarkdownBundle({ ...payload, compressZip: true })
}

export async function exportBatch(payload: BatchExportPayload): Promise<ExportResult> {
  const notes = payload?.notes || []
  const format = (payload?.format || 'markdown').toLowerCase()
  const isZip = Boolean(payload?.compressZip) || format === 'zip'
  const effectiveFormat = format === 'zip' ? 'markdown' : format
  const optimizeImages = payload?.optimizeImages ?? true
  const stripMarkdown = payload?.stripMarkdown ?? true
  const includeTitle = payload?.includeTitle ?? true
  const toc = payload?.toc ?? true
  const theme = payload?.theme

  if (notes.length === 0) throw new Error('No notes selected')

  if (isZip) {
    const archiveBase = safeFileName(payload?.archiveTitle || 'Lumina-Notes')
    const filePath =
      payload?.filePath ||
      (await pickSavePath('Save ZIP Archive', `${archiveBase}.zip`, 'ZIP Archive', ['zip']))
    if (!filePath) return { success: false, canceled: true }

    emitBatchProgress({ phase: 'start', current: 0, total: notes.length, title: 'Packaging…' })

    const entries: Array<{ name: string; text?: string; bytes?: number[] }> = []
    const usedZipNames = new Set<string>()
    let exported = 0
    let failed = 0
    const failures: Array<{ id: string; title: string; error: string }> = []

    const uniqueZipPath = (base: string, ext: string): string => {
      let cand = `${base}.${ext}`
      let n = 1
      while (usedZipNames.has(cand.toLowerCase())) {
        cand = `${base} (${n}).${ext}`
        n += 1
      }
      usedZipNames.add(cand.toLowerCase())
      return cand
    }

    for (let i = 0; i < notes.length; i += 1) {
      const note = notes[i]
      const noteTitle = note.title || 'Untitled'
      const noteContent = note.content || ''
      const base = safeFileName(noteTitle)
      try {
        if (effectiveFormat === 'html') {
          const rendered = await renderMarkdownForExport(noteContent, {
            wikilinkMode: 'span',
            mermaidMode: resolveHtmlMermaidMode(theme),
            toc,
            optimizeImages
          })
          entries.push({
            name: uniqueZipPath(base, 'html'),
            text: buildCleanHTMLDocument(noteTitle, rendered.html, rendered.tocHtml, theme)
          })
        } else if (effectiveFormat === 'docs') {
          const rendered = await renderMarkdownForExport(noteContent, {
            wikilinkMode: 'link',
            mermaidMode: 'docs',
            toc,
            optimizeImages
          })
          entries.push({
            name: uniqueZipPath(base, 'doc'),
            text: buildDocsDocument(noteTitle, rendered.html, rendered.tocHtml, false)
          })
        } else if (effectiveFormat === 'text') {
          const plain = await buildPlainText(noteTitle, noteContent, { stripMarkdown, includeTitle })
          entries.push({ name: uniqueZipPath(base, 'txt'), text: plain })
        } else {
          const assets = await collectLocalAssets(noteContent, optimizeImages)
          const rewritten = rewriteMarkdownAssetLinks(noteContent, assets, './assets/')
          entries.push({ name: uniqueZipPath(base, 'md'), text: rewritten })
          for (const asset of assets) {
            const assetKey = `assets/${asset.filename}`
            if (!usedZipNames.has(assetKey.toLowerCase())) {
              usedZipNames.add(assetKey.toLowerCase())
              entries.push({ name: assetKey, bytes: Array.from(asset.bytes) })
            }
          }
        }
        exported += 1
        emitBatchProgress({ phase: 'done', current: i + 1, total: notes.length, title: noteTitle })
      } catch (err: any) {
        failed += 1
        failures.push({
          id: note.id || String(i),
          title: noteTitle,
          error: err?.message || 'Failed to package note'
        })
        emitBatchProgress({
          phase: 'error',
          current: i + 1,
          total: notes.length,
          title: noteTitle,
          error: err?.message
        })
      }
    }

    const res = await invoke<ExportResult>('export_write_zip', { filePath, entries })
    emitBatchProgress({ phase: 'complete', current: notes.length, total: notes.length })
    return {
      ...res,
      success: exported > 0,
      ...(exported === 0 && failures.length > 0 ? { error: failures[0].error } : {}),
      filePath,
      isZip: true,
      total: notes.length,
      exported,
      failed,
      failures
    }
  }

  const outputDir = payload?.outputDir || (await pickExportDirectory('Select Batch Export Folder'))
  if (!outputDir) return { success: false, canceled: true }

  emitBatchProgress({ phase: 'start', current: 0, total: notes.length, title: 'Starting…' })

  let exported = 0
  let failed = 0
  const failures: Array<{ id: string; title: string; error: string }> = []

  for (let i = 0; i < notes.length; i += 1) {
    const note = notes[i]
    const noteTitle = note.title || 'Untitled'
    const noteContent = note.content || ''
    try {
      const ext =
        effectiveFormat === 'pdf'
          ? 'pdf'
          : effectiveFormat === 'docs'
            ? 'doc'
            : effectiveFormat === 'html'
              ? 'html'
              : effectiveFormat === 'text'
                ? 'txt'
                : 'md'
      const destPath = await invoke<string>('export_unique_path', {
        dir: outputDir,
        baseName: noteTitle,
        ext
      })

      if (effectiveFormat === 'pdf') {
        const rendered = await renderMarkdownForExport(noteContent, {
          wikilinkMode: 'span',
          mermaidMode: 'print',
          toc,
          optimizeImages
        })
        const html = buildPDFDocument(noteTitle, rendered.html, rendered.tocHtml)
        await invoke('export_render_pdf', { html, filePath: destPath, landscape: false })
      } else if (effectiveFormat === 'docs') {
        const rendered = await renderMarkdownForExport(noteContent, {
          wikilinkMode: 'link',
          mermaidMode: 'docs',
          toc,
          optimizeImages
        })
        const docHtml = buildDocsDocument(noteTitle, rendered.html, rendered.tocHtml, false)
        await invoke('export_write_file', { filePath: destPath, content: docHtml, bytes: null })
      } else if (effectiveFormat === 'html') {
        const rendered = await renderMarkdownForExport(noteContent, {
          wikilinkMode: 'span',
          mermaidMode: resolveHtmlMermaidMode(theme),
          toc,
          optimizeImages
        })
        const html = buildCleanHTMLDocument(noteTitle, rendered.html, rendered.tocHtml, theme)
        await invoke('export_write_file', { filePath: destPath, content: html, bytes: null })
      } else if (effectiveFormat === 'text') {
        const plain = await buildPlainText(noteTitle, noteContent, { stripMarkdown, includeTitle })
        await invoke('export_write_file', { filePath: destPath, content: plain, bytes: null })
      } else {
        const assets = await collectLocalAssets(noteContent, optimizeImages)
        if (assets.length > 0) {
          const rewritten = rewriteMarkdownAssetLinks(noteContent, assets, './assets/')
          await invoke('export_write_markdown_bundle', {
            filePath: destPath,
            markdown: rewritten,
            assets: assets.map((a) => ({ filename: a.filename, bytes: Array.from(a.bytes) }))
          })
        } else {
          await invoke('export_write_file', { filePath: destPath, content: noteContent, bytes: null })
        }
      }

      exported += 1
      emitBatchProgress({
        phase: 'done',
        current: i + 1,
        total: notes.length,
        title: noteTitle,
        filePath: destPath
      })
    } catch (err: any) {
      failed += 1
      failures.push({
        id: note.id || String(i),
        title: noteTitle,
        error: err?.message || 'Export error'
      })
      emitBatchProgress({
        phase: 'error',
        current: i + 1,
        total: notes.length,
        title: noteTitle,
        error: err?.message
      })
    }
  }

  emitBatchProgress({ phase: 'complete', current: notes.length, total: notes.length })
  return {
    success: exported > 0,
    ...(exported === 0 && failures.length > 0 ? { error: failures[0].error } : {}),
    outputDir,
    total: notes.length,
    exported,
    failed,
    failures
  }
}

export async function exportCombined(payload: BatchExportPayload): Promise<ExportResult> {
  const notes = payload?.notes || []
  const format = (payload?.format || 'pdf').toLowerCase()
  const toc = payload?.toc ?? true
  const optimizeImages = payload?.optimizeImages ?? true
  const stripMarkdown = payload?.stripMarkdown ?? true
  const includeTitle = payload?.includeTitle ?? true
  const theme = payload?.theme

  if (notes.length === 0) throw new Error('No notes provided for combined export')

  const docTitle =
    payload?.title || (notes.length === 1 ? notes[0]?.title || 'Untitled' : 'Combined Export')
  const baseName = safeFileName(docTitle)

  const filterSpecs: Record<string, { title: string; ext: string; label: string; exts: string[] }> = {
    pdf: { title: 'Save Combined PDF', ext: 'pdf', label: 'PDF Files', exts: ['pdf'] },
    docs: { title: 'Save Combined Word Document', ext: 'doc', label: 'Word Document', exts: ['doc'] },
    html: { title: 'Save Combined HTML', ext: 'html', label: 'HTML Document', exts: ['html', 'htm'] },
    markdown: {
      title: 'Save Combined Markdown',
      ext: 'md',
      label: 'Markdown Document',
      exts: ['md', 'markdown']
    },
    text: { title: 'Save Combined Text', ext: 'txt', label: 'Text Files', exts: ['txt'] }
  }

  const spec = filterSpecs[format] || filterSpecs.pdf
  const filePath =
    payload?.filePath ||
    (await pickSavePath(spec.title, `${baseName}.${spec.ext}`, spec.label, spec.exts))
  if (!filePath) return { success: false, canceled: true }

  emitBatchProgress({ phase: 'start', current: 0, total: notes.length + 1, title: 'Preparing…' })

  const mergedMarkdown = mergeBatchMarkdown(notes)

  notes.forEach((n, idx) => {
    emitBatchProgress({
      phase: 'merging',
      current: idx + 1,
      total: notes.length + 1,
      title: n.title || 'Untitled'
    })
  })

  if (format === 'pdf') {
    const rendered = await renderMarkdownForExport(mergedMarkdown, {
      wikilinkMode: 'span',
      mermaidMode: 'print',
      toc,
      optimizeImages
    })
    const html = buildPDFDocument(docTitle, rendered.html, rendered.tocHtml)
    await invoke('export_render_pdf', { html, filePath, landscape: false })
  } else if (format === 'docs') {
    const rendered = await renderMarkdownForExport(mergedMarkdown, {
      wikilinkMode: 'link',
      mermaidMode: 'docs',
      toc,
      optimizeImages
    })
    const docHtml = buildDocsDocument(docTitle, rendered.html, rendered.tocHtml, false)
    await invoke('export_write_file', { filePath, content: docHtml, bytes: null })
  } else if (format === 'html') {
    const rendered = await renderMarkdownForExport(mergedMarkdown, {
      wikilinkMode: 'span',
      mermaidMode: resolveHtmlMermaidMode(theme),
      toc,
      optimizeImages
    })
    const html = buildCleanHTMLDocument(docTitle, rendered.html, rendered.tocHtml, theme)
    await invoke('export_write_file', { filePath, content: html, bytes: null })
  } else if (format === 'markdown') {
    await invoke('export_write_file', { filePath, content: mergedMarkdown, bytes: null })
  } else {
    const plain = await buildPlainText(docTitle, mergedMarkdown, { stripMarkdown, includeTitle })
    await invoke('export_write_file', { filePath, content: plain, bytes: null })
  }

  emitBatchProgress({ phase: 'complete', current: notes.length + 1, total: notes.length + 1 })
  return {
    success: true,
    filePath,
    total: notes.length,
    exported: notes.length,
    failed: 0,
    combined: true
  }
}
