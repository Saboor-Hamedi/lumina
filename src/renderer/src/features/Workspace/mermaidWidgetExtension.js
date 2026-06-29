import { syntaxTree } from '@codemirror/language'
import { Decoration, WidgetType, EditorView } from '@codemirror/view'
import { StateField } from '@codemirror/state'
import mermaid from 'mermaid'
import { getMermaidPngBlob } from './copyMermaidAsImage'
import React from 'react'
import { createRoot } from 'react-dom/client'
import ToolTip from '../../components/atoms/ToolTip'
import './mermaidCodeWrapper.css'

let mermaidIdCounter = 0

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

    // Clicking anywhere on the widget enters edit mode
    wrap.addEventListener('click', (e) => {
      if (view.state.readOnly) return
      // Ignore clicks on buttons
      if (e.target.closest('.mermaid-edit-btn')) return
      
      const pos = view.posAtDOM(wrap)
      if (pos !== null) {
        view.dispatch({ selection: { anchor: pos + 1 }, scrollIntoView: true })
        view.focus()
      }
    })

    // Header Bar (Like CodeWrapper)
    const header = document.createElement('div')
    header.className = 'mermaid-widget-header'

    const langLabel = document.createElement('span')
    langLabel.className = 'mermaid-widget-lang-label'
    langLabel.textContent = 'MERMAID'
    header.appendChild(langLabel)

    // Action Buttons Container (Rendered via React to support ToolTip)
    const actionsWrap = document.createElement('div')
    actionsWrap.style.display = 'flex'
    actionsWrap.style.alignItems = 'center'
    header.appendChild(actionsWrap)
    wrap.appendChild(header)

    const root = createRoot(actionsWrap)
    wrap._reactRoot = root

    const ActionsOverlay = () => {
      const [copied, ReactSetCopied] = React.useState(false)

      const handleEdit = (e) => {
        if (view.state.readOnly) return
        e.preventDefault()
        e.stopPropagation()
        const pos = view.posAtDOM(wrap)
        if (pos !== null) {
          view.dispatch({ selection: { anchor: pos + 1 }, scrollIntoView: true })
          view.focus()
        }
      }

      const handleCopy = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const svgEl = wrap.querySelector('svg')
        if (svgEl) {
          try {
            // Pass the Promise directly to ClipboardItem so write() executes in the synchronous click context
            const blobPromise = getMermaidPngBlob(svgEl)
            const item = new ClipboardItem({ 'image/png': blobPromise })
            await navigator.clipboard.write([item])
            
            ReactSetCopied(true)
            setTimeout(() => ReactSetCopied(false), 1500)
          } catch (err) {
            console.error('Failed to copy mermaid image', err)
            window.dispatchEvent(new CustomEvent('show-toast', { 
              detail: { message: `Failed to copy diagram: ${err.message || 'Tainted canvas'}`, type: 'error' } 
            }))
          }
        }
      }

      const copyIcon = React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", style: { display: 'block' } },
        React.createElement('rect', { x: 3, y: 3, width: 18, height: 18, rx: 2, ry: 2 }),
        React.createElement('circle', { cx: 8.5, cy: 8.5, r: 1.5 }),
        React.createElement('polyline', { points: "21 15 16 10 5 21" })
      )

      const checkIcon = React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", style: { display: 'block' } },
        React.createElement('polyline', { points: "20 6 9 17 4 12" })
      )

      const editBtn = React.createElement(ToolTip, { text: 'Edit Code', position: 'top' },
        React.createElement('div', { className: 'mermaid-edit-btn', style: { position: 'static' }, onClick: handleEdit }, '</>')
      )

      const copyBtn = React.createElement(ToolTip, { text: 'Copy as Image', position: 'top' },
        React.createElement('div', { 
          className: 'mermaid-edit-btn', 
          style: { 
            position: 'static', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: copied ? '#4ade80' : undefined,
            borderColor: copied ? '#4ade80' : undefined
          }, 
          onClick: handleCopy 
        }, copied ? checkIcon : copyIcon)
      )

      return React.createElement('div', { style: { display: 'flex', gap: '8px' } }, 
        view.state.readOnly ? null : editBtn,
        copyBtn
      )
    }

    root.render(React.createElement(ActionsOverlay))

    const bodyWrap = document.createElement('div')
    bodyWrap.className = 'mermaid-widget-body'
    
    const scrollWrap = document.createElement('div')
    scrollWrap.className = 'mermaid-scroll-wrap'

    const contentDiv = document.createElement('div')
    contentDiv.className = 'mermaid-content'

    // Add a pulsing skeleton loading state with a spinner
    contentDiv.innerHTML = `
      <div class="mermaid-loading">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
        Rendering Graph...
      </div>
    `
    scrollWrap.appendChild(contentDiv)
    bodyWrap.appendChild(scrollWrap)
    wrap.appendChild(bodyWrap)

    // We generate a unique ID for mermaid to use
    const id = `mermaid-${mermaidIdCounter++}`

    renderMermaidToElement(contentDiv, this.code, id)
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
        // Prevent <foreignObject> usage which taints canvas export
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        sequence: { htmlLabels: false },
        state: { htmlLabels: false },
        class: { htmlLabels: false },
        themeVariables: {
          fontFamily: fontEditor,

          // Flowcharts & General
          primaryColor: bgPanel,
          primaryBorderColor: 'transparent',
          primaryTextColor: accent,
          lineColor: textFaint,
          textColor: textMain,
          mainBkg: bgPrimary,

          nodeBkg: bgPanel,
          nodeBorder: 'transparent',
          nodeTextColor: accent,
          clusterBkg: 'transparent',
          clusterBorder: 'transparent',
          edgeLabelBackground: bgPanel,

          // Sequence Diagrams
          actorBkg: bgPanel,
          actorBorder: 'transparent',
          actorTextColor: accent,
          actorLineColor: textFaint,
          signalColor: textFaint,
          signalTextColor: textMain,
          noteBkg: accent,
          noteTextColor: bgPrimary,
          noteBorderColor: 'transparent',
          labelBoxBkg: bgPanel,
          labelBoxBorderColor: 'transparent',
          labelTextColor: textMain,
          loopTextColor: textMain,
          activationBkgColor: accent,
          activationBorderColor: 'transparent',
          sequenceNumberColor: bgPrimary
        },
        themeCSS: `
          .node rect, .node circle, .node ellipse, .node polygon, .node path {
            fill: ${bgPanel} !important;
            stroke: transparent !important;
            stroke-width: 0px !important;
          }
          .node .label, .node .label text {
            color: ${accent} !important;
            fill: ${accent} !important;
          }
          .cluster rect {
            fill: transparent !important;
            stroke: transparent !important;
            stroke-width: 0px !important;
          }
        `
      })
      const { svg } = await mermaid.render(uniqueId, code)
      container.innerHTML = svg

      const svgEl = container.querySelector('svg')
      if (svgEl) {
        svgEl.removeAttribute('width')
        svgEl.style.maxWidth = 'none'

        const viewBox = svgEl.getAttribute('viewBox')
        if (viewBox) {
          const parts = viewBox.split(' ')
          if (parts.length === 4) {
            const nativeWidth = parseFloat(parts[2])
            svgEl.style.width = nativeWidth * 0.75 + 'px'
          }
        }
      }
    } catch (err) {
      container.innerHTML = `<div class="mermaid-error"><strong>Mermaid Syntax Error</strong>\n${err.message}</div>`
    }
  }, 0)
}

function buildMermaidDecorations(state) {
  const widgets = []
  const tree = syntaxTree(state)
  const selection = state.selection.main

  tree.iterate({
    enter(node) {
      if (node.name === 'FencedCode') {
        const text = state.sliceDoc(node.from, node.to)
        if (text.startsWith('```mermaid')) {
          // If the selection overlaps the block at all, or touches its edges, do NOT render the widget.
          // This prevents the diagram from instantly closing on you if you drag-select slightly outside the bounds,
          // and it elegantly opens the diagram as your arrow keys approach the boundaries.
          const overlaps = selection.from <= node.to + 1 && selection.to >= node.from - 1
          if (overlaps) {
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

export const mermaidWidgetExtension = StateField.define({
  create(state) {
    return buildMermaidDecorations(state)
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection) {
      return buildMermaidDecorations(tr.state)
    }
    return value
  },
  provide: (f) => EditorView.decorations.from(f)
})
