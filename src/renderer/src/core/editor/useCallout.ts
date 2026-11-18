import { useCallback } from 'react'
import { Decoration, ViewPlugin, WidgetType, EditorView, type ViewUpdate, type DecorationSet } from '@codemirror/view'
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
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`
  } else if (t === 'warning') {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`
  } else if (t === 'tip' || t === 'success') {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`
  } else if (t === 'important') {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`
  } else if (t === 'caution' || t === 'danger' || t === 'bug') {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>`
  } else if (t === 'question') {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg>`
  } else if (t === 'todo') {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="m9 12 2 2 4-4"></path></svg>`
  } else if (t === 'quote') {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path></svg>`
  }
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`
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
  } catch (err) {
    console.error('Failed to copy text using fallback:', err)
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
 * Parses a markdown callout header line (e.g. `> [!note]- Optional Title`).
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

function buildFoldDecorations(state: EditorState): DecorationSet {
  const builder: any[] = []
  const doc = state.doc
  const foldMap = state.field(calloutFoldField, false)

  for (let l = 1; l <= doc.lines; l++) {
    const startLine = doc.line(l)
    if (!startLine.text.includes('[!')) continue
    const header = parseCalloutHeaderLine(startLine.text)
    if (!header || header.foldMode === null) continue

    const isCollapsed = foldMap?.has(startLine.from)
      ? foldMap.get(startLine.from)!
      : header.foldMode === '-'

    if (!isCollapsed) continue

    let lastBodyLineNumber = l
    for (let nextLineNum = l + 1; nextLineNum <= doc.lines; nextLineNum++) {
      const nextLine = doc.line(nextLineNum)
      const prefix = nextLine.text.match(/^\s*(?:>\s*)+/)
      if (!prefix) break
      const level = prefix[0].match(/>/g)?.length || 0
      if (level < header.level) break
      if (parseCalloutHeaderLine(nextLine.text)) break
      lastBodyLineNumber = nextLineNum
    }

    if (lastBodyLineNumber > l) {
      const lastLine = doc.line(lastBodyLineNumber)
      const selectionInside = state.selection.ranges.some(
        (range) => range.from > startLine.to && range.from <= lastLine.to
      )
      if (!selectionInside) {
        builder.push(Decoration.replace({}).range(startLine.to, lastLine.to))
      }
      l = lastBodyLineNumber
    }
  }

  return Decoration.set(builder, true)
}

export const calloutFoldDecorations = StateField.define<DecorationSet>({
  create(state) {
    return buildFoldDecorations(state)
  },
  update(decorations, tr) {
    if (
      tr.docChanged ||
      tr.selection ||
      tr.effects.some((effect) => effect.is(toggleCalloutFoldEffect))
    ) {
      return buildFoldDecorations(tr.state)
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field)
})

const COPY_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const CHECK_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
const CHEVRON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`

/**
 * Shared copy button factory for both CalloutHeaderWidget and standalone CalloutCopyWidget.
 */
function createCalloutCopyButton(
  view: EditorView,
  getAnchorElement: () => HTMLElement,
  options: { parseHeaderFirstLine?: boolean; label?: string } = {}
): HTMLButtonElement {
  const { parseHeaderFirstLine = false, label = 'Copy callout' } = options
  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'lumina-callout-copy-btn'
  copyBtn.title = label
  copyBtn.setAttribute('aria-label', label)
  copyBtn.innerHTML = COPY_ICON_SVG

  copyBtn.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })

  copyBtn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const pos = view.posAtDOM(getAnchorElement())
    if (pos < 0) return

    const doc = view.state.doc
    const startLine = doc.lineAt(pos)
    const collected: string[] = []

    if (parseHeaderFirstLine) {
      const header = parseCalloutHeaderLine(startLine.text)
      if (header?.title) collected.push(header.title)
    } else {
      collected.push(startLine.text.replace(/^\s*(?:>\s?)+/, ''))
    }

    for (let ln = startLine.number + 1; ln <= doc.lines; ln++) {
      const line = doc.line(ln)
      if (!/^\s*>/.test(line.text)) break
      if (parseHeaderFirstLine && parseCalloutHeaderLine(line.text)) break
      collected.push(line.text.replace(/^\s*(?:>\s?)+/, ''))
    }

    const payload = collected.join('\n').trim()
    if (!payload) return

    const triggerSuccess = () => {
      copyBtn.classList.add('copied')
      copyBtn.innerHTML = CHECK_ICON_SVG
      window.setTimeout(() => {
        copyBtn.classList.remove('copied')
        copyBtn.innerHTML = COPY_ICON_SVG
      }, 1400)
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
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

  return copyBtn
}

/**
 * CodeMirror Widget rendering the stylized header of a Callout block
 */
export class CalloutHeaderWidget extends WidgetType {
  readonly type: string
  readonly title: string
  readonly foldMode: CalloutFoldMode
  readonly isCollapsed: boolean

  constructor(
    type?: string,
    title?: string,
    foldMode: CalloutFoldMode = null,
    isCollapsed = false
  ) {
    super()
    this.type = (type || 'note').toLowerCase()
    this.title = title || ''
    this.foldMode = foldMode
    this.isCollapsed = isCollapsed
  }

  eq(other: CalloutHeaderWidget): boolean {
    return (
      other.type === this.type &&
      other.title === this.title &&
      other.foldMode === this.foldMode &&
      other.isCollapsed === this.isCollapsed
    )
  }

  toDOM(view?: EditorView): HTMLElement {
    const wrap = document.createElement('span')
    const classes = ['lumina-callout-header', `lumina-callout-${this.type}`]
    if (this.foldMode !== null) classes.push('is-foldable')
    if (this.isCollapsed) classes.push('is-collapsed')
    wrap.className = classes.join(' ')

    const icon = document.createElement('span')
    icon.className = 'lumina-callout-icon'
    icon.innerHTML = getCalloutSvgIcon(this.type)

    const text = document.createElement('span')
    text.className = 'lumina-callout-title'
    text.textContent = this.title || this.type.toUpperCase()

    wrap.appendChild(icon)
    wrap.appendChild(text)

    if (this.foldMode !== null) {
      const foldBtn = document.createElement('button')
      foldBtn.type = 'button'
      foldBtn.className = `lumina-callout-fold-btn${this.isCollapsed ? ' is-collapsed' : ''}`
      foldBtn.title = this.isCollapsed ? 'Expand callout' : 'Collapse callout'
      foldBtn.setAttribute('aria-label', foldBtn.title)
      foldBtn.setAttribute('aria-expanded', String(!this.isCollapsed))
      foldBtn.innerHTML = CHEVRON_SVG
      wrap.appendChild(foldBtn)

      if (view) {
        const handleToggle = (e: MouseEvent) => {
          if ((e.target as HTMLElement | null)?.closest('.lumina-callout-copy-btn')) return
          e.preventDefault()
          e.stopPropagation()
          const pos = view.posAtDOM(wrap)
          if (pos < 0) return
          const startLine = view.state.doc.lineAt(pos)
          view.dispatch({
            effects: toggleCalloutFoldEffect.of({
              pos: startLine.from,
              defaultCollapsed: this.foldMode === '-'
            })
          })
        }

        wrap.addEventListener('mousedown', (e) => {
          if ((e.target as HTMLElement | null)?.closest('.lumina-callout-copy-btn')) return
          e.preventDefault()
          e.stopPropagation()
        })
        wrap.addEventListener('click', handleToggle)
      }
    }

    if (view) {
      wrap.appendChild(
        createCalloutCopyButton(view, () => wrap, {
          parseHeaderFirstLine: true,
          label: 'Copy callout'
        })
      )
    }

    return wrap
  }
}

/**
 * Inline icon preview displayed while the user is actively typing inside [!type]
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
    wrap.style.display = 'inline-flex'
    wrap.style.alignItems = 'center'
    wrap.style.marginRight = '4px'
    wrap.style.verticalAlign = 'middle'
    wrap.innerHTML = getCalloutSvgIcon(this.type)
    return wrap
  }
}

/**
 * Copy button widget attached to standalone quote blocks (> without [!type])
 */
export class CalloutCopyWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(view: EditorView): HTMLElement {
    const copyBtn = createCalloutCopyButton(view, () => copyBtn, {
      parseHeaderFirstLine: false,
      label: 'Copy'
    })
    return copyBtn
  }
}

/**
 * CodeMirror ViewPlugin for scanning, decorating, and styling Callouts
 */
export const calloutPlugin = ViewPlugin.fromClass(
  class {
    decorations: any

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      const foldToggled = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(toggleCalloutFoldEffect))
      )
      if (update.docChanged || update.viewportChanged || update.selectionSet || foldToggled) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView) {
      const builder: any[] = []
      const doc = view.state.doc
      const foldMap = view.state.field(calloutFoldField, false)

      for (let { from, to } of view.visibleRanges) {
        const startLineNumber = doc.lineAt(from).number
        const endLineIdx = doc.lineAt(to).number

        // Backtrack to the start of the contiguous blockquote group
        let scanStart = startLineNumber
        while (scanStart > 1) {
          const prev = doc.line(scanStart - 1)
          if (/^\s*>/.test(prev.text)) {
            scanStart--
          } else {
            break
          }
        }

        let currentCalloutType: string | null = null
        let currentCalloutLevel = 0

        for (let l = scanStart; l <= endLineIdx; l++) {
          const line = doc.line(l)
          const match = line.text.match(/^\s*(?:>\s*)+/)

          if (match) {
            const level = match[0].match(/>/g)?.length || 0
            const header = parseCalloutHeaderLine(line.text)

            if (header) {
              currentCalloutLevel = level
              currentCalloutType = header.type
              const isCollapsed =
                header.foldMode !== null &&
                (foldMap?.has(line.from) ? foldMap.get(line.from)! : header.foldMode === '-')

              // Only decorate if within visible range
              if (l >= startLineNumber) {
                const { bracketIdx, bracketEnd } = header
                const sel = view.state.selection.main
                const cursor = sel.head

                // Only unmount widget if cursor is actively inside [!type]
                const isEditingBracket =
                  bracketIdx >= 0 &&
                  bracketEnd >= 0 &&
                  sel.empty &&
                  cursor >= line.from + bracketIdx &&
                  cursor <= line.from + bracketEnd + 1

                if (!isEditingBracket) {
                  const replaceFrom = line.from + (bracketIdx >= 0 ? bracketIdx : 0)
                  const replaceTo = line.to
                  builder.push(
                    Decoration.replace({
                      widget: new CalloutHeaderWidget(
                        currentCalloutType,
                        header.title,
                        header.foldMode,
                        isCollapsed
                      )
                    }).range(replaceFrom, replaceTo)
                  )
                } else if (bracketIdx >= 0) {
                  // While actively typing inside [!type], still display the icon preview!
                  builder.push(
                    Decoration.widget({
                      widget: new CalloutIconWidget(currentCalloutType),
                      side: -1
                    }).range(line.from + bracketIdx)
                  )
                }

                builder.push(
                  Decoration.line({
                    class: `lumina-callout-line lumina-callout-line-${currentCalloutType}${
                      isCollapsed ? ' lumina-callout-is-collapsed' : ''
                    }`
                  }).range(line.from)
                )
              }
            } else if (currentCalloutType && level >= currentCalloutLevel) {
              if (l >= startLineNumber) {
                builder.push(
                  Decoration.line({
                    class: `lumina-callout-line lumina-callout-line-${currentCalloutType}`
                  }).range(line.from)
                )
              }
            } else {
              // Standalone blockquote (> without [!type])
              // Treat as 'quote' callout so it shares the exact same robust borderless card frame & hover copy button!
              currentCalloutType = 'quote'
              currentCalloutLevel = level
              if (l >= startLineNumber) {
                const isFirstQuoteLine = l === scanStart || !/^\s*>/.test(doc.line(l - 1).text)
                if (isFirstQuoteLine) {
                  builder.push(
                    Decoration.widget({
                      widget: new CalloutCopyWidget(),
                      side: 1
                    }).range(line.from)
                  )
                }

                builder.push(
                  Decoration.line({
                    class: `lumina-callout-line lumina-callout-line-quote`
                  }).range(line.from)
                )
              }
            }
          } else {
            currentCalloutType = null
          }
        }
      }

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

let currentHoveredCalloutBtn: HTMLElement | null = null

/**
 * Event handler that tracks hovering over ANY line of a callout block
 * and illuminates its copy button, matching CodeWrapper geometry.
 */
export const calloutHoverHandler = EditorView.domEventHandlers({
  mousemove(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (!target) return

    const line = target.closest('.cm-line.lumina-callout-line')
    let btn: HTMLElement | null = null
    if (line) {
      // 1. Direct copy button inside this line
      btn = line.querySelector('.lumina-callout-copy-btn') as HTMLElement | null
      // 2. Search backwards through contiguous callout lines to find the header copy button
      if (!btn) {
        let curr: Element | null = line.previousElementSibling
        while (curr && curr.classList.contains('lumina-callout-line')) {
          const found = curr.querySelector('.lumina-callout-copy-btn') as HTMLElement | null
          if (found) {
            btn = found
            break
          }
          curr = curr.previousElementSibling
        }
      }
      // 3. Fallback search forwards
      if (!btn) {
        let curr: Element | null = line.nextElementSibling
        while (curr && curr.classList.contains('lumina-callout-line')) {
          const found = curr.querySelector('.lumina-callout-copy-btn') as HTMLElement | null
          if (found) {
            btn = found
            break
          }
          curr = curr.nextElementSibling
        }
      }
    } else {
      const b = target.closest('.lumina-callout-copy-btn') as HTMLElement | null
      if (b) btn = b
    }

    if (currentHoveredCalloutBtn !== btn) {
      if (currentHoveredCalloutBtn) currentHoveredCalloutBtn.classList.remove('is-hovered')
      if (btn) btn.classList.add('is-hovered')
      currentHoveredCalloutBtn = btn
    }
  },
  mouseleave() {
    if (currentHoveredCalloutBtn) {
      currentHoveredCalloutBtn.classList.remove('is-hovered')
      currentHoveredCalloutBtn = null
    }
  }
})

export const calloutExtension: Extension = [
  calloutFoldField,
  calloutFoldDecorations,
  calloutPlugin,
  calloutHoverHandler
]

/**
 * Inserts a new Callout block or wraps the current selection in a callout
 */
export function insertCallout(view: EditorView | null | undefined, type = 'note', title = ''): boolean {
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
