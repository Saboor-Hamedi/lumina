import { invoke } from '@tauri-apps/api/core'
import { collectLocalAssets, rewriteMarkdownAssetLinks } from './assetPipeline'
import { buildCleanHTMLDocument } from './htmlTemplate'
import {
  buildPlainText,
  mergeBatchMarkdown,
  renderMarkdownForExport
} from './markdownRenderer'
import { buildDocsDocument, buildPDFDocument } from './pdfAndDocsTemplates'
import { pickExportDirectory, pickSavePath } from './singleExporters'
import {
  emitBatchProgress,
  resolveHtmlMermaidMode,
  safeFileName,
  type BatchExportPayload,
  type ExportResult
} from './types'

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
    docs: {
      title: 'Save Combined Word Document',
      ext: 'doc',
      label: 'Word Document',
      exts: ['doc']
    },
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
