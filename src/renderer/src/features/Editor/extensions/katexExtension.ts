import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view'
import { type EditorState, RangeSetBuilder, StateField, StateEffect } from '@codemirror/state'
import './katex.css'

let katexInstance: any = null
let katexLoadPromise: Promise<any> | null = null
const katexMountedViews = new Set<EditorView>()
const refreshKatexEffect = StateEffect.define<null>()

function loadKatexAsync(): Promise<any> {
  if (katexInstance) return Promise.resolve(katexInstance)
  if (!katexLoadPromise) {
    katexLoadPromise = import('katex').then((mod) => {
      katexInstance = mod.default || mod
      for (const v of katexMountedViews) {
        try {
          v.dispatch({ effects: refreshKatexEffect.of(null) })
        } catch {}
      }
      return katexInstance
    })
  }
  return katexLoadPromise
}

export interface MathRange {
  from: number
  to: number
  latex: string
  isBlock: boolean
}

class KaTeXWidget extends WidgetType {
  constructor(
    readonly latex: string,
    readonly isBlock: boolean,
    readonly from: number,
    readonly to: number,
    readonly isLivePreview = false,
    readonly editPos?: number
  ) {
    super()
  }

  get estimatedHeight(): number {
    return this.isBlock ? 60 : -1
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof KaTeXWidget &&
      other.latex === this.latex &&
      other.isBlock === this.isBlock &&
      other.isLivePreview === this.isLivePreview &&
      other.from === this.from &&
      other.to === this.to
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement(this.isBlock ? 'div' : 'span')
    el.className = this.isBlock
      ? this.isLivePreview
        ? 'cm-katex-block cm-katex-live-preview'
        : 'cm-katex-block'
      : 'cm-katex-inline'
    if (this.isBlock) {
      el.contentEditable = 'false'
    }

    const content = document.createElement(this.isBlock ? 'div' : 'span')
    if (this.isBlock) {
      content.className = 'cm-katex-content'
    }

    try {
      katexMountedViews.add(view)
      if (katexInstance) {
        content.innerHTML = katexInstance.renderToString(this.latex, {
          displayMode: this.isBlock,
          throwOnError: false,
          output: 'html'
        })
      } else {
        content.textContent = this.latex
        void loadKatexAsync().then((k) => {
          try {
            content.innerHTML = k.renderToString(this.latex, {
              displayMode: this.isBlock,
              throwOnError: false,
              output: 'html'
            })
          } catch {}
        })
      }
    } catch {
      el.className += ' cm-katex-error'
      content.textContent = this.latex
    }

    el.appendChild(content)

    if (this.isBlock) {
      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className = 'cm-katex-copy-btn'
      copyBtn.title = 'Copy LaTeX'
      copyBtn.setAttribute('aria-label', 'Copy LaTeX')
      const copyIconSvg =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
      const checkIconSvg =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      copyBtn.innerHTML = copyIconSvg

      let resetTimer: ReturnType<typeof setTimeout> | null = null
      copyBtn.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
      })
      copyBtn.addEventListener('click', async (e: MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          await navigator.clipboard?.writeText?.(this.latex)
          copyBtn.classList.add('copied')
          copyBtn.innerHTML = checkIconSvg
          copyBtn.title = 'Copied!'
          if (resetTimer) clearTimeout(resetTimer)
          resetTimer = setTimeout(() => {
            copyBtn.classList.remove('copied')
            copyBtn.innerHTML = copyIconSvg
            copyBtn.title = 'Copy LaTeX'
          }, 1500)
        } catch {}
      })

      el.appendChild(copyBtn)
    }

    const root =
      this.isBlock && this.isLivePreview ? document.createElement('div') : el

    if (root !== el) {
      root.className = 'cm-katex-live-preview-wrap'
      root.contentEditable = 'false'
      root.appendChild(el)
    }

    const focusBlockSource = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('.cm-katex-copy-btn')) return
      e.preventDefault()
      e.stopPropagation()
      if (this.isLivePreview) {
        view.focus()
        return
      }
      const targetPos = this.editPos ?? this.from + (this.isBlock ? 2 : 1)
      const clampedPos = Math.max(0, Math.min(targetPos, view.state.doc.length))
      view.dispatch({
        selection: { anchor: clampedPos }
      })
      view.focus()
    }

    if (this.isBlock) {
      root.addEventListener('mousedown', focusBlockSource)
      root.addEventListener('click', (e: Event) => {
        const target = e.target as HTMLElement | null
        if (target?.closest?.('.cm-katex-copy-btn')) return
        e.preventDefault()
        e.stopPropagation()
      })
    } else {
      root.addEventListener('click', focusBlockSource)
    }

    return root
  }

  ignoreEvent(event: Event): boolean {
    const target = event?.target as HTMLElement | null
    if (target?.closest?.('.cm-katex-copy-btn')) return true
    if (this.isBlock) {
      const type = event?.type
      if (
        type === 'mousedown' ||
        type === 'mouseup' ||
        type === 'click' ||
        type === 'dblclick' ||
        type === 'pointerdown' ||
        type === 'pointerup' ||
        type === 'touchstart' ||
        type === 'touchend'
      ) {
        return true
      }
    }
    return false
  }
}

export function findMathRanges(docText: string): MathRange[] {
  const ranges: MathRange[] = []

  const blockRegex = /\$\$([\s\S]+?)\$\$/g
  let match: RegExpExecArray | null
  while ((match = blockRegex.exec(docText)) !== null) {
    const raw = match[0]
    const latex = match[1].replace(/\r\n/g, '\n').trim()
    if (latex) {
      ranges.push({
        from: match.index,
        to: match.index + raw.length,
        latex,
        isBlock: true
      })
    }
  }

  const codeFenceBlockRegex = /```(?:math|katex)\n([\s\S]*?)```/g
  while ((match = codeFenceBlockRegex.exec(docText)) !== null) {
    const raw = match[0]
    const latex = match[1].replace(/\r\n/g, '\n').trim()
    if (latex) {
      ranges.push({
        from: match.index,
        to: match.index + raw.length,
        latex,
        isBlock: true
      })
    }
  }

  const inlineRegex = /(?<!\$)\$([^\$\n\r]+?)\$(?!\$)/g
  while ((match = inlineRegex.exec(docText)) !== null) {
    const from = match.index
    const raw = match[0]
    const to = from + raw.length

    const isInsideBlock = ranges.some((r) => r.isBlock && from >= r.from && to <= r.to)
    if (isInsideBlock) continue

    const content = match[1]
    if (!content || /^\s|\s$/.test(content) || /^\d+(?:\.\d+)?$/.test(content)) {
      continue
    }

    ranges.push({
      from,
      to,
      latex: content.trim(),
      isBlock: false
    })
  }

  ranges.sort((a, b) => a.from - b.from)

  const nonOverlapping: MathRange[] = []
  let lastEnd = -1
  for (const r of ranges) {
    if (r.from >= lastEnd) {
      nonOverlapping.push(r)
      lastEnd = r.to
    }
  }

  return nonOverlapping
}

function buildKaTeXDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const docText = state.doc.toString()
  if (!docText) return builder.finish()

  const selection = state.selection.main
  const mathRanges = findMathRanges(docText)

  for (const item of mathRanges) {
    if (item.isBlock) {
      const lineFrom = state.doc.lineAt(item.from)
      const lineTo = state.doc.lineAt(item.to)
      const lineText = lineFrom.text.trim()
      const mathText = state.sliceDoc(item.from, item.to).trim()
      const isSoloLine = lineText === mathText
      const isFullBlock = isSoloLine || lineFrom.number !== lineTo.number

      const activeFrom = isFullBlock ? lineFrom.from : item.from
      const activeTo = isFullBlock ? lineTo.to : item.to
      const isCursorInside = selection.from <= activeTo && selection.to >= activeFrom
      const editPos =
        lineFrom.number !== lineTo.number
          ? state.doc.line(lineFrom.number + 1).from
          : Math.min(item.from + 2, item.to)

      if (isCursorInside) {
        for (let n = lineFrom.number; n <= lineTo.number; n++) {
          const line = state.doc.line(n)
          const classes = ['cm-katex-source-line']
          if (n === lineFrom.number) classes.push('cm-katex-source-first')
          if (n === lineTo.number) classes.push('cm-katex-source-last')
          builder.add(line.from, line.from, Decoration.line({ class: classes.join(' ') }))
        }
        builder.add(
          lineTo.to,
          lineTo.to,
          Decoration.widget({
            widget: new KaTeXWidget(item.latex, true, activeFrom, activeTo, true, editPos),
            side: 1,
            block: true
          })
        )
        continue
      }

      if (isFullBlock) {
        builder.add(
          lineFrom.from,
          lineTo.to,
          Decoration.replace({
            widget: new KaTeXWidget(item.latex, true, lineFrom.from, lineTo.to, false, editPos),
            block: true
          })
        )
      } else {
        builder.add(
          item.from,
          item.to,
          Decoration.replace({
            widget: new KaTeXWidget(item.latex, false, item.from, item.to, false, editPos)
          })
        )
      }
    } else {
      const isCursorInside = selection.from <= item.to && selection.to >= item.from
      if (isCursorInside) continue

      builder.add(
        item.from,
        item.to,
        Decoration.replace({
          widget: new KaTeXWidget(item.latex, false, item.from, item.to)
        })
      )
    }
  }

  return builder.finish()
}

export const katexExtension: StateField<DecorationSet> = StateField.define<DecorationSet>({
  create(state) {
    return buildKaTeXDecorations(state)
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection) {
      return buildKaTeXDecorations(tr.state)
    }
    return value.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f)
})
