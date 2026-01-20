import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField, Facet } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import { CodeBlockHeaderWidget, CodeBlockFooterWidget } from './markdownWidgets'

/**
 * Editor mode facet for Lumina Markdown Editor
 * Supports: 'source' (show all syntax), 'live' (hide syntax, live preview)
 */
export const editorMode = Facet.define({
  combine: (values) => values[0] || 'live'
})

/**
 * Code Block Widget StateField
 *
 * Handles layout-level widgets (code block headers/footers) that require
 * block-level decorations. Inline decorations are handled by CodeMirror's
 * default markdown language support for better performance and robustness.
 *
 * Optimized for smooth typing performance:
 * - Only rebuilds when code block structure changes (not on every keystroke)
 * - Uses efficient syntax tree checks instead of string operations
 * - Skips rebuilds when typing inside code blocks
 */
const blockField = StateField.define({
  create() {
    return Decoration.none
  },
  update(decos, tr) {
    const mode = tr.state.facet(editorMode)
    const prevMode = tr.startState.facet(editorMode)

    // Source mode: no decorations (show all syntax)
    if (mode === 'source') {
      return Decoration.none
    }

    // Always rebuild on mode changes or reconfiguration
    const modeChanged = mode !== prevMode
    if (modeChanged || tr.reconfigured) {
      // Force rebuild - mode changed or extensions reconfigured
    } else if (tr.docChanged) {
      // FAST PATH: If we have decorations and it's a simple text edit, skip expensive checks
      // This makes typing smooth by avoiding syntax tree operations on every keystroke
      if (decos.size > 0) {
        // Quick check: only rebuild if we're near a fence line
        try {
          const cursorPos = tr.state.selection.main.head
          const cursorLine = tr.state.doc.lineAt(cursorPos)
          const lineText = cursorLine.text.trim()

          // If cursor is NOT on a fence line, and we have decorations, likely no structure change
          if (!lineText.startsWith('```')) {
            // Quick check: see if any changed lines are fence lines
            let nearFenceLine = false
            tr.changes.iterChanges((fromA, toA, fromB) => {
              try {
                // Only check the changed lines - much faster
                const changedLineA = tr.startState.doc.lineAt(
                  Math.min(fromA, tr.startState.doc.length - 1)
                )
                const changedLineB = tr.state.doc.lineAt(Math.min(fromB, tr.state.doc.length - 1))
                if (
                  changedLineA.text.trim().startsWith('```') ||
                  changedLineB.text.trim().startsWith('```')
                ) {
                  nearFenceLine = true
                  return true // Stop iteration
                }
              } catch {
                // If we can't check, assume we might be near a fence
                nearFenceLine = true
                return true
              }
            })

            // If not near a fence line, keep existing decorations (smooth typing!)
            if (!nearFenceLine) {
              return decos
            }
          }
        } catch {
          // If quick check fails, continue to full rebuild
        }
      }
    } else if (tr.selectionSet) {
      // Selection changed - only rebuild if we have no decorations
      if (decos.size > 0) {
        return decos
      }
    } else {
      // No document or selection changes - keep existing decorations
      return decos
    }

    // Check for code blocks efficiently using syntax tree (not string conversion)
    let hasCodeBlocks = false
    try {
      const tree = syntaxTree(tr.state)
      tree.iterate({
        enter: (node) => {
          if (node.name === 'FencedCode') {
            hasCodeBlocks = true
            return false // Stop iteration once we find one
          }
        }
      })
    } catch {
      // If tree iteration fails, assume no code blocks
    }

    // Empty document or no code blocks: no decorations
    if (!tr.state.doc.length || (!hasCodeBlocks && decos.size === 0)) {
      return Decoration.none
    }

    // Live mode: rebuild on viewport changes
    if (mode === 'live' && tr.viewportChanged) {
      // Viewport changed in live mode - rebuild decorations
    }

    // Build decorations for code blocks
    const builder = new RangeSetBuilder()
    const docLength = tr.state.doc.length

    try {
      const tree = syntaxTree(tr.state)
      tree.iterate({
        enter: (node) => {
          if (node.name !== 'FencedCode') {
            return
          }

          // Validate node positions
          if (node.from < 0 || node.to > docLength || node.from >= node.to) {
            return
          }

          try {
            const startLine = tr.state.doc.lineAt(node.from)
            const endLine = tr.state.doc.lineAt(node.to)
            const fenceText = startLine.text.trim()
            const lang = fenceText.replace(/`/g, '').trim() || 'text'

            // Extract code content (between fences) - only if needed
            // For performance, we can skip content extraction if not needed by widget
            let codeContent = ''
            if (startLine.number + 1 < endLine.number) {
              const contentStart = tr.state.doc.line(startLine.number + 1).from
              const contentEnd = tr.state.doc.line(endLine.number - 1).to

              if (contentStart >= 0 && contentEnd <= docLength && contentStart < contentEnd) {
                // Only extract if content is reasonably sized (performance optimization)
                const contentLength = contentEnd - contentStart
                if (contentLength < 10000) {
                  // Only extract for smaller blocks to avoid performance issues
                  codeContent = tr.state.doc.sliceString(contentStart, contentEnd)
                }
              }
            }

            // Add header widget (before opening fence)
            if (startLine.from >= 0 && startLine.from <= docLength) {
              builder.add(
                startLine.from,
                startLine.from,
                Decoration.widget({
                  widget: new CodeBlockHeaderWidget(lang, codeContent),
                  block: true,
                  side: -1
                })
              )
            }

            // Add footer widget (after closing fence)
            if (endLine.from >= 0 && endLine.from <= docLength) {
              builder.add(
                endLine.to,
                endLine.to,
                Decoration.widget({
                  widget: new CodeBlockFooterWidget(),
                  block: true,
                  side: 1
                })
              )
            }
          } catch (err) {
            // Silently skip invalid nodes - don't spam console during typing
            if (process.env.NODE_ENV === 'development') {
              console.warn('[richMarkdown] Error processing code block:', err)
            }
          }
        }
      })
    } catch (err) {
      // If syntax tree iteration fails, return existing decorations or none
      if (process.env.NODE_ENV === 'development') {
        console.warn('[richMarkdown] Error iterating syntax tree:', err)
      }
      return decos.size > 0 ? decos : Decoration.none
    }

    return builder.finish()
  },
  provide: (field) => EditorView.decorations.from(field)
})

/**
 * Inline Syntax Hiding StateField
 * Hides markdown syntax marks (**, ##, [], etc.) in live mode using regex
 */
const inlineSyntaxField = StateField.define({
  create() {
    return Decoration.none
  },
  update(decos, tr) {
    const mode = tr.state.facet(editorMode)

    // Source mode: show all syntax
    if (mode === 'source') {
      return Decoration.none
    }

    // Live mode: hide ALL syntax marks (preview mode - no editing)
    // Always rebuild in live mode to ensure decorations are applied immediately
    const prevMode = tr.startState.facet(editorMode)
    const modeChanged = mode !== prevMode

    // If mode changed to source, clear decorations immediately
    if (modeChanged && mode === 'source') {
      return Decoration.none
    }

    // In live mode, always rebuild to ensure symbols are hidden immediately
    // Don't skip rebuild even if decos exist - we need fresh decorations on mode change
    if (mode === 'live' && (modeChanged || tr.reconfigured || tr.docChanged)) {
      // Force rebuild - continue to decoration building
    } else if (mode !== 'live') {
      return Decoration.none
    } else if (decos.size > 0 && !modeChanged && !tr.reconfigured && !tr.docChanged) {
      // Only skip rebuild if we're in live mode, have decorations, and nothing changed
      return decos
    }

    const builder = new RangeSetBuilder()
    const doc = tr.state.doc

    // Handle empty document
    if (!doc.length) {
      return Decoration.none
    }

    // Get syntax tree to exclude code blocks and tables from inline syntax hiding
    let codeBlockRanges = []
    let tableRanges = []
    try {
      const tree = syntaxTree(tr.state)
      tree.iterate({
        enter: (node) => {
          if (node.name === 'FencedCode') {
            codeBlockRanges.push({ from: node.from, to: node.to })
          } else if (node.name === 'Table' || node.name === 'TableRow' || node.name === 'TableHeader') {
            tableRanges.push({ from: node.from, to: node.to })
          }
        }
      })
    } catch (err) {
      // If tree iteration fails, continue without exclusions
    }

    // Helper to check if position is inside a code block or table
    const isInCodeBlockOrTable = (pos) => {
      return codeBlockRanges.some(range => pos >= range.from && pos <= range.to) ||
             tableRanges.some(range => pos >= range.from && pos <= range.to)
    }

    // Patterns to match markdown syntax
    // Note: Order matters - more specific patterns should come first
    const patterns = [
      // Code block fences: ``` at start of line (must be first to exclude from other patterns)
      { regex: /^```[\w]*$/gm, name: 'codeblock-fence' },
      // Headings: #, ##, ###, etc. at start of line
      { regex: /^(#{1,6})\s/gm, name: 'heading' },
      // Bold: **text** (must not be part of ***)
      { regex: /\*\*([^*\n]+?)\*\*(?!\*)/g, name: 'bold' },
      // Bold: __text__ (must not be part of ___)
      { regex: /__(?![_\s])([^_\n]+?)(?<![_\s])__/g, name: 'bold' },
      // Strikethrough: ~~text~~ (check before italic to avoid conflicts)
      { regex: /~~([^~\n]+?)~~/g, name: 'strikethrough' },
      // Italic: *text* (but not ** or ***)
      { regex: /(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g, name: 'italic' },
      // Italic: _text_ (but not __ or ___)
      { regex: /(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)/g, name: 'italic' },
      // Inline code: `code` (but not ``` code blocks)
      { regex: /(?<!`)`(?!`)([^`\n]+?)(?<!`)`(?!`)/g, name: 'code' },
      // Links: [text](url) - hide brackets
      { regex: /\[([^\]]+)\]\([^)]+\)/g, name: 'link' }
    ]

    try {
      const text = doc.toString()
      const decorations = [] // Collect all decorations first

      patterns.forEach(({ regex, name }) => {
        // Create a new regex instance to avoid state issues with global flag
        const patternRegex = new RegExp(regex.source, regex.flags)
        let match

        while ((match = patternRegex.exec(text)) !== null) {
          const matchStart = match.index
          const matchEnd = matchStart + match[0].length

          // Skip if inside code block or table (they have their own styling)
          if (isInCodeBlockOrTable(matchStart) || isInCodeBlockOrTable(matchEnd)) {
            continue
          }

          // In preview mode, hide ALL symbols regardless of cursor position
          if (name === 'codeblock-fence') {
            // Hide the entire ``` fence line
            decorations.push({
              from: matchStart,
              to: matchEnd,
              decoration: Decoration.mark({ class: 'cm-hidden-mark' })
            })
          } else if (name === 'heading') {
            // Hide the # marks
            const hashCount = match[1].length
            decorations.push({
              from: matchStart,
              to: matchStart + hashCount,
              decoration: Decoration.mark({ class: 'cm-hidden-mark' })
            })
          } else if (name === 'bold') {
            // Hide ** or __
            if (match[0].startsWith('**')) {
              decorations.push({
                from: matchStart,
                to: matchStart + 2,
                decoration: Decoration.mark({ class: 'cm-hidden-mark' })
              })
              decorations.push({
                from: matchEnd - 2,
                to: matchEnd,
                decoration: Decoration.mark({ class: 'cm-hidden-mark' })
              })
            } else if (match[0].startsWith('__')) {
              decorations.push({
                from: matchStart,
                to: matchStart + 2,
                decoration: Decoration.mark({ class: 'cm-hidden-mark' })
              })
              decorations.push({
                from: matchEnd - 2,
                to: matchEnd,
                decoration: Decoration.mark({ class: 'cm-hidden-mark' })
              })
            }
          } else if (name === 'italic') {
            // Hide * or _
            if (match[0].startsWith('*')) {
              decorations.push({
                from: matchStart,
                to: matchStart + 1,
                decoration: Decoration.mark({ class: 'cm-hidden-mark' })
              })
              decorations.push({
                from: matchEnd - 1,
                to: matchEnd,
                decoration: Decoration.mark({ class: 'cm-hidden-mark' })
              })
            } else if (match[0].startsWith('_')) {
              decorations.push({
                from: matchStart,
                to: matchStart + 1,
                decoration: Decoration.mark({ class: 'cm-hidden-mark' })
              })
              decorations.push({
                from: matchEnd - 1,
                to: matchEnd,
                decoration: Decoration.mark({ class: 'cm-hidden-mark' })
              })
            }
          } else if (name === 'code') {
            // Hide backticks
            decorations.push({
              from: matchStart,
              to: matchStart + 1,
              decoration: Decoration.mark({ class: 'cm-hidden-mark' })
            })
            decorations.push({
              from: matchEnd - 1,
              to: matchEnd,
              decoration: Decoration.mark({ class: 'cm-hidden-mark' })
            })
          } else if (name === 'strikethrough') {
            // Hide ~~
            decorations.push({
              from: matchStart,
              to: matchStart + 2,
              decoration: Decoration.mark({ class: 'cm-hidden-mark' })
            })
            decorations.push({
              from: matchEnd - 2,
              to: matchEnd,
              decoration: Decoration.mark({ class: 'cm-hidden-mark' })
            })
          } else if (name === 'link') {
            // Hide [ and ]
            decorations.push({
              from: matchStart,
              to: matchStart + 1,
              decoration: Decoration.mark({ class: 'cm-hidden-mark' })
            })
            const closingBracket = match[0].indexOf(']')
            if (closingBracket > 0) {
              decorations.push({
                from: matchStart + closingBracket,
                to: matchStart + closingBracket + 1,
                decoration: Decoration.mark({ class: 'cm-hidden-mark' })
              })
            }
          }
        }
      })

      // Sort decorations by 'from' position before adding to builder
      decorations.sort((a, b) => a.from - b.from)

      // Add all decorations in sorted order
      decorations.forEach(({ from, to, decoration }) => {
        builder.add(from, to, decoration)
      })
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[richMarkdown] Error hiding inline syntax:', err)
      }
      return decos.size > 0 ? decos : Decoration.none
    }

    return builder.finish()
  },
  provide: (field) => EditorView.decorations.from(field)
})

/**
 * Rich Markdown Extensions
 *
 * Exports block-level decorations (code block widgets) and
 * inline syntax hiding (bold, italic, headings, etc.)
 */
export const richMarkdown = [blockField, inlineSyntaxField]
