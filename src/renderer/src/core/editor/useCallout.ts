import { useCallback } from 'react'
import { Decoration, WidgetType, EditorView, type DecorationSet } from '@codemirror/view'
import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'

export interface CalloutMeta {
  type: string
  label: string
  color: string
}

/**
 * Standard callout types with associated metadata and default icons
 */
export const CALLOUT_TYPES: Record<string, CalloutMeta> = {
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

export const CALLOUT_ALIASES: Record<string, string> = {
  note: 'note',
  info: 'info',
  information: 'info',
  tip: 'tip',
  hint: 'tip',
  idea: 'tip',
  success: 'success',
  check: 'success',
  done: 'success',
  warning: 'warning',
  warn: 'warning',
  caution: 'caution',
  attention: 'caution',
  important: 'important',
  importen: 'important',
  importente: 'important',
  importante: 'important',
  importance: 'important',
  imp: 'important',
  danger: 'danger',
  error: 'danger',
  crit: 'danger',
  critical: 'danger',
  bug: 'bug',
  issue: 'bug',
  example: 'example',
  sample: 'example',
  question: 'question',
  faq: 'question',
  help: 'question',
  todo: 'todo',
  task: 'todo',
  quote: 'quote',
  cite: 'quote'
}

export function resolveCalloutType(rawType: string): string {
  const clean = (rawType || '').toLowerCase().trim()
  if (CALLOUT_ALIASES[clean]) return CALLOUT_ALIASES[clean]
  if (clean.startsWith('imp')) return 'important'
  if (clean.startsWith('inf')) return 'info'
  if (clean.startsWith('warn')) return 'warning'
  if (clean.startsWith('tip')) return 'tip'
  if (clean.startsWith('dang') || clean.startsWith('err')) return 'danger'
  if (clean.startsWith('suc')) return 'success'
  if (clean.startsWith('que')) return 'question'
  return clean || 'note'
}

export function getCalloutSvgIcon(type: string): string {
  const t = (type || 'note').toLowerCase()
  if (t === 'note' || t === 'info') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`
  } else if (t === 'warning') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`
  } else if (t === 'tip' || t === 'success') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`
  } else if (t === 'important') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`
  } else if (t === 'caution' || t === 'danger' || t === 'bug') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>`
  } else if (t === 'question') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>`
  } else if (t === 'todo') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="m9 12 2 2 4-4"></path></svg>`
  } else if (t === 'quote') {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path></svg>`
  }
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`
}

function fallbackCopyText(text: string): boolean {
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '-9999px'
    textarea.setAttribute('readonly', '')
    document.body.appendChild(textarea)
    textarea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textarea)
    return successful
  } catch {
    return false
  }
}

export type CalloutFoldMode = '+' | '-' | null

export interface ParsedCalloutHeader {
  level: number
  rawType: string
  type: string
  foldMode: CalloutFoldMode
  title: string
  bracketIdx: number
  bracketEnd: number
}

const CALLOUT_HEADER_RE = /^\s*(?:>\s*)+\[!([a-zA-Z]+)\]([+-])?(.*)/

/**
 * Parses a markdown callout header line (e.g. `> [!note]- Optional Title` or `>[!error]`).
 */
export function parseCalloutHeaderLine(text: string): ParsedCalloutHeader | null {
  const match = text.match(CALLOUT_HEADER_RE)
  if (!match) return null

  const prefixMatch = text.match(/^\s*(?:>\s*)+/)
  const level = prefixMatch?.[0].match(/>/g)?.length || 1
  const bracketIdx = text.indexOf('[!')
  const bracketEnd = bracketIdx >= 0 ? text.indexOf(']', bracketIdx) : -1
  const foldMarker = match[2]

  return {
    level,
    rawType: match[1],
    type: resolveCalloutType(match[1]),
    foldMode: foldMarker === '-' ? '-' : foldMarker === '+' ? '+' : null,
    title: (match[3] || '').trim(),
    bracketIdx,
    bracketEnd
  }
}

export const toggleCalloutFoldEffect = StateEffect.define<{
  pos: number
  defaultCollapsed: boolean
}>()

export const calloutFoldField = StateField.define<Map<number, boolean>>({
  create() {
    return new Map()
  },
  update(value, tr) {
    let next = value
    let cloned = false
    const ensureCloned = () => {
      if (!cloned) {
        next = new Map(value)
        cloned = true
      }
      return next
    }

    if (tr.docChanged && value.size > 0) {
      const remapped = new Map<number, boolean>()
      value.forEach((collapsed, pos) => {
        const mapped = tr.changes.mapPos(pos, -1)
        if (mapped >= 0) remapped.set(mapped, collapsed)
      })
      next = remapped
      cloned = true
    }

    for (const effect of tr.effects) {
      if (effect.is(toggleCalloutFoldEffect)) {
        const map = ensureCloned()
        const { pos, defaultCollapsed } = effect.value
        const current = map.has(pos) ? map.get(pos)! : defaultCollapsed
        map.set(pos, !current)
      }
    }

    return next
  }
})

const COPY_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const CHECK_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
const CHEVRON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`

interface CalloutBlockRange {
  startLineNum: number
  endLineNum: number
  startFrom: number
  startTo: number
  endTo: number
  bodyLineCount: number
  header: ParsedCalloutHeader
}

function findCalloutBlocks(doc: EditorState['doc']): CalloutBlockRange[] {
  const blocks: CalloutBlockRange[] = []
  let inCodeFence = false
  let l = 1

  while (l <= doc.lines) {
    const line = doc.line(l)
    if (/^\s*(```|~~~)/.test(line.text)) {
      inCodeFence = !inCodeFence
      l++
      continue
    }
    if (inCodeFence) {
      l++
      continue
    }

    const header = parseCalloutHeaderLine(line.text)
    if (!header) {
      l++
      continue
    }

    const startLineNum = l
    const startFrom = line.from
    const startTo = line.to
    let endLineNum = l
    let endTo = line.to
    l++

    while (l <= doc.lines) {
      const nextLine = doc.line(l)
      const nextPrefix = nextLine.text.match(/^\s*(?:>\s*)+/)
      if (!nextPrefix) break
      const nextLevel = nextPrefix[0].match(/>/g)?.length || 0
      if (nextLevel < header.level) break
      if (parseCalloutHeaderLine(nextLine.text)) break
      endLineNum = l
      endTo = nextLine.to
      l++
    }

    blocks.push({
      startLineNum,
      endLineNum,
      startFrom,
      startTo,
      endTo,
      bodyLineCount: endLineNum - startLineNum,
      header
    })
  }

  return blocks
}

function collectCalloutText(state: EditorState, startFrom: number): string {
  const doc = state.doc
  if (startFrom < 0 || startFrom > doc.length) return ''
  const startLine = doc.lineAt(startFrom)
  const header = parseCalloutHeaderLine(startLine.text)
  const collected: string[] = []

  if (header?.title) collected.push(header.title)
  for (let ln = startLine.number + 1; ln <= doc.lines; ln++) {
    const line = doc.line(ln)
    const prefix = line.text.match(/^\s*(?:>\s*)+/)
    if (!prefix) break
    const level = prefix[0].match(/>/g)?.length || 0
    if (header && level < header.level) break
    if (parseCalloutHeaderLine(line.text)) break
    collected.push(line.text.replace(/^\s*(?:>\s?)+/, ''))
  }
  return collected.join('\n').trim()
}

function dispatchCalloutToggle(
  view: EditorView,
  blockStartPos: number,
  blockEndPos: number,
  foldMode: CalloutFoldMode,
  currentlyCollapsed: boolean
): void {
  const doc = view.state.doc
  if (blockStartPos < 0 || blockStartPos > doc.length) return
  const willCollapse = !currentlyCollapsed
  let nextSelection: { anchor: number } | undefined

  if (willCollapse) {
    const sel = view.state.selection.main
    if (sel.from >= blockStartPos && sel.from <= blockEndPos) {
      const outsidePos =
        blockEndPos < doc.length
          ? blockEndPos + 1
          : blockStartPos > 0
            ? blockStartPos - 1
            : 0
      if (outsidePos < blockStartPos || outsidePos > blockEndPos) {
        nextSelection = { anchor: outsidePos }
      }
    }
  }

  view.dispatch({
    effects: toggleCalloutFoldEffect.of({
      pos: blockStartPos,
      defaultCollapsed: foldMode === '-'
    }),
    ...(nextSelection ? { selection: nextSelection } : {})
  })
}

/**
 * Atomic block-level Callout Header Widget (`block: true`).
 * Never lets the text cursor jump beside the copy button, never disappears on
 * random clicks, and supports reliable 1-click collapse/expand + double-click to edit source.
 */
export class CalloutHeaderWidget extends WidgetType {
  readonly type: string
  readonly title: string
  readonly foldMode: CalloutFoldMode
  readonly isCollapsed: boolean
  readonly blockStartPos: number
  readonly blockEndPos: number
  readonly bodyLineCount: number

  constructor(
    type = 'note',
    title = '',
    foldMode: CalloutFoldMode = null,
    isCollapsed = false,
    blockStartPos = 0,
    blockEndPos = 0,
    bodyLineCount = 0
  ) {
    super()
    this.type = (type || 'note').toLowerCase()
    this.title = title || ''
    this.foldMode = foldMode
    this.isCollapsed = isCollapsed
    this.blockStartPos = blockStartPos
    this.blockEndPos = blockEndPos
    this.bodyLineCount = bodyLineCount
  }

  eq(other: CalloutHeaderWidget): boolean {
    return (
      other.type === this.type &&
      other.title === this.title &&
      other.foldMode === this.foldMode &&
      other.isCollapsed === this.isCollapsed &&
      other.blockStartPos === this.blockStartPos &&
      other.blockEndPos === this.blockEndPos &&
      other.bodyLineCount === this.bodyLineCount
    )
  }

  toDOM(view?: EditorView): HTMLElement {
    const bar = document.createElement('div')
    const classes = [
      'lumina-callout-block-header',
      `lumina-callout-${this.type}`,
      `lumina-callout-line-${this.type}`,
      'is-foldable'
    ]
    if (this.isCollapsed || this.bodyLineCount === 0) {
      classes.push('is-standalone-card')
    }
    if (this.isCollapsed) {
      classes.push('is-collapsed')
    }
    bar.className = classes.join(' ')
    bar.setAttribute('contenteditable', 'false')

    const left = document.createElement('span')
    left.className = 'lumina-callout-header-left'

    const icon = document.createElement('span')
    icon.className = 'lumina-callout-icon'
    icon.innerHTML = getCalloutSvgIcon(this.type)

    const text = document.createElement('span')
    text.className = 'lumina-callout-title'
    text.textContent = this.title || this.type.toUpperCase()

    left.appendChild(icon)
    left.appendChild(text)

    if (this.isCollapsed && this.bodyLineCount > 0) {
      const countEl = document.createElement('span')
      countEl.className = 'lumina-callout-count'
      countEl.textContent = this.bodyLineCount === 1 ? '1 line' : `${this.bodyLineCount} lines`
      left.appendChild(countEl)
    }

    const actions = document.createElement('span')
    actions.className = 'lumina-callout-actions'

    if (view) {
      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className = 'lumina-callout-copy-btn'
      copyBtn.title = 'Copy callout'
      copyBtn.setAttribute('aria-label', 'Copy callout')
      copyBtn.innerHTML = COPY_ICON_SVG

      copyBtn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const payload = collectCalloutText(view.state, this.blockStartPos)
        if (!payload) return
        const triggerSuccess = () => {
          copyBtn.classList.add('copied')
          copyBtn.innerHTML = CHECK_ICON_SVG
          window.setTimeout(() => {
            copyBtn.classList.remove('copied')
            copyBtn.innerHTML = COPY_ICON_SVG
          }, 1400)
        }
        if (navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText(payload)
            .then(triggerSuccess)
            .catch(() => {
              if (fallbackCopyText(payload)) triggerSuccess()
            })
        } else if (fallbackCopyText(payload)) {
          triggerSuccess()
        }
      })
      actions.appendChild(copyBtn)
    }

    const foldBtn = document.createElement('button')
    foldBtn.type = 'button'
    foldBtn.className = `lumina-callout-fold-btn${this.isCollapsed ? ' is-collapsed' : ''}`
    foldBtn.title = this.isCollapsed ? 'Expand callout' : 'Collapse callout'
    foldBtn.setAttribute('aria-label', foldBtn.title)
    foldBtn.setAttribute('aria-expanded', String(!this.isCollapsed))
    foldBtn.innerHTML = CHEVRON_SVG
    actions.appendChild(foldBtn)

    bar.appendChild(left)
    bar.appendChild(actions)

    if (view) {
      bar.addEventListener('mousedown', (e) => {
        if ((e.target as HTMLElement | null)?.closest('.lumina-callout-copy-btn')) return
        e.preventDefault()
        e.stopPropagation()
      })

      bar.addEventListener('click', (e) => {
        if ((e.target as HTMLElement | null)?.closest('.lumina-callout-copy-btn')) return
        e.preventDefault()
        e.stopPropagation()
        dispatchCalloutToggle(
          view,
          this.blockStartPos,
          this.blockEndPos,
          this.foldMode,
          this.isCollapsed
        )
      })

      // Double-click title/left area to edit raw `> [!type] Title` markdown source
      left.addEventListener('dblclick', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const doc = view.state.doc
        if (this.blockStartPos < 0 || this.blockStartPos > doc.length) return
        const line = doc.lineAt(this.blockStartPos)
        view.dispatch({
          ...(this.isCollapsed
            ? {
                effects: toggleCalloutFoldEffect.of({
                  pos: this.blockStartPos,
                  defaultCollapsed: this.foldMode === '-'
                })
              }
            : {}),
          selection: { anchor: line.to },
          scrollIntoView: true
        })
        view.focus()
      })
    }

    return bar
  }

  ignoreEvent(): boolean {
    return true
  }
}

/**
 * Inline icon preview displayed while the user is actively editing the raw `> [!type]` line
 */
export class CalloutIconWidget extends WidgetType {
  readonly type: string

  constructor(type?: string) {
    super()
    this.type = (type || 'note').toLowerCase()
  }

  eq(other: CalloutIconWidget): boolean {
    return other.type === this.type
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.className = `lumina-callout-icon-preview lumina-callout-${this.type}`
    wrap.innerHTML = getCalloutSvgIcon(this.type)
    return wrap
  }
}

function buildCalloutDecorations(state: EditorState): DecorationSet {
  const builder: any[] = []
  const doc = state.doc
  const foldMap = state.field(calloutFoldField, false)
  const blocks = findCalloutBlocks(doc)

  for (const block of blocks) {
    const { header, startLineNum, endLineNum, startFrom, startTo, endTo, bodyLineCount } = block
    const requestedCollapsed = foldMap?.has(startFrom)
      ? foldMap.get(startFrom)!
      : header.foldMode === '-'

    const hasRoomOutside = startFrom > 0 || endTo < doc.length
    const selectionInHeader = state.selection.ranges.some(
      (r) => r.from >= startFrom && r.from <= startTo
    )
    const selectionInBody =
      bodyLineCount > 0 &&
      state.selection.ranges.some((r) => r.from > startTo && r.from <= endTo)

    const isCollapsed =
      requestedCollapsed &&
      !(hasRoomOutside && (selectionInHeader || selectionInBody))

    if (isCollapsed) {
      builder.push(
        Decoration.replace({
          widget: new CalloutHeaderWidget(
            header.type,
            header.title,
            header.foldMode,
            true,
            startFrom,
            endTo,
            bodyLineCount
          ),
          block: true
        }).range(startFrom, endTo)
      )
      continue
    }

    // Expanded state:
    if (selectionInHeader) {
      // User is actively editing the `> [!type]` header line: keep raw source editable
      // with inline icon preview (zero cursor-hijacking inline widgets on the right!)
      if (header.bracketIdx >= 0) {
        builder.push(
          Decoration.widget({
            widget: new CalloutIconWidget(header.type),
            side: -1
          }).range(startFrom + header.bracketIdx)
        )
      }
      const classes = [
        'lumina-callout-line',
        `lumina-callout-line-${header.type}`,
        'lumina-callout-line-first'
      ]
      if (bodyLineCount === 0) classes.push('lumina-callout-line-last')
      builder.push(Decoration.line({ class: classes.join(' ') }).range(startFrom))
    } else {
      // Render atomic block-level header bar (never steals cursor, always shows Copy + Fold)
      builder.push(
        Decoration.replace({
          widget: new CalloutHeaderWidget(
            header.type,
            header.title,
            header.foldMode,
            false,
            startFrom,
            endTo,
            bodyLineCount
          ),
          block: true
        }).range(startFrom, startTo)
      )
    }

    // Decorate body lines below the header
    for (let ln = startLineNum + 1; ln <= endLineNum; ln++) {
      const line = doc.line(ln)
      const isLast = ln === endLineNum
      builder.push(
        Decoration.line({
          class: `lumina-callout-line lumina-callout-line-${header.type}${
            isLast ? ' lumina-callout-line-last' : ''
          }`
        }).range(line.from)
      )
    }
  }

  return Decoration.set(builder, true)
}

export const calloutDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    return buildCalloutDecorations(state)
  },
  update(decorations, tr) {
    if (
      tr.docChanged ||
      tr.selection ||
      tr.effects.some((effect) => effect.is(toggleCalloutFoldEffect))
    ) {
      return buildCalloutDecorations(tr.state)
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field)
})

export const calloutExtension: Extension = [calloutFoldField, calloutDecorationsField]

/**
 * Inserts a new Callout block or wraps the current selection in a callout
 */
export function insertCallout(
  view: EditorView | null | undefined,
  type = 'note',
  title = ''
): boolean {
  if (!view || !view.state) return false
  const state = view.state
  const sel = state.selection?.main
  if (!sel) return false

  const selectedText = state.sliceDoc(sel.from, sel.to)

  const calloutType = (type || 'note').toLowerCase()
  const header = `> [!${calloutType}]${title ? ` ${title}` : ''}\n`

  let content = selectedText || 'Content\n'
  if (!content.endsWith('\n')) content += '\n'

  const formattedContent =
    content
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

export interface UseCalloutReturn {
  calloutExtension: Extension
  insertCallout: (view: EditorView | null | undefined, type?: string, title?: string) => boolean
  CALLOUT_TYPES: Record<string, CalloutMeta>
}

/**
 * React hook wrapping callout utilities and extensions
 */
export function useCallout(): UseCalloutReturn {
  const insert = useCallback((view: EditorView | null | undefined, type = 'note', title = '') => {
    return insertCallout(view, type, title)
  }, [])

  return {
    calloutExtension,
    insertCallout: insert,
    CALLOUT_TYPES
  }
}

export default useCallout
