/**
 * =========================================================================================
 * Code Block Header Widget & Extensions (`codeBlockHeader.ts`)
 * =========================================================================================
 *
 * Purpose:
 * Renders the top control header above markdown fenced code blocks:
 * - Language badge
 * - 1-click copy markdown code syntax
 * - 1-click export code as image (with active theme support)
 * - Custom syntax highlighting rules for Lumina
 * =========================================================================================
 */

import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import ToolTip from '../../components/atoms/ToolTip'
import { copyCodeAsImage } from './copyCodeAsImage'
import '../../assets/codeWrapper.css'

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

export const codeMap = new Map<string, string>()

function extractCode(state: EditorState, from: number, to: number): string {
  const raw = state.sliceDoc(from, to)
  const lines = raw.split('\n')
  const firstLine = lines[0] || ''
  const fenceMatch = firstLine.match(/^(`{3,}|~{3,})\s*(\S+)?/)
  const fenceLen = fenceMatch ? fenceMatch[1].length : 3
  const codeLines: string[] = []
  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd()
    if (trimmed === '~'.repeat(fenceLen) || trimmed === '`'.repeat(fenceLen)) break
    codeLines.push(lines[i])
  }
  return codeLines.join('\n')
}

export class CodeBlockHeaderWidget extends WidgetType {
  lang: string

  constructor(lang?: string) {
    super()
    this.lang = (lang || 'CODE').toUpperCase()
  }

  get estimatedHeight(): number {
    return 30
  }

  eq(other: CodeBlockHeaderWidget): boolean {
    return other.lang === this.lang
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div') as HTMLElement & { _reactRoot?: Root | null }
    wrap.className = 'code-block-widget-header'
    wrap.setAttribute('contenteditable', 'false')

    wrap.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement | null)?.closest('.mermaid-edit-btn')) return
      const pos = view.posAtDOM(wrap)
      if (pos !== null) {
        view.dispatch({
          selection: { anchor: pos },
          scrollIntoView: true
        })
        view.focus()
      }
    })

    const langLabel = document.createElement('span')
    langLabel.className = 'mermaid-widget-lang-label'
    langLabel.textContent = this.lang
    langLabel.setAttribute('contenteditable', 'false')

    langLabel.addEventListener('mousedown', (e) => {
      e.stopPropagation()
      const pos = view.posAtDOM(wrap)
      if (pos !== null) {
        const line = view.state.doc.lineAt(pos)
        const match = line.text.match(/^(`{3,}|~{3,})/)
        if (match) {
          const langStart = line.from + match[1].length
          const langEnd = line.to
          view.dispatch({
            selection: { anchor: langStart, head: langEnd },
            scrollIntoView: true
          })
          view.focus()
        }
      }
    })

    wrap.appendChild(langLabel)

    const actionsWrap = document.createElement('div')
    actionsWrap.style.display = 'flex'
    actionsWrap.style.alignItems = 'center'
    wrap.appendChild(actionsWrap)

    const root = createRoot(actionsWrap)
    wrap._reactRoot = root

    const ActionsOverlay = () => {
      const [copiedImage, setCopiedImage] = React.useState(false)
      const [copiedSyntax, setCopiedSyntax] = React.useState(false)

      const getCodeSnippet = (): string => {
        const pos = view.posAtDOM(wrap)
        if (pos !== null) {
          const tree = syntaxTree(view.state)
          const node = tree.resolveInner(pos, 1)
          let fenced: any = node
          while (fenced && fenced.type?.name !== 'FencedCode' && fenced.name !== 'FencedCode') {
            fenced = fenced.parent
          }
          if (fenced) {
            return extractCode(view.state, fenced.from, fenced.to)
          }
        }
        return ''
      }

      const handleCopyImage = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          const code = getCodeSnippet()
          await copyCodeAsImage(code, this.lang)
          setCopiedImage(true)
          setTimeout(() => setCopiedImage(false), 1500)
          window.dispatchEvent(
            new CustomEvent('show-toast', {
              detail: { message: 'Code snippet copied as image', type: 'success' }
            })
          )
        } catch (err) {
          console.error('Failed to copy code as image', err)
          window.dispatchEvent(
            new CustomEvent('show-toast', {
              detail: { message: 'Failed to copy code as image', type: 'error' }
            })
          )
        }
      }

      const handleCopySyntax = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          const code = getCodeSnippet()
          await navigator.clipboard.writeText(code)
          setCopiedSyntax(true)
          setTimeout(() => setCopiedSyntax(false), 1500)
          window.dispatchEvent(
            new CustomEvent('show-toast', {
              detail: { message: 'Code copied to clipboard', type: 'success' }
            })
          )
        } catch (err) {
          console.error('Failed to copy syntax', err)
        }
      }

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
        ToolTip as any,
        { text: 'Copy as Image', position: 'top' },
        React.createElement(
          'div',
          {
            className: 'mermaid-edit-btn',
            style: {
              color: copiedImage ? '#4ade80' : undefined,
              borderColor: copiedImage ? '#4ade80' : undefined
            },
            onClick: handleCopyImage
          },
          copiedImage ? checkIcon : copyIcon
        )
      )

      const copySyntaxBtn = React.createElement(
        ToolTip as any,
        { text: 'Copy Code', position: 'top' },
        React.createElement(
          'div',
          {
            className: 'mermaid-edit-btn',
            style: {
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
        { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
        copySyntaxBtn,
        copyImageBtn
      )
    }

    root.render(React.createElement(ActionsOverlay))

    requestAnimationFrame(() => {
      view.requestMeasure()
    })

    return wrap
  }

  destroy(dom: HTMLElement & { _reactRoot?: Root | null }): void {
    if (dom._reactRoot) {
      setTimeout(() => dom._reactRoot?.unmount(), 0)
    }
  }
}

let currentHoveredHeader: HTMLElement | null = null

const codeBlockHoverHandler = EditorView.domEventHandlers({
  mousemove(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (!target) return

    const line = target.closest('.cm-line.cm-atomic-fenced-code')
    let header: HTMLElement | null = null
    if (line) {
      let prev = line.previousElementSibling as HTMLElement | null
      while (prev && prev.classList.contains('cm-line')) {
        prev = prev.previousElementSibling as HTMLElement | null
      }
      if (prev && prev.classList.contains('code-block-widget-header')) {
        header = prev
      }
    } else {
      const h = target.closest('.code-block-widget-header') as HTMLElement | null
      if (h) header = h
    }
    if (currentHoveredHeader !== header) {
      if (currentHoveredHeader) currentHoveredHeader.classList.remove('is-hovered')
      if (header) header.classList.add('is-hovered')
      currentHoveredHeader = header
    }
  },
  mouseleave() {
    if (currentHoveredHeader) {
      currentHoveredHeader.classList.remove('is-hovered')
      currentHoveredHeader = null
    }
  }
})

function buildDecorations(state: EditorState) {
  const builder = new RangeSetBuilder<Decoration>()
  const tree = syntaxTree(state)

  tree.iterate({
    enter(node) {
      if (node.name === 'FencedCode') {
        const text = state.sliceDoc(node.from, node.to)
        const firstLine = text.split('\n')[0] || ''
        const match = firstLine.match(/^(`{3,}|~{3,})\s*(\S+)?/)
        const lang = (match && match[2]) || ''

        // Exclude mermaid diagrams entirely — mermaid is handled by mermaidWidgetExtension
        if (
          lang.toLowerCase() === 'mermaid' ||
          text.startsWith('```mermaid') ||
          text.startsWith('~~~mermaid')
        ) {
          return
        }

        // Render header widget stably at the top of the block
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

export const codeBlockDecorations: Extension = StateField.define({
  create(state) {
    return buildDecorations(state)
  },
  update(decorations, tr) {
    if (tr.docChanged) return buildDecorations(tr.state)
    return decorations
  },
  provide: (f) => [EditorView.decorations.from(f), codeBlockHoverHandler]
})

export default codeBlockDecorations
