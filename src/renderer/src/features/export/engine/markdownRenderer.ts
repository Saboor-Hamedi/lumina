import { Marked, type Tokens } from 'marked'
import hljs from '../../../core/code/hljsCore'
import katex from 'katex'
import { embedImagesAsDataUri } from './assetPipeline'
import {
  escapeHtml,
  htmlToPlainText,
  slugifyHeading,
  type BatchExportNoteInput
} from './types'

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

export function createExportMarked(mermaidEnabled: boolean): Marked {
  const m = new Marked({ gfm: true, breaks: false })
  m.use({
    extensions: [
      {
        name: 'mathBlock',
        level: 'block',
        start(src: string) {
          return src.match(/\$\$/)?.index
        },
        tokenizer(src: string) {
          const match = /^\$\$([\s\S]+?)\$\$(?:\r?\n+|$)/.exec(src)
          if (match) {
            return {
              type: 'mathBlock',
              raw: match[0],
              text: match[1].trim()
            }
          }
          return undefined
        },
        renderer(token: any) {
          try {
            const mathml = katex.renderToString(String(token.text || ''), {
              displayMode: true,
              throwOnError: false,
              output: 'mathml'
            })
            return `<div class="math-block">${mathml}</div>\n`
          } catch {
            return `<pre class="math-fallback">${escapeHtml(String(token.text || ''))}</pre>\n`
          }
        }
      },
      {
        name: 'mathInline',
        level: 'inline',
        start(src: string) {
          return src.match(/(^|[^\\])\$/)?.index
        },
        tokenizer(src: string) {
          const match = /^\$(?!\s)([^$\n\r]+?)\$/.exec(src)
          if (match) {
            const inner = match[1]
            if (inner.endsWith(' ') || inner.endsWith('\\')) return undefined
            return {
              type: 'mathInline',
              raw: match[0],
              text: inner.trim()
            }
          }
          return undefined
        },
        renderer(token: any) {
          try {
            const mathml = katex.renderToString(String(token.text || ''), {
              displayMode: false,
              throwOnError: false,
              output: 'mathml'
            })
            return `<span class="math-inline">${mathml}</span>`
          } catch {
            return escapeHtml(String(token.raw || ''))
          }
        }
      }
    ],
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
    const width = Math.max(1, Math.ceil((viewBox && viewBox.width) || widthAttr || 600))
    const height = Math.max(1, Math.ceil((viewBox && viewBox.height) || heightAttr || 360))

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

export function mergeBatchMarkdown(notes: BatchExportNoteInput[]): string {
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
