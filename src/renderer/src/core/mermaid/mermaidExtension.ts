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
const activeEditorViews = new Set<EditorView>()
let mermaidThemeVersion = 0
let currentAccent = '#40bafa'
let currentFont = 'monospace'

function initializeMermaid(): void {
  if (typeof window === 'undefined') return
  const computed = getComputedStyle(document.documentElement)
  const raw = computed.getPropertyValue('--text-accent').trim()
  currentAccent = raw
    ? raw.startsWith('#') || raw.startsWith('rgb') ? raw : `#${raw}`
    : '#40bafa'
  currentFont = computed.getPropertyValue('--font-editor').trim() || 'monospace'

  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: 'default',
    htmlLabels: false,
    flowchart: { htmlLabels: false, curve: 'basis' },
    sequence: {
      mirrorActors: false,
      actorMargin: 50,
      boxMargin: 10,
      boxTextMargin: 5,
      noteMargin: 10,
      messageMargin: 35
    },
    mindmap: { padding: 16, maxNodeWidth: 200 },
    state: {},
    class: { htmlLabels: false },
    themeVariables: {
      fontFamily: currentFont,
      textColor: currentAccent,
      primaryTextColor: currentAccent,
      nodeTextColor: currentAccent,
      actorTextColor: currentAccent,
      signalTextColor: currentAccent,
      labelTextColor: currentAccent,
      loopTextColor: currentAccent,
      noteTextColor: currentAccent,
      taskTextColor: currentAccent,
      titleColor: currentAccent,
      gitBranchLabel0: currentAccent
    },
    themeCSS: `
      .node .label, .node .label text, .nodeLabel, .edgeLabel, .edgeLabel span, .edgeLabel p, .label, .label span, .label p, foreignObject span, foreignObject p, foreignObject div, text, tspan, p, span {
        font-family: ${currentFont} !important;
        fill: var(--text-accent, #40bafa) !important;
        color: var(--text-accent, #40bafa) !important;
      }
      text.actor, text.actor > tspan, .actor {
        fill: var(--text-accent, #40bafa) !important;
        color: var(--text-accent, #40bafa) !important;
        font-family: ${currentFont} !important;
      }
      .mindmap-node text, .mindmap-node tspan, .mindmap-node span {
        fill: var(--text-accent, #40bafa) !important;
        color: var(--text-accent, #40bafa) !important;
      }
      text.messageText, .noteText, text.loopText, .taskText {
        fill: var(--text-accent, #40bafa) !important;
        color: var(--text-accent, #40bafa) !important;
      }
      .classTitle, .classText, .state-title, .statediagram-state text, .entityBox text,
      .commit-label, .branch-label {
        fill: var(--text-accent, #40bafa) !important;
        color: var(--text-accent, #40bafa) !important;
      }
    `
  })
}

export function clearMermaidCache(): void {
  mermaidSvgCache.clear()
  mermaidThemeVersion++
  initializeMermaid() // re-initialize with new accent/font before re-renders start
  for (const view of activeEditorViews) {
    if (!view.state) continue
    try {
      view.dispatch({ effects: refreshMermaidEffect.of(null) })
    } catch {
      // view may have been destroyed
    }
  }
}

if (typeof window !== 'undefined') {
  initializeMermaid()
  window.addEventListener('theme-changed', clearMermaidCache)
  const cleanupStrayMermaid = () => {
    document.querySelectorAll('body > [id^="dmermaid"], body > svg[id^="mermaid-"]').forEach((el) => {
      el.remove()
    })
  }
  cleanupStrayMermaid()
  window.addEventListener('load', cleanupStrayMermaid)
}

class MermaidWidget extends WidgetType {
  code: string
  themeVersion: number

  constructor(code: string) {
    super()
    this.code = code
    this.themeVersion = mermaidThemeVersion
  }

  eq(other: MermaidWidget): boolean {
    return other.code === this.code && other.themeVersion === this.themeVersion
  }

  updateDOM(_dom: HTMLElement): boolean {
    return false
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div') as HTMLElement & { _reactRoot?: Root | null }
    wrap.className = 'cm-mermaid-widget'
    wrap.dataset.code = encodeURIComponent(this.code)

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
          } catch (err) {
            console.error('Failed to copy mermaid image', err)
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
        ToolTip as any,
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
      classifyMermaidDiagram(contentDiv, this.code)
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

let mermaidRenderQueue = Promise.resolve()

function classifyMermaidDiagram(container: HTMLElement, code: string): void {
  const isLR = /^\s*(flowchart|graph)\s+LR\b/i.test(code)
  const isTD = /^\s*(flowchart|graph)\s+(TD|TB)\b/i.test(code)
  const svgEl = container.querySelector('svg')
  let aspectRatio = 1
  if (svgEl) {
    const vb = svgEl.getAttribute('viewBox')
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number)
      if (parts.length === 4 && parts[3] > 0) {
        aspectRatio = parts[2] / parts[3]
      }
    }
  }

  if (isLR || aspectRatio > 2.0) {
    container.classList.add('mermaid-flowchart-lr')
    container.classList.remove('mermaid-flowchart-td')
  } else if (isTD || aspectRatio < 1.0) {
    container.classList.add('mermaid-flowchart-td')
    container.classList.remove('mermaid-flowchart-lr')
  }
}

export function renderMermaidToElement(
  container: HTMLElement,
  code: string,
  uniqueId: string,
  isRetry = false
): void {
  // Fast path: if already cached, apply immediately and never re-render (prevents scroll reload)
  const cachedSvg = mermaidSvgCache.get(code)
  if (cachedSvg) {
    container.innerHTML = cachedSvg
    classifyMermaidDiagram(container, code)
    return
  }

  // Chain into sequential queue so concurrent diagrams never collide on temporary DOM elements
  mermaidRenderQueue = mermaidRenderQueue
    .then(async () => {
      // Re-check cache in case a previous queued render produced the SVG for this code
      const alreadyCached = mermaidSvgCache.get(code)
      if (alreadyCached) {
        container.innerHTML = alreadyCached
        classifyMermaidDiagram(container, code)
        return
      }

      // Yield to the browser event loop so consecutive diagrams do not block the UI thread
      await new Promise((r) => setTimeout(r, 0))

      try {
        const isValid = await mermaid.parse(code, { suppressErrors: true })
        if (isValid === false) {
          throw new Error('Invalid Mermaid syntax')
        }

        let { svg } = await mermaid.render(uniqueId, code)

        // Force accent color variable on text elements so CSS variable changes apply live
        svg = svg.replace(/<(text|tspan)(\s[^>]*)?>/g, (match, tag, attrs = '') => {
          if (/fill\s*=/.test(attrs)) {
            attrs = attrs.replace(/fill\s*=\s*["'][^"']*["']/, 'fill="var(--text-accent, #40bafa)"')
          } else {
            attrs = attrs + ' fill="var(--text-accent, #40bafa)"'
          }
          return `<${tag}${attrs}>`
        })

        mermaidSvgCache.set(code, svg)
        container.innerHTML = svg
        classifyMermaidDiagram(container, code)

        // If CodeMirror updated or replaced the widget DOM node while asynchronous rendering was in flight,
        // also populate the live active widget(s) in the document.
        const encoded = encodeURIComponent(code)
        document.querySelectorAll<HTMLElement>(
          `.cm-mermaid-widget[data-code="${encoded}"] .mermaid-content`
        ).forEach((el) => {
          if (el !== container) {
            el.innerHTML = svg
            classifyMermaidDiagram(el, code)
          }
        })
      } catch (err: any) {
        // If transient DOM race occurred (e.g. firstChild on null), retry once cleanly
        if (!isRetry && (err?.message?.includes('firstChild') || err?.message?.includes('null'))) {
          const tempDiv = document.getElementById(`d${uniqueId}`)
          if (tempDiv && tempDiv !== container && !container.contains(tempDiv)) {
            tempDiv.remove()
          }
          const straySvg = document.body.querySelector(`:scope > #${uniqueId}, :scope > svg#${uniqueId}`)
          straySvg?.remove()
          return new Promise<void>((resolve) => {
            setTimeout(() => {
              renderMermaidToElement(container, code, uniqueId, true)
              resolve()
            }, 50)
          })
        }
        container.innerHTML = `<div class="mermaid-error"><strong>Mermaid Syntax Error</strong>\n${err?.message || err}</div>`
      } finally {
        // Clean up Mermaid's temporary scratch container from body without touching the rendered diagram
        const tempDiv = document.getElementById(`d${uniqueId}`)
        if (tempDiv && tempDiv !== container && !container.contains(tempDiv)) {
          tempDiv.remove()
        }
        // If Mermaid left a stray element directly under body, remove only that direct child
        const strayBodySvg = document.body.querySelector(`:scope > #${uniqueId}, :scope > svg#${uniqueId}`)
        strayBodySvg?.remove()
      }
    })
    .catch((err) => {
      console.error('[Mermaid] Queue execution error:', err)
    })
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
      activeEditorViews.add(view)
      this._check(view.state)
    }

    update(update: any) {
      if (update.docChanged || update.viewportChanged) {
        this._check(update.state)
      }
    }

    destroy() {
      this._destroyed = true
      activeEditorViews.delete(this.view)
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
