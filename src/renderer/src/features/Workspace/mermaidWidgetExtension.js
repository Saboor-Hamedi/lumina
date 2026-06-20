import { syntaxTree } from '@codemirror/language'
import { Decoration, WidgetType, EditorView } from '@codemirror/view'
import { StateField } from '@codemirror/state'
import mermaid from 'mermaid'

let mermaidIdCounter = 0;

class MermaidWidget extends WidgetType {
  constructor(code) {
    super()
    this.code = code
  }

  eq(other) {
    return this.code === other.code
  }

  toDOM(view) {
    const wrap = document.createElement('div')
    wrap.className = 'cm-mermaid-widget'
    wrap.style.position = 'relative'
    wrap.style.cursor = 'pointer' // Indicate it's clickable
    wrap.title = 'Click anywhere to edit diagram code'
    
    // Clicking anywhere on the widget enters edit mode
    wrap.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const pos = view.posAtDOM(wrap)
      if (pos !== null) {
        // Move cursor safely inside the fenced block (e.g., pos + 3 is past the backticks)
        view.dispatch({
          selection: { anchor: pos + 3 },
          scrollIntoView: true
        })
        view.focus()
      }
    })
    
    // Edit Button (kept for visual affordance)
    const editBtn = document.createElement('div')
    editBtn.className = 'mermaid-edit-btn'
    editBtn.innerHTML = `&lt;/&gt;`
    editBtn.title = 'Edit Code'
    
    editBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const pos = view.posAtDOM(wrap)
      if (pos !== null) {
        // Move cursor just inside the fenced block to trigger the edit mode
        view.dispatch({
          selection: { anchor: pos + 1 },
          scrollIntoView: true
        })
        view.focus()
      }
    })
    
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
    wrap.appendChild(scrollWrap)
    wrap.appendChild(editBtn)

    // We generate a unique ID for mermaid to use
    const id = `mermaid-${mermaidIdCounter++}`
    
    const computed = getComputedStyle(document.documentElement)
    
    // Try to grab the resolved hex for mermaid dynamically
    let accent = computed.getPropertyValue('--text-accent').trim()
    if (!accent) accent = '#40bafa'
    if (!accent.startsWith('#')) accent = '#' + accent

    let textFaint = computed.getPropertyValue('--text-faint').trim() || '#888888'
    let textMain = computed.getPropertyValue('--text-main').trim() || '#e0e0e0'
    let bgPrimary = computed.getPropertyValue('--bg-primary').trim() || '#121212'
    let bgPanel = computed.getPropertyValue('--bg-panel').trim() || '#1e1e1e'
    let fontEditor = computed.getPropertyValue('--font-editor').trim() || 'monospace'

    // Asynchronously render the mermaid graph
    setTimeout(async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          useMaxWidth: false,
          themeVariables: {
            fontFamily: fontEditor,
            
            // Flowcharts & General
            primaryColor: bgPanel,
            primaryBorderColor: accent,
            primaryTextColor: accent,
            lineColor: textFaint,
            textColor: textMain,
            mainBkg: bgPrimary,
            
            nodeBkg: bgPanel,
            nodeBorder: accent,
            nodeTextColor: accent,
            clusterBkg: 'transparent',
            clusterBorder: accent,
            edgeLabelBackground: bgPanel,

            // Sequence Diagrams
            actorBkg: bgPanel,
            actorBorder: accent,
            actorTextColor: accent,
            actorLineColor: textFaint,
            signalColor: textFaint,
            signalTextColor: textMain,
            noteBkg: accent,
            noteTextColor: bgPrimary,
            noteBorderColor: accent,
            labelBoxBkg: bgPanel,
            labelBoxBorderColor: accent,
            labelTextColor: textMain,
            loopTextColor: textMain,
            activationBkgColor: accent,
            activationBorderColor: accent,
            sequenceNumberColor: bgPrimary
          },
          themeCSS: `
            .node rect, .node circle, .node ellipse, .node polygon, .node path {
              fill: ${bgPanel} !important;
              stroke: ${accent} !important;
              stroke-width: 1px !important;
            }
            .node .label, .node .label text {
              color: ${accent} !important;
              fill: ${accent} !important;
            }
            .cluster rect {
              fill: transparent !important;
              stroke: ${accent} !important;
              stroke-width: 1px !important;
            }
          `
        })
        const { svg } = await mermaid.render(id, this.code)
        contentDiv.innerHTML = svg
        
        // Force the SVG to render at its exact, mathematically calculated native pixel scale.
        // This stops small diagrams from stretching to 100% and giant diagrams from shrinking to 100%.
        const svgEl = contentDiv.querySelector('svg')
        if (svgEl) {
          svgEl.removeAttribute('width')
          svgEl.style.maxWidth = 'none'
          
          const viewBox = svgEl.getAttribute('viewBox')
          if (viewBox) {
            const parts = viewBox.split(' ')
            if (parts.length === 4) {
              const nativeWidth = parseFloat(parts[2])
              // Scale down slightly (75%) to make it less overwhelming while preserving scroll
              svgEl.style.width = (nativeWidth * 0.75) + 'px'
            }
          }
        }
      } catch (err) {
        contentDiv.innerHTML = `<div class="mermaid-error"><strong>Mermaid Syntax Error</strong>\n${err.message}</div>`
      }
    }, 0)

    return wrap
  }
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
          const overlaps = selection.from <= node.to + 1 && selection.to >= node.from - 1;
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
  provide: f => EditorView.decorations.from(f)
})
