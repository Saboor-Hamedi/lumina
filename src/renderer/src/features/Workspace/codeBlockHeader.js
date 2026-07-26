import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

export const luminaSyntaxHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { 
      tag: [t.heading, t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], 
      class: 'lumina-heading-text'
    },
    { tag: [t.string, t.special(t.string)], class: 'lumina-syntax-string' },
    { tag: [t.keyword, t.operatorKeyword, t.modifier], class: 'lumina-syntax-keyword' },
    { tag: [t.comment, t.lineComment, t.blockComment], class: 'lumina-syntax-comment' },
    { tag: [t.number, t.bool, t.null], class: 'lumina-syntax-number' },
    { tag: [t.variableName, t.attributeName, t.propertyName], class: 'lumina-syntax-variable' },
    { tag: [t.typeName, t.className, t.namespace], class: 'lumina-syntax-type' },
    { tag: [t.operator, t.punctuation], class: 'lumina-syntax-operator' }
  ])
)

export const codeMap = new Map()

let nextId = 0

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

function extractLanguage(state, from, to) {
  const raw = state.sliceDoc(from, to)
  const firstLine = raw.split('\n')[0] || ''
  const match = firstLine.match(/^(`{3,}|~{3,})\s*(\S+)?/)
  return (match && match[2]) || ''
}

function buildDecorations(state) {
  codeMap.clear()
  nextId = 0
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
      const id = nextId++

      codeMap.set(id, code)

      builder.add(
        from,
        from,
        Decoration.line({
          class: 'cb-code-header',
          attributes: {
            'data-cb-lang': lang || 'CODE',
            'data-cb-id': String(id)
          }
        })
      )
    }
  } while (cursor.nextSibling())

  return builder.finish()
}

export const codeBlockDecorations = StateField.define({
  create(state) {
    return buildDecorations(state)
  },
  update(decorations, tr) {
    if (tr.docChanged) return buildDecorations(tr.state)
    return decorations
  },
  provide: (f) => EditorView.decorations.from(f)
})
