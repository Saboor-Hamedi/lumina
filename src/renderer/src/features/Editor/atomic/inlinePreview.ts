/**
 * =========================================================================
 * Clean TypeScript Inline Preview Extension for CodeMirror 6
 * =========================================================================
 *
 * Provides Obsidian-style live-preview in Lumina:
 * - Bare URLs and autolinks remain 100% visible and interactive at all times
 * - Markdown links [text](url) hide syntax when inactive and reveal when active
 * - Headings, blockquotes, code fences, and inline marks
 * - Task checkboxes and bullet lists with tight continuation
 * - Zero monkey patching, 100% type-safe
 * =========================================================================
 */

import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { EditorSelection, Prec, StateEffect, StateField, type Extension, type Range } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  keymap
} from '@codemirror/view'
import { treeGrowthEffect, treeProgressPlugin } from './treeProgress'

export interface InlinePreviewConfig {
  onLinkClick?: (url: string) => void
}

function defaultOnLinkClick(url: string): void {
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch {
    // window.open can throw in sandboxed environments — silent failure fallback
  }
}

const FREEZE_TAIL_MS = 100

// ---- Freeze Plumbing -----------------------------------------------------
const setFrozen = StateEffect.define<boolean>()
const previewFrozenField = StateField.define<boolean>({
  create: () => false,
  update(prev, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setFrozen)) return effect.value
    }
    return prev
  }
})

function linkIconHitTarget(event: MouseEvent | PointerEvent, root: HTMLElement | null): Element | null {
  const target = event.target
  if (!(target instanceof Element)) return null
  const linkEl = target.closest('.cm-atomic-link')
  if (!linkEl || (root && !root.contains(linkEl))) return null

  const rects = Array.from(linkEl.getClientRects())
  if (rects.length === 0) return null
  const lastRect = rects[rects.length - 1]
  const emSize = parseFloat(window.getComputedStyle(linkEl).fontSize) || 16
  const iconZone = emSize * 1.25
  const onIcon =
    event.clientX >= lastRect.right - iconZone &&
    event.clientX <= lastRect.right &&
    event.clientY >= lastRect.top &&
    event.clientY <= lastRect.bottom

  return onIcon ? linkEl : null
}

class FreezeMousePluginValue {
  view: EditorView
  down = false
  releaseTimer: number | null = null

  constructor(view: EditorView) {
    this.view = view
    view.dom.addEventListener('pointerdown', this.onDown, true)
    window.addEventListener('pointerup', this.onUp)
    window.addEventListener('pointercancel', this.onUp)
  }

  onDown = (event: PointerEvent): void => {
    if (event.button !== 0) return
    const target = event.target
    if (!(target instanceof Node) || !this.view.contentDOM.contains(target)) {
      return
    }
    if (linkIconHitTarget(event, this.view.contentDOM)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    this.down = true
    if (this.releaseTimer !== null) {
      window.clearTimeout(this.releaseTimer)
      this.releaseTimer = null
    }
    if (!this.view.state.field(previewFrozenField)) {
      this.view.dispatch({ effects: setFrozen.of(true) })
    }
  }

  onUp = (): void => {
    if (!this.down) return
    this.down = false
    if (this.releaseTimer !== null) {
      window.clearTimeout(this.releaseTimer)
    }
    this.releaseTimer = window.setTimeout(() => {
      this.releaseTimer = null
      if (!this.view.state.field(previewFrozenField)) return
      try {
        this.view.dispatch({ effects: setFrozen.of(false) })
      } catch {
        // View destroyed while timer was pending
      }
    }, FREEZE_TAIL_MS)
  }

  update(): void {
    // No-op
  }

  destroy(): void {
    this.view.dom.removeEventListener('pointerdown', this.onDown, true)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('pointercancel', this.onUp)
    if (this.releaseTimer !== null) {
      window.clearTimeout(this.releaseTimer)
    }
  }
}

const freezeMousePlugin = ViewPlugin.fromClass(FreezeMousePluginValue)

// ---- Decoration Building --------------------------------------------------
const LINE_CLASS_BY_BLOCK: Record<string, string> = {
  ATXHeading1: 'cm-atomic-h1',
  ATXHeading2: 'cm-atomic-h2',
  ATXHeading3: 'cm-atomic-h3',
  ATXHeading4: 'cm-atomic-h4',
  ATXHeading5: 'cm-atomic-h5',
  ATXHeading6: 'cm-atomic-h6',
  SetextHeading1: 'cm-atomic-h1',
  SetextHeading2: 'cm-atomic-h2',
  Blockquote: 'cm-atomic-blockquote',
  FencedCode: 'cm-atomic-fenced-code'
}

const HIDEABLE_SYNTAX = new Set([
  'HeaderMark',
  'EmphasisMark',
  'CodeMark',
  'CodeInfo',
  'LinkMark',
  'URL',
  'LinkTitle',
  'StrikethroughMark',
  'QuoteMark'
])

const LINK_CHILD_SYNTAX = new Set(['LinkMark', 'URL', 'LinkTitle'])

const INLINE_MARK_CLASS: Record<string, string> = {
  StrongEmphasis: 'cm-atomic-strong',
  Emphasis: 'cm-atomic-em',
  InlineCode: 'cm-atomic-inline-code',
  Strikethrough: 'cm-atomic-strike',
  Link: 'cm-atomic-link',
  URL: 'cm-atomic-link'
}

class BulletWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-atomic-list-marker cm-atomic-bullet'
    span.textContent = '•'
    return span
  }

  ignoreEvent(): boolean {
    return false
  }
}

const BULLET_WIDGET = new BulletWidget()

class TaskCheckboxWidget extends WidgetType {
  checked: boolean

  constructor(checked: boolean) {
    super()
    this.checked = checked
  }

  eq(other: TaskCheckboxWidget): boolean {
    return other.checked === this.checked
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.className = 'cm-atomic-list-marker cm-atomic-task-checkbox'
    input.setAttribute('contenteditable', 'false')
    input.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
    input.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const pos = view.posAtDOM(input)
      if (pos < 0) return
      const current = view.state.doc.sliceString(pos, pos + 3)
      const next = /\[x\]/i.test(current) ? '[ ]' : '[x]'
      if (current === next) return
      view.dispatch({ changes: { from: pos, to: pos + 3, insert: next } })
    })
    return input
  }

  ignoreEvent(event: Event): boolean {
    return event.type === 'mousedown' || event.type === 'click'
  }
}

function pushReplace(
  ranges: Range<Decoration>[],
  doc: { lineAt: (pos: number) => { to: number } },
  from: number,
  to: number,
  spec: Record<string, any> = {}
): void {
  if (from >= to) return
  const startLine = doc.lineAt(from)
  if (to <= startLine.to) {
    ranges.push(Decoration.replace(spec).range(from, to))
    return
  }

  let cursor = from
  let firstSegment = true
  while (cursor < to) {
    const line = doc.lineAt(cursor)
    const segEnd = Math.min(to, line.to)
    if (segEnd > cursor) {
      ranges.push(Decoration.replace(firstSegment ? spec : {}).range(cursor, segEnd))
      firstSegment = false
    }
    cursor = line.to + 1
  }
}

function buildInlineDecorations(view: EditorView): DecorationSet {
  const { state } = view
  const { doc } = state
  const ranges: Range<Decoration>[] = []
  const activeLines = new Set<number>()

  if (view.hasFocus) {
    for (const r of state.selection.ranges) {
      const firstLine = doc.lineAt(r.from).number
      const lastLine = doc.lineAt(r.to).number
      for (let n = firstLine; n <= lastLine; n++) {
        activeLines.add(n)
      }
    }
  }

  const tree = ensureSyntaxTree(state, state.doc.length, 200) ?? syntaxTree(state)
  const activeLinkStarts = new Set<number>()

  tree.iterate({
    enter: (node) => {
      if (node.name === 'FencedCode') {
        const firstLine = doc.lineAt(node.from).number
        const lastLine = doc.lineAt(node.to).number
        let anyActive = false
        for (let n = firstLine; n <= lastLine; n++) {
          if (activeLines.has(n)) {
            anyActive = true
            break
          }
        }
        if (anyActive) {
          for (let n = firstLine; n <= lastLine; n++) {
            activeLines.add(n)
          }
        }
      }

      if (node.name === 'Link' && view.hasFocus) {
        for (const range of state.selection.ranges) {
          if (range.from <= node.to && range.to >= node.from) {
            activeLinkStarts.add(node.from)
            break
          }
        }
      }

      const lineClass = LINE_CLASS_BY_BLOCK[node.name]
      if (lineClass) {
        const firstLine = doc.lineAt(node.from)
        const lastLine = doc.lineAt(node.to)
        for (let n = firstLine.number; n <= lastLine.number; n++) {
          const line = doc.line(n)
          ranges.push(Decoration.line({ class: lineClass }).range(line.from))
        }
      }

      const markClass = INLINE_MARK_CLASS[node.name]
      if (markClass && node.from < node.to) {
        ranges.push(Decoration.mark({ class: markClass }).range(node.from, node.to))
      }

      if (HIDEABLE_SYNTAX.has(node.name) && node.from < node.to) {
        const lineNum = doc.lineAt(node.from).number
        let shouldHide = false

        if (LINK_CHILD_SYNTAX.has(node.name)) {
          let parent = node.node.parent
          while (parent && parent.name !== 'Link' && parent.name !== 'Image') {
            parent = parent.parent
          }
          if (parent && parent.name === 'Link') {
            shouldHide = !activeLinkStarts.has(parent.from)
          } else if (node.name === 'URL') {
            // Standalone bare URLs or autolinks: NEVER hide!
            shouldHide = false
          } else {
            shouldHide = !activeLines.has(lineNum)
          }
        } else {
          shouldHide = !activeLines.has(lineNum)
        }

        if (shouldHide) {
          let hideTo = node.to
          if (node.name === 'HeaderMark' || node.name === 'QuoteMark') {
            while (hideTo < doc.length && doc.sliceString(hideTo, hideTo + 1) === ' ') {
              hideTo++
            }
          }
          pushReplace(ranges, doc, node.from, hideTo)
        }
      }

      // Backslash escapes
      if (node.name === 'Escape' && node.to - node.from >= 2) {
        const lineNum = doc.lineAt(node.from).number
        if (!activeLines.has(lineNum)) {
          pushReplace(ranges, doc, node.from, node.from + 1)
        }
      }

      // Lists
      if (node.name === 'ListMark' && node.from < node.to) {
        const line = doc.lineAt(node.from)
        const taskLead = line.text.match(/^(\s*[-*+]\s+)\[[ xX]\]/)
        const taskFrom = taskLead != null ? line.from + taskLead[1].length : undefined

        const rawIndent = node.from - line.from
        const depth = Math.max(0, Math.floor(rawIndent / 2))
        const BASE_EM = 0.8
        const ALCOVE_EM = 1.2
        const LEVEL_EM = 0.6
        const padding = BASE_EM + ALCOVE_EM + depth * LEVEL_EM

        ranges.push(
          Decoration.line({
            attributes: {
              style: `padding-left: ${padding}em; text-indent: -${ALCOVE_EM}em`
            }
          }).range(line.from)
        )

        const hasTrailingSpace = doc.sliceString(node.to, node.to + 1) === ' '
        const markEnd = hasTrailingSpace ? node.to + 1 : node.to

        if (taskFrom !== undefined) {
          pushReplace(ranges, doc, node.from, taskFrom)
        } else {
          const markText = doc.sliceString(node.from, node.to)
          if (markText === '-' || markText === '*' || markText === '+') {
            pushReplace(ranges, doc, node.from, markEnd, { widget: BULLET_WIDGET })
          } else {
            ranges.push(Decoration.mark({ class: 'cm-atomic-list-marker' }).range(node.from, node.to))
            if (hasTrailingSpace) {
              pushReplace(ranges, doc, node.to, markEnd)
            }
          }
        }
      }

      // Horizontal Rule
      if (node.name === 'HorizontalRule') {
        const line = doc.lineAt(node.from)
        if (!activeLines.has(line.number)) {
          ranges.push(Decoration.line({ class: 'cm-atomic-hr' }).range(line.from))
          pushReplace(ranges, doc, line.from, line.to)
        }
      }

      // Image
      if (node.name === 'Image' && node.from < node.to) {
        const imageLine = doc.lineAt(node.from)
        const lineNum = imageLine.number
        if (!activeLines.has(lineNum)) {
          pushReplace(ranges, doc, node.from, node.to)
        }
      }

      // Task Marker
      if (node.name === 'TaskMarker' && node.from < node.to) {
        const markText = doc.sliceString(node.from, node.to)
        const checked = /\[x\]/i.test(markText)
        const hasTrailingSpace = node.to < doc.length && doc.sliceString(node.to, node.to + 1) === ' '
        const replaceTo = hasTrailingSpace ? node.to + 1 : node.to
        pushReplace(ranges, doc, node.from, replaceTo, {
          widget: new TaskCheckboxWidget(checked)
        })
        if (checked) {
          const lineNum = doc.lineAt(node.from).number
          const line = doc.line(lineNum)
          ranges.push(Decoration.line({ class: 'cm-atomic-task-done' }).range(line.from))
        }
      }
    }
  })

  // Supplemental inline marks for typing emphasis
  if (view.hasFocus) {
    const head = state.selection.main.head
    const line = doc.lineAt(head)
    if (activeLines.has(line.number)) {
      supplementMidTypingEmphasis(line.text, line.from, head - line.from, ranges)
    }
  }

  return Decoration.set(ranges, true)
}

const MID_TYPING_DELIMITERS = [
  { delim: '**', contentCls: 'cm-atomic-strong', delimCls: 'cm-atomic-strong-mark' },
  { delim: '__', contentCls: 'cm-atomic-strong', delimCls: 'cm-atomic-strong-mark' },
  { delim: '~~', contentCls: 'cm-atomic-strike', delimCls: 'cm-atomic-strike-mark' },
  { delim: '*', contentCls: 'cm-atomic-em', delimCls: 'cm-atomic-em-mark' },
  { delim: '_', contentCls: 'cm-atomic-em', delimCls: 'cm-atomic-em-mark' }
]

function supplementMidTypingEmphasis(
  text: string,
  lineFrom: number,
  localCursor: number,
  out: Range<Decoration>[]
): void {
  const consumed = new Uint8Array(text.length)
  for (const { delim, contentCls, delimCls } of MID_TYPING_DELIMITERS) {
    const dLen = delim.length
    const isUnderscore = delim === '_' || delim === '__'
    let searchFrom = 0
    while (searchFrom < text.length) {
      const open = indexOfUnconsumed(text, delim, searchFrom, consumed)
      if (open < 0) break
      if (isUnderscore && open > 0 && /\w/.test(text[open - 1])) {
        searchFrom = open + dLen
        continue
      }
      const close = indexOfUnconsumed(text, delim, open + dLen, consumed)
      if (close < 0) break
      for (let i = open; i < close + dLen; i++) consumed[i] = 1
      const contentFrom = open + dLen
      const contentTo = close
      if (contentFrom < contentTo && localCursor > open && localCursor < close + dLen) {
        out.push(Decoration.mark({ class: contentCls }).range(lineFrom + contentFrom, lineFrom + contentTo))
        out.push(Decoration.mark({ class: delimCls }).range(lineFrom + open, lineFrom + contentFrom))
        out.push(Decoration.mark({ class: delimCls }).range(lineFrom + contentTo, lineFrom + close + dLen))
      }
      searchFrom = close + dLen
    }
  }
}

function indexOfUnconsumed(text: string, needle: string, from: number, consumed: Uint8Array): number {
  let i = from
  while (i <= text.length - needle.length) {
    const found = text.indexOf(needle, i)
    if (found < 0) return -1
    let isConsumed = false
    for (let k = found; k < found + needle.length; k++) {
      if (consumed[k]) {
        isConsumed = true
        break
      }
    }
    if (!isConsumed) return found
    i = found + 1
  }
  return -1
}

class InlinePreviewPluginValue {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = buildInlineDecorations(view)
  }

  update(update: ViewUpdate): void {
    const prevFrozen = update.startState.field(previewFrozenField)
    const nextFrozen = update.state.field(previewFrozenField)
    const justUnfroze = prevFrozen && !nextFrozen

    if (nextFrozen && !justUnfroze && !update.docChanged) return

    let treeGrew = false
    for (const tr of update.transactions) {
      for (const effect of tr.effects) {
        if (effect.is(treeGrowthEffect)) {
          treeGrew = true
          break
        }
      }
      if (treeGrew) break
    }

    if (justUnfroze || update.docChanged || update.selectionSet || update.focusChanged || treeGrew) {
      this.decorations = buildInlineDecorations(update.view)
    }
  }
}

const inlinePreviewPlugin = ViewPlugin.fromClass(InlinePreviewPluginValue, {
  decorations: (v) => v.decorations
})

function insertTightListItem(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const from = sel.from
  const line = state.doc.lineAt(from)
  const tree = syntaxTree(state)
  let cursor = tree.resolveInner(from, -1).cursor()
  let inBulletList = false
  for (;;) {
    if (cursor.name === 'BulletList') {
      inBulletList = true
      break
    }
    if (!cursor.parent()) break
  }
  if (!inBulletList) return false
  const lineText = state.doc.sliceString(line.from, line.to)
  const prefix = lineText.match(/^(\s*)([-*+])(\s+)/)
  if (!prefix) return false
  const [whole, indent, marker] = prefix
  const rest = lineText.slice(whole.length)
  const taskMatch = rest.match(/^(\[[ xX]\])(\s*)/)
  const taskPrefixLen = taskMatch ? taskMatch[0].length : 0
  const contentAfterPrefix = rest.slice(taskPrefixLen)
  if (!contentAfterPrefix.trim()) {
    const depth = Math.floor(indent.length / 2)
    if (depth >= 1) {
      const outerIndent = indent.slice(0, indent.length - 2)
      const continuation = taskMatch ? `${marker} [ ] ` : `${marker} `
      const replacement = `${outerIndent}${continuation}`
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: replacement },
        selection: EditorSelection.cursor(line.from + replacement.length)
      })
    } else {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
        selection: EditorSelection.cursor(line.from)
      })
    }
    return true
  }
  const continuation = taskMatch ? `${marker} [ ] ` : `${marker} `
  const insert = `\n${indent}${continuation}`
  view.dispatch({
    changes: { from, to: from, insert },
    selection: EditorSelection.cursor(from + insert.length)
  })
  return true
}

function makeLinkClickHandler(onLinkClick: (url: string) => void): Extension {
  return EditorView.domEventHandlers({
    click: (event, view) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
      if (event.button !== 0) return false
      const linkEl = linkIconHitTarget(event, view.contentDOM)
      if (!linkEl) return false
      const pos = view.posAtDOM(linkEl)
      if (pos < 0) return false
      const tree = syntaxTree(view.state)
      let node: any = tree.resolveInner(pos, 1)
      while (node && node.name !== 'Link' && node.name !== 'URL') {
        node = node.parent
      }
      if (!node) return false
      let url = ''
      if (node.name === 'URL') {
        url = view.state.doc.sliceString(node.from, node.to)
      } else {
        const urlNode = node.getChild('URL')
        if (!urlNode) return false
        url = view.state.doc.sliceString(urlNode.from, urlNode.to)
      }
      if (!url) return false
      event.preventDefault()
      event.stopPropagation()
      onLinkClick(url)
      return true
    }
  })
}

export function inlinePreview(config: InlinePreviewConfig = {}): Extension[] {
  const { onLinkClick = defaultOnLinkClick } = config
  return [
    previewFrozenField,
    inlinePreviewPlugin,
    freezeMousePlugin,
    treeProgressPlugin,
    makeLinkClickHandler(onLinkClick),
    Prec.highest(keymap.of([{ key: 'Enter', run: insertTightListItem }]))
  ]
}
