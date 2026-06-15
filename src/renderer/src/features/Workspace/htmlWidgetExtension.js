import { StateField } from '@codemirror/state'
import { EditorView, Decoration, WidgetType } from '@codemirror/view'

class HiddenHtmlWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.style.display = 'none'
    return span
  }
}

class SpaceWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.textContent = ' '
    return span
  }
}

function buildDecorations(state) {
  const widgets = []
  const lineDecos = []
  const selection = state.selection
  const docText = state.doc.toString()

  let inCenterDiv = false

  // Regex to check if a line is exclusively badges, links, or simple separators (like dots)
  const isBadgeLine = (text) => {
    if (text.trim() === '') return false
    // Match ![alt](url), <a href="...">...</a>, [text](url), and characters like . , | -
    const stripped = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '')
                         .replace(/<a\s[^>]*>[\s\S]*?<\/a>/gi, '')
                         .replace(/\[[^\]]+\]\([^)]+\)/g, '')
                         .replace(/[\s\.\,\|\-]/g, '')
    return stripped === ''
  }

  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    const text = line.text

    if (/<(div|p)[^>]*(?:align=["']center["']|class=["'][^"']*center[^"']*["'])[^>]*>/i.test(text)) {
      inCenterDiv = true
    }

    if (inCenterDiv) {
      // Center the block
      lineDecos.push(Decoration.line({ attributes: { style: 'text-align: center;' } }).range(line.from))

      // If this line and the next line are badge lines, dynamically merge them!
      if (i < state.doc.lines && isBadgeLine(text)) {
        const nextLine = state.doc.line(i + 1)
        if (isBadgeLine(nextLine.text)) {
          // Merge them by replacing the newline
          const matchFrom = line.to
          const matchTo = line.to + 1
          
          let intersects = false
          for (const range of selection.ranges) {
            if (range.from <= matchTo + 2 && range.to >= matchFrom - 2) {
              intersects = true
              break
            }
          }
          
          if (!intersects) {
            widgets.push(Decoration.replace({
              widget: new SpaceWidget()
            }).range(matchFrom, matchTo))
          }
        }
      }
    }

    if (/<\/(div|p)>/i.test(text)) {
      inCenterDiv = false
    }
  }

  // Hide specific HTML tags if cursor is not on them
  const tagRegex = /(<(div|p)[^>]*>|<\/(div|p)>|<\/?br\s*\/?>|<\/?span[^>]*>|<a\s[^>]*>|<\/a>)/gi
  let match
  while ((match = tagRegex.exec(docText)) !== null) {
    const matchFrom = match.index
    const matchTo = match.index + match[0].length

    let intersects = false
    for (const range of selection.ranges) {
      if (range.from <= matchTo && range.to >= matchFrom) {
        intersects = true
        break
      }
    }

    if (!intersects) {
      widgets.push(Decoration.replace({
        widget: new HiddenHtmlWidget()
      }).range(matchFrom, matchTo))
    }
  }

  // Style text inside <a> tags to look like links
  const aTagRegex = /<a\s[^>]*>([\s\S]*?)<\/a>/gi
  while ((match = aTagRegex.exec(docText)) !== null) {
    const openTagMatch = match[0].match(/<a\s[^>]*>/i)
    if (openTagMatch) {
      const innerTextFrom = match.index + openTagMatch[0].length
      const innerTextTo = innerTextFrom + match[1].length
      
      if (innerTextTo > innerTextFrom) {
        widgets.push(Decoration.mark({
          class: 'cm-html-link-text'
        }).range(innerTextFrom, innerTextTo))
      }
    }
  }

  const allDecos = [...lineDecos, ...widgets].sort((a, b) => a.from - b.from || (a.value.startSide - b.value.startSide))
  return Decoration.set(allDecos, true)
}

export const htmlWidgetExtension = StateField.define({
  create(state) {
    return buildDecorations(state)
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection) {
      return buildDecorations(tr.state)
    }
    return value
  },
  provide: f => EditorView.decorations.from(f)
})
