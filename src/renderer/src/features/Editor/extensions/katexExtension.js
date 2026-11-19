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

  get estimatedHeight() {
    return this.isBlock ? 60 : -1
  }

  eq(other) {
    return other.latex === this.latex && other.isBlock === this.isBlock
  }

  toDOM(view) {
    const el = document.createElement(this.isBlock ? 'div' : 'span')
    el.className = this.isBlock ? 'cm-katex-block' : 'cm-katex-inline'

    const content = document.createElement(this.isBlock ? 'div' : 'span')
    if (this.isBlock) {
      content.className = 'cm-katex-content'
    }

    try {
      content.innerHTML = katex.renderToString(this.latex, {
        displayMode: this.isBlock,
        throwOnError: false
      })
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

      let resetTimer = null
      copyBtn.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
      })
      copyBtn.addEventListener('click', async (e) => {
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

    el.addEventListener('click', (e) => {
      if (e.target && e.target.closest && e.target.closest('.cm-katex-copy-btn')) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({
        selection: { anchor: this.from + (this.isBlock ? 2 : 1) }
      })
      view.focus()
    })

    return el
  }

  ignoreEvent(event) {
    if (event?.target?.closest?.('.cm-katex-copy-btn')) {
      return true
    }
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
      const lineText = lineFrom.text.trim()
      const mathText = state.sliceDoc(item.from, item.to).trim()
      const isSoloLine = lineText === mathText

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
            widget: new KaTeXWidget(item.latex, false, item.from, item.to)
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
