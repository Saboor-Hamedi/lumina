/**
 * =========================================================================================
 * Callout Extension & Helper Hook (`useCallout.js`)
 * =========================================================================================
 *
 * Responsibilities:
 * - Provides live preview widgets and line styling for Obsidian-style markdown callouts:
 *   `> [!note] Title`
 *   `> [!tip] Title`
 *   `> [!warning] Title`
 *   `> [!important] Title`
 *   `> [!caution] Title`
 *   `> [!info] Title`
 *   `> [!success] Title`
 *   `> [!question] Title`
 *   `> [!bug] Title`
 *   `> [!example] Title`
 *   `> [!quote] Title`
 *   `> [!todo] Title`
 *   `> [!danger] Title`
 * - Provides helper functions for inserting, converting, and toggling callouts
 * - Exposes `useCallout()` React hook
 * =========================================================================================
 */

import { useCallback } from 'react'
import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'

/**
 * Standard callout types with associated metadata and default icons
 */
export const CALLOUT_TYPES = {
  note: { type: 'note', label: 'Note', color: '#38bdf8' },
  tip: { type: 'tip', label: 'Tip', color: '#4ade80' },
  warning: { type: 'warning', label: 'Warning', color: '#fbbf24' },
  important: { type: 'important', label: 'Important', color: '#a855f7' },
  caution: { type: 'caution', label: 'Caution', color: '#f87171' },
  info: { type: 'info', label: 'Info', color: '#38bdf8' },
  success: { type: 'success', label: 'Success', color: '#4ade80' },
  question: { type: 'question', label: 'Question', color: '#fbbf24' },
  bug: { type: 'bug', label: 'Bug', color: '#f87171' },
  example: { type: 'example', label: 'Example', color: '#a855f7' },
  quote: { type: 'quote', label: 'Quote', color: '#94a3b8' },
  todo: { type: 'todo', label: 'Todo', color: '#38bdf8' },
  danger: { type: 'danger', label: 'Danger', color: '#f87171' }
}

/**
 * CodeMirror Widget rendering the stylized header of a Callout block
 */
export class CalloutHeaderWidget extends WidgetType {
  constructor(type, title) {
    super()
    this.type = (type || 'note').toLowerCase()
    this.title = title || ''
  }

  eq(other) {
    return other.type === this.type && other.title === this.title
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = `lumina-callout-header lumina-callout-${this.type}`

    const icon = document.createElement('span')
    icon.className = 'lumina-callout-icon'

    // Match icons based on callout type
    if (this.type === 'note' || this.type === 'info') {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`
    } else if (this.type === 'warning') {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`
    } else if (this.type === 'tip' || this.type === 'success') {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`
    } else if (this.type === 'important') {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4c0-1.1.9-2 2-2"></path><path d="M20 2c1.1 0 2 .9 2 2"></path><path d="M22 8c0 1.1-.9 2-2 2"></path><path d="M16 10c-1.1 0-2-.9-2-2"></path><path d="m8.2 20.2 1.4 1.4"></path><path d="m2 22 2.8-2.8"></path><path d="m2.8 2 4.6 4.6"></path><path d="m20.2 8.2-1.4-1.4"></path></svg>`
    } else if (this.type === 'caution' || this.type === 'danger' || this.type === 'bug') {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>`
    } else {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`
    }

    const text = document.createElement('span')
    text.className = 'lumina-callout-title'
    text.textContent = this.title || this.type.toUpperCase()

    wrap.appendChild(icon)
    wrap.appendChild(text)

    return wrap
  }
}

/**
 * CodeMirror ViewPlugin for scanning, decorating, and styling Callouts
 */
export const calloutPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.buildDecorations(view)
    }

    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view) {
      const builder = []
      const doc = view.state.doc
      let currentCalloutType = null
      let currentCalloutLevel = 0

      for (let { from, to } of view.visibleRanges) {
        let lineIdx = doc.lineAt(from).number
        const endLineIdx = doc.lineAt(to).number

        for (; lineIdx <= endLineIdx; lineIdx++) {
          const line = doc.line(lineIdx)

          // Count blockquote level
          const match = line.text.match(/^(>\s*)+/)
          if (match) {
            const level = match[0].match(/>/g).length

            // Is this a new callout header? e.g. > [!note] Title
            const blockStart = line.text.match(/^(?:>\s*)+\[!([a-zA-Z]+)\](.*)/)
            if (blockStart) {
              currentCalloutLevel = level
              currentCalloutType = blockStart[1]
              const title = blockStart[2].trim()

              // Only replace if cursor is NOT on this line
              const cursor = view.state.selection.main.head
              if (cursor < line.from || cursor > line.to) {
                const replaceFrom = line.from + line.text.indexOf('[')
                const replaceTo = line.to
                builder.push(
                  Decoration.replace({
                    widget: new CalloutHeaderWidget(currentCalloutType, title)
                  }).range(replaceFrom, replaceTo)
                )
              }

              builder.push(
                Decoration.line({
                  class: `lumina-callout-line lumina-callout-line-${currentCalloutType.toLowerCase()}`
                }).range(line.from)
              )
            } else if (currentCalloutType && level >= currentCalloutLevel) {
              // Continuation of callout
              builder.push(
                Decoration.line({
                  class: `lumina-callout-line lumina-callout-line-${currentCalloutType.toLowerCase()}`
                }).range(line.from)
              )
            } else {
              // Reset if level drops
              currentCalloutType = null
            }
          } else {
            // Not a blockquote, reset
            currentCalloutType = null
          }
        }
      }

      // Sort decorations
      return Decoration.set(
        builder.sort((a, b) => a.from - b.from),
        true
      )
    }
  },
  {
    decorations: (v) => v.decorations
  }
)

export const calloutExtension = calloutPlugin

/**
 * Inserts a new Callout block or wraps the current selection in a callout
 */
export function insertCallout(view, type = 'note', title = '') {
  if (!view) return false
  const state = view.state
  const sel = state.selection.main
  const selectedText = state.sliceDoc(sel.from, sel.to)

  const calloutType = (type || 'note').toLowerCase()
  const header = `> [!${calloutType}]${title ? ` ${title}` : ''}\n`

  let content = selectedText || 'Content\n'
  if (!content.endsWith('\n')) content += '\n'

  const formattedContent = content
    .split('\n')
    .filter((_, idx, arr) => idx < arr.length - 1 || _ !== '')
    .map((line) => `> ${line}`)
    .join('\n') + '\n'

  const insertText = `\n${header}${formattedContent}\n`

  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: insertText },
    selection: { anchor: sel.from + header.length + 3 }
  })
  return true
}

/**
 * React hook wrapping callout utilities and extensions
 */
export function useCallout() {
  const insert = useCallback((view, type = 'note', title = '') => {
    return insertCallout(view, type, title)
  }, [])

  return {
    calloutExtension,
    insertCallout: insert,
    CALLOUT_TYPES
  }
}

export default useCallout
