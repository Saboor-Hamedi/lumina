import { Decoration, WidgetType, EditorView } from '@codemirror/view'
import { RangeSetBuilder, StateField } from '@codemirror/state'
import katex from 'katex'
import './katex.css'

class KaTeXWidget extends WidgetType {
  constructor(latex, isBlock, from, to) {
    super()
    this.latex = latex
    this.isBlock = isBlock
    this.from = from
    this.to = to
  }

  eq(other) {
    return other.latex === this.latex && other.isBlock === this.isBlock
  }

  toDOM(view) {
    const el = document.createElement(this.isBlock ? 'div' : 'span')
    el.className = this.isBlock ? 'cm-katex-block' : 'cm-katex-inline'

    try {
      el.innerHTML = katex.renderToString(this.latex, {
        displayMode: this.isBlock,
        throwOnError: false
      })
    } catch {
      el.className += ' cm-katex-error'
      el.textContent = this.latex
    }

    el.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({
        selection: { anchor: this.from + (this.isBlock ? 2 : 1) }
      })
      view.focus()
    })

    return el
  }

  ignoreEvent() {
    return false
  }
}

function findMathRanges(docText) {
  const ranges = []

  const blockRegex = /\$\$([\s\S]+?)\$\$/g
  let match
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

  const nonOverlapping = []
  let lastEnd = -1
  for (const r of ranges) {
    if (r.from >= lastEnd) {
      nonOverlapping.push(r)
      lastEnd = r.to
    }
  }

  return nonOverlapping
}

function buildKaTeXDecorations(state) {
  const builder = new RangeSetBuilder()
  const docText = state.doc.toString()
  if (!docText) return builder.finish()

  const selection = state.selection.main
  const mathRanges = findMathRanges(docText)

  for (const item of mathRanges) {
    const isCursorInside = selection.from <= item.to && selection.to >= item.from
    if (isCursorInside) {
      continue
    }

    if (item.isBlock) {
      const lineFrom = state.doc.lineAt(item.from)
      const lineTo = state.doc.lineAt(item.to)
      const isSoloLine = lineFrom.from === item.from && lineTo.to === item.to

      if (isSoloLine || lineFrom.number !== lineTo.number) {
        builder.add(
          lineFrom.from,
          lineTo.to,
          Decoration.replace({
            widget: new KaTeXWidget(item.latex, true, lineFrom.from, lineTo.to),
            block: true
          })
        )
      } else {
        builder.add(
          item.from,
          item.to,
          Decoration.replace({
            widget: new KaTeXWidget(item.latex, true, item.from, item.to)
          })
        )
      }
    } else {
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

export const katexExtension = StateField.define({
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
