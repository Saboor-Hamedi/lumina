import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Decoration, WidgetType, EditorView, ViewPlugin } from '@codemirror/view'
import { StateField, StateEffect, type Extension, type Transaction } from '@codemirror/state'
import { treeGrowthEffect } from '../../features/table/tableParserProgress'
import { copyMermaidAsImage } from './mermaidAsImage'
import { openMermaidLightbox } from './mermaidBox'
import { computeMermaidFit, getMermaidNaturalSize } from './mermaidFit'
import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import ToolTip from '../../components/atoms/ToolTip'
import { renderPulseLoaderHtml } from '../../components/PulseLoader'
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
let mermaidInitializedVersion = -1
let mermaidModulePromise: Promise<any> | null = null
let mermaidInstance: any = null
let currentAccent = '#40bafa'
let currentFont = 'monospace'

function isDarkAppTheme(bgColor: string): boolean {
  const attr = document.documentElement.getAttribute('data-theme')?.toLowerCase() || ''
  if (attr.includes('light') || attr.includes('porcelain') || attr.includes('paper')) {
    return false
  }
  const hex = bgColor.trim().match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return 0.299 * r + 0.587 * g + 0.114 * b < 140
  }
  const rgb = bgColor.trim().match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) {
    const r = parseInt(rgb[1], 10)
    const g = parseInt(rgb[2], 10)
    const b = parseInt(rgb[3], 10)
    return 0.299 * r + 0.587 * g + 0.114 * b < 140
  }
  return true
}

function initializeMermaid(mermaid: any): void {
  if (typeof window === 'undefined' || !mermaid) return
  const computed = getComputedStyle(document.documentElement)
  const raw = computed.getPropertyValue('--text-accent').trim()
  currentAccent = raw
    ? raw.startsWith('#') || raw.startsWith('rgb') ? raw : `#${raw}`
    : '#40bafa'
  currentFont = computed.getPropertyValue('--font-editor').trim() || 'monospace'
  const uiFont =
    computed.getPropertyValue('--font-ui').trim() ||
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  const bgSurface = computed.getPropertyValue('--bg-surface').trim() || '#1e1e1e'
  const textMain = computed.getPropertyValue('--text-main').trim() || '#e4e4e7'
  const isDark = isDarkAppTheme(bgSurface)

  // Curated, cohesive section palette for mindmap & timeline diagrams
  // (replaces Mermaid's clashing default rainbow pastels with crisp theme-aware surfaces)
  const darkPalette = [
    '#27273a', // root / section 0 (indigo-slate)
    '#1e3246', // section 1 (ocean slate)
    '#1f3a33', // section 2 (emerald slate)
    '#3b2c44', // section 3 (plum slate)
    '#3f3122', // section 4 (amber slate)
    '#3d2430', // section 5 (rose slate)
    '#1f3640', // section 6 (teal slate)
    '#2f2d47'  // section 7 (violet slate)
  ]
  const lightPalette = [
    '#eef2ff', // root / section 0
    '#e0f2fe', // section 1
    '#dcfce7', // section 2
    '#f3e8ff', // section 3
    '#fef3c7', // section 4
    '#ffe4e6', // section 5
    '#ccfbf1', // section 6
    '#e0e7ff'  // section 7
  ]
  const darkBorders = [
    '#6366f1',
    '#38bdf8',
    '#34d399',
    '#c084fc',
    '#fbbf24',
    '#fb7185',
    '#2dd4bf',
    '#818cf8'
  ]
  const lightBorders = [
    '#6366f1',
    '#0284c7',
    '#16a34a',
    '#9333ea',
    '#d97706',
    '#e11d48',
    '#0d9488',
    '#4f46e5'
  ]
  const palette = isDark ? darkPalette : lightPalette
  const borders = isDark ? darkBorders : lightBorders
  const sectionLabelColor = isDark ? '#f4f4f5' : '#18181b'

  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: 'default',
    htmlLabels: false,
    // useMaxWidth:false removes Mermaid's inline `max-width:<natural>px` + `width:100%`,
    // which otherwise permanently caps the diagram at its intrinsic size. We size the
    // SVG ourselves (see applyMermaidFit) so it can grow and stay centered.
    flowchart: { htmlLabels: false, curve: 'basis', useMaxWidth: false },
    sequence: {
      mirrorActors: false,
      actorMargin: 50,
      boxMargin: 10,
      boxTextMargin: 5,
      noteMargin: 10,
      messageMargin: 35,
      useMaxWidth: false
    },
    gantt: { useMaxWidth: false },
    journey: { useMaxWidth: false },
    mindmap: { padding: 18, maxNodeWidth: 220, useMaxWidth: false },
    timeline: { useMaxWidth: false, padding: 18 },
    state: { useMaxWidth: false },
    class: { htmlLabels: false, useMaxWidth: false },
    er: { useMaxWidth: false },
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
      titleColor: textMain,
      gitBranchLabel0: currentAccent,
      cScale0: palette[0],
      cScale1: palette[1],
      cScale2: palette[2],
      cScale3: palette[3],
      cScale4: palette[4],
      cScale5: palette[5],
      cScale6: palette[6],
      cScale7: palette[7],
      cScale8: palette[0],
      cScale9: palette[1],
      cScale10: palette[2],
      cScale11: palette[3],
      cScalePeer0: borders[0],
      cScalePeer1: borders[1],
      cScalePeer2: borders[2],
      cScalePeer3: borders[3],
      cScalePeer4: borders[4],
      cScalePeer5: borders[5],
      cScalePeer6: borders[6],
      cScalePeer7: borders[7],
      cScalePeer8: borders[0],
      cScalePeer9: borders[1],
      cScalePeer10: borders[2],
      cScalePeer11: borders[3],
      cScaleLabel0: sectionLabelColor,
      cScaleLabel1: sectionLabelColor,
      cScaleLabel2: sectionLabelColor,
      cScaleLabel3: sectionLabelColor,
      cScaleLabel4: sectionLabelColor,
      cScaleLabel5: sectionLabelColor,
      cScaleLabel6: sectionLabelColor,
      cScaleLabel7: sectionLabelColor,
      cScaleLabel8: sectionLabelColor,
      cScaleLabel9: sectionLabelColor,
      cScaleLabel10: sectionLabelColor,
      cScaleLabel11: sectionLabelColor
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
      text.messageText, .noteText, text.loopText, .taskText {
        fill: var(--text-accent, #40bafa) !important;
        color: var(--text-accent, #40bafa) !important;
      }
      .classTitle, .classText, .state-title, .statediagram-state text, .entityBox text,
      .commit-label, .branch-label {
        fill: var(--text-accent, #40bafa) !important;
        color: var(--text-accent, #40bafa) !important;
      }
      /* Crisp high-contrast UI typography for mindmap & timeline */
      [aria-roledescription="mindmap"] text,
      [aria-roledescription="mindmap"] tspan,
      [aria-roledescription="mindmap"] .mindmap-node text,
      [aria-roledescription="mindmap"] .mindmap-node tspan,
      [aria-roledescription="mindmap"] foreignObject,
      [aria-roledescription="mindmap"] foreignObject div,
      [aria-roledescription="mindmap"] foreignObject span,
      [aria-roledescription="mindmap"] foreignObject p,
      [aria-roledescription="timeline"] text,
      [aria-roledescription="timeline"] tspan,
      [aria-roledescription="timeline"] foreignObject,
      [aria-roledescription="timeline"] foreignObject div,
      [aria-roledescription="timeline"] foreignObject span,
      [aria-roledescription="timeline"] foreignObject p {
        font-family: ${uiFont} !important;
        fill: ${sectionLabelColor} !important;
        color: ${sectionLabelColor} !important;
        font-weight: 500 !important;
      }
      [aria-roledescription="mindmap"] .section-root text,
      [aria-roledescription="mindmap"] .section-root tspan,
      [aria-roledescription="timeline"] .timeline-node text,
      [aria-roledescription="timeline"] .timeline-node tspan {
        font-weight: 600 !important;
      }
      [aria-roledescription="mindmap"] .edge {
        stroke-width: 1.75px !important;
        stroke-opacity: 0.7 !important;
      }
    `
  })
  mermaidInitializedVersion = mermaidThemeVersion
}

async function getMermaid(): Promise<any> {
  if (!mermaidInstance) {
    mermaidModulePromise ??= import('mermaid').then((mod) => mod.default)
    mermaidInstance = await mermaidModulePromise
  }
  if (mermaidInitializedVersion !== mermaidThemeVersion) {
    initializeMermaid(mermaidInstance)
  }
  return mermaidInstance
}

export function clearMermaidCache(): void {
  mermaidSvgCache.clear()
  mermaidThemeVersion++
  if (mermaidInstance) {
    initializeMermaid(mermaidInstance)
  }
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
    const wrap = document.createElement('div') as HTMLElement & {
      _reactRoot?: Root | null
      _mermaidFitObserver?: ResizeObserver | null
    }
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
      scheduleMermaidFit(contentDiv)
    } else {
      contentDiv.innerHTML = `<div class="mermaid-loading">${renderPulseLoaderHtml('', 'xs', true)}</div>`
      const id = `mermaid-${mermaidIdCounter++}`
      renderMermaidToElement(contentDiv, this.code, id)
    }

    scrollWrap.appendChild(contentDiv)
    bodyWrap.appendChild(scrollWrap)
    wrap.appendChild(bodyWrap)

    // Re-fit whenever the container resizes (pane resize, layout shift). Reading the
    // stable viewBox for natural size + a "skip if unchanged" guard prevents loops.
    if (typeof ResizeObserver !== 'undefined') {
      let fitRaf: number | null = null
      const observer = new ResizeObserver(() => {
        if (fitRaf !== null) cancelAnimationFrame(fitRaf)
        fitRaf = requestAnimationFrame(() => {
          fitRaf = null
          applyMermaidFit(contentDiv)
        })
      })
      observer.observe(scrollWrap)
      wrap._mermaidFitObserver = observer
    }

    scheduleMermaidFit(contentDiv)
    return wrap
  }

  destroy(
    dom: HTMLElement & {
      _reactRoot?: Root | null
      _mermaidFitObserver?: ResizeObserver | null
    }
  ): void {
    if (dom._mermaidFitObserver) {
      dom._mermaidFitObserver.disconnect()
      dom._mermaidFitObserver = null
    }
    if (dom._reactRoot) {
      const root = dom._reactRoot
      setTimeout(() => root.unmount(), 0)
      dom._reactRoot = null
    }
  }
}

let mermaidRenderQueue = Promise.resolve()

/**
 * Scales the rendered SVG to fill the available space of its `.mermaid-scroll-wrap`
 * container, preserving aspect ratio and centering via the container's flexbox.
 *
 * The natural size is read from the viewBox (stable), never from the live rendered
 * size, so applying the size cannot feed back into the measurement and loop.
 */
export function applyMermaidFit(container: HTMLElement): void {
  const svg = container.querySelector('svg')
  if (!svg) return
  // Never size the loading spinner (also an <svg>) as if it were a diagram.
  if (svg.closest('.mermaid-loading')) return

  const wrap = container.closest('.mermaid-scroll-wrap') as HTMLElement | null
  if (!wrap) return

  const natural = getMermaidNaturalSize(svg as SVGSVGElement)
  if (!natural) return

  const style = getComputedStyle(wrap)
  const padX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
  const roleDesc = (svg.getAttribute('aria-roledescription') || '').toLowerCase()
  const isMindmapOrTimeline =
    roleDesc === 'mindmap' ||
    roleDesc === 'timeline' ||
    Boolean(svg.querySelector('.mindmap-node, .section-root, .timeline-node, .taskWrapper'))

  const availWidth = Math.min(wrap.clientWidth - padX, isMindmapOrTimeline ? 920 : 720)
  const maxInlineHeight = isMindmapOrTimeline ? 440 : 320
  // Keep a readable minimum scale on mindmap/timeline so text never shrinks into blurry subpixels;
  // wide diagrams scroll cleanly inside `.mermaid-scroll-wrap`.
  const minReadableScale = isMindmapOrTimeline ? 0.8 : 0.15

  const fit = computeMermaidFit(
    natural.width,
    natural.height,
    availWidth,
    maxInlineHeight,
    1.0,
    minReadableScale
  )
  if (!fit) return

  const nextW = `${Math.round(fit.width)}px`
  const nextH = `${Math.round(fit.height)}px`
  if (svg.style.width === nextW && svg.style.height === nextH) return

  svg.style.maxWidth = isMindmapOrTimeline ? 'none' : '100%'
  svg.style.maxHeight = `${maxInlineHeight}px`
  svg.style.width = nextW
  svg.style.height = nextH
  if (isMindmapOrTimeline) {
    wrap.classList.add('is-rich-diagram')
  }
}

/**
 * Defers a fit to the next frame so the container has laid out (and, for cached
 * renders injected before attachment, has non-zero dimensions).
 */
export function scheduleMermaidFit(container: HTMLElement): void {
  if (typeof requestAnimationFrame !== 'function') {
    applyMermaidFit(container)
    return
  }
  requestAnimationFrame(() => {
    applyMermaidFit(container)
    // Fonts / async layout can shift intrinsic metrics slightly; settle once more.
    requestAnimationFrame(() => applyMermaidFit(container))
  })
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
    scheduleMermaidFit(container)
    return
  }

  // Chain into sequential queue so concurrent diagrams never collide on temporary DOM elements
  mermaidRenderQueue = mermaidRenderQueue
    .then(async () => {
      // Re-check cache in case a previous queued render produced the SVG for this code
      const alreadyCached = mermaidSvgCache.get(code)
      if (alreadyCached) {
        container.innerHTML = alreadyCached
        scheduleMermaidFit(container)
        return
      }

      // Yield to the browser event loop so consecutive diagrams do not block the UI thread
      await new Promise((r) => setTimeout(r, 0))

      try {
        const mermaid = await getMermaid()
        const isValid = await mermaid.parse(code, { suppressErrors: true })
        if (isValid === false) {
          throw new Error('Invalid Mermaid syntax')
        }

        let { svg } = (await mermaid.render(uniqueId, code)) as { svg: string }

        const isMindmapOrTimelineSvg =
          /aria-roledescription\s*=\s*["'](mindmap|timeline)["']/i.test(svg) ||
          /^\s*(mindmap|timeline)\b/im.test(code)

        // Force accent color variable on standard diagram text elements so CSS variable changes apply live,
        // while keeping high-contrast `--text-main` on mindmap & timeline section nodes.
        const textFillVar = isMindmapOrTimelineSvg
          ? 'var(--text-main, #e4e4e7)'
          : 'var(--text-accent, #40bafa)'
        svg = svg.replace(/<(text|tspan)(\s[^>]*)?>/g, (_match: string, tag: string, attrs = '') => {
          if (/fill\s*=/.test(attrs)) {
            attrs = attrs.replace(/fill\s*=\s*["'][^"']*["']/, `fill="${textFillVar}"`)
          } else {
            attrs = attrs + ` fill="${textFillVar}"`
          }
          return `<${tag}${attrs}>`
        })

        mermaidSvgCache.set(code, svg)
        container.innerHTML = svg
        scheduleMermaidFit(container)

        // If CodeMirror updated or replaced the widget DOM node while asynchronous rendering was in flight,
        // also populate the live active widget(s) in the document.
        const encoded = encodeURIComponent(code)
        document.querySelectorAll<HTMLElement>(
          `.cm-mermaid-widget[data-code="${encoded}"] .mermaid-content`
        ).forEach((el) => {
          if (el !== container) {
            el.innerHTML = svg
            scheduleMermaidFit(el)
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
  const doc = state.doc
  let hasMermaid = false
  for (let i = 1; i <= doc.lines; i++) {
    if (doc.line(i).text.toLowerCase().includes('mermaid')) {
      hasMermaid = true
      break
    }
  }
  if (!hasMermaid) return Decoration.none

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
