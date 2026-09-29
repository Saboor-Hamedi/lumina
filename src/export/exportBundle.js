/**
 * ============================================================================
 * Clean HTML & Markdown Bundle Exporter (`exportBundle.js`)
 * ============================================================================
 * Robust export system for Lumina:
 * 1. Self-contained Clean HTML export (embedded CSS, syntax highlighting, base64 images)
 * 2. Markdown Bundle export (copies referenced assets to local subfolder / bundle)
 * ============================================================================
 */

import { dialog } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { renderMarkdown, escapeHtml } from './exportUtils.js'
import WorkspaceManager from '../main/workspace/workspaceManager.js'

/**
 * Builds a self-contained, beautifully styled HTML document from markdown.
 * @param {string} title
 * @param {string} content Markdown source
 * @param {object} [opts]
 * @param {boolean} [opts.toc=true] Whether to prepend a table of contents
 */
export async function generateCleanHTML(title, content, opts = {}) {
  const { toc = true } = opts
  const { html: htmlBody, tocHtml } = await renderMarkdown(content, {
    wikilinkMode: 'span',
    toc
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Untitled'}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css">
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #8b5cf6;
      --border: rgba(255, 255, 255, 0.1);
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --card: #ffffff;
        --text: #0f172a;
        --text-muted: #64748b;
        --accent: #6366f1;
        --border: rgba(0, 0, 0, 0.1);
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
    ::-webkit-scrollbar { width: 11px; height: 11px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 999px;
      border: 3px solid transparent;
      background-clip: padding-box;
    }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); background-clip: padding-box; }
    ::-webkit-scrollbar-corner { background: transparent; }
    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      padding: 48px 24px;
      display: flex;
      justify-content: center;
    }
    .container {
      width: 100%;
      max-width: 780px;
    }
    h1, h2, h3, h4, h5, h6 {
      color: var(--text);
      font-weight: 700;
      margin-top: 1.8em;
      margin-bottom: 0.6em;
      line-height: 1.3;
    }
    h1 { font-size: 2.2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; margin-top: 0; }
    h2 { font-size: 1.6em; border-bottom: 1px solid var(--border); padding-bottom: 0.2em; }
    h3 { font-size: 1.3em; }
    p { margin-bottom: 1.2em; }
    code {
      font-family: 'Consolas', 'Fira Code', monospace;
      font-size: 0.9em;
      background: var(--card);
      border: 1px solid var(--border);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--accent);
    }
    pre {
      background: var(--card);
      border: 1px solid var(--border);
      padding: 16px 20px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.4em 0;
    }
    pre code {
      background: transparent;
      border: none;
      padding: 0;
      color: inherit;
    }
    blockquote {
      border-left: 4px solid var(--accent);
      background: var(--card);
      padding: 12px 20px;
      margin: 1.4em 0;
      border-radius: 0 8px 8px 0;
      color: var(--text-muted);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.6em 0;
      background: var(--card);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    th, td {
      padding: 10px 16px;
      border: 1px solid var(--border);
      text-align: left;
    }
    th {
      background: rgba(125, 125, 125, 0.08);
      font-weight: 600;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    tr:nth-child(even) { background: rgba(125, 125, 125, 0.03); }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1.2em 0;
      border: 1px solid var(--border);
    }
    .wikilink {
      color: var(--accent);
      font-weight: 500;
      text-decoration: underline;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .toc {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px 24px;
      margin: 0 0 2em 0;
    }
    .toc-title {
      font-size: 1.1em;
      margin-top: 0;
      margin-bottom: 0.6em;
      border-bottom: none;
      padding-bottom: 0;
    }
    .toc-list {
      list-style: none;
      padding-left: 0;
      margin: 0;
    }
    .toc-list li {
      margin: 0.3em 0;
    }
    .toc-l2 { padding-left: 1.2em; }
    .toc-l3 { padding-left: 2.4em; }
    .toc-list a {
      color: var(--text-muted);
      text-decoration: none;
    }
    .toc-list a:hover {
      color: var(--accent);
      text-decoration: underline;
    }
    ul, ol { margin: 1.2em 0; padding-left: 24px; }
    li { margin-bottom: 0.4em; }
    hr { border: none; height: 1px; background: var(--border); margin: 2em 0; }
    .doc-header {
      margin-bottom: 2em;
      padding-bottom: 1em;
      border-bottom: 2px solid var(--accent);
    }
    .doc-title {
      font-size: 2em;
      font-weight: 800;
      color: var(--text);
      margin: 0;
      padding: 0;
      border: none;
    }
    .doc-meta {
      margin-top: 0.4em;
      font-size: 0.75em;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="doc-header">
      <h1 class="doc-title">${escapeHtml(title || 'Untitled')}</h1>
      <div class="doc-meta">Exported from Lumina</div>
    </header>
    ${tocHtml}
    ${htmlBody}
  </div>
</body>
</html>`
}

/**
 * Handles exporting a note to a standalone, fully self-contained HTML file.
 */
export async function handleExportCleanHTML(mainWindow, payload) {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as Clean HTML',
      defaultPath: `${title || 'Untitled'}.html`,
      filters: [{ name: 'HTML Document', extensions: ['html', 'htm'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const html = await generateCleanHTML(title, content)
    await fs.writeFile(filePath, html, 'utf-8')
    return { success: true, filePath }
  } catch (error) {
    console.error('[ExportBundle] Export HTML failed:', error)
    throw error
  }
}

/**
 * Handles exporting a note and all its linked local media as a complete Markdown bundle folder.
 */
export async function handleExportMarkdownBundle(mainWindow, payload) {
  try {
    const { title, content } = payload || {}
    if (!content) throw new Error('No content provided')

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Markdown Bundle',
      defaultPath: `${title || 'Untitled'}.md`,
      filters: [{ name: 'Markdown Document', extensions: ['md', 'markdown'] }]
    })

    if (canceled || !filePath) {
      return { success: false, canceled: true }
    }

    const targetDir = path.dirname(filePath)
    const baseName = path.basename(filePath, path.extname(filePath))
    const assetsDir = path.join(targetDir, `${baseName}_assets`)

    let processedContent = content || ''
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
    const matches = [...processedContent.matchAll(imgRegex)]
    let hasCopiedAssets = false

    for (const match of matches) {
      const fullMatch = match[0]
      const alt = match[1]
      const url = match[2]

      if (!url.startsWith('http') && !url.startsWith('data:')) {
        try {
          let cleanUrl = url.startsWith('/') ? url.slice(1) : url
          if (cleanUrl.startsWith('<') && cleanUrl.endsWith('>')) {
            cleanUrl = cleanUrl.slice(1, -1)
          }
          cleanUrl = decodeURIComponent(cleanUrl)

          const buffer = await WorkspaceManager.readAsset(cleanUrl)
          if (buffer) {
            if (!hasCopiedAssets) {
              await fs.mkdir(assetsDir, { recursive: true })
              hasCopiedAssets = true
            }

            const imgFileName = path.basename(cleanUrl)
            const targetImagePath = path.join(assetsDir, imgFileName)
            await fs.writeFile(targetImagePath, buffer)

            // Rewrite link to relative assets folder
            const relativeUrl = `./${baseName}_assets/${imgFileName}`
            processedContent = processedContent.replace(fullMatch, `![${alt}](${relativeUrl})`)
          }
        } catch (e) {
          console.error('[ExportBundle] Failed to copy asset to bundle:', url, e)
        }
      }
    }

    await fs.writeFile(filePath, processedContent, 'utf-8')
    return { success: true, filePath, bundleDir: hasCopiedAssets ? assetsDir : null }
  } catch (error) {
    console.error('[ExportBundle] Export Markdown Bundle failed:', error)
    throw error
  }
}
