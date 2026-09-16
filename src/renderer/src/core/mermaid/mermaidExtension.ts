import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Decoration, WidgetType, EditorView, ViewPlugin } from '@codemirror/view'
import { StateField, StateEffect, type Extension, type Transaction } from '@codemirror/state'
import { treeGrowthEffect } from '../../features/table/tableParserProgress'
import mermaid from 'mermaid'
import { copyMermaidAsImage } from './mermaidAsImage'
import { openMermaidLightbox } from './mermaidBox'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import ToolTip from '../../components/atoms/ToolTip'
import '../../assets/mermaid.css'

let mermaidIdCounter = 0

export const setEditingMermaid = StateEffect.define<number>()

export const editingMermaidField = StateField.define<number | null>({
  create() {
    return null
  },
  update(value, tr: Transaction) {
    for (const effect of tr.effects) {
      if (effect.is(setEditingMermaid)) {
        return effect.value
      }
    }

    if (value !== null) {
      const currentPos = tr.docChanged ? tr.changes.mapPos(value) : value
      const tree = ensureSyntaxTree(tr.state, currentPos, 100) ?? syntaxTree(tr.state)
      const node = tree.resolveInner(currentPos, 1)
      let fenced: any = node
      while (fenced && fenced.name !== 'FencedCode') {
        fenced = fenced.parent
      }

      if (fenced) {
        const sel = tr.state.selection.main
        if (sel.from >= fenced.from && sel.to <= fenced.to) {
          return fenced.from
        }
      }
      return null
    }

    return null
  }
})

const mermaidSvgCache = new Map<string, string>()

export function clearMermaidCache(): void {
  mermaidSvgCache.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener('theme-changed', clearMermaidCache)
}

class MermaidWidget extends WidgetType {
  code: string

  constructor(code: string) {
    super()
    this.code = code
  }

  eq(other: MermaidWidget): boolean {
    return other.code === this.code
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div') as HTMLElement & { _reactRoot?: Root | null }
    wrap.className = 'cm-mermaid-widget'

    wrap.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement | null)?.closest('.mermaid-edit-btn')) return
      e.stopPropagation()
    })

    const header = document.createElement('div')
    header.className = 'mermaid-widget-header'
    header.setAttribute('contenteditable', 'false')

    const langLabel = document.createElement('span')
    langLabel.className = 'mermaid-widget-lang-label'
    langLabel.textContent = 'MERMAID'
    header.appendChild(langLabel)

    const actionsWrap = document.createElement('div')
    actionsWrap.style.display = 'flex'
    actionsWrap.style.alignItems = 'center'
    header.appendChild(actionsWrap)
    wrap.appendChild(header)

    const root = createRoot(actionsWrap)
    wrap._reactRoot = root

    const ActionsOverlay = () => {
      const [copiedImage, setCopiedImage] = React.useState(false)
      const [copiedSyntax, setCopiedSyntax] = React.useState(false)

      const handleEdit = (e: React.MouseEvent) => {
        if (view.state.readOnly) return
        e.preventDefault()
        e.stopPropagation()
        const pos = view.posAtDOM(wrap)
        if (pos !== null) {
          const tree = syntaxTree(view.state)
          const node = tree.resolveInner(pos, 1)
          let fenced: any = node
          while (fenced && fenced.name !== 'FencedCode') {
            fenced = fenced.parent
          }
          const from = fenced ? fenced.from : pos
          const targetPos = Math.min(from + '```mermaid\n'.length, view.state.doc.length)
          view.dispatch({
            effects: setEditingMermaid.of(from),
            selection: { anchor: targetPos },
            scrollIntoView: true
          })
          view.focus()
        }
      }

      const handleCopyImage = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const svgEl = (wrap.querySelector('.mermaid-scroll-wrap svg') || wrap.querySelector('svg')) as SVGSVGElement | null
        if (svgEl) {
          try {
            await copyMermaidAsImage(svgEl)
            setCopiedImage(true)
            setTimeout(() => setCopiedImage(false), 1500)
            window.dispatchEvent(
              new CustomEvent('show-toast', {
                detail: { message: 'Mermaid diagram copied as image', type: 'success' }
              })
            )
          } catch (err) {
            console.error('Failed to copy mermaid image', err)
            window.dispatchEvent(
              new CustomEvent('show-toast', {
                detail: { message: 'Failed to copy diagram image', type: 'error' }
              })
            )
          }
        }
      }

      const handleCopySyntax = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          const codeText = this.code ? this.code.trim() : ''
          await navigator.clipboard.writeText(codeText)
          setCopiedSyntax(true)
          setTimeout(() => setCopiedSyntax(false), 1500)
          window.dispatchEvent(
            new CustomEvent('show-toast', {
              detail: { message: 'Mermaid syntax copied to clipboard', type: 'success' }
            })
          )
        } catch (err) {
          console.error('Failed to copy mermaid syntax', err)
          window.dispatchEvent(
            new CustomEvent('show-toast', {
              detail: { message: 'Failed to copy syntax', type: 'error' }
            })
          )
        }
      }

      const editIcon = React.createElement(
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
        React.createElement('polyline', { points: '16 18 22 12 16 6' }),
        React.createElement('polyline', { points: '8 6 2 12 8 18' })
      )

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

      const editBtn = React.createElement(
        ToolTip,
        { text: 'Edit Code', position: 'top' },
        React.createElement(
          'div',
          {
            className: 'mermaid-edit-btn',
            onClick: handleEdit
          },
          editIcon
        )
      )

      const copyImageBtn = React.createElement(
        ToolTip,
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
        ToolTip,
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
        view.state.readOnly ? null : editBtn,
        copySyntaxBtn,
        copyImageBtn
      )
    }

    root.render(React.createElement(ActionsOverlay))

    const bodyWrap = document.createElement('div')
    bodyWrap.className = 'mermaid-widget-body'
    bodyWrap.removeAttribute('title')

    bodyWrap.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const svg = bodyWrap.querySelector('svg')
      if (svg) {
        openMermaidLightbox(svg)
      }
    })

    const scrollWrap = document.createElement('div')
    scrollWrap.className = 'mermaid-scroll-wrap'

    const contentDiv = document.createElement('div')
    contentDiv.className = 'mermaid-content'

    const cachedSvg = mermaidSvgCache.get(this.code)
    if (cachedSvg) {
      contentDiv.innerHTML = cachedSvg
    } else {
      contentDiv.innerHTML = `
        <div class="mermaid-loading">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          Rendering...
        </div>
      `
      const id = `mermaid-${mermaidIdCounter++}`
      renderMermaidToElement(contentDiv, this.code, id)
    }

    scrollWrap.appendChild(contentDiv)
    bodyWrap.appendChild(scrollWrap)
    wrap.appendChild(bodyWrap)
    return wrap
  }

  destroy(dom: HTMLElement & { _reactRoot?: Root | null }): void {
    if (dom._reactRoot) {
      const root = dom._reactRoot
      setTimeout(() => root.unmount(), 0)
      dom._reactRoot = null
    }
  }
}

export function renderMermaidToElement(container: HTMLElement, code: string, uniqueId: string): void {
  const computed = getComputedStyle(document.documentElement)

  let accent = computed.getPropertyValue('--text-accent').trim()
  if (!accent) accent = '#40bafa'
  if (!accent.startsWith('#') && !accent.startsWith('rgb')) accent = '#' + accent

  let textFaint = computed.getPropertyValue('--text-faint').trim() || '#888888'
  let textMain = computed.getPropertyValue('--text-main').trim() || '#e0e0e0'
  let bgPrimary = computed.getPropertyValue('--bg-app').trim() || computed.getPropertyValue('--bg-primary').trim() || '#121212'
  let bgPanel = computed.getPropertyValue('--bg-panel').trim() || computed.getPropertyValue('--bg-card').trim() || '#1e1e1e'
  let bgCard = computed.getPropertyValue('--bg-card').trim() || bgPanel
  let borderSubtle = computed.getPropertyValue('--border-subtle').trim() || computed.getPropertyValue('--border-dim').trim() || 'rgba(128, 128, 128, 0.2)'
  let borderDim = computed.getPropertyValue('--border-dim').trim() || borderSubtle
  let fontEditor = computed.getPropertyValue('--font-editor').trim() || 'monospace'

  setTimeout(async () => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        useMaxWidth: false,
        htmlLabels: false,
        flowchart: { htmlLabels: false, curve: 'basis' },
        sequence: {
          htmlLabels: false,
          mirrorActors: false,
          actorMargin: 50,
          boxMargin: 10,
          boxTextMargin: 5,
          noteMargin: 10,
          messageMargin: 35
        },
        mindmap: {
          padding: 16,
          maxNodeWidth: 200
        },
        state: { htmlLabels: false },
        class: { htmlLabels: false },
        themeVariables: {
          fontFamily: fontEditor,
          primaryColor: bgCard,
          primaryBorderColor: borderSubtle,
          primaryTextColor: accent,
          lineColor: textFaint,
          textColor: textMain,
          mainBkg: bgPrimary,
          nodeBkg: bgCard,
          nodeBorder: borderSubtle,
          nodeTextColor: accent,
          clusterBkg: bgPanel,
          clusterBorder: borderDim,
          edgeLabelBackground: bgCard,
          actorBkg: bgCard,
          actorBorder: borderSubtle,
          actorTextColor: accent,
          actorLineColor: textFaint,
          signalColor: textFaint,
          signalTextColor: textMain,
          noteBkg: accent,
          noteTextColor: bgPrimary,
          noteBorderColor: 'transparent',
          labelBoxBkg: bgCard,
          labelBoxBorderColor: borderSubtle,
          labelTextColor: textMain,
          loopTextColor: textMain,
          activationBkgColor: accent,
          activationBorderColor: 'transparent',
          sequenceNumberColor: bgPrimary,
          git0: accent,
          gitBranchLabel0: bgPrimary,
          cScale0: accent,
          cScaleLabel0: bgPrimary,
          cScale1: 'rgba(255, 255, 255, 0.06)',
          cScaleLabel1: textMain,
          cScale2: 'rgba(255, 255, 255, 0.04)',
          cScaleLabel2: textMain,
          cScale3: 'rgba(255, 255, 255, 0.04)',
          cScaleLabel3: textMain,
          cScale4: 'rgba(255, 255, 255, 0.04)',
          cScaleLabel4: textMain,
          cScale5: 'rgba(255, 255, 255, 0.04)',
          cScaleLabel5: textMain
        },
        themeCSS: `
          .node rect, .node circle, .node ellipse, .node polygon, .node path {
            stroke-width: 1px;
          }
          .node .label, .node .label text {
            font-family: ${fontEditor};
          }
          /* Mindmap sleek nodes & lines styling */
          .mindmap-node rect,
          .mindmap-node circle,
          .mindmap-node polygon,
          .mindmap-node path {
            rx: 6px !important;
            ry: 6px !important;
            stroke-width: 1px !important;
            stroke: rgba(255, 255, 255, 0.12) !important;
          }
          .mindmap-node.section-root rect,
          .mindmap-node.section-root circle,
          .mindmap-node.section-root polygon {
            fill: ${accent} !important;
            rx: 8px !important;
            ry: 8px !important;
            stroke: transparent !important;
          }
          .mindmap-node.section-root text,
          .mindmap-node.section-root tspan {
            fill: ${bgPrimary} !important;
            font-weight: 600 !important;
          }
          .mindmap-node:not(.section-root) rect,
          .mindmap-node:not(.section-root) circle,
          .mindmap-node:not(.section-root) polygon {
            fill: ${bgPanel} !important;
            stroke: rgba(255, 255, 255, 0.12) !important;
          }
          .mindmap-node:not(.section-root) text,
          .mindmap-node:not(.section-root) tspan {
            fill: ${textMain} !important;
            font-size: 13px !important;
          }
          .mindmap-edges path,
          path.edge {
            stroke: ${textFaint} !important;
            stroke-width: 1.5px !important;
            stroke-opacity: 0.7 !important;
            fill: none !important;
          }
          /* Sequence diagram actor & figure styling */
          rect.actor {
            fill: ${bgPanel} !important;
            stroke: rgba(255, 255, 255, 0.15) !important;
            rx: 4px !important;
            ry: 4px !important;
          }
          text.actor, text.actor > tspan {
            fill: ${accent} !important;
            font-family: ${fontEditor} !important;
          }
          line.actor-line {
            stroke: ${textFaint} !important;
            stroke-width: 1px !important;
            stroke-dasharray: 4, 4;
            stroke-opacity: 0.6;
          }
        `
      })
      const { svg } = await mermaid.render(uniqueId, code)
      mermaidSvgCache.set(code, svg)
      container.innerHTML = svg
    } catch (err: any) {
      container.innerHTML = `<div class="mermaid-error"><strong>Mermaid Syntax Error</strong>\n${err?.message || err}</div>`
    }
  }, 0)
}

export const refreshMermaidEffect = StateEffect.define<null>()

const mermaidTreeWatcher = ViewPlugin.fromClass(
  class {
    view: EditorView
    _idleHandle: number | null
    _destroyed: boolean

    constructor(view: EditorView) {
      this.view = view
      this._idleHandle = null
      this._destroyed = false
      this._check(view.state)
    }

    update(update: any) {
      if (update.docChanged || update.viewportChanged) {
        this._check(update.state)
      }
    }

    destroy() {
      this._destroyed = true
      if (this._idleHandle !== null) {
        cancelAnimationFrame(this._idleHandle)
        this._idleHandle = null
      }
    }

    _check(state: any) {
      const tree = syntaxTree(state)
      if (tree.length < state.doc.length) {
        if (this._idleHandle !== null) return
        this._idleHandle = requestAnimationFrame(() => {
          this._idleHandle = null
          if (this._destroyed) return
          const ensured = ensureSyntaxTree(this.view.state, this.view.state.doc.length, 150)
          if (ensured) {
            this.view.dispatch({ effects: refreshMermaidEffect.of(null) })
          } else {
            this._check(this.view.state)
          }
        })
      }
    }
  }
)

function buildMermaidDecorations(state: any) {
  const widgets: any[] = []
  const tree = ensureSyntaxTree(state, state.doc.length, 250) ?? syntaxTree(state)
  const editingPos = state.field(editingMermaidField, false)

  tree.iterate({
    enter(node: any) {
      if (node.name === 'FencedCode') {
        const text = state.sliceDoc(node.from, node.to)
        const firstLine = (text.split(/\r?\n/)[0] || '').trim()
        if (/^(`{3,}|~{3,})\s*mermaid\b/i.test(firstLine)) {
          if (editingPos !== null && editingPos === node.from) {
            return
          }

          const lines = text.split(/\r?\n/)
          const codeLines = lines.slice(1, -1)
          const code = codeLines.join('\n').trim()

          if (code) {
            const deco = Decoration.replace({
              widget: new MermaidWidget(code),
              block: true
            })
            widgets.push(deco.range(node.from, node.to))
          }
        }
      }
    }
  })

  return Decoration.set(widgets, true)
}

const mermaidDecorationsField = StateField.define({
  create(state) {
    return buildMermaidDecorations(state)
  },
  update(value, tr) {
    const prevEditing = tr.startState.field(editingMermaidField, false)
    const nextEditing = tr.state.field(editingMermaidField, false)
    if (
      tr.docChanged ||
      prevEditing !== nextEditing ||
      tr.effects.some(
        (e) =>
          e.is(setEditingMermaid) ||
          e.is(refreshMermaidEffect) ||
          e.is(treeGrowthEffect)
      )
    ) {
      return buildMermaidDecorations(tr.state)
    }
    return value
  },
  provide: (f) => EditorView.decorations.from(f)
})

export const mermaidWidgetExtension: Extension = [
  editingMermaidField,
  mermaidDecorationsField,
  mermaidTreeWatcher
]

export default mermaidWidgetExtension
