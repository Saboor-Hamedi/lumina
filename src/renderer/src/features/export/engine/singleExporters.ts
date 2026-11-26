import { invoke } from '@tauri-apps/api/core'
import { collectLocalAssets, rewriteMarkdownAssetLinks } from './assetPipeline'
import { buildCleanHTMLDocument, buildSourcePreview } from './htmlTemplate'
import {
  buildPlainText,
  mergeBatchMarkdown,
  renderMarkdownForExport
} from './markdownRenderer'
import { buildDocsDocument, buildPDFDocument } from './pdfAndDocsTemplates'
import {
  isLightColorHexOrRgb,
  normalizeTheme,
  resolveHtmlMermaidMode,
  safeFileName,
  type ExportPayload,
  type ExportResult,
  type PreviewResult
} from './types'

export async function pickSavePath(
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

export async function pickExportDirectory(title: string): Promise<string | null> {
  return invoke<string | null>('export_pick_directory', { title })
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
      html = buildPDFDocument(title, rendered.html, rendered.tocHtml, theme)
    } else if (format === 'docs') {
      html = buildDocsDocument(title, rendered.html, rendered.tocHtml, true, theme)
    } else {
      html = buildCleanHTMLDocument(title, rendered.html, rendered.tocHtml, theme, true)
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

export async function exportHTML(payload: ExportPayload): Promise<ExportResult> {
  const {
    title = 'Untitled',
    content = '',
    toc = true,
    optimizeImages = true,
    theme
  } = payload || {}
  if (!content) throw new Error('No content provided')

  const filePath = await pickSavePath(
    'Export as HTML',
    `${safeFileName(title)}.html`,
    'HTML Document',
    ['html', 'htm']
  )
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

  const filePath = await pickSavePath(
    'Export as PDF',
    `${safeFileName(title)}.pdf`,
    'PDF Document',
    ['pdf']
  )
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

  const filePath = await pickSavePath(
    'Export as Word Document',
    `${safeFileName(title)}.doc`,
    'Word Document',
    ['doc']
  )
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

  const filePath = await pickSavePath(
    'Export as Markdown',
    `${safeFileName(title)}.md`,
    'Markdown Files',
    ['md', 'markdown']
  )
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

  const filePath = await pickSavePath(
    'Export as Plain Text',
    `${safeFileName(title)}.txt`,
    'Text Files',
    ['txt']
  )
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
