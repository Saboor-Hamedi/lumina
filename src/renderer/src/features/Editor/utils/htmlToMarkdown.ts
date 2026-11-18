/**
 * htmlToMarkdown.ts
 * 
 * Enterprise-grade HTML-to-Markdown engine and paste pipeline for Lumina.
 * Specifically engineered for Microsoft Word, Google Docs, Web tables, and rich text.
 * 
 * Architecture & Guarantees:
 * - Resilient & Non-Breaking: Safe parsing with complete fallback to plain text on any error.
 * - Million-Character & Deep-Tree Hardened: Enforces input length caps, tree depth clamps, and table row limits.
 * - Table Polish: Zero literal <br> tags in table cells; handles colspan balance and text alignment (:---:, ---:).
 * - Single-Column Preservation: Prevents 1-column copied tables from collapsing into a single row.
 * - Link Fidelity: Preserves rich markdown links [text](url) copied from websites, resolving relative URLs.
 * - Paragraph Flow: Cleans mid-sentence ragged line breaks and justification spacing for continuous text flow.
 * - Table of Contents (TOC): Clean single-line entries with hierarchical indent levels (MsoToc1 -> -, MsoToc2 ->   -).
 * - References / Bibliography: Auto-detects and highlights raw URLs/DOIs into [url](url); prevents multi-line spacing gaps.
 * - Embedded Images: Extracts base64 images and saves to workspace assets via onSaveImage callback.
 * - Selection Safety: Atomic dispatch clamping prevents RangeError selection out-of-bounds exceptions.
 */

import type { EditorView } from '@codemirror/view'
import { trySmartLinkPaste } from './smartLinkPaste'

export const MAX_HTML_PARSE_LENGTH = 1_000_000 // 1MB payload safety guard
export const MAX_PARSE_DEPTH = 32 // Prevent call stack overflow on deeply nested trees
export const MAX_CHILDREN_PER_NODE = 2000 // Prevent iteration freezing on thousands of inline spans
export const MAX_TABLE_ROWS = 500 // Prevent memory exhaustion on massive spreadsheets

export interface ImageState {
  seen: Set<string>
  saved: number
}

export interface HtmlToMarkdownOptions {
  baseHref?: string
  imageState?: ImageState
  maxImages?: number
  maxDepth?: number
  maxHtmlLength?: number
  onSaveImage?: (uint8Array: Uint8Array, filename: string) => Promise<string | null>
  onSaveImageFromPath?: (filePath: string, filename?: string) => Promise<string | null>
  onGetClipboardImage?: () => Promise<string | null>
}

/**
 * Extracts base href or SourceURL from HTML if present (e.g. from Word or Chromium clipboard header).
 */
export function extractBaseHref(html: string): string {
  if (!html || typeof html !== 'string') return ''
  const baseMatch = html.match(/<base\s+[^>]*href=["']([^"']+)["']/i)
  if (baseMatch) return baseMatch[1]
  const sourceUrlMatch = html.match(/(?:SourceURL|URL):\s*([^\r\n]+)/i)
  if (sourceUrlMatch) return sourceUrlMatch[1].trim()
  return ''
}

/**
 * Detects whether plain text represents a tab-separated spreadsheet table (e.g. copied from Excel/Sheets).
 */
export function isTsvTable(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim()
  if (!trimmed.includes('\t') || !trimmed.includes('\n')) return false

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return false

  // At least 2 lines must contain tab characters
  const tabLines = lines.filter((l) => l.includes('\t'))
  return tabLines.length >= 2 && tabLines.length >= lines.length * 0.7
}

/**
 * Converts tab-separated spreadsheet values into a clean GitHub-Flavored Markdown table.
 */
export function tsvToMarkdownTable(tsv: string): string {
  const lines = tsv.trim().split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return ''

  const rows = lines.map((line) =>
    line.split('\t').map((cell) => cell.trim().replace(/\|/g, '\\|'))
  )

  const maxCols = Math.max(...rows.map((r) => r.length))
  if (maxCols <= 1) {
    return `\n\n${rows.map((r) => r[0]).join('\n\n')}\n\n`
  }

  const paddedRows = rows.map((row) => {
    const padded = [...row]
    while (padded.length < maxCols) padded.push(' ')
    return padded
  })

  const headerRow = paddedRows[0]
  const headerLine = `| ${headerRow.map((c) => c || ' ').join(' | ')} |`
  const sepLine = `| ${new Array(maxCols).fill('---').join(' | ')} |`
  const bodyLines = paddedRows.slice(1).map((r) => `| ${r.map((c) => c || ' ').join(' | ')} |`)

  return `\n\n${[headerLine, sepLine, ...bodyLines].join('\n')}\n\n`
}

/**
 * Automatically converts raw URLs in plain text into Markdown links [url](url),
 * skipping punctuation at the end and avoiding double-linking URLs already wrapped in markdown links.
 */
export function autolinkText(text: string): string {
  if (!text || typeof text !== 'string') return ''

  // Matches http://, https://, or www., skipping URLs already inside markdown [text](url) or <url>
  const urlRegex = /(?<!\(|<)\b(https?:\/\/[^\s<>()"']+|www\.[^\s<>()"']+)/gi

  return text.replace(urlRegex, (url) => {
    let cleanUrl = url
    let trailingPunct = ''

    // Strip trailing punctuation like . , ; : ? ! )
    const matchPunct = cleanUrl.match(/[.,;:?!)]+$/)
    if (matchPunct) {
      trailingPunct = matchPunct[0]
      cleanUrl = cleanUrl.slice(0, -trailingPunct.length)
    }

    const href = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`
    return `[${cleanUrl}](${href})${trailingPunct}`
  })
}

/**
 * Detects whether an image src is a local filesystem path or file:// URI.
 */
export function isLocalPath(src: string): boolean {
  if (!src || typeof src !== 'string') return false
  const trimmed = src.trim()
  if (trimmed.startsWith('data:')) return false
  if (/^https?:\/\//i.test(trimmed)) return false
  if (/^file:\/\//i.test(trimmed)) return true
  if (/^[a-zA-Z]:[\\/]/.test(trimmed)) return true
  if (trimmed.startsWith('\\\\')) return true
  return false
}

/**
 * Strips Microsoft Word proprietary comments, XML tags, and wrapper fragments.
 */
export function cleanWordHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== 'string') return ''

  let html = rawHtml

  // 1. Extract content between Word fragment markers if present
  const fragmentStart = html.indexOf('<!--StartFragment-->')
  const fragmentEnd = html.lastIndexOf('<!--EndFragment-->')
  if (fragmentStart !== -1 && fragmentEnd !== -1) {
    html = html.substring(fragmentStart + '<!--StartFragment-->'.length, fragmentEnd)
  }

  // 2. Convert Word HYPERLINK field codes to <a> tags before stripping comments
  html = html.replace(/HYPERLINK\s+"([^"]+)"(?:\s*\\l\s*"[^"]*")?\s*([^\r\n<]*)/gi, (_match, url, text) => {
    const linkText = text.trim() || url
    return `<a href="${url}">${linkText}</a>`
  })

  // 3. Unwrap Word textboxes so figure captions and text inside shapes are never deleted
  html = html.replace(/<v:textbox[^>]*>([\s\S]*?)<\/v:textbox>/gi, '$1')

  // 4. Preserve Word images before stripping conditional comments:
  // (a) If a VML conditional block is followed by a non-VML block (<![if !vml]><img ...><![endif]>),
  //     remove ONLY that specific VML block (safe non-bridging regex)
  html = html.replace(/<!--\[if\s+gte\s+vml\s+1\]>(?:(?!<!\[endif\]-->)[\s\S])*?<!\[endif\]-->\s*(?=<!\[if\s+!vml\]>)/gi, '')

  // (b) Unwrap non-VML conditional block wrappers so the standard <img> is preserved for DOMParser
  html = html.replace(/<!\[if\s+!vml\]>/gi, '').replace(/<!\[endif\]>/gi, '')

  // (c) Unwrap <!--[if !mso]>...<![endif]--> conditional blocks safely
  html = html.replace(/<!--\[if\s+!mso\]>((?:(?!<!\[endif\]-->)[\s\S])*?)<!\[endif\]-->/gi, '$1')

  // (d) Strip Word field code comments safely (e.g. <!--[if supportFields]>...<![endif]-->)
  html = html.replace(/<!--\[if\s+supportFields\]>(?:(?!<!\[endif\]-->)[\s\S])*?<!\[endif\]-->/gi, '')

  // (e) If a VML conditional block has <v:imagedata> and had NO non-VML fallback, convert to <img> before comments are stripped
  html = html.replace(/<!--\[if\b(?:(?!<!\[endif\]-->)[\s\S])*?<v:imagedata[^>]*src=["']?([^"'\s>]+)["']?[^>]*>(?:(?!<!\[endif\]-->)[\s\S])*?<!\[endif\]-->/gi, (match, src) => {
    const titleMatch = match.match(/o:title=["']([^"']*)["']/i)
    const alt = titleMatch ? titleMatch[1] : 'image'
    return `<img src="${src}" alt="${alt}" />`
  })

  // (f) Convert any remaining standalone <v:imagedata> elements into standard <img> tags
  html = html.replace(/<v:imagedata[^>]*src=["']?([^"'\s>]+)["']?[^>]*>/gi, (match, src) => {
    const titleMatch = match.match(/o:title=["']([^"']*)["']/i)
    const alt = titleMatch ? titleMatch[1] : 'image'
    return `<img src="${src}" alt="${alt}" />`
  })

  // 5. Strip remaining Word conditional comments using safe non-bridging regex
  html = html.replace(/<!--\[if\b(?:(?!<!\[endif\]-->)[\s\S])*?<!\[endif\]-->/gi, '')

  // 6. Strip generic HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, '')

  // 7. Strip <style>, <script>, <xml>, <meta>, <link> blocks
  html = html.replace(/<(style|script|xml|meta|link)[^>]*>[\s\S]*?<\/\1>/gi, '')
  html = html.replace(/<(meta|link)[^>]*\/?>/gi, '')

  // 8. Strip Word namespace tags (e.g. <o:p>...</o:p>, <w:WordDocument>)
  html = html.replace(/<\/?\w+:[^>]*>/gi, '')

  // 9. Strip empty Word spacer paragraphs (e.g. <p class="MsoNormal">&nbsp;</p>)
  html = html.replace(/<p[^>]*>\s*(?:&nbsp;|\u00A0|\s)*<\/p>/gi, '')

  // 10. Strip inter-tag whitespace between block elements to avoid stray blank lines
  html = html.replace(/<\/(p|div|h[1-6]|tr|table|ul|ol|li)>\s+<(p|div|h[1-6]|tr|table|ul|ol|li)/gi, '</$1><$2')

  return html.trim()
}

/**
 * Converts a base64 data URL to a Uint8Array safely.
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  try {
    const base64Index = dataUrl.indexOf(';base64,')
    if (base64Index === -1) return null
    const base64Data = dataUrl.substring(base64Index + ';base64,'.length)
    const binaryString = typeof window !== 'undefined' ? window.atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary')
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  } catch (err) {
    console.error('Failed to parse base64 data URL:', err)
    return null
  }
}

/**
 * Detects whether an HTML element represents a Word list item.
 */
function isWordListItem(el: Element): boolean {
  const className = el.className || ''
  return typeof className === 'string' && className.toLowerCase().includes('msolistparagraph')
}

/**
 * Detects whether an HTML element represents a Word Table of Contents item,
 * and returns the 1-based hierarchy level (1, 2, 3, etc.).
 */
function getWordTocLevel(el: Element): number {
  const className = (el.className || '').toLowerCase()
  if (!className.includes('toc')) return 0
  const match = className.match(/toc([1-6])/i)
  if (match) return parseInt(match[1], 10)
  return 1
}

/**
 * Detects whether an HTML element represents a Bibliography or Reference item.
 */
function isWordReferenceItem(el: Element): boolean {
  const className = (el.className || '').toLowerCase()
  return (
    className.includes('msobibliography') ||
    className.includes('bibliography') ||
    className.includes('reference') ||
    className.includes('citation')
  )
}

/**
 * Normalizes text content with Markdown delimiters, ensuring whitespace is not wrapped inside.
 * e.g. "  hello  " wrapped in "**" becomes "  **hello**  "
 */
function wrapFormattedText(text: string, delimiter: string): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (!trimmed) return text

  const leadSpace = text.match(/^\s*/)?.[0] || ''
  const trailSpace = text.match(/\s*$/)?.[0] || ''

  return `${leadSpace}${delimiter}${trimmed}${delimiter}${trailSpace}`
}

/**
 * Normalizes intra-paragraph text flow by flattening accidental ragged line wraps,
 * multiple spaces, tabs, and Word justification spacers into a clean continuous sentence.
 */
function justifyParagraphText(text: string): string {
  if (!text) return ''
  return text
    .replace(/\r?\n+/g, ' ')
    .replace(/[ \t\u00A0\u2007\u202F]+/g, ' ')
    .trim()
}

/**
 * Recursively converts an HTML DOM element and its children into clean Markdown text.
 * Guarded against deep call stacks and excessive children.
 */
export async function convertDomNodeToMarkdown(
  node: Node,
  options: HtmlToMarkdownOptions = {},
  listDepth: number = 0
): Promise<string> {
  const { onSaveImage } = options
  const maxDepth = options.maxDepth ?? MAX_PARSE_DEPTH

  // Depth-cutoff safeguard against call stack overflow on deeply nested elements
  if (listDepth > maxDepth) {
    return node.textContent ? node.textContent.replace(/[\u00A0\u2007\u202F]/g, ' ') : ''
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const raw = (node.textContent || '').replace(/[\u00A0\u2007\u202F]/g, ' ')

    // Auto-link plain text URLs when not already wrapped inside <a>, <code>, or <pre>
    const parentTag = node.parentElement ? node.parentElement.tagName.toLowerCase() : ''
    const isInsideLinkOrCode =
      parentTag === 'a' ||
      parentTag === 'code' ||
      parentTag === 'pre' ||
      Boolean(node.parentElement?.closest?.('a, code, pre'))

    if (!isInsideLinkOrCode && (raw.includes('http') || raw.includes('www.'))) {
      return autolinkText(raw)
    }

    return raw
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const el = node as HTMLElement
  const tagName = el.tagName.toLowerCase()

  if (tagName === 'table') {
    return convertTableToMarkdown(el, options, listDepth)
  }

  if (tagName === 'pre') {
    const codeText = el.textContent || ''
    return `\n\n\`\`\`\n${codeText.replace(/\r\n/g, '\n').trim()}\n\`\`\`\n\n`
  }

  if (tagName === 'ul' || tagName === 'ol') {
    const indent = '  '.repeat(listDepth)
    const items = Array.from(el.children).filter((child) => child.tagName.toLowerCase() === 'li')
    const listLines: string[] = []

    for (let index = 0; index < items.length; index += 1) {
      const itemMarkdown = await convertDomNodeToMarkdown(items[index], options, listDepth + 1)
      const marker = tagName === 'ul' ? '-' : `${index + 1}.`
      listLines.push(`${indent}${marker} ${itemMarkdown.trim()}`)
    }

    return `\n\n${listLines.join('\n')}\n\n`
  }

  // Walk children in document order with a slice guard against massive arrays of child nodes
  const childNodes = Array.from(el.childNodes)
  const safeChildNodes = childNodes.length > MAX_CHILDREN_PER_NODE
    ? childNodes.slice(0, MAX_CHILDREN_PER_NODE)
    : childNodes

  let innerMarkdown = ''
  for (const child of safeChildNodes) {
    innerMarkdown += await convertDomNodeToMarkdown(child, options, listDepth)
  }

  // Headings: H1 - H6 or Word MsoHeading / MsoTitle classes
  const classNameLower = (el.className || '').toLowerCase()
  const isMsoHeading = classNameLower.includes('msoheading') || classNameLower.includes('msotitle')
  if (/^h[1-6]$/.test(tagName) || isMsoHeading) {
    let level = 1
    if (tagName.length === 2 && !isNaN(Number(tagName[1]))) {
      level = parseInt(tagName[1], 10)
    } else if (isMsoHeading) {
      const match = el.className.match(/msoheading([1-6])/i)
      if (match) level = parseInt(match[1], 10)
    }
    const prefix = '#'.repeat(level)
    return `\n\n${prefix} ${innerMarkdown.trim()}\n\n`
  }

  // Bold / Strong / font-weight: bold / 700+
  const fontWeight = el.style?.fontWeight || ''
  const isBold =
    tagName === 'strong' ||
    tagName === 'b' ||
    fontWeight === 'bold' ||
    parseInt(fontWeight, 10) >= 600

  if (isBold) {
    return wrapFormattedText(innerMarkdown, '**')
  }

  // Italic / Emphasis
  const fontStyle = el.style?.fontStyle || ''
  const isItalic = tagName === 'em' || tagName === 'i' || fontStyle === 'italic'

  if (isItalic) {
    return wrapFormattedText(innerMarkdown, '*')
  }

  // Strikethrough / Delete
  const textDecoration = el.style?.textDecoration || ''
  const isStrike =
    tagName === 'del' ||
    tagName === 's' ||
    tagName === 'strike' ||
    textDecoration.includes('line-through')

  if (isStrike) {
    return wrapFormattedText(innerMarkdown, '~~')
  }

  // Underline: Markdown has no native underline syntax; return clean inner text without raw HTML tags
  if (tagName === 'u' || textDecoration.includes('underline')) {
    return innerMarkdown
  }

  // Superscript & Subscript
  if (tagName === 'sup') {
    const trimmed = innerMarkdown.trim()
    return trimmed ? `^${trimmed}^` : ''
  }
  if (tagName === 'sub') {
    const trimmed = innerMarkdown.trim()
    return trimmed ? `~${trimmed}~` : ''
  }

  // Inline Code vs Code Block
  if (tagName === 'code') {
    if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'pre') {
      return innerMarkdown
    }
    return wrapFormattedText(innerMarkdown, '`')
  }

  // Blockquote
  if (tagName === 'blockquote') {
    const lines = innerMarkdown.trim().split('\n')
    const quoted = lines.map((line) => `> ${line.trim()}`).join('\n')
    return `\n\n${quoted}\n\n`
  }

  // Horizontal Rule
  if (tagName === 'hr') {
    return '\n\n---\n\n'
  }

  // Anchor Link
  if (tagName === 'a') {
    let href = el.getAttribute('href') || ''
    const title = el.getAttribute('title') || ''

    // Resolve relative URL using baseHref if available
    const baseHref = options.baseHref
    if (href && baseHref && !/^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/|#)/.test(href)) {
      try {
        href = new URL(href, baseHref).href
      } catch {
        // preserve original
      }
    } else if (href && href.startsWith('//')) {
      href = `https:${href}`
    }

    // Word internal bookmarks and anchors (e.g. #_Ref123, #_Toc123, #fig1, #bookmark): render clean text directly
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
      return innerMarkdown
    }

    const rawText = innerMarkdown || title || href
    const leadSpace = rawText.match(/^\s*/)?.[0] || ''
    const trailSpace = rawText.match(/\s*$/)?.[0] || ''
    let cleanText = rawText.trim()

    if (!cleanText) return ''

    // If cleanText contains block breaks (\n\n), split by paragraph so markdown links don't break across paragraphs
    if (cleanText.includes('\n\n')) {
      const parts = cleanText.split(/\n\n+/)
      return parts
        .map((part) => {
          const t = part.trim()
          return t ? `[${t}](${href})` : ''
        })
        .filter(Boolean)
        .join('\n\n')
    }

    // Clean internal newlines inside link text
    cleanText = cleanText.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ')

    return `${leadSpace}[${cleanText}](${href})${trailSpace}`
  }

  // Images
  if (tagName === 'img') {
    const imageState = options.imageState || (options.imageState = { seen: new Set(), saved: 0 })
    let src = el.getAttribute('src') || ''
    const alt = el.getAttribute('alt') || 'image'

    if (!src || imageState.seen.has(src)) return ''
    imageState.seen.add(src)

    const width = Number.parseInt(el.getAttribute('width') || '', 10)
    const height = Number.parseInt(el.getAttribute('height') || '', 10)
    const style = el.getAttribute('style') || ''
    if (
      (width > 0 && width <= 1) ||
      (height > 0 && height <= 1) ||
      /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0/i.test(style)
    ) {
      return ''
    }

    const maxImages = options.maxImages ?? 100
    if (imageState.saved >= maxImages) return alt && alt !== 'image' ? alt : ''

    // If a baseHref was provided or found in HTML, resolve relative src
    if (options.baseHref && src && !/^https?:\/\//i.test(src) && !src.startsWith('data:') && !isLocalPath(src)) {
      try {
        src = new URL(src, options.baseHref).href
      } catch (_) {}
    }

    if (src.startsWith('data:image/')) {
      if (typeof onSaveImage === 'function') {
        try {
          const match = src.match(/data:image\/([a-zA-Z0-9]+);base64,/)
          const ext = match ? match[1] : 'png'
          const uint8Array = dataUrlToUint8Array(src)
          if (uint8Array) {
            const filename = `Pasted image ${Date.now()}.${ext}`
            const savedPath = await onSaveImage(uint8Array, filename)
            if (savedPath) {
              imageState.saved += 1
              return `![${alt}](${savedPath})`
            }
          }
        } catch (err) {
          console.error('Failed to save embedded image from HTML:', err)
        }
      }
      return `![${alt}](${src})`
    }

    if (isLocalPath(src)) {
      if (typeof options.onSaveImageFromPath === 'function') {
        try {
          const filename = alt && alt !== 'image' ? alt : undefined
          const savedPath = await options.onSaveImageFromPath(src, filename)
          if (savedPath) {
            imageState.saved += 1
            return `![${alt}](${savedPath})`
          }
        } catch (err) {
          console.error('Failed to save image from local path:', err)
        }
      }

      // Fallback: If onGetClipboardImage is available and local file read was unable to save
      if (typeof options.onGetClipboardImage === 'function') {
        try {
          const savedPath = await options.onGetClipboardImage()
          if (savedPath) {
            imageState.saved += 1
            return `![${alt}](${savedPath})`
          }
        } catch (err) {
          console.error('Failed to fallback to clipboard image:', err)
        }
      }
    }

    if (src) {
      imageState.saved += 1
      return `![${alt}](${src})`
    }
    return ''
  }

  // Line breaks
  if (tagName === 'br') {
    // If inside a table cell, return space to prevent literal <br> strings
    if (el.closest && el.closest('td, th')) {
      return ' '
    }
    return '\n'
  }

  // Lists: UL / OL / LI
  if (tagName === 'li') {
    return innerMarkdown.trim()
  }

  // Word List Paragraphs (<p class="MsoListParagraph">)
  if (isWordListItem(el)) {
    const cleanItem = innerMarkdown.replace(/^[·•\u2022\u25E6\u25AA-]\s*/, '').trim()
    return `\n- ${cleanItem}`
  }

  // Paragraphs & Divs
  if (tagName === 'p') {
    let content = innerMarkdown.trim()
    if (!content) return ''

    // Inside table cells, paragraphs must be inline text separated by space
    if (el.closest && el.closest('td, th')) {
      return `${content} `
    }

    // Table of contents item: single newline for tight list with indent levels
    const tocLevel = getWordTocLevel(el)
    if (tocLevel > 0) {
      // Normalize dot leaders (e.g. " . . . . . . . . . . 12" -> " ... 12")
      content = content.replace(/\s*(?:\.\s*){3,}\s*/g, ' ... ')
      const indent = '  '.repeat(Math.max(0, tocLevel - 1))
      return `\n${indent}- ${content}`
    }

    // Reference / Bibliography item: single newline for tight list
    if (isWordReferenceItem(el)) {
      return `\n${content}`
    }

    // Caption item (MsoCaption or caption class): single newline directly beneath the image
    const classNameLower = (el.className || '').toLowerCase()
    if (classNameLower.includes('msocaption') || classNameLower.includes('caption')) {
      return `\n${content}\n`
    }

    // Standard paragraph: justify sentence flow and separate with standard blank line
    const justified = justifyParagraphText(content)
    return `\n\n${justified}`
  }

  if (tagName === 'div') {
    const trimmed = innerMarkdown.trim()
    if (!trimmed) return ''
    // If this div is a direct child of body or another div, ensure block separation so lines don't collapse into one row
    const parentTag = (el.parentElement?.tagName || '').toLowerCase()
    if (parentTag === 'body' || parentTag === 'div' || parentTag === 'td') {
      return innerMarkdown.endsWith('\n') ? innerMarkdown : `${innerMarkdown}\n`
    }
    return innerMarkdown
  }

  return innerMarkdown
}

/**
 * Converts an HTML Table element into a clean, balanced GitHub-Flavored Markdown pipe table.
 * Resolves colspan cell padding, column alignment, and completely eliminates raw <br> tags.
 */
async function convertTableToMarkdown(
  tableEl: HTMLElement,
  options: HtmlToMarkdownOptions,
  listDepth: number = 0
): Promise<string> {
  const allRows = Array.from(tableEl.querySelectorAll('tr'))
  if (allRows.length === 0) return ''

  // Truncate table rows to prevent memory exhaustion on massive spreadsheets
  const rows = allRows.length > MAX_TABLE_ROWS ? allRows.slice(0, MAX_TABLE_ROWS) : allRows

  // Collect table matrix and cell alignments
  const tableData: string[][] = []
  const alignments: string[] = []

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('th, td')) as HTMLElement[]
    if (cells.length === 0) continue

    const rowData: string[] = []
    for (let cIdx = 0; cIdx < cells.length; cIdx++) {
      const cell = cells[cIdx]
      let cellMd = await convertDomNodeToMarkdown(cell, options, listDepth + 1)

      // Replace any <br> tags, residual HTML tags (like <u>, <span>, <font>), newlines, and extra whitespace
      cellMd = cellMd
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/?(?:u|span|font|b|i|strong|em|p|div|small|big|sub|sup)[^>]*>/gi, '')
        .replace(/\r?\n+/g, ' ')
        .replace(/\|/g, '\\|')
        .replace(/\s{2,}/g, ' ')
        .trim()

      // Handle colspan: pad additional empty columns so table structure remains aligned
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10)
      rowData.push(cellMd || ' ')

      // Record column alignment from header, updating from data rows if header is unaligned
      const alignAttr = (cell.getAttribute('align') || cell.style?.textAlign || '').toLowerCase()
      const alignToken = alignAttr === 'center' ? ':---:' : alignAttr === 'right' ? '---:' : '---'

      if (tableData.length === 0) {
        alignments.push(alignToken)
      } else if (alignToken !== '---' && cIdx < alignments.length && alignments[cIdx] === '---') {
        alignments[cIdx] = alignToken
      }

      for (let c = 1; c < colspan; c++) {
        rowData.push(' ')
        if (tableData.length === 0) {
          alignments.push('---')
        }
      }
    }
    tableData.push(rowData)
  }

  if (tableData.length === 0) return ''

  // Determine maximum column count
  const colCount = Math.max(...tableData.map((row) => row.length))
  if (colCount === 0) return ''

  // Pad all rows to have equal column counts
  const normalizedRows = tableData.map((row) => {
    const padded = [...row]
    while (padded.length < colCount) {
      padded.push(' ')
    }
    return padded
  })

  // When there is only 1 column (e.g. user copied a single column from Docs, Sheets, or Word table),
  // GFM Markdown tables require >= 2 columns to parse as a Table. In CommonMark / Lezer,
  // a 1-column pipe table degrades into a single Paragraph and collapses all lines into a single row.
  // Instead, output each cell on its own line so the column preserves its vertical sequence cleanly.
  if (colCount === 1) {
    const lines = normalizedRows
      .map((row) => row[0])
      .filter((text) => text && text.trim().length > 0)
    let result = `\n\n${lines.join('\n\n')}\n\n`
    if (allRows.length > MAX_TABLE_ROWS) {
      result += `\n\n*(Table truncated: showing first ${MAX_TABLE_ROWS} rows)*\n\n`
    }
    return result
  }

  // Format header row (Row 0)
  const headerRow = normalizedRows[0]
  const headerLine = `| ${headerRow.join(' | ')} |`

  // Separator row with alignment tokens
  while (alignments.length < colCount) {
    alignments.push('---')
  }
  const separatorLine = `| ${alignments.slice(0, colCount).join(' | ')} |`

  // Body rows (Row 1 onwards)
  const bodyLines = normalizedRows.slice(1).map((row) => `| ${row.join(' | ')} |`)

  let markdownTable = [headerLine, separatorLine, ...bodyLines].join('\n')
  if (allRows.length > MAX_TABLE_ROWS) {
    markdownTable += `\n\n*(Table truncated: showing first ${MAX_TABLE_ROWS} rows)*`
  }
  return `\n\n${markdownTable}\n\n`
}

/**
 * Main entry point: converts an HTML string into clean Markdown.
 * Wrapped in resilient error-handling to guarantee it never throws or breaks the editor.
 * 
 * @param html - Raw HTML from clipboard (e.g. text/html)
 * @param options - Conversion options
 * @returns Clean Markdown string
 */
export async function htmlToMarkdown(html: string, options: HtmlToMarkdownOptions = {}): Promise<string> {
  if (!html || typeof html !== 'string') return ''

  try {
    // Truncate input string if it exceeds maximum parse limit (safety guard for 1M+ char pastes)
    const maxHtmlLength = options.maxHtmlLength ?? MAX_HTML_PARSE_LENGTH
    let workingHtml = html
    if (workingHtml.length > maxHtmlLength) {
      console.warn(`[htmlToMarkdown] HTML length (${workingHtml.length}) exceeds safety limit (${maxHtmlLength}). Truncating.`)
      workingHtml = workingHtml.slice(0, maxHtmlLength)
    }

    // Extract base href if present in raw HTML (e.g. from Word temp folder or browser SourceURL header)
    const baseHref = options.baseHref || extractBaseHref(workingHtml)

    // Clean Microsoft Office XML artifacts, spacer paragraphs & comments
    const cleaned = cleanWordHtml(workingHtml)
    if (!cleaned) return ''

    // Parse HTML into browser DOM
    const parser = new DOMParser()
    const doc = parser.parseFromString(cleaned, 'text/html')

    const mergedOptions: HtmlToMarkdownOptions = { ...options, baseHref }

    // Convert body tree to Markdown
    const markdown = await convertDomNodeToMarkdown(doc.body, mergedOptions)

    // Normalize excessive blank lines (collapse any sequences of 2+ empty lines into a single blank line)
    return markdown
      .replace(/[ \t]+$/gm, '')
      .replace(/\n[ \t\r]*\n[ \t\r]*\n+/g, '\n\n')
      .trim()
  } catch (err) {
    console.error('[htmlToMarkdown] Unexpected parsing error, falling back:', err)
    return ''
  }
}

/**
 * Shared DRY helper to execute rich paste into a CodeMirror EditorView.
 * Used by both DOM event handlers (imageDropExtension) and context menu actions (clipboardActions).
 * 
 * Guarantees:
 * - Atomic calculation against the live document state right before dispatch.
 * - Absolute clamping of from/to/anchor to guarantee zero RangeError out-of-document exceptions.
 * - Graceful fallback to replaceSelection and plain text on any unexpected transaction failure.
 */
export async function applyRichPasteToView(
  view: EditorView | any,
  rawHtml: string,
  fallbackText: string = '',
  options: HtmlToMarkdownOptions = {}
): Promise<boolean> {
  if (!view) return false

  try {
    // 1. Smart Link Paste: If text is selected and fallbackText is a URL, transform into [Selected](URL)
    if (fallbackText && trySmartLinkPaste(view, fallbackText)) {
      return true
    }

    let insertText = ''

    // 2. HTML to Markdown conversion (guarded with length limit)
    if (rawHtml && rawHtml.trim()) {
      const maxHtmlLength = options.maxHtmlLength ?? MAX_HTML_PARSE_LENGTH
      if (rawHtml.length > maxHtmlLength && fallbackText) {
        console.warn(`[applyRichPasteToView] HTML length (${rawHtml.length}) exceeds safety limit; using plain text fallback.`)
        insertText = fallbackText
      } else {
        const onSaveImage =
          options.onSaveImage ||
          (async (uint8Array: Uint8Array, filename: string) => {
            if ((window as any).api?.saveImage) {
              return await (window as any).api.saveImage(uint8Array, filename)
            }
            return null
          })

        const onSaveImageFromPath =
          options.onSaveImageFromPath ||
          (async (filePath: string, filename?: string) => {
            if ((window as any).api?.saveImageFromPath) {
              return await (window as any).api.saveImageFromPath(filePath, filename)
            }
            return null
          })

        const onGetClipboardImage =
          options.onGetClipboardImage ||
          (async () => {
            if ((window as any).api?.readClipboardImageBuffer && (window as any).api?.saveImage) {
              const buffer = await (window as any).api.readClipboardImageBuffer()
              if (buffer) {
                const filename = `Pasted image ${Date.now()}.png`
                return await (window as any).api.saveImage(buffer, filename)
              }
            }
            return null
          })

        const markdown = await htmlToMarkdown(rawHtml, {
          ...options,
          onSaveImage,
          onSaveImageFromPath,
          onGetClipboardImage
        })

        if (markdown && markdown.trim()) {
          insertText = markdown
        }
      }
    }

    // 3. Fallback to TSV table conversion or plain text
    if (!insertText && fallbackText && isTsvTable(fallbackText)) {
      insertText = tsvToMarkdownTable(fallbackText)
    }

    if (!insertText) {
      insertText = fallbackText || ''
    }

    if (!insertText) return false

    // 4. Safely query document length and selection AT DISPATCH TIME (post-await)
    const currentDoc = view.state?.doc
    const docLen = typeof currentDoc?.length === 'number' ? currentDoc.length : 0
    const mainSel = view.state?.selection?.main ?? { from: 0, to: 0 }

    // Strictly clamp selection boundaries to the live document range
    const safeFrom = typeof currentDoc?.length === 'number'
      ? Math.max(0, Math.min(mainSel.from, docLen))
      : mainSel.from
    const safeTo = typeof currentDoc?.length === 'number'
      ? Math.max(safeFrom, Math.min(mainSel.to, docLen))
      : mainSel.to

    const newDocLen = typeof currentDoc?.length === 'number'
      ? docLen - (safeTo - safeFrom) + insertText.length
      : safeFrom + insertText.length
    const safeAnchor = Math.max(0, Math.min(safeFrom + insertText.length, newDocLen))

    try {
      view.dispatch({
        changes: { from: safeFrom, to: safeTo, insert: insertText },
        selection: { anchor: safeAnchor }
      })
      view.focus()
      return true
    } catch (dispatchErr) {
      console.warn('[applyRichPasteToView] Transaction with explicit selection failed, falling back to replaceSelection:', dispatchErr)
      if (typeof view.state?.replaceSelection === 'function') {
        view.dispatch(view.state.replaceSelection(insertText))
        view.focus()
        return true
      }
      return false
    }
  } catch (err) {
    console.error('[applyRichPasteToView] Failed to process rich paste:', err)
    if (fallbackText) {
      try {
        if (trySmartLinkPaste(view, fallbackText)) {
          return true
        }
        if (typeof view.state?.replaceSelection === 'function') {
          view.dispatch(view.state.replaceSelection(fallbackText))
          view.focus()
          return true
        }
        const sel = view.state?.selection?.main ?? { from: 0, to: 0 }
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: fallbackText }
        })
        view.focus()
        return true
      } catch (fallbackErr) {
        console.error('[applyRichPasteToView] Plain text fallback failed:', fallbackErr)
      }
    }
    return false
  }
}
