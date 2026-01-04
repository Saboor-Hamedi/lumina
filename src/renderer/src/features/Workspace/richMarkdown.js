import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField, StateEffect, Facet } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { HrWidget, CodeBlockHeaderWidget } from './markdownWidgets'

/**
 * Modes for the Lumina Editor
 */
export const editorMode = Facet.define({
  combine: (values) => values[0] || 'live'
})

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
const headingDeco = (level) =>
  Decoration.line({ attributes: { class: `cm-heading cm-heading-${level}` } })
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
/**
 * CodeBlock & Rich Markdown StateField
 * Using StateField allows us to use BLOCK decorations (needed for headers) 
 * without triggering the RangeError associated with ViewPlugins.
 */
const richMarkdownField = StateField.define({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    return buildDecorations(tr.state)
  },
  provide: (f) => EditorView.decorations.from(f)
})

function buildDecorations(state) {
  const builder = new RangeSetBuilder()
  const selection = state.selection
  const decorations = []
  let inImage = false // Track Image Context specifically
  let inLink = false

  // --- Helper: Selection Context ---
  const mode = state.facet(editorMode)
  const shouldReveal = (at) => {
    // RULE 1: Source Mode ALWAYS reveals syntax
    if (mode === 'source') return true

    // RULE 2: Reading Mode (Read Only) NEVER reveals syntax
    if (state.readOnly) return false

    // RULE 3: Live Mode reveals if cursor is on this line
    const line = state.doc.lineAt(at)
    for (const range of selection.ranges) {
      if (range.head >= line.from && range.head <= line.to) return true
    }
    return false
  }

  const add = (from, to, val) => decorations.push({ from, to, val })

  // 1. Regex Pass (WikiLinks & Images)
  // We do this manually because WikiLinks aren't standard CommonMark
  // Iterate over the entire document for StateField
  const docText = state.doc.toString()
  const docLength = state.doc.length

  // WikiLinks
  const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  let match
  while ((match = wikiRegex.exec(docText)) !== null) {
    const start = match.index
    const end = start + match[0].length
    const linkLabel = match[2]

    if (shouldReveal(start)) {
      add(start, start + 2, Decoration.mark({ class: 'cm-link-bracket op-50' }))
      add(start + 2, end - 2, wikilinkDeco)
      add(end - 2, end, Decoration.mark({ class: 'cm-link-bracket op-50' }))
    } else {
      // Hide brackets, show label if exists
      if (linkLabel) {
        const pipeIndex = match[0].indexOf('|')
        add(start, start + pipeIndex + 1, hideDeco) // [[Target|
        add(start + pipeIndex + 1, end - 2, wikilinkDeco) // Label
        add(end - 2, end, hideDeco) // ]]
      } else {
        add(start, start + 2, hideDeco) // [[
        add(start + 2, end - 2, wikilinkDeco) // Target
        add(end - 2, end, hideDeco) // ]]
      }
    }
  }

  // Images (![alt](url)) - PRECISE HIDING
  const imgRegex = /!\[(.*?)\]\((.*?)\)/g
  let imgMatch
  while ((imgMatch = imgRegex.exec(docText)) !== null) {
    const start = imgMatch.index
    const end = start + imgMatch[0].length
    const altText = imgMatch[1]

    const altStart = start + 2
    const altEnd = altStart + altText.length

    if (!shouldReveal(start)) {
      // Safety: If alt text is empty, hiding marks makes image invisible/unhoverable.
      // In that case, we REVEAL syntax or at least don't hide it.
      if (altText.length === 0) {
        // Do nothing (reveal) OR render a placeholder widget (advanced).
        // For now, reveal to ensure robustness.
      } else {
        // Hide '!['
        add(start, altStart, hideDeco)

        // Decorate the Alt Text so it looks like a distinct object (not plain text)
        add(altStart, altEnd, Decoration.mark({ class: 'cm-image-alt-text' }))

        // Hide '](url)'
        add(altEnd, end, hideDeco)
      }
    }
  }

  // 2. Syntax Tree Pass
  syntaxTree(state).iterate({
    from: 0,
    to: docLength,
    enter: (node) => {
      const { name, from, to } = node

      // Track Link/Image Context
      if (name === 'Link') inLink = true
      if (name === 'Image') {
        inLink = true
        inImage = true
      }

      // Headers
      if (name.startsWith('ATXHeading')) {
        const level = parseInt(name.slice(-1)) || 1
        const line = state.doc.lineAt(from)
        add(line.from, line.from, headingDeco(level))
      }

      // Blockquotes
      if (name === 'Blockquote') {
        const startLine = state.doc.lineAt(from).number
        const endLine = state.doc.lineAt(to).number
        for (let i = startLine; i <= endLine; i++) {
          const l = state.doc.line(i)
          add(l.from, l.from, quoteDeco)
        }
      }

      // Horizontal Rule (FB Standard #11: Reveal on active)
      if (name === 'HorizontalRule' && !shouldReveal(from)) {
        add(from, to, hrDeco)
      }

      // Fenced Code Blocks (The Core Fix)
      if (name === 'FencedCode') {
        const startLine = state.doc.lineAt(from).number
        const endLine = state.doc.lineAt(to).number
        const startL = state.doc.line(startLine)

        const fenceText = startL.text.trim()
        const lang = fenceText.replace(/`/g, '').trim() || 'text'
        
        // Extract content for copy button
        let codeContent = ''
        if (startLine + 1 < endLine) {
           codeContent = state.doc.sliceString(state.doc.line(startLine + 1).from, state.doc.line(endLine - 1).to)
        }

        // A. THE HEADER (BLOCK WIDGET)
        // By using block: true, the widget sits above the line and is NOT part of the selectable text range.
        // This stops the glitching when selecting.
        add(startL.from, startL.from, Decoration.widget({ 
          widget: new CodeBlockHeaderWidget(lang, codeContent),
          block: true,
          side: -1 
        }))

        // B. THE BEGIN LINE (Hide backticks if not active)
        add(startL.from, startL.from, Decoration.line({ attributes: { class: 'cm-codeblock-begin' } }))
        if (!shouldReveal(startL.from)) {
          add(startL.from, startL.to, hideDeco)
        }

        // C. BODY LINES
        for (let i = startLine + 1; i < endLine; i++) {
          const l = state.doc.line(i)
          add(l.from, l.from, Decoration.line({ attributes: { class: 'cm-codeblock-body' } }))
        }

        // D. END LINE
        const endL = state.doc.line(endLine)
        add(endL.from, endL.from, Decoration.line({ attributes: { class: 'cm-codeblock-end' } }))
        if (!shouldReveal(endL.from)) {
          add(endL.from, endL.to, hideDeco)
        }
      }

      // --- Hiding Logic ---

      // Standard Marks (Bold, Italic, etc)
      if (HIDDEN_MARKS.has(name)) {
        if (!shouldReveal(from)) {
          add(from, to, hideDeco)
        }
      }

      // URLs inside Links (e.g. [foo](http://bar))
      // We ONLY hide URLs for Links, NOT Images (so Images remain visible/hoverable in Reading Mode)
      if (name === 'URL' && inLink && !inImage) {
        if (!shouldReveal(from)) {
          add(from, to, hideDeco)
        }
      }

      // --- Inline Styling ---
      if (name === 'ListMark') add(from, to, listMarkDeco)
      if (name === 'URL' && !inLink) add(from, to, urlDeco)
      if (name === 'StrongEmphasis') add(from, to, strongDeco)
      if (name === 'Emphasis') add(from, to, emphasisDeco)
    },
    leave: (node) => {
      if (node.name === 'Link') inLink = false
      if (node.name === 'Image') {
        inLink = false
        inImage = false
      }
    }
  })

  // Sort and Build
  decorations.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from
    if (a.val.startSide !== b.val.startSide) return a.val.startSide - b.val.startSide
    return a.to - b.to
  })
  for (const { from, to, val } of decorations) builder.add(from, to, val)
  return builder.finish()
}

export const richMarkdown = [richMarkdownField]
