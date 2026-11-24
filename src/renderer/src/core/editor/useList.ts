import { syntaxTree } from '@codemirror/language'
import { EditorSelection, type ChangeSpec, type EditorState, type Extension, type Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { isComposing } from '../i18n'

export type ListKind = 'bullet' | 'task' | 'ordered-num' | 'ordered-alpha'

export interface ParsedListLine {
  /** Leading blockquote prefix if any (e.g. `> `, `>> `), otherwise `''`. */
  quotePrefix: string
  /** Leading whitespace indentation after any blockquote prefix. */
  indent: string
  /** Raw marker without trailing space (e.g. `-`, `1.`, `a)`, `- [ ]`). */
  marker: string
  /** Task checkbox character when kind === 'task' (`' '`, `'x'`, `'X'`, `''`). */
  taskState?: string
  /** Numeric value when kind === 'ordered-num'. */
  num?: number
  /** Alphabetic marker when kind === 'ordered-alpha'. */
  alpha?: string
  /** Ordered delimiter (`.` or `)`). */
  delim?: string
  /** Bullet symbol (`-`, `*`, `+`) for bullet or task items. */
  bullet?: string
  /** Kind of list item. */
  kind: ListKind
  /** Exact prefix length from line start up to and including the space(s) after the marker. */
  prefixLength: number
  /** Content text after the marker prefix. */
  content: string
}

const INDENT_UNIT = '  '

/**
 * Returns true if `pos` is inside a Markdown fenced code block (`FencedCode` / `CodeBlock`).
 * Prevents list, task, and blockquote handlers from misfiring inside code blocks.
 */
export function isInsideCodeFence(state: EditorState, pos: number): boolean {
  try {
    const tree = syntaxTree(state)
    let node: any = tree.resolveInner(pos, -1)
    while (node) {
      if (node.name === 'FencedCode' || node.name === 'CodeBlock') {
        return true
      }
      node = node.parent
    }
  } catch {
    // Fall through to lightweight line-based scan
  }

  // Lightweight fallback when syntax tree is not yet parsed at `pos`
  const targetLine = state.doc.lineAt(pos).number
  let inFence = false
  let fenceChar = ''
  let fenceLen = 0
  for (let l = 1; l < targetLine; l++) {
    const text = state.doc.line(l).text
    const m = text.match(/^\s*(`{3,}|~{3,})(.*)$/)
    if (m) {
      const marker = m[1]
      const rest = m[2]
      if (!inFence) {
        inFence = true
        fenceChar = marker[0]
        fenceLen = marker.length
      } else if (marker[0] === fenceChar && marker.length >= fenceLen && rest.trim() === '') {
        inFence = false
        fenceChar = ''
        fenceLen = 0
      }
    }
  }
  return inFence
}

/**
 * Parses a Markdown list/task line, including optional leading blockquote prefixes
 * such as `> - item`, `> 1. item`, or `> - [ ] task`.
 * Returns `null` if the line is not a list item.
 */
export function parseListLine(lineText: string): ParsedListLine | null {
  if (!lineText) return null

  // Optional leading blockquote prefix (e.g. `> `, `>> `, `> > `)
  let quotePrefix = ''
  let rest = lineText
  const quoteMatch = lineText.match(/^(\s*(?:>\s*)+)/)
  if (quoteMatch) {
    quotePrefix = quoteMatch[1]
    rest = lineText.slice(quotePrefix.length)
  }

  // 1. Task list item: `  - [ ] text` or `  - [x]` (with optional trailing space)
  const taskMatch = rest.match(/^(\s*)([-*+])\s+\[([ xX]?)\](?:\s+(.*)|\s*)$/)
  if (taskMatch) {
    const indent = taskMatch[1]
    const bullet = taskMatch[2]
    const taskState = taskMatch[3]
    const content = taskMatch[4] ?? ''
    const marker = `${bullet} [${taskState || ' '}]`
    const prefixLength = lineText.length - content.length
    return {
      quotePrefix,
      indent,
      marker,
      bullet,
      taskState,
      kind: 'task',
      prefixLength,
      content
    }
  }

  // 2. Unordered bullet item: `  - text`, `  * text`, `  + text`
  const bulletMatch = rest.match(/^(\s*)([-*+])(?:\s+(.*)|\s+)$/)
  if (bulletMatch) {
    const indent = bulletMatch[1]
    const bullet = bulletMatch[2]
    const content = bulletMatch[3] ?? ''
    const prefixLength = lineText.length - content.length
    return {
      quotePrefix,
      indent,
      marker: bullet,
      bullet,
      kind: 'bullet',
      prefixLength,
      content
    }
  }

  // 3. Ordered numeric item: `  1. text`, `  12) text`
  const numMatch = rest.match(/^(\s*)(\d+)([.)])(?:\s+(.*)|\s+)$/)
  if (numMatch) {
    const indent = numMatch[1]
    const num = parseInt(numMatch[2], 10)
    const delim = numMatch[3]
    const content = numMatch[4] ?? ''
    const marker = `${num}${delim}`
    const prefixLength = lineText.length - content.length
    return {
      quotePrefix,
      indent,
      marker,
      num,
      delim,
      kind: 'ordered-num',
      prefixLength,
      content
    }
  }

  // 4. Ordered single-letter alphabetic item: `  a. text`, `  B) text`
  const alphaMatch = rest.match(/^(\s*)([a-zA-Z])([.)])(?:\s+(.*)|\s+)$/)
  if (alphaMatch) {
    const indent = alphaMatch[1]
    const alpha = alphaMatch[2]
    const delim = alphaMatch[3]
    const content = alphaMatch[4] ?? ''
    const marker = `${alpha}${delim}`
    const prefixLength = lineText.length - content.length
    return {
      quotePrefix,
      indent,
      marker,
      alpha,
      delim,
      kind: 'ordered-alpha',
      prefixLength,
      content
    }
  }

  return null
}

/**
 * Computes the next marker string for a parsed list item.
 */
function nextMarkerFor(parsed: ParsedListLine): string {
  if (parsed.kind === 'task') {
    return `${parsed.bullet ?? '-'} [ ]`
  }
  if (parsed.kind === 'ordered-num' && parsed.num !== undefined && parsed.delim) {
    return `${parsed.num + 1}${parsed.delim}`
  }
  if (parsed.kind === 'ordered-alpha' && parsed.alpha && parsed.delim) {
    const ch = parsed.alpha
    const nextChar =
      ch === 'z' ? 'a' : ch === 'Z' ? 'A' : String.fromCharCode(ch.charCodeAt(0) + 1)
    return `${nextChar}${parsed.delim}`
  }
  return parsed.marker
}

/**
 * Strips one indentation level (`  ` or `\t` or single leading space) from `indent`.
 */
function outdentString(indent: string): string {
  if (indent.endsWith('\t')) return indent.slice(0, -1)
  if (indent.endsWith('  ')) return indent.slice(0, -2)
  if (indent.endsWith(' ')) return indent.slice(0, -1)
  return ''
}

/**
 * Normalizes blockquote prefix spacing for equality comparisons (e.g. `> ` vs `>  `).
 */
function normalizeQuotePrefix(qp: string): string {
  return qp.replace(/\s+/g, '')
}

/**
 * Computes visual indentation width (treating tab as 2 spaces).
 */
function indentWidth(indent: string): number {
  let w = 0
  for (let i = 0; i < indent.length; i++) {
    w += indent[i] === '\t' ? 2 : 1
  }
  return w
}

/**
 * Collects ChangeSpecs to renumber subsequent contiguous sibling ordered numeric items
 * starting after `afterLineNumber` at the same `(quotePrefix, indent)` level,
 * beginning from `startNum`.
 */
function collectSubsequentRenumberChanges(
  doc: Text,
  afterLineNumber: number,
  targetQuote: string,
  targetIndentWidth: number,
  targetDelim: string,
  startNum: number
): ChangeSpec[] {
  const changes: ChangeSpec[] = []
  let expected = startNum
  const normTargetQuote = normalizeQuotePrefix(targetQuote)

  for (let l = afterLineNumber + 1; l <= doc.lines; l++) {
    const line = doc.line(l)
    if (line.text.trim() === '') break

    const parsed = parseListLine(line.text)
    if (!parsed) {
      // Allow indented continuation lines belonging to a sibling item
      const lineIndent = line.text.match(/^(\s*)/)?.[1] ?? ''
      if (normTargetQuote === '' && indentWidth(lineIndent) > targetIndentWidth) {
        continue
      }
      break
    }

    if (normalizeQuotePrefix(parsed.quotePrefix) !== normTargetQuote) break

    const w = indentWidth(parsed.indent)
    if (w > targetIndentWidth) {
      // Nested child item — skip without breaking the outer list
      continue
    }
    if (w < targetIndentWidth) {
      // Outdented back to parent list — stop
      break
    }

    if (parsed.kind !== 'ordered-num' || parsed.delim !== targetDelim) {
      break
    }

    if (parsed.num !== expected) {
      const markerStart = line.from + parsed.quotePrefix.length + parsed.indent.length
      const markerEnd = markerStart + parsed.marker.length
      changes.push({
        from: markerStart,
        to: markerEnd,
        insert: `${expected}${targetDelim}`
      })
    }
    expected++
  }

  return changes
}

/**
 * Renumbers an entire contiguous ordered numeric list containing `lineNumber`
 * at the target `(quotePrefix, indent)` level, starting from the first sibling's number
 * (or 1 if `forceStartAtOne` is true).
 */
export function buildOrderedListRenumberChanges(
  doc: Text,
  lineNumber: number,
  forceStartAtOne = false
): ChangeSpec[] {
  if (lineNumber < 1 || lineNumber > doc.lines) return []
  const anchorLine = doc.line(lineNumber)
  const anchor = parseListLine(anchorLine.text)
  if (!anchor || anchor.kind !== 'ordered-num' || !anchor.delim) return []

  const normQuote = normalizeQuotePrefix(anchor.quotePrefix)
  const targetWidth = indentWidth(anchor.indent)
  const targetDelim = anchor.delim

  // Walk upward to find the first sibling in this contiguous ordered list
  let firstLineNum = lineNumber
  for (let l = lineNumber - 1; l >= 1; l--) {
    const line = doc.line(l)
    if (line.text.trim() === '') break
    const parsed = parseListLine(line.text)
    if (!parsed) {
      const lineIndent = line.text.match(/^(\s*)/)?.[1] ?? ''
      if (normQuote === '' && indentWidth(lineIndent) > targetWidth) continue
      break
    }
    if (normalizeQuotePrefix(parsed.quotePrefix) !== normQuote) break
    const w = indentWidth(parsed.indent)
    if (w > targetWidth) continue
    if (w < targetWidth) break
    if (parsed.kind !== 'ordered-num' || parsed.delim !== targetDelim) break
    firstLineNum = l
  }

  const firstParsed = parseListLine(doc.line(firstLineNum).text)
  const startNum = forceStartAtOne ? 1 : (firstParsed?.num ?? 1)

  const changes: ChangeSpec[] = []
  let expected = startNum
  for (let l = firstLineNum; l <= doc.lines; l++) {
    const line = doc.line(l)
    if (line.text.trim() === '') break
    const parsed = parseListLine(line.text)
    if (!parsed) {
      const lineIndent = line.text.match(/^(\s*)/)?.[1] ?? ''
      if (normQuote === '' && indentWidth(lineIndent) > targetWidth) continue
      break
    }
    if (normalizeQuotePrefix(parsed.quotePrefix) !== normQuote) break
    const w = indentWidth(parsed.indent)
    if (w > targetWidth) continue
    if (w < targetWidth) break
    if (parsed.kind !== 'ordered-num' || parsed.delim !== targetDelim) break

    if (parsed.num !== expected) {
      const markerStart = line.from + parsed.quotePrefix.length + parsed.indent.length
      const markerEnd = markerStart + parsed.marker.length
      changes.push({
        from: markerStart,
        to: markerEnd,
        insert: `${expected}${targetDelim}`
      })
    }
    expected++
  }

  return changes
}

/**
 * Handles Enter key on list lines (bullets, ordered numeric/alpha, and quoted lists):
 * - Skips if inside a fenced code block.
 * - If list item is empty:
 *   - If indented -> outdents one level (preserving list flow).
 *   - If quoted (`> - `) -> strips list marker, keeping `> `.
 *   - If at root column 0 -> clears marker and exits list cleanly.
 * - If list item has content:
 *   - Replaces active selection (if any) and inserts next marker.
 *   - Auto-renumbers subsequent sibling ordered list items in the same atomic transaction.
 */
export function handleListEnter(view: EditorView): boolean {
  if (!view || !view.state) return false

  const state = view.state
  const sel = state.selection?.main
  if (!sel) return false

  if (isInsideCodeFence(state, sel.from)) return false

  const line = state.doc.lineAt(sel.from)
  // Only handle single-line selections or collapsed carets for list continuation
  if (sel.to > line.to) return false

  const parsed = parseListLine(line.text)
  if (!parsed || parsed.kind === 'task') return false

  const col = sel.from - line.from
  const isEmptyItem = parsed.content.trim() === ''

  // 1. Empty list item -> outdent if nested, strip marker if quoted, else exit list
  if (isEmptyItem && sel.empty && col >= line.text.trimEnd().length) {
    if (parsed.indent.length > 0) {
      const newIndent = outdentString(parsed.indent)
      const replacement = `${parsed.quotePrefix}${newIndent}${parsed.marker} `
      const changes: ChangeSpec[] = [
        { from: line.from, to: line.to, insert: replacement }
      ]
      view.dispatch({
        changes,
        selection: { anchor: line.from + replacement.length },
        scrollIntoView: true
      })
      // Renumber ordered list at the new indent level if applicable
      if (parsed.kind === 'ordered-num') {
        const renum = buildOrderedListRenumberChanges(view.state.doc, line.number)
        if (renum.length > 0) {
          view.dispatch({ changes: renum })
        }
      }
      return true
    }

    if (parsed.quotePrefix.length > 0) {
      const replacement = parsed.quotePrefix
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: replacement },
        selection: { anchor: line.from + replacement.length },
        scrollIntoView: true
      })
      return true
    }

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: '' },
      selection: { anchor: line.from },
      scrollIntoView: true
    })
    return true
  }

  // If cursor is before the marker ends (e.g. at column 0 before `- `), let default newline run
  if (col < parsed.prefixLength) {
    return false
  }

  // 2. Continue active list format (replacing any selected text)
  const nextMarker = nextMarkerFor(parsed)
  const insertText = `\n${parsed.quotePrefix}${parsed.indent}${nextMarker} `

  const changes: ChangeSpec[] = [
    { from: sel.from, to: sel.to, insert: insertText }
  ]

  // Auto-renumber subsequent sibling ordered items in the same atomic transaction
  if (parsed.kind === 'ordered-num' && parsed.num !== undefined && parsed.delim) {
    const renumChanges = collectSubsequentRenumberChanges(
      state.doc,
      line.number,
      parsed.quotePrefix,
      indentWidth(parsed.indent),
      parsed.delim,
      parsed.num + 2
    )
    changes.push(...renumChanges)
  }

  view.dispatch({
    changes,
    selection: { anchor: sel.from + insertText.length },
    scrollIntoView: true
  })
  return true
}

/**
 * Handles `Shift-Enter` inside a list or task item:
 * inserts a soft continuation newline aligned to the item's content column
 * without creating a new bullet/number.
 */
export function handleListShiftEnter(view: EditorView): boolean {
  if (!view || !view.state) return false
  const state = view.state
  const sel = state.selection?.main
  if (!sel) return false
  if (isInsideCodeFence(state, sel.from)) return false

  const line = state.doc.lineAt(sel.from)
  if (sel.to > line.to) return false

  const parsed = parseListLine(line.text)
  if (!parsed) return false

  const col = sel.from - line.from
  if (col < parsed.prefixLength) return false

  const alignSpaces = ' '.repeat(Math.max(2, parsed.prefixLength - parsed.quotePrefix.length))
  const insertText = `\n${parsed.quotePrefix}${alignSpaces}`
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: insertText },
    selection: { anchor: sel.from + insertText.length },
    scrollIntoView: true
  })
  return true
}

/**
 * Smart Backspace on empty list, task, or blockquote prefix:
 * When the caret is collapsed right after an empty marker (`- |`, `1. |`, `- [ ] |`, `> |`):
 * - If indented, outdents one level.
 * - Otherwise removes the entire marker in a single Backspace press.
 */
export function handleListBackspace(view: EditorView): boolean {
  if (!view || !view.state) return false
  const state = view.state
  const sel = state.selection?.main
  if (!sel || !sel.empty) return false
  if (isInsideCodeFence(state, sel.from)) return false

  const line = state.doc.lineAt(sel.from)
  const col = sel.from - line.from
  if (col === 0) return false

  const parsed = parseListLine(line.text)
  if (parsed && col === parsed.prefixLength && parsed.content === '') {
    if (parsed.indent.length > 0) {
      const newIndent = outdentString(parsed.indent)
      const replacement = `${parsed.quotePrefix}${newIndent}${parsed.marker} `
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: replacement },
        selection: { anchor: line.from + replacement.length },
        scrollIntoView: true
      })
      return true
    }

    if (parsed.quotePrefix.length > 0) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: parsed.quotePrefix },
        selection: { anchor: line.from + parsed.quotePrefix.length },
        scrollIntoView: true
      })
      return true
    }

    const changes: ChangeSpec[] = [{ from: line.from, to: line.to, insert: '' }]
    if (parsed.kind === 'ordered-num' && parsed.num !== undefined && parsed.delim) {
      changes.push(
        ...collectSubsequentRenumberChanges(
          state.doc,
          line.number,
          parsed.quotePrefix,
          indentWidth(parsed.indent),
          parsed.delim,
          parsed.num
        )
      )
    }
    view.dispatch({
      changes,
      selection: { anchor: line.from },
      scrollIntoView: true
    })
    return true
  }

  // Empty blockquote line (`> |` or `>> |`)
  const quoteOnly = line.text.match(/^(\s*(?:>\s*)+)$/)
  if (quoteOnly && col === line.text.length) {
    const arrows = line.text.match(/>/g)?.length ?? 0
    const replacement = arrows > 1 ? '>'.repeat(arrows - 1) + ' ' : ''
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: replacement },
      selection: { anchor: line.from + replacement.length },
      scrollIntoView: true
    })
    return true
  }

  return false
}

/**
 * Checks if a line is a list or task item (including quoted lists).
 */
export function isListLine(lineText: string): boolean {
  return parseListLine(lineText) !== null
}

/**
 * Indents the current list line or multi-line selection by 2 spaces,
 * and automatically renumbers affected ordered lists.
 */
export function indentListLines(view: EditorView): boolean {
  const state = view.state
  const sel = state.selection.main
  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)

  const changes: ChangeSpec[] = []
  let touchesOrdered = false

  for (let l = startLine.number; l <= endLine.number; l++) {
    const line = state.doc.line(l)
    const parsed = parseListLine(line.text)
    if (parsed?.kind === 'ordered-num') touchesOrdered = true
    const insertAt = parsed ? line.from + parsed.quotePrefix.length : line.from
    changes.push({ from: insertAt, insert: INDENT_UNIT })
  }

  if (startLine.number === endLine.number && sel.empty) {
    view.dispatch({
      changes,
      selection: { anchor: sel.head + INDENT_UNIT.length },
      scrollIntoView: true
    })
  } else {
    view.dispatch({ changes, scrollIntoView: true })
  }

  if (touchesOrdered) {
    const renumNew = buildOrderedListRenumberChanges(view.state.doc, startLine.number, true)
    if (renumNew.length > 0) {
      view.dispatch({ changes: renumNew })
    }
    if (endLine.number + 1 <= view.state.doc.lines) {
      const renumAfter = buildOrderedListRenumberChanges(view.state.doc, endLine.number + 1)
      if (renumAfter.length > 0) {
        view.dispatch({ changes: renumAfter })
      }
    }
  }

  return true
}

/**
 * Outdents the current line or multi-line selection by up to 2 spaces (or 1 tab),
 * and automatically renumbers affected ordered lists.
 */
export function outdentListLines(view: EditorView): boolean {
  const state = view.state
  const sel = state.selection.main
  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)

  const changes: ChangeSpec[] = []
  let singleLineRemoved = 0
  let touchesOrdered = false

  for (let l = startLine.number; l <= endLine.number; l++) {
    const line = state.doc.line(l)
    const parsed = parseListLine(line.text)
    if (parsed?.kind === 'ordered-num') touchesOrdered = true

    const baseOffset = parsed ? parsed.quotePrefix.length : 0
    const rest = line.text.slice(baseOffset)
    let removeCount = 0
    if (rest.startsWith('\t')) removeCount = 1
    else if (rest.startsWith('  ')) removeCount = 2
    else if (rest.startsWith(' ')) removeCount = 1

    if (removeCount > 0) {
      changes.push({
        from: line.from + baseOffset,
        to: line.from + baseOffset + removeCount,
        insert: ''
      })
      if (startLine.number === endLine.number) {
        singleLineRemoved = removeCount
      }
    }
  }

  if (changes.length === 0) return true

  if (startLine.number === endLine.number && sel.empty) {
    view.dispatch({
      changes,
      selection: { anchor: Math.max(startLine.from, sel.head - singleLineRemoved) },
      scrollIntoView: true
    })
  } else {
    view.dispatch({ changes, scrollIntoView: true })
  }

  if (touchesOrdered) {
    const renum = buildOrderedListRenumberChanges(view.state.doc, startLine.number)
    if (renum.length > 0) {
      view.dispatch({ changes: renum })
    }
  }

  return true
}

/**
 * Moves the current line or selected block of lines up by 1 line (`Alt-ArrowUp`).
 * Automatically renumbers ordered lists when moving a numbered list item.
 */
export function moveLinesUp(view: EditorView): boolean {
  const state = view.state
  const sel = state.selection.main
  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)
  if (startLine.number <= 1) return true

  const aboveLine = state.doc.line(startLine.number - 1)
  const blockText = state.doc.sliceString(startLine.from, endLine.to)
  const replacement = `${blockText}\n${aboveLine.text}`
  const delta = -(aboveLine.length + 1)

  const touchesOrdered =
    parseListLine(startLine.text)?.kind === 'ordered-num' ||
    parseListLine(aboveLine.text)?.kind === 'ordered-num'

  view.dispatch({
    changes: { from: aboveLine.from, to: endLine.to, insert: replacement },
    selection: EditorSelection.range(sel.anchor + delta, sel.head + delta),
    scrollIntoView: true
  })

  if (touchesOrdered) {
    const renum = buildOrderedListRenumberChanges(view.state.doc, startLine.number - 1, true)
    if (renum.length > 0) {
      view.dispatch({ changes: renum })
    }
  }

  return true
}

/**
 * Moves the current line or selected block of lines down by 1 line (`Alt-ArrowDown`).
 * Automatically renumbers ordered lists when moving a numbered list item.
 */
export function moveLinesDown(view: EditorView): boolean {
  const state = view.state
  const sel = state.selection.main
  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)
  if (endLine.number >= state.doc.lines) return true

  const belowLine = state.doc.line(endLine.number + 1)
  const blockText = state.doc.sliceString(startLine.from, endLine.to)
  const replacement = `${belowLine.text}\n${blockText}`
  const delta = belowLine.length + 1

  const touchesOrdered =
    parseListLine(startLine.text)?.kind === 'ordered-num' ||
    parseListLine(belowLine.text)?.kind === 'ordered-num'

  view.dispatch({
    changes: { from: startLine.from, to: belowLine.to, insert: replacement },
    selection: EditorSelection.range(sel.anchor + delta, sel.head + delta),
    scrollIntoView: true
  })

  if (touchesOrdered) {
    const renum = buildOrderedListRenumberChanges(view.state.doc, startLine.number, true)
    if (renum.length > 0) {
      view.dispatch({ changes: renum })
    }
  }

  return true
}

/**
 * Duplicates the current line or selected lines below (`Shift-Alt-ArrowDown`)
 * or above (`Shift-Alt-ArrowUp`), auto-renumbering ordered lists when needed.
 */
export function duplicateLines(view: EditorView, direction: 'up' | 'down'): boolean {
  const state = view.state
  const sel = state.selection.main
  const startLine = state.doc.lineAt(sel.from)
  const endLine = state.doc.lineAt(sel.to)
  const blockText = state.doc.sliceString(startLine.from, endLine.to)
  const touchesOrdered = parseListLine(startLine.text)?.kind === 'ordered-num'

  if (direction === 'down') {
    const insert = `\n${blockText}`
    const shift = blockText.length + 1
    view.dispatch({
      changes: { from: endLine.to, insert },
      selection: EditorSelection.range(sel.anchor + shift, sel.head + shift),
      scrollIntoView: true
    })
  } else {
    const insert = `${blockText}\n`
    view.dispatch({
      changes: { from: startLine.from, insert },
      selection: EditorSelection.range(sel.anchor, sel.head),
      scrollIntoView: true
    })
  }

  if (touchesOrdered) {
    const renum = buildOrderedListRenumberChanges(view.state.doc, startLine.number)
    if (renum.length > 0) {
      view.dispatch({ changes: renum })
    }
  }

  return true
}

const WRAP_PAIRS: Record<string, string> = {
  '*': '*',
  '_': '_',
  '`': '`',
  '~': '~',
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'"
}

/**
 * Smart Selection Wrapping:
 * When text is selected and the user types a Markdown delimiter (`*`, `_`, `` ` ``, `~`, `(`, `[`, `{`, `"`, `'`),
 * wraps the selection instead of replacing it and keeps the inner text selected
 * (so typing `*` twice produces `**word**`).
 */
export const smartWrapSelectionExtension: Extension = EditorView.inputHandler.of(
  (view, from, to, text) => {
    if (isComposing(view)) return false
    if (from === to) return false
    if (text.length !== 1) return false

    const close = WRAP_PAIRS[text]
    if (!close) return false

    const selected = view.state.doc.sliceString(from, to)
    // Don't wrap multi-line selections with inline-only markers except brackets/parens
    if (selected.includes('\n') && !['(', '[', '{'].includes(text)) {
      return false
    }

    view.dispatch({
      changes: { from, to, insert: `${text}${selected}${close}` },
      selection: EditorSelection.range(from + 1, to + 1),
      scrollIntoView: true
    })
    return true
  }
)
