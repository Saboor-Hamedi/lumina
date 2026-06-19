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
    
    // Edit Button
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
    
    const contentDiv = document.createElement('div')
    contentDiv.className = 'mermaid-content'
    contentDiv.style.width = '100%'
    contentDiv.style.display = 'flex'
    contentDiv.style.justifyContent = 'center'
    
    // Add a pulsing skeleton loading state with a spinner
    contentDiv.innerHTML = `
      <div class="mermaid-loading">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
    wrap.appendChild(contentDiv)
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

    // Asynchronously render the mermaid graph
    setTimeout(async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            fontFamily: 'var(--font-editor, monospace)',
            
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
          // If the cursor is anywhere inside the block, do NOT render the widget. 
          // Show the raw code so they can edit it blazing fast.
          if (selection.from >= node.from && selection.to <= node.to) {
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
