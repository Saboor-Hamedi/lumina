import { syntaxTree } from '@codemirror/language'
import { Decoration, WidgetType, EditorView } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'
import mermaid from 'mermaid'
import { copyMermaidAsImage } from './mermaidAsImage'
import { openMermaidLightbox } from './mermaidBox'
import React from 'react'
import { createRoot } from 'react-dom/client'
import ToolTip from '../../components/atoms/ToolTip'
import './mermaid.css'

let mermaidIdCounter = 0

export const setEditingMermaid = StateEffect.define()

export const editingMermaidField = StateField.define({
  create() {
    return null
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setEditingMermaid)) {
        return effect.value
      }
    }

    if (value !== null) {
      const currentPos = tr.docChanged ? tr.changes.mapPos(value) : value
      const tree = syntaxTree(tr.state)
      const node = tree.resolveInner(currentPos, 1)
      let fenced = node
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

const mermaidSvgCache = new Map()

export function clearMermaidCache() {
  mermaidSvgCache.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener('theme-changed', clearMermaidCache)
}

class MermaidWidget extends WidgetType {
  constructor(code) {
    super()
    this.code = code
  }

  eq(other) {
    return other.code === this.code
  }

  toDOM(view) {
    const wrap = document.createElement('div')
    wrap.className = 'cm-mermaid-widget'

    wrap.addEventListener('mousedown', (e) => {
      if (e.target.closest('.mermaid-edit-btn')) return
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

      const handleEdit = (e) => {
        if (view.state.readOnly) return
        e.preventDefault()
        e.stopPropagation()
        const pos = view.posAtDOM(wrap)
        if (pos !== null) {
          const tree = syntaxTree(view.state)
          const node = tree.resolveInner(pos, 1)
          let fenced = node
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

      const handleCopyImage = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const svgEl = wrap.querySelector('.mermaid-scroll-wrap svg') || wrap.querySelector('svg')
        if (svgEl) {
          try {
            await copyMermaidAsImage(svgEl)
            setCopiedImage(true)
            setTimeout(() => setCopiedImage(false), 1500)
          } catch (err) {
            console.error('Failed to copy mermaid image', err)
          }
        }
      }

      const handleCopySyntax = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        try {
          const codeText = this.code ? this.code.trim() : ''
          await navigator.clipboard.writeText(codeText)
          setCopiedSyntax(true)
          setTimeout(() => setCopiedSyntax(false), 1500)
        } catch (err) {
          console.error('Failed to copy mermaid syntax', err)
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

  destroy(dom) {
    if (dom._reactRoot) {
      const root = dom._reactRoot
      setTimeout(() => root.unmount(), 0)
      dom._reactRoot = null
    }
  }
}

export function renderMermaidToElement(container, code, uniqueId) {
  const computed = getComputedStyle(document.documentElement)

  let accent = computed.getPropertyValue('--text-accent').trim()
  if (!accent) accent = '#40bafa'
  if (!accent.startsWith('#')) accent = '#' + accent

  let textFaint = computed.getPropertyValue('--text-faint').trim() || '#888888'
  let textMain = computed.getPropertyValue('--text-main').trim() || '#e0e0e0'
  let bgPrimary = computed.getPropertyValue('--bg-primary').trim() || '#121212'
  let bgPanel = computed.getPropertyValue('--bg-panel').trim() || '#1e1e1e'
  let fontEditor = computed.getPropertyValue('--font-editor').trim() || 'monospace'

  setTimeout(async () => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        useMaxWidth: false,
        htmlLabels: false,
        flowchart: { htmlLabels: false, curve: 'basis' },
        sequence: { htmlLabels: false },
        state: { htmlLabels: false },
        class: { htmlLabels: false },
        themeVariables: {
          fontFamily: fontEditor,
          primaryColor: bgPanel,
          primaryBorderColor: 'rgba(255, 255, 255, 0.1)',
          primaryTextColor: accent,
          lineColor: textFaint,
          textColor: textMain,
          mainBkg: bgPrimary,
          nodeBkg: bgPanel,
          nodeBorder: 'rgba(255, 255, 255, 0.1)',
          nodeTextColor: accent,
          clusterBkg: 'rgba(255, 255, 255, 0.02)',
          clusterBorder: 'rgba(255, 255, 255, 0.08)',
          edgeLabelBackground: bgPanel,
          actorBkg: bgPanel,
          actorBorder: 'rgba(255, 255, 255, 0.1)',
          actorTextColor: accent,
          actorLineColor: textFaint,
          signalColor: textFaint,
          signalTextColor: textMain,
          noteBkg: accent,
          noteTextColor: bgPrimary,
          noteBorderColor: 'transparent',
          labelBoxBkg: bgPanel,
          labelBoxBorderColor: 'rgba(255, 255, 255, 0.1)',
          labelTextColor: textMain,
          loopTextColor: textMain,
          activationBkgColor: accent,
          activationBorderColor: 'transparent',
          sequenceNumberColor: bgPrimary
        },
        themeCSS: `
          .node rect, .node circle, .node ellipse, .node polygon, .node path {
            stroke-width: 1px;
          }
          .node .label, .node .label text {
            font-family: ${fontEditor};
          }
        `
      })
      const { svg } = await mermaid.render(uniqueId, code)
      mermaidSvgCache.set(code, svg)
      container.innerHTML = svg
    } catch (err) {
      container.innerHTML = `<div class="mermaid-error"><strong>Mermaid Syntax Error</strong>\n${err.message}</div>`
    }
  }, 0)
}

function buildMermaidDecorations(state) {
  const widgets = []
  const tree = syntaxTree(state)
  const editingPos = state.field(editingMermaidField, false)

  tree.iterate({
    enter(node) {
      if (node.name === 'FencedCode') {
        const text = state.sliceDoc(node.from, node.to)
        if (text.startsWith('```mermaid') || text.startsWith('~~~mermaid')) {
          if (editingPos !== null && editingPos === node.from) {
            return
          }

          const lines = text.split('\n')
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
    if (tr.docChanged || prevEditing !== nextEditing || tr.effects.some((e) => e.is(setEditingMermaid))) {
      return buildMermaidDecorations(tr.state)
    }
    return value
  },
  provide: (f) => EditorView.decorations.from(f)
})

export const mermaidWidgetExtension = [editingMermaidField, mermaidDecorationsField]

export default mermaidWidgetExtension
