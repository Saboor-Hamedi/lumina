/**
 * ============================================================================
 * Lumina Smart Link Paste (`smartLinkPaste.ts`)
 * ============================================================================
 * 
 * Automatically transforms selected editor text into markdown links when a URL
 * is pasted from the clipboard:
 *
 *     [Selected Text](https://example.com)
 *
 * Capabilities:
 * - Detects valid web URLs, mailto links, and www.* addresses.
 * - Auto-prepends `https://` to naked `www.` URLs.
 * - Preserves leading/trailing whitespace in selections.
 * - Prevents breaking multi-line selections (avoids corrupting multiple paragraphs).
 * - Bypassable via Shift key (Ctrl+Shift+V / Cmd+Shift+V) for raw unformatted paste.
 * ============================================================================
 */

import type { EditorView } from '@codemirror/view'

/**
 * Checks if the provided text is a single-line valid URL.
 */
export function isLikelyUrl(text: string): boolean {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim()

  // Reject multi-line strings or empty content
  if (trimmed.length === 0 || trimmed.includes('\n') || trimmed.includes('\r')) {
    return false
  }

  // Common URL patterns (http, https, www., mailto, file)
  const urlRegex = /^(https?:\/\/[^\s<>()"']+|www\.[^\s<>()"']+|mailto:[^\s<>()"']+|file:\/\/[^\s<>()"']+)/i
  return urlRegex.test(trimmed)
}

/**
 * Formats a raw URL for clean markdown consumption (e.g. www.foo.com -> https://www.foo.com).
 */
export function normalizePasteUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim()
  if (trimmed.toLowerCase().startsWith('www.')) {
    return `https://${trimmed}`
  }
  return trimmed
}

/**
 * Creates the markdown link string combining selected text and target URL.
 */
export function formatMarkdownLink(selectedText: string, rawUrl: string): string {
  const url = normalizePasteUrl(rawUrl)
  const trimmedText = selectedText.trim()

  // If the user already has brackets around the selection, e.g. `[Canva]`
  if (trimmedText.startsWith('[') && trimmedText.endsWith(']')) {
    return `${trimmedText}(${url})`
  }

  // Preserve leading and trailing whitespace from the selection
  const leadingSpaces = selectedText.match(/^\s*/)?.[0] || ''
  const trailingSpaces = selectedText.match(/\s*$/)?.[0] || ''

  return `${leadingSpaces}[${trimmedText}](${url})${trailingSpaces}`
}

export interface SmartPasteResult {
  handled: boolean
  insertedText?: string
  newCursorPos?: number
}

/**
 * Attempts to perform a smart link paste on an active CodeMirror EditorView.
 * Returns true if smart link paste was executed, false otherwise.
 */
export function trySmartLinkPaste(view: EditorView, clipboardText: string): boolean {
  if (!view || !view.state || !clipboardText) return false
  if (!view.state.selection || !view.state.selection.main) return false

  const { from, to } = view.state.selection.main

  // Only apply when there is an active selection (from !== to)
  if (from >= to) return false

  // Quick check: only proceed if clipboardText is a likely URL
  if (!isLikelyUrl(clipboardText)) {
    return false
  }

  // Safely extract selected text supporting mock views and standard CodeMirror states
  let selectedText = ''
  if (typeof view.state.sliceDoc === 'function') {
    selectedText = view.state.sliceDoc(from, to)
  } else if (view.state.doc && typeof (view.state.doc as any).sliceString === 'function') {
    selectedText = (view.state.doc as any).sliceString(from, to)
  } else {
    return false
  }

  // Don't apply to empty selections or massive multi-paragraph selections
  if (!selectedText.trim() || selectedText.includes('\n') || selectedText.includes('\r')) {
    return false
  }

  const markdownLink = formatMarkdownLink(selectedText, clipboardText)
  const newAnchor = from + markdownLink.length

  view.dispatch({
    changes: { from, to, insert: markdownLink },
    selection: { anchor: newAnchor },
    userEvent: 'input.paste'
  })

  return true
}
