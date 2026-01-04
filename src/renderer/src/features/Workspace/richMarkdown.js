import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, ViewPlugin } from '@codemirror/view'
import { HrWidget, CodeBlockHeaderWidget, CodeBlockFooterWidget } from './markdownWidgets'

/**
 * Lumina Live Preview & Reading Mode
 * 
 * DESIGN PHILOSOPHY:
 * 1. "What You See Is What You Mean" (Live Mode):
 *    - Formatting marks (**, ##, []) are hidden by default.
 *    - Cursor movement REVEALS them for editing.
 * 
 * 2. "True Reading" (Reading Mode):
 *    - Formatting marks are ALWAYS hidden.
 *    - Cursor movement does NOT reveal them.
 *    - Read-Only state enforced.
 */

// --- Constants ---
const HIDDEN_MARKS = new Set([
  'HeaderMark', 
  'QuoteMark', 
  'EmphasisMark', 
  'StrongEmphasisMark', 
  'CodeMark', 
  'LinkMark', 
  'StrikethroughMark', 
  'ProcessingInstruction'
])

// --- Decoration Factories ---
const headingDeco = (level) => Decoration.line({ attributes: { class: `cm-heading cm-heading-${level}` } })
const quoteDeco = Decoration.line({ attributes: { class: 'cm-blockquote' } })
const codeBlockBodyDeco = Decoration.line({ attributes: { class: 'cm-codeblock-body' } })
const codeBlockEndDeco = Decoration.line({ attributes: { class: 'cm-codeblock-end' } })
const hrDeco = Decoration.replace({ widget: new HrWidget() })

const listMarkDeco = Decoration.mark({ class: 'cm-list-mark' })
const urlDeco = Decoration.mark({ class: 'cm-url' })
const strongDeco = Decoration.mark({ class: 'cm-strong' })
const emphasisDeco = Decoration.mark({ class: 'cm-em' })
const wikilinkDeco = Decoration.mark({ class: 'cm-wikilink' })
const hideDeco = Decoration.mark({ class: 'cm-hidden-mark' })

/**
 * Main CodeMirror Plugin
 */
const livePreviewPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.buildDecorations(view)
  }

  update(update) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view) {
    const builder = new RangeSetBuilder()
    const { selection } = view.state
    const decorations = [] 

    // --- Helper: Active Line Check ---
    // Returns TRUE if we should reveal source syntax (Cursor is nearby)
    // Returns FALSE if we should hide syntax (Reading mode, or cursor far away)
    const shouldRevealSyntax = (from) => {
      // RULE 1: Reading Mode (Read Only) NEVER reveals syntax
      if (view.state.readOnly) return false
      
      // RULE 2: Source Mode ALWAYS reveals syntax
      // Check for the .mode-source class on the editor's ancestral container
      if (view.dom.closest('.mode-source')) return true

      // RULE 3: Live Mode reveals if cursor involves this line
      const line = view.state.doc.lineAt(from)
      for (const range of selection.ranges) {
        if (range.head >= line.from && range.head <= line.to) return true
      }
      return false
    }

    // --- Helper: Push Decoration ---
    const add = (from, to, val) => decorations.push({ from, to, val })

    // --- Main Loop ---
    for (let { from, to } of view.visibleRanges) {
      const safeTo = Math.min(to, view.state.doc.length)
      
      // 1. Parse WikiLinks (Regex)
      // We do this manually because WikiLinks aren't standard CommonMark
      const text = view.state.doc.sliceString(from, safeTo)
      const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
      let match
      while ((match = wikiRegex.exec(text)) !== null) {
        const start = from + match.index
        const end = start + match[0].length
        const linkLabel = match[2]
        
        if (shouldRevealSyntax(start)) {
           add(start, start + 2, Decoration.mark({ class: 'cm-link-bracket op-50' }))
           add(start + 2, end - 2, wikilinkDeco)
           add(end - 2, end, Decoration.mark({ class: 'cm-link-bracket op-50' }))
        } else {
          // Hide brackets, show label if exists
          if (linkLabel) {
            const pipeIndex = match[0].indexOf('|')
            add(start, start + pipeIndex + 1, hideDeco)     // [[Target|
            add(start + pipeIndex + 1, end - 2, wikilinkDeco) // Label
            add(end - 2, end, hideDeco)                     // ]]
          } else {
            add(start, start + 2, hideDeco)                 // [[
            add(start + 2, end - 2, wikilinkDeco)           // Target
            add(end - 2, end, hideDeco)                     // ]]
          }
        }
      }

      // 2. Parse Standard Markdown (Syntax Tree)
      let inLink = false
      syntaxTree(view.state).iterate({
        from,
        to: safeTo,
        enter: (node) => {
          const { name, from: nFrom, to: nTo } = node

          // Track Link Context
          if (name === 'Link' || name === 'Image') inLink = true

          // --- Block Styling ---

          // Headers
          if (name.startsWith('ATXHeading')) {
            const level = parseInt(name.slice(-1)) || 1
            const line = view.state.doc.lineAt(nFrom)
            add(line.from, line.from, headingDeco(level))

            // Highlight the Header Mark (#) when not active
            if (!shouldRevealSyntax(nFrom)) {
              const mark = node.node.firstChild
              if (mark && mark.name === 'HeaderMark') {
                add(mark.from, mark.to, hideDeco)
              }
            }
          }

          // Blockquotes
          if (name === 'Blockquote') {
            const startLine = view.state.doc.lineAt(nFrom).number
            const endLine = view.state.doc.lineAt(nTo).number
            for (let i = startLine; i <= endLine; i++) {
              const l = view.state.doc.line(i)
              add(l.from, l.from, quoteDeco)

              // Hide the > mark if not active
              if (!shouldRevealSyntax(l.from)) {
                // This is slightly tricky with line decorations, usually we decorate the mark separately
              }
            }
          }

          // Horizontal Rule (FB Standard #11: Reveal on active)
          if (name === 'HorizontalRule') {
            if (!shouldRevealSyntax(nFrom)) {
              add(nFrom, nTo, hrDeco)
            }
          }

          // Fenced Code Blocks
          if (name === 'FencedCode') {
            const startLine = view.state.doc.lineAt(nFrom).number
            const endLine = view.state.doc.lineAt(nTo).number
            const startL = view.state.doc.line(startLine)

            // Extract Info
            const fenceText = startL.text.trim()
            const lang = fenceText.replace(/`/g, '').trim() || 'text'

            let codeContent = ''
            const bodyStartLine = startLine + 1
            const bodyEndLine = endLine - 1

            if (bodyStartLine <= bodyEndLine) {
              const startPos = view.state.doc.line(bodyStartLine).from
              const endPos = view.state.doc.line(bodyEndLine).to
              codeContent = view.state.doc.sliceString(startPos, endPos)
            }

            // Render Header
            if (!shouldRevealSyntax(startL.from)) {
              add(
                startL.from,
                startL.to,
                Decoration.replace({ widget: new CodeBlockHeaderWidget(lang, codeContent) })
              )
            } else {
              add(startL.from, startL.from, codeBlockBodyDeco)
            }

            // Render Body
            for (let i = startLine + 1; i < endLine; i++) {
              const l = view.state.doc.line(i)
              add(l.from, l.from, codeBlockBodyDeco)
            }

            // Render Footer
            const endL = view.state.doc.line(endLine)
            if (!shouldRevealSyntax(endL.from)) {
              add(endL.from, endL.to, Decoration.replace({ widget: new CodeBlockFooterWidget() }))
            } else {
              add(endL.from, endL.from, codeBlockEndDeco)
            }
          }

          // --- Hiding Logic ---

          // Standard Marks (Bold, Italic, etc)
          if (HIDDEN_MARKS.has(name)) {
            if (!shouldRevealSyntax(nFrom)) {
              add(nFrom, nTo, hideDeco)
            }
          }

          // URLs inside Links (e.g. [foo](http://bar))
          if (name === 'URL' && inLink) {
            if (!shouldRevealSyntax(nFrom)) {
              add(nFrom, nTo, hideDeco)
            }
          }

          // --- Inline Styling ---
          if (name === 'ListMark') add(nFrom, nTo, listMarkDeco)
          if (name === 'URL' && !inLink) add(nFrom, nTo, urlDeco)
          if (name === 'StrongEmphasis') add(nFrom, nTo, strongDeco)
          if (name === 'Emphasis') add(nFrom, nTo, emphasisDeco)
        },
        leave: (node) => {
          if (node.name === 'Link' || node.name === 'Image') inLink = false
        }
      })
    }

    // 3. Robust Sorting (Prevents Crashes)
    decorations.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from
      if (a.val.startSide !== b.val.startSide) return a.val.startSide - b.val.startSide
      return a.to - b.to
    })

    // 4. Build RangeSet
    for (const { from, to, val } of decorations) {
      builder.add(from, to, val)
    }

    return builder.finish()
  }
}, {
  decorations: v => v.decorations
})

export const richMarkdown = [
  livePreviewPlugin
]
