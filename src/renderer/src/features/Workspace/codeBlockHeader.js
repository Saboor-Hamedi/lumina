import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'

function extractLanguage(state, from, to) {
  const raw = state.sliceDoc(from, to)
  const firstLine = raw.split('\n')[0] || ''
  const match = firstLine.match(/^(`{3,}|~{3,})\s*(\S+)?/)
  return (match && match[2]) || ''
}

function extractCode(state, from, to) {
  const raw = state.sliceDoc(from, to)
  const lines = raw.split('\n')
  const firstLine = lines[0] || ''
  const fenceMatch = firstLine.match(/^(`{3,}|~{3,})\s*(\S+)?/)
  const fenceLen = fenceMatch ? fenceMatch[1].length : 3
  let codeLines = []
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd()
    if (trimmed === '~'.repeat(fenceLen) || trimmed === '`'.repeat(fenceLen)) break
    codeLines.push(lines[i])
  }
  return codeLines.join('\n')
}

function buildDecorations(state) {
  const builder = new RangeSetBuilder()
  const tree = syntaxTree(state)
  let cursor = tree.cursor()
  if (!cursor.firstChild()) return builder.finish()

  do {
    if (cursor.type.name === 'FencedCode') {
      const from = cursor.from
      const to = cursor.to
      const lang = extractLanguage(state, from, to)
      const code = extractCode(state, from, to)

      // Mark the first line with language info for CSS ::before label
      builder.add(
        from,
        from,
        Decoration.line({
          attributes: {
            'data-cb-lang': lang || 'code',
            'data-cb-code': code,
          },
        })
      )

      // Mark lines for click-to-copy — just for event delegation target
      builder.add(
        from,
        to,
        Decoration.mark({ class: 'cb-code-block' })
      )
    }
  } while (cursor.nextSibling())

  return builder.finish()
}

export const codeBlockDecorations = StateField.define({
  create(state) { return buildDecorations(state) },
  update(decorations, tr) {
    if (tr.docChanged) return buildDecorations(tr.state)
    return decorations
  },
  provide: f => EditorView.decorations.from(f),
})
