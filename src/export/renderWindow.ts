/**
 * ============================================================================
 * Offscreen Render Window (`renderWindow.ts`)
 * ============================================================================
 * Loads generated HTML in a hidden BrowserWindow from a temporary directory
 * (avoids data-URL size limits), with the local Mermaid runtime copied next to
 * it and referenced by a relative `<script src>` so diagrams render offline.
 *
 * The temporary directory and window are always cleaned up.
 * ============================================================================
 */

import { BrowserWindow } from 'electron'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { resolveMermaidPath, mermaidCdnFallback, injectMermaidScript } from './mermaidRuntime'

/**
 * Resolves once the document signals `mermaid-done` (or after a hard timeout),
 * so a stuck diagram can never hang an export.
 */
async function waitForMermaid(win: BrowserWindow, timeoutMs = 6000): Promise<void> {
  try {
    await win.webContents.executeJavaScript(`
      new Promise((resolve) => {
        if (document.body.classList.contains('mermaid-done')) { setTimeout(resolve, 150); return; }
        var observer = new MutationObserver(function () {
          if (document.body.classList.contains('mermaid-done')) {
            observer.disconnect();
            setTimeout(resolve, 150);
          }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        setTimeout(function () { observer.disconnect(); resolve(); }, ${timeoutMs});
      })
    `)
  } catch {
    /* ignore — proceed with whatever has rendered */
  }
}

/**
 * Renders HTML in a hidden window and runs `fn(win)`.
 *
 * @param html Full HTML document
 * @param fn Callback executing against the rendered BrowserWindow
 * @returns Result of callback
 */
export async function withRenderedHtml<T>(
  html: string,
  fn: (win: BrowserWindow) => Promise<T>
): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lumina-render-'))
  const htmlFile = path.join(dir, 'preview.html')

  try {
    // Prefer the local Mermaid build (offline). Copy it beside the HTML and
    // reference it by relative path so no JS is inlined into the markup.
    let scriptTag: string
    const runtimePath = resolveMermaidPath()
    if (runtimePath) {
      await fs.copyFile(runtimePath, path.join(dir, 'mermaid.min.js'))
      scriptTag = '<script src="mermaid.min.js"></script>'
    } else {
      scriptTag = mermaidCdnFallback()
    }

    const prepared = injectMermaidScript(html, scriptTag)
    await fs.writeFile(htmlFile, prepared, 'utf-8')

    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })

    try {
      await win.loadFile(htmlFile)
      await waitForMermaid(win)
      return await fn(win)
    } finally {
      if (win.isDestroyed?.() !== true) win.close()
    }
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
