import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField, Facet } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import { HrWidget, CodeBlockHeaderWidget } from './markdownWidgets'

/**
 * Modes for the Lumina Editor
 */
export const editorMode = Facet.define({
  combine: (values) => values[0] || 'live'
})

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

// --- Decoration Factories (Cached for Performance) ---
const headingDecos = [
  null,
  Decoration.line({ attributes: { class: 'cm-heading cm-heading-1' } }),
  Decoration.line({ attributes: { class: 'cm-heading cm-heading-2' } }),
  Decoration.line({ attributes: { class: 'cm-heading cm-heading-3' } }),
  Decoration.line({ attributes: { class: 'cm-heading cm-heading-4' } }),
  Decoration.line({ attributes: { class: 'cm-heading cm-heading-5' } }),
  Decoration.line({ attributes: { class: 'cm-heading cm-heading-6' } })
]
const quoteDeco = Decoration.line({ attributes: { class: 'cm-blockquote' } })
const hrDeco = Decoration.replace({ widget: new HrWidget() })
const wikilinkDeco = Decoration.mark({ class: 'cm-wikilink' })
const hideDeco = Decoration.mark({ class: 'cm-hidden-mark' })
const listMarkDeco = Decoration.mark({ class: 'cm-list-mark' })
const strongDeco = Decoration.mark({ class: 'cm-strong' })
const emphasisDeco = Decoration.mark({ class: 'cm-em' })
const inlineCodeDeco = Decoration.mark({ class: 'cm-inline-code' })
const taskMarkerDeco = Decoration.mark({ class: 'cm-task-marker' })

// --- Table Decos ---
const tableRowDeco = Decoration.line({ attributes: { class: 'cm-table-row' } })
const tableHeaderDeco = Decoration.line({ attributes: { class: 'cm-table-header' } })
const tableCellDeco = Decoration.mark({ class: 'cm-table-cell' })
const tablePipeDeco = Decoration.mark({ class: 'cm-table-pipe' })
const tablePipeHiddenDeco = Decoration.mark({ class: 'cm-table-pipe-hidden' })

/**
 * STRATEGY: 
 * CodeMirror 6 does not allow BLOCK decorations (layout widgets) from ViewPlugins.
 * 1. StateField (blockField): Handles layout-level widgets (Code Headers).
 * 2. ViewPlugin (richMarkdownPlugin): Handles high-performance inline/mark/line styling.
 */

// --- 1. Block StateField (Layout Stability) ---
const blockField = StateField.define({
  create(state) { 
    // Check mode on creation too
    const mode = state.facet(editorMode)
    if (mode === 'source') {
      return Decoration.none
    }
    return Decoration.none 
  },
  update(decos, tr) {
    // Always check mode first - mode changes should trigger updates
    const mode = tr.state.facet(editorMode)
    
    // In source mode, always return no decorations (clear any existing ones)
    // This prevents header widgets from appearing when typing ``` in source mode
    if (mode === 'source') {
      // Force clear all decorations in source mode - no widgets should appear
      return Decoration.none
    }
    
    // If mode changed (reconfigured) or we have existing decorations but shouldn't, rebuild
    // Early return optimization - but only if nothing changed
    // Note: tr.reconfigured is true when extensions change (like editorMode)
    if (!tr.docChanged && !tr.selectionSet && !tr.reconfigured) {
      // But still check if we have decorations when we shouldn't (safety check)
      return decos
    }
    
    // Safety check: ensure document is valid
    if (!tr.state.doc.length) return Decoration.none
    
    const builder = new RangeSetBuilder()
    const docLength = tr.state.doc.length
    
    try {
      syntaxTree(tr.state).iterate({
        enter: (node) => {
          if (node.name === 'FencedCode') {
            // Safety check: ensure node positions are valid
            if (node.from < 0 || node.to > docLength || node.from >= node.to) return
            
            try {
              const startLine = tr.state.doc.lineAt(node.from)
              const fenceText = startLine.text.trim()
              const lang = fenceText.replace(/`/g, '').trim() || 'text'
              
              let codeContent = ''
              const nodeTo = node.to
              const endLineNum = tr.state.doc.lineAt(nodeTo).number
              if (startLine.number + 1 < endLineNum) {
                const startPos = tr.state.doc.line(startLine.number + 1).from
                const endPos = tr.state.doc.line(endLineNum - 1).to
                // Safety check: ensure slice positions are valid
                if (startPos >= 0 && endPos <= docLength && startPos < endPos) {
                  codeContent = tr.state.doc.sliceString(startPos, endPos)
                }
              }

              // Safety check: ensure decoration position is valid
              // Only add header widget in live/reading mode, not source mode
              if (startLine.from >= 0 && startLine.from <= docLength) {
                builder.add(startLine.from, startLine.from, Decoration.widget({ 
                   widget: new CodeBlockHeaderWidget(lang, codeContent), block: true, side: -1 
                }))
              }
            } catch (err) {
              // Silently skip invalid nodes to prevent crashes
              console.warn('[richMarkdown] Error processing code block:', err)
            }
          }
        }
      })
    } catch (err) {
      // If syntax tree iteration fails, return empty decorations
      console.warn('[richMarkdown] Error iterating syntax tree:', err)
      return Decoration.none
    }
    
    return builder.finish()
  },
  provide: f => EditorView.decorations.from(f)
})

// --- 2. Inline ViewPlugin (Viewport Optimized) ---
const richMarkdownPlugin = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = this.buildDecorations(view) }
  update(update) {
    if (update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }
  buildDecorations(view) {
    const builder = new RangeSetBuilder()
    const { state, viewport } = view
    const mode = state.facet(editorMode)
    const selection = state.selection

    const shouldReveal = (at) => {
      if (mode === 'source') return true
      if (state.readOnly) return false
      const line = state.doc.lineAt(at)
      for (const range of selection.ranges) {
        if (range.head >= line.from && range.head <= line.to) return true
      }
      return false
    }

    const from = viewport.from, to = viewport.to
    const temp = []

    // Inline Regex (WikiLinks & Images)
    const viewportText = state.doc.sliceString(from, to)
    const wikiRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
    let match
    while ((match = wikiRegex.exec(viewportText)) !== null) {
      const start = from + match.index, end = start + match[0].length
      if (shouldReveal(start)) {
        temp.push({ from: start, to: start + 2, val: Decoration.mark({ class: 'cm-link-bracket op-50' }) })
        temp.push({ from: start + 2, to: end - 2, val: wikilinkDeco })
        temp.push({ from: end - 2, to: end, val: Decoration.mark({ class: 'cm-link-bracket op-50' }) })
      } else {
        const pipeIndex = match[0].indexOf('|')
        if (pipeIndex !== -1) {
          temp.push({ from: start, to: start + pipeIndex + 1, val: hideDeco })
          temp.push({ from: start + pipeIndex + 1, to: end - 2, val: wikilinkDeco })
          temp.push({ from: end - 2, to: end, val: hideDeco })
        } else {
          temp.push({ from: start, to: start + 2, val: hideDeco })
          temp.push({ from: start + 2, to: end - 2, val: wikilinkDeco })
          temp.push({ from: end - 2, to: end, val: hideDeco })
        }
      }
    }

    const imgRegex = /!\[(.*?)\]\((.*?)\)/g
    let imgM
    while ((imgM = imgRegex.exec(viewportText)) !== null) {
      const start = from + imgM.index, end = start + imgM[0].length
      if (!shouldReveal(start) && imgM[1].length > 0) {
        temp.push({ from: start, to: end, val: hideDeco })
      }
    }

    // Syntax Tree Pass
    let inLink = false, inImg = false
    syntaxTree(state).iterate({
      from, to,
      enter: (node) => {
        const { name, from: nF, to: nT } = node
        if (name === 'Link') inLink = true
        if (name === 'Image') { inLink = true; inImg = true }

        if (name.startsWith('ATXHeading')) {
          const l = parseInt(name.slice(-1)) || 1
          temp.push({ from: state.doc.lineAt(nF).from, to: state.doc.lineAt(nF).from, val: headingDecos[l] })
        }
        if (name === 'Blockquote') {
          for (let i = state.doc.lineAt(Math.max(from, nF)).number; i <= state.doc.lineAt(Math.min(to, nT)).number; i++) {
            const l = state.doc.line(i); temp.push({ from: l.from, to: l.from, val: quoteDeco })
          }
        }
        if (name === 'HorizontalRule' && !shouldReveal(nF)) temp.push({ from: nF, to: nT, val: hrDeco })
        
        if (name === 'FencedCode') {
          const line = state.doc.lineAt(nF)
          // In source mode, don't add any code block styling - just plain ``` text
          if (mode !== 'source') {
            temp.push({ from: line.from, to: line.from, val: Decoration.line({ attributes: { class: 'cm-codeblock-begin' } }) })
          }
          // Only hide fence markers in live/reading mode, never in source mode
          // Also check if we're currently editing this line (cursor is on it)
          const isEditingFence = selection.ranges.some(r => {
            const cursorLine = state.doc.lineAt(r.head)
            return cursorLine.number === line.number || cursorLine.number === state.doc.lineAt(nT).number
          })
          if (mode !== 'source' && !shouldReveal(nF) && !isEditingFence) {
            temp.push({ from: line.from, to: line.to, val: hideDeco })
          }
          
          const endL = state.doc.lineAt(nT)
          // In source mode, don't add code block body styling
          if (mode !== 'source') {
            for (let i = Math.max(line.number + 1, state.doc.lineAt(from).number); i < Math.min(endL.number, state.doc.lineAt(to).number); i++) {
              const curL = state.doc.line(i)
              temp.push({ from: curL.from, to: curL.from, val: Decoration.line({ attributes: { class: 'cm-codeblock-body' } }) })
            }
          }
          if (nT <= to) {
            // In source mode, don't add code block end styling
            if (mode !== 'source') {
              temp.push({ from: endL.from, to: endL.from, val: Decoration.line({ attributes: { class: 'cm-codeblock-end' } }) })
            }
            // Only hide closing fence in live/reading mode, never in source mode
            // Also check if we're currently editing this line
            if (mode !== 'source' && !shouldReveal(nT) && !isEditingFence) {
              temp.push({ from: endL.from, to: endL.to, val: hideDeco })
            }
          }
        }

        if (HIDDEN_MARKS.has(name) && !shouldReveal(nF)) temp.push({ from: nF, to: nT, val: hideDeco })
        if (name === 'URL' && inLink && !inImg && !shouldReveal(nF)) temp.push({ from: nF, to: nT, val: hideDeco })
        if (name === 'ListMark') temp.push({ from: nF, to: nT, val: listMarkDeco })
        if (name === 'StrongEmphasis') {
           temp.push({ from: nF, to: nT, val: strongDeco })
        }
        if (name === 'Emphasis') {
           temp.push({ from: nF, to: nT, val: emphasisDeco })
        }
        if (name === 'InlineCode') {
           temp.push({ from: nF, to: nT, val: inlineCodeDeco })
        }
        if (name === 'TaskMarker') {
           temp.push({ from: nF, to: nT, val: taskMarkerDeco })
        }

        // --- Table Handling ---
        if (name === 'Table') {
           // Standard table row decoration logic
        }
        if (name === 'TableHeader') {
           const line = state.doc.lineAt(nF)
           temp.push({ from: line.from, to: line.from, val: tableHeaderDeco })
        }
        if (name === 'TableRow') {
           const line = state.doc.lineAt(nF)
           temp.push({ from: line.from, to: line.from, val: tableRowDeco })
        }
        if (name === 'TableCell') {
           temp.push({ from: nF, to: nT, val: tableCellDeco })
        }
        if (name === 'TableDelimiter') {
           if (!shouldReveal(nF)) {
             temp.push({ from: nF, to: nT, val: tablePipeHiddenDeco })
           } else {
             temp.push({ from: nF, to: nT, val: tablePipeDeco })
           }
        }
      },
      leave: (node) => {
        if (node.name === 'Link') inLink = false
        if (node.name === 'Image') { inLink = false; inImg = false }
      }
    })

    temp.sort((a, b) => a.from - b.from || a.to - b.to)
    for (const { from, to, val } of temp) {
      if (from <= to && from >= 0 && to <= state.doc.length) builder.add(from, to, val)
    }
    return builder.finish()
  }
}, { decorations: v => v.decorations })

export const richMarkdown = [blockField, richMarkdownPlugin]
