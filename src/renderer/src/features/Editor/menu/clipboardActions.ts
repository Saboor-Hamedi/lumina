/**
 * clipboardActions.ts
 * 
 * Handles clipboard operations (Copy, Cut, Paste, Paste as plain text) and selecting all text in the editor.
 * Supports rich HTML-to-Markdown conversion for formatted paste (Word, web, tables, images).
 */

import type { EditorView } from '@codemirror/view'
import { applyRichPasteToView } from '../utils/htmlToMarkdown'
import { trySmartLinkPaste } from '../utils/smartLinkPaste'

export const selectAll = (view: EditorView | null | undefined | any): void => {
  if (!view) return
  const len = view.state?.doc?.length ?? 0
  view.dispatch({ selection: { anchor: 0, head: len } })
  view.focus()
}

export const cutText = (): boolean => {
  try {
    return document.execCommand('cut')
  } catch {
    return false
  }
}

export const copyText = (): boolean => {
  try {
    return document.execCommand('copy')
  } catch {
    return false
  }
}

/**
 * Pastes clipboard content as unformatted raw plain text.
 */
export const pastePlainText = async (view: EditorView | null | undefined | any): Promise<void> => {
  if (!view) return
  try {
    const text = await navigator.clipboard.readText()
    if (!text) return
    if (trySmartLinkPaste(view, text)) {
      view.focus()
      return
    }

    const sel = view.state?.selection?.main ?? { from: 0, to: 0 }
    const docLen = view.state?.doc?.length
    const safeFrom = typeof docLen === 'number' ? Math.max(0, Math.min(sel.from, docLen)) : sel.from
    const safeTo = typeof docLen === 'number' ? Math.max(safeFrom, Math.min(sel.to, docLen)) : sel.to

    view.dispatch({
      changes: { from: safeFrom, to: safeTo, insert: text }
    })
    view.focus()
  } catch (e) {
    console.error('Failed to read clipboard', e)
  }
}

/**
 * Pastes clipboard content with rich formatting preserved (tables, styles, images converted to Markdown).
 */
export const pasteRichText = async (view: EditorView | null | undefined | any): Promise<void> => {
  if (!view) return
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html')
          const rawHtml = await blob.text()
          if (rawHtml && rawHtml.trim()) {
            let rawText = ''
            if (item.types.includes('text/plain')) {
              const textBlob = await item.getType('text/plain')
              rawText = await textBlob.text()
            }
            const handled = await applyRichPasteToView(view, rawHtml, rawText)
            if (handled) return
          }
        }
      }
    }
  } catch (err) {
    console.warn('Rich clipboard read not permitted or failed, falling back to plain text:', err)
  }

  // Fallback to plain text if rich paste is unavailable
  return pastePlainText(view)
}
