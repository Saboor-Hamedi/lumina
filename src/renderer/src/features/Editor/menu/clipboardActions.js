/**
 * clipboardActions.js
 * 
 * Handles clipboard operations (Copy, Cut, Paste, Paste as plain text) and selecting all text in the editor.
 * Supports rich HTML-to-Markdown conversion for formatted paste (Word, web, tables, images).
 */

import { htmlToMarkdown, applyRichPasteToView } from '../utils/htmlToMarkdown'

export const selectAll = (view) => {
  if (!view) return
  view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })
  view.focus()
}

export const cutText = () => document.execCommand('cut')
export const copyText = () => document.execCommand('copy')

/**
 * Pastes clipboard content as unformatted raw plain text.
 */
export const pastePlainText = async (view) => {
  if (!view) return
  try {
    const text = await navigator.clipboard.readText()
    view.dispatch({
      changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert: text }
    })
    view.focus()
  } catch (e) {
    console.error('Failed to read clipboard', e)
  }
}

/**
 * Pastes clipboard content with rich formatting preserved (tables, styles, images converted to Markdown).
 */
export const pasteRichText = async (view) => {
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
