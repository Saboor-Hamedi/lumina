import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import React from 'react'
import { createRoot } from 'react-dom/client'
import ToolTip from '../../components/atoms/ToolTip'
import { copyCodeAsImage } from './copyCodeAsImage'
import './CodeWrapper.css'

export { copyCodeAsImage } from './copyCodeAsImage'

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

class CodeBlockHeaderWidget extends WidgetType {
  constructor(lang) {
    super()
    this.lang = (lang || 'CODE').toUpperCase()
  }

  eq(other) {
    return other.lang === this.lang
  }

  toDOM(view) {
    const wrap = document.createElement('div')
    wrap.className = 'mermaid-widget-header code-block-widget-header'
    wrap.setAttribute('contenteditable', 'false')

    // Prevent editor focus / caret shifts on header click
    wrap.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

    const langLabel = document.createElement('span')
    langLabel.className = 'mermaid-widget-lang-label'
    langLabel.textContent = this.lang
    wrap.appendChild(langLabel)

    // Action Buttons Container (Exact match to Mermaid actions)
    const actionsWrap = document.createElement('div')
    actionsWrap.style.display = 'flex'
    actionsWrap.style.alignItems = 'center'
    wrap.appendChild(actionsWrap)

    const root = createRoot(actionsWrap)
    wrap._reactRoot = root

    const ActionsOverlay = () => {
      const [copiedImage, setCopiedImage] = React.useState(false)
      const [copiedSyntax, setCopiedSyntax] = React.useState(false)

      const getCodeSnippet = () => {
        const pos = view.posAtDOM(wrap)
        if (pos !== null) {
          const tree = syntaxTree(view.state)
          const node = tree.resolveInner(pos, 1)
          let fenced = node
          while (fenced && fenced.type.name !== 'FencedCode') {
            fenced = fenced.parent
          }
          if (fenced) {
            return extractCode(view.state, fenced.from, fenced.to)
          }
        }
        return ''
      }

      const handleCopyImage = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          const code = getCodeSnippet()
          await copyCodeAsImage(code, this.lang)
          setCopiedImage(true)
          setTimeout(() => setCopiedImage(false), 1500)
        } catch (err) {
          console.error('Failed to copy code as image', err)
        }
      }

      const handleCopySyntax = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          const code = getCodeSnippet()
          await navigator.clipboard.writeText(code)
          setCopiedSyntax(true)
          setTimeout(() => setCopiedSyntax(false), 1500)
        } catch (err) {
          console.error('Failed to copy syntax', err)
        }
      }

      // Exact icons from Mermaid
      const copyIcon = React.createElement(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          width: 14,
          height: 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          style: { display: 'block' }
        },
        React.createElement('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }),
        React.createElement('circle', { cx: 8.5, cy: 8.5, r: 1.5 }),
        React.createElement('polyline', { points: '21 15 16 10 5 21' })
      )

      const textCopyIcon = React.createElement(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          width: 14,
          height: 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          style: { display: 'block' }
        },
        React.createElement('rect', { x: 9, y: 9, width: 13, height: 13, rx: 2, ry: 2 }),
        React.createElement('path', {
          d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'
        })
      )

      const checkIcon = React.createElement(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          width: 14,
          height: 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          style: { display: 'block' }
        },
        React.createElement('polyline', { points: '20 6 9 17 4 12' })
      )

      const copyImageBtn = React.createElement(
        ToolTip,
        { text: 'Copy as Image', position: 'top' },
        React.createElement(
          'div',
          {
            className: 'mermaid-edit-btn',
            style: {
              position: 'static',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: copiedImage ? '#4ade80' : undefined,
              borderColor: copiedImage ? '#4ade80' : undefined
            },
            onClick: handleCopyImage
          },
          copiedImage ? checkIcon : copyIcon
        )
      )

      const copySyntaxBtn = React.createElement(
        ToolTip,
        { text: 'Copy Code', position: 'top' },
        React.createElement(
          'div',
          {
            className: 'mermaid-edit-btn',
            style: {
              position: 'static',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: copiedSyntax ? '#4ade80' : undefined,
              borderColor: copiedSyntax ? '#4ade80' : undefined
            },
            onClick: handleCopySyntax
          },
          copiedSyntax ? checkIcon : textCopyIcon
        )
      )

      return React.createElement(
        'div',
        { style: { display: 'flex', gap: '8px' } },
        copySyntaxBtn,
        copyImageBtn
      )
    }

    root.render(React.createElement(ActionsOverlay))

    return wrap
  }

  destroy(dom) {
    if (dom._reactRoot) {
      setTimeout(() => dom._reactRoot.unmount(), 0)
    }
  }
}

function buildDecorations(state) {
  const builder = new RangeSetBuilder()
  const tree = syntaxTree(state)

  tree.iterate({
    enter(node) {
      if (node.name === 'FencedCode') {
        const text = state.sliceDoc(node.from, node.to)
        const firstLine = text.split('\n')[0] || ''
        const match = firstLine.match(/^(`{3,}|~{3,})\s*(\S+)?/)
        const lang = (match && match[2]) || ''

        // Exclude mermaid diagrams entirely — mermaid is handled by mermaidWidgetExtension
        if (lang.toLowerCase() === 'mermaid' || text.startsWith('```mermaid') || text.startsWith('~~~mermaid')) {
          return
        }

        builder.add(
          node.from,
          node.from,
          Decoration.widget({
            widget: new CodeBlockHeaderWidget(lang),
            side: -1,
            block: true
          })
        )
      }
    }
  })

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
