/**
 * htmlToMarkdown.js
 * 
 * Enterprise-grade HTML-to-Markdown engine and paste pipeline for Lumina.
 * Specifically engineered for Microsoft Word, Google Docs, Web tables, and rich text.
 * 
 * Architecture & Guarantees:
 * - Resilient & Non-Breaking: Safe parsing with complete fallback to plain text on any error.
 * - Table Polish: Zero literal <br> tags in table cells; handles colspan balance and text alignment (:---:, ---:).
 * - Paragraph Flow: Cleans mid-sentence ragged line breaks and justification spacing for continuous text flow.
 * - Table of Contents (TOC): Clean single-line entries with hierarchical indent levels (MsoToc1 -> -, MsoToc2 ->   -).
 * - References / Bibliography: Auto-detects and highlights raw URLs/DOIs into [url](url); prevents multi-line spacing gaps.
 * - Embedded Images: Extracts base64 images and saves to workspace assets via onSaveImage callback.
 * - DRY Execution: Provides applyRichPasteToView for unified CodeMirror paste handling.
 */

/**
 * Automatically converts raw URLs in plain text into Markdown links [url](url),
 * skipping punctuation at the end.
 */
export function autolinkText(text) {
  if (!text || typeof text !== 'string') return ''

  // Matches http://, https://, or www.
  const urlRegex = /\b(https?:\/\/[^\s<>()"']+|www\.[^\s<>()"']+)/gi

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
export function isLocalPath(src) {
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
export function cleanWordHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return ''

  let html = rawHtml

  // 1. Extract content between Word fragment markers if present
  const fragmentStart = html.indexOf('<!--StartFragment-->')
  const fragmentEnd = html.lastIndexOf('<!--EndFragment-->')
  if (fragmentStart !== -1 && fragmentEnd !== -1) {
    html = html.substring(fragmentStart + '<!--StartFragment-->'.length, fragmentEnd)
  }

  // 2. Convert Word HYPERLINK field codes to <a> tags before stripping comments
  html = html.replace(/HYPERLINK\s+"([^"]+)"(?:\s*\\l\s*"[^"]*")?\s*([^\r\n<]*)/gi, (match, url, text) => {
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
function dataUrlToUint8Array(dataUrl) {
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
function isWordListItem(el) {
  const className = el.className || ''
  return typeof className === 'string' && className.toLowerCase().includes('msolistparagraph')
}

/**
 * Detects whether an HTML element represents a Word Table of Contents item,
 * and returns the 1-based hierarchy level (1, 2, 3, etc.).
 */
function getWordTocLevel(el) {
  const className = (el.className || '').toLowerCase()
  if (!className.includes('toc')) return 0
  const match = className.match(/toc([1-6])/i)
  if (match) return parseInt(match[1], 10)
  return 1
}

/**
 * Detects whether an HTML element represents a Bibliography or Reference item.
 */
function isWordReferenceItem(el) {
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
function wrapFormattedText(text, delimiter) {
  if (!text) return ''
  const trimmed = text.trim()
  if (!trimmed) return text

  const leadSpace = text.match(/^\s*/)[0]
  const trailSpace = text.match(/\s*$/)[0]

  return `${leadSpace}${delimiter}${trimmed}${delimiter}${trailSpace}`
}

/**
 * Normalizes intra-paragraph text flow by flattening accidental ragged line wraps,
 * multiple spaces, tabs, and Word justification spacers into a clean continuous sentence.
 */
function justifyParagraphText(text) {
  if (!text) return ''
  return text
    .replace(/\r?\n+/g, ' ')
    .replace(/[ \t\u00A0\u2007\u202F]+/g, ' ')
    .trim()
}

/**
 * Recursively converts an HTML DOM element and its children into clean Markdown text.
 */
export async function convertDomNodeToMarkdown(node, options = {}, listDepth = 0) {
  const { onSaveImage } = options

  if (node.nodeType === Node.TEXT_NODE) {
    const raw = node.textContent.replace(/[\u00A0\u2007\u202F]/g, ' ')

    // Auto-link plain text URLs when not already wrapped inside <a>, <code>, or <pre>
    const parentTag = node.parentElement ? node.parentElement.tagName.toLowerCase() : ''
    const isInsideLinkOrCode =
      parentTag === 'a' ||
      parentTag === 'code' ||
      parentTag === 'pre' ||
      node.parentElement?.closest?.('a, code, pre')

    if (!isInsideLinkOrCode && raw.includes('http')) {
      return autolinkText(raw)
    }

    return raw
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ''
  }

  const tagName = node.tagName.toLowerCase()

  if (tagName === 'table') {
    return convertTableToMarkdown(node, options)
  }

  if (tagName === 'pre') {
    const codeText = node.textContent || ''
    return `\n\n\`\`\`\n${codeText.replace(/\r\n/g, '\n').trim()}\n\`\`\`\n\n`
  }

  if (tagName === 'ul' || tagName === 'ol') {
    const indent = '  '.repeat(listDepth)
    const items = Array.from(node.children).filter((child) => child.tagName.toLowerCase() === 'li')
    const listLines = []

    for (let index = 0; index < items.length; index += 1) {
      const itemMarkdown = await convertDomNodeToMarkdown(items[index], options, listDepth + 1)
      const marker = tagName === 'ul' ? '-' : `${index + 1}.`
      listLines.push(`${indent}${marker} ${itemMarkdown.trim()}`)
    }

    return `\n\n${listLines.join('\n')}\n\n`
  }

  // Walk children in document order without creating a promise for every node.
  // Large Word pastes can contain tens of thousands of nodes; recursive Promise.all
  // creates a large transient promise tree and delays the first editor update.
  let innerMarkdown = ''
  for (const child of node.childNodes) {
    innerMarkdown += await convertDomNodeToMarkdown(child, options, listDepth)
  }

  // Headings: H1 - H6 or Word MsoHeading / MsoTitle classes
  const classNameLower = (node.className || '').toLowerCase()
  const isMsoHeading = classNameLower.includes('msoheading') || classNameLower.includes('msotitle')
  if (/^h[1-6]$/.test(tagName) || isMsoHeading) {
    let level = 1
    if (tagName.length === 2 && !isNaN(tagName[1])) {
      level = parseInt(tagName[1], 10)
    } else if (isMsoHeading) {
      const match = node.className.match(/msoheading([1-6])/i)
      if (match) level = parseInt(match[1], 10)
    }
    const prefix = '#'.repeat(level)
    return `\n\n${prefix} ${innerMarkdown.trim()}\n\n`
  }

  // Bold / Strong / font-weight: bold / 700+
  const fontWeight = node.style?.fontWeight || ''
  const isBold =
    tagName === 'strong' ||
    tagName === 'b' ||
    fontWeight === 'bold' ||
    parseInt(fontWeight, 10) >= 600

  if (isBold) {
    return wrapFormattedText(innerMarkdown, '**')
  }

  // Italic / Emphasis
  const fontStyle = node.style?.fontStyle || ''
  const isItalic = tagName === 'em' || tagName === 'i' || fontStyle === 'italic'

  if (isItalic) {
    return wrapFormattedText(innerMarkdown, '*')
  }

  // Strikethrough / Delete
  const textDecoration = node.style?.textDecoration || ''
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
    if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
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
    const href = node.getAttribute('href')
    const text = innerMarkdown.trim() || href || ''

    // Word internal bookmarks and anchors (e.g. #_Ref123, #_Toc123, #fig1, #bookmark): render clean text directly
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
      return text
    }

    return `[${text}](${href})`
  }

  // Images
  if (tagName === 'img') {
    const imageState = options.imageState || (options.imageState = { seen: new Set(), saved: 0 })
    let src = node.getAttribute('src') || ''
    const alt = node.getAttribute('alt') || 'image'

    if (!src || imageState.seen.has(src)) return ''
    imageState.seen.add(src)

    const width = Number.parseInt(node.getAttribute('width') || '', 10)
    const height = Number.parseInt(node.getAttribute('height') || '', 10)
    const style = node.getAttribute('style') || ''
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
    if (node.closest && node.closest('td, th')) {
      return ' '
    }
    return '\n'
  }

  // Lists: UL / OL / LI
  if (tagName === 'li') {
    return innerMarkdown.trim()
  }

  // Word List Paragraphs (<p class="MsoListParagraph">)
  if (isWordListItem(node)) {
    const cleanItem = innerMarkdown.replace(/^[·•\u2022\u25E6\u25AA-]\s*/, '').trim()
    return `\n- ${cleanItem}`
  }

  // Paragraphs & Divs
  if (tagName === 'p') {
    let content = innerMarkdown.trim()
    if (!content) return ''

    // Inside table cells, paragraphs must be inline text separated by space
    if (node.closest && node.closest('td, th')) {
      return `${content} `
    }

    // Table of contents item: single newline for tight list with indent levels
    const tocLevel = getWordTocLevel(node)
    if (tocLevel > 0) {
      // Normalize dot leaders (e.g. " . . . . . . . . . . 12" -> " ... 12")
      content = content.replace(/\s*(?:\.\s*){3,}\s*/g, ' ... ')
      const indent = '  '.repeat(Math.max(0, tocLevel - 1))
      return `\n${indent}- ${content}`
    }

    // Reference / Bibliography item: single newline for tight list
    if (isWordReferenceItem(node)) {
      return `\n${content}`
    }

    // Caption item (MsoCaption or caption class): single newline directly beneath the image
    const classNameLower = (node.className || '').toLowerCase()
    if (classNameLower.includes('msocaption') || classNameLower.includes('caption')) {
      return `\n${content}\n`
    }

    // Standard paragraph: justify sentence flow and separate with standard blank line
    const justified = justifyParagraphText(content)
    return `\n\n${justified}`
  }

  if (tagName === 'div') {
    return innerMarkdown
  }

  return innerMarkdown
}

/**
 * Converts an HTML Table element into a clean, balanced GitHub-Flavored Markdown pipe table.
 * Resolves colspan cell padding, column alignment, and completely eliminates raw <br> tags.
 */
async function convertTableToMarkdown(tableEl, options) {
  const rows = Array.from(tableEl.querySelectorAll('tr'))
  if (rows.length === 0) return ''

  // Collect table matrix and cell alignments
  const tableData = []
  const alignments = []

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('th, td'))
    if (cells.length === 0) continue

    const rowData = []
    for (let cIdx = 0; cIdx < cells.length; cIdx++) {
      const cell = cells[cIdx]
      let cellMd = await convertDomNodeToMarkdown(cell, options)

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

      // Record column alignment from header or first row
      if (tableData.length === 0) {
        const alignAttr = (cell.getAttribute('align') || cell.style?.textAlign || '').toLowerCase()
        alignments.push(alignAttr === 'center' ? ':---:' : alignAttr === 'right' ? '---:' : '---')
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

  const markdownTable = [headerLine, separatorLine, ...bodyLines].join('\n')
  return `\n\n${markdownTable}\n\n`
}

/**
 * Main entry point: converts an HTML string into clean Markdown.
 * Wrapped in resilient error-handling to guarantee it never throws or breaks the editor.
 * 
 * @param {string} html - Raw HTML from clipboard (e.g. text/html)
 * @param {Object} options - Conversion options
 * @param {Function} [options.onSaveImage] - Optional callback (uint8Array, filename) => Promise<string>
 * @returns {Promise<string>} Clean Markdown string
 */
export async function htmlToMarkdown(html, options = {}) {
  if (!html || typeof html !== 'string') return ''

  try {
    // Extract base href if present in raw HTML (e.g. from Word temp folder)
    let baseHref = options.baseHref || ''
    const baseMatch = html.match(/<base\s+[^>]*href=["']([^"']+)["']/i)
    if (baseMatch && !baseHref) {
      baseHref = baseMatch[1]
    }

    // Clean Microsoft Office XML artifacts, spacer paragraphs & comments
    const cleaned = cleanWordHtml(html)
    if (!cleaned) return ''

    // Parse HTML into browser DOM
    const parser = new DOMParser()
    const doc = parser.parseFromString(cleaned, 'text/html')

    const mergedOptions = { ...options, baseHref }

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
 * @param {Object} view - CodeMirror EditorView instance
 * @param {string} rawHtml - HTML clipboard string (text/html)
 * @param {string} fallbackText - Plain text clipboard string (text/plain)
 * @param {Object} [options] - Optional settings
 * @returns {Promise<boolean>} True if rich paste was applied
 */
export async function applyRichPasteToView(view, rawHtml, fallbackText = '', options = {}) {
  if (!view) return false

  try {
    const from = view.state.selection.main.from
    const to = view.state.selection.main.to

    let insertText = ''
    if (rawHtml && rawHtml.trim()) {
      const onSaveImage =
        options.onSaveImage ||
        (async (uint8Array, filename) => {
          if (window.api?.saveImage) {
            return await window.api.saveImage(uint8Array, filename)
          }
          return null
        })

      const onSaveImageFromPath =
        options.onSaveImageFromPath ||
        (async (filePath, filename) => {
          if (window.api?.saveImageFromPath) {
            return await window.api.saveImageFromPath(filePath, filename)
          }
          return null
        })

      const onGetClipboardImage =
        options.onGetClipboardImage ||
        (async () => {
          if (window.api?.readClipboardImageBuffer && window.api?.saveImage) {
            const buffer = await window.api.readClipboardImageBuffer()
            if (buffer) {
              const filename = `Pasted image ${Date.now()}.png`
              return await window.api.saveImage(buffer, filename)
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

    // Fallback to plain text if rich markdown conversion produced empty output
    if (!insertText) {
      insertText = fallbackText || ''
    }

    if (!insertText) return false

    view.dispatch({
      changes: { from, to, insert: insertText },
      selection: { anchor: from + insertText.length }
    })
    view.focus()
    return true
  } catch (err) {
    console.error('[applyRichPasteToView] Failed to dispatch rich paste:', err)
    if (fallbackText) {
      const from = view.state.selection.main.from
      const to = view.state.selection.main.to
      view.dispatch({
        changes: { from, to, insert: fallbackText },
        selection: { anchor: from + fallbackText.length }
      })
      view.focus()
      return true
    }
    return false
  }
}
