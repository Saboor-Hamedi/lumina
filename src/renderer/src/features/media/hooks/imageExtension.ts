/**
 * =========================================================================================
 * Markdown Image Widget Extension (`imageExtension.ts`)
 * =========================================================================================
 *
 * Renders borderless inline/floated live-preview image widgets for markdown
 * `![alt|size|align](url)` tokens, matching CodeWrapper's minimal hover aesthetic:
 * - Hover-reveal floating action toolbar (Wrap Left, Center, Wrap Right, Source, Copy, Delete)
 * - Side-by-side writing and text wrapping when left- or right-aligned or placed inline
 * - Slim hover-reveal edge resize handle with live width readout during drag
 * - High-resolution pan & zoom lightbox modal via `attachLightbox`
 * =========================================================================================
 */

import { WidgetType, EditorView, Decoration, type DecorationSet } from '@codemirror/view'
import { StateField, type EditorState } from '@codemirror/state'
import '../css/imageExtension.css'
import { attachLightbox } from '../../../core/mermaid'
import { renderPulseLoaderHtml } from '../../../components/PulseLoader'
import { copyImageToClipboard } from './imageClipboard'
import { createCaptionElement } from './imageCaption'

const urlCache = new Map<string, Promise<string | null>>()

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif'
}

function inferImageMime(url: string): string {
  const clean = url.split('?')[0].split('#')[0]
  const ext = clean.split('.').pop()?.toLowerCase() || ''
  return IMAGE_MIME_BY_EXT[ext] || 'image/png'
}

function isDirectImageUrl(url: string): boolean {
  return /^(https?:|data:|blob:|asset:)/i.test(url)
}

const createIcon = (svgString: string): Node | null => {
  const template = document.createElement('template')
  template.innerHTML = svgString.trim()
  return template.content.firstChild
}

const icons = {
  left: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="12" x2="3" y2="12"></line><polyline points="8 7 3 12 8 17"></polyline><line x1="21" y1="19" x2="21" y2="5"></line></svg>`,
  center: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="12" x2="3" y2="12"></line><polyline points="8 7 3 12 8 17"></polyline><polyline points="16 17 21 12 16 7"></polyline></svg>`,
  right: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="12" x2="21" y2="12"></line><polyline points="16 7 21 12 16 17"></polyline><line x1="3" y1="19" x2="3" y2="5"></line></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`
}

function resolveLocalAssetUrl(rawUrl: string): Promise<string | null> {
  if (urlCache.has(rawUrl)) {
    return urlCache.get(rawUrl)!
  }

  const cleanUrl = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl
  const mimeType = inferImageMime(cleanUrl)

  const fetchWithRetry = async (retries = 3, delay = 50): Promise<string | null> => {
    const readAsset = (window as any).api?.readAsset
    if (!readAsset) return null

    for (let i = 0; i < retries; i++) {
      try {
        const res = await readAsset(cleanUrl)
        if (!res) return null
        if (res.dataUrl) return res.dataUrl
        if (res.buffer && !(res instanceof Uint8Array)) {
          return URL.createObjectURL(
            new Blob([res.buffer], { type: res.mimeType || mimeType })
          )
        }
        if (
          res instanceof Uint8Array ||
          res instanceof ArrayBuffer ||
          (typeof Buffer !== 'undefined' && Buffer.isBuffer(res))
        ) {
          const buf = res instanceof Uint8Array ? new Uint8Array(res) : res
          return URL.createObjectURL(new Blob([buf as BlobPart], { type: mimeType }))
        }
        return null
      } catch {
        if (i === retries - 1) return null
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
    return null
  }

  const promise = fetchWithRetry()
  urlCache.set(rawUrl, promise)
  return promise
}

export class ImageWidget extends WidgetType {
  altText: string
  url: string
  pos: number
  originalLength: number
  onUpdate: ((newText: string) => void) | null
  parts: string[]
  actualAlt: string
  width: string
  align: string
  isStandaloneLine: boolean

  constructor(
    altText: string,
    url: string,
    pos: number,
    originalLength: number,
    onUpdate: ((newText: string) => void) | null = null,
    isStandaloneLine: boolean = true
  ) {
    super()
    this.altText = altText
    this.url = url
    this.pos = pos
    this.originalLength = originalLength
    this.onUpdate = onUpdate
    this.isStandaloneLine = isStandaloneLine

    const unescapedAltText = (altText || '').replace(/\\\|/g, '|')
    this.parts = unescapedAltText.split('|')
    this.actualAlt = this.parts[0] ? this.parts[0].trim() : ''

    this.width = 'auto'
    this.align = 'center'

    for (let i = 1; i < this.parts.length; i++) {
      const part = this.parts[i].toLowerCase().trim()
      if (['left', 'center', 'right'].includes(part)) {
        this.align = part
      } else {
        const isWxH = /^\d+x\d+$/.test(part)
        const isPercent = /^\d+%$/.test(part)
        const isPx = /^\d+px$/.test(part)
        const isNum = /^\d+$/.test(part)

        if (isWxH) this.width = part.split('x')[0] + 'px'
        else if (isPercent || isPx) this.width = part
        else if (isNum) this.width = part + 'px'
      }
    }
  }

  get estimatedHeight(): number {
    const parsedWidth = parseInt(this.width, 10)
    if (!isNaN(parsedWidth) && this.width.includes('px')) {
      return parsedWidth * 0.75
    }
    return 240
  }

  eq(other: ImageWidget): boolean {
    return (
      other.url === this.url &&
      other.align === this.align &&
      other.width === this.width &&
      other.actualAlt === this.actualAlt &&
      other.isStandaloneLine === this.isStandaloneLine
    )
  }

  updateDOM(): boolean {
    return false
  }

  toDOM(view: EditorView): HTMLElement {
    const isFloated = this.align === 'left' || this.align === 'right'
    const isInline = !this.isStandaloneLine || isFloated

    const wrap = document.createElement('span') as HTMLElement & { __imageWidget?: ImageWidget }
    wrap.className = [
      'cm-image-widget-wrapper',
      `align-${this.align}`,
      isFloated ? 'is-floated' : '',
      isInline ? 'is-inline' : ''
    ]
      .filter(Boolean)
      .join(' ')
    wrap.setAttribute('contenteditable', 'false')
    wrap.__imageWidget = this

    const card = document.createElement('span')
    card.className = 'cm-image-card'
    card.setAttribute('contenteditable', 'false')

    wrap.addEventListener('mousedown', (e) => e.stopPropagation())
    card.addEventListener('mousedown', (e) => e.stopPropagation())

    const locateImageMatch = (): { altText: string; url: string; from: number; len: number } | null => {
      let pos: number | null = null
      try {
        pos = view.posAtDOM(wrap)
      } catch {
        pos = null
      }
      if ((pos === null || pos === undefined) && wrap.__imageWidget) {
        pos = wrap.__imageWidget.pos
      }
      if (pos === null || pos === undefined) return null

      const docStr = view.state.doc.toString()
      const searchStart = Math.max(0, pos - 500)
      const searchEnd = Math.min(docStr.length, pos + 2000)
      const windowStr = docStr.slice(searchStart, searchEnd)

      const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
      let match: RegExpExecArray | null = null
      let closestMatch: { match: RegExpExecArray; pos: number } | null = null
      let minDistance = Infinity

      while ((match = regex.exec(windowStr)) !== null) {
        if (match[2] === wrap.__imageWidget?.url) {
          const matchPos = searchStart + match.index
          const distance = Math.abs(matchPos - pos)
          if (distance < minDistance) {
            minDistance = distance
            closestMatch = { match, pos: matchPos }
          }
        }
      }

      if (!closestMatch) return null
      return {
        altText: closestMatch.match[1],
        url: closestMatch.match[2],
        from: closestMatch.pos,
        len: closestMatch.match[0].length
      }
    }

    const updateImage = (
      newWidth?: string,
      newAlign?: string,
      newAltText?: string,
      newUrl?: string
    ) => {
      let currentAltText = ''
      let currentUrl = ''
      let actualPos = 0
      let currentLen = 0

      if (this.onUpdate) {
        currentAltText = this.altText
        currentUrl = this.url
      } else {
        const found = locateImageMatch()
        if (!found) return
        currentAltText = found.altText
        currentUrl = found.url
        currentLen = found.len
        actualPos = found.from
      }

      const parts = currentAltText.split('|')
      const actualAlt = newAltText !== undefined ? newAltText : parts[0] ? parts[0].trim() : ''
      const finalUrl = newUrl !== undefined ? newUrl : currentUrl

      let currentWidth = 'auto'
      let currentAlign = 'center'
      for (let i = 1; i < parts.length; i++) {
        const p = parts[i].toLowerCase().trim()
        if (['left', 'center', 'right'].includes(p)) {
          currentAlign = p
        } else {
          const isWxH = /^\d+x\d+$/.test(p)
          const isPercent = /^\d+%$/.test(p)
          const isPx = /^\d+px$/.test(p)
          const isNum = /^\d+$/.test(p)
          if (isWxH) currentWidth = p.split('x')[0] + 'px'
          else if (isPercent || isPx) currentWidth = p
          else if (isNum) currentWidth = p + 'px'
        }
      }

      const finalWidth = newWidth !== undefined ? newWidth : currentWidth
      const finalAlign = newAlign !== undefined ? newAlign : currentAlign

      const newParts = [actualAlt]
      if (finalWidth && finalWidth !== 'auto') newParts.push(finalWidth)
      if (finalAlign && finalAlign !== 'center') newParts.push(finalAlign)

      const newAlt = newParts.join('|')
      const newText = `![${newAlt}](${finalUrl})`

      if (this.onUpdate) {
        this.onUpdate(newText)
        this.altText = newAlt
        this.width = finalWidth !== 'auto' ? finalWidth : 'auto'
        this.align = finalAlign
        return
      }

      view.dispatch({
        changes: { from: actualPos, to: actualPos + currentLen, insert: newText }
      })
    }

    // Floating Hover Toolbar (matches CodeWrapper compact aesthetic)
    const toolbar = document.createElement('span')
    toolbar.className = 'image-widget-toolbar'

    const btnLeft = this.createBtn(icons.left, 'Float Left & Wrap Text', () =>
      updateImage(undefined, 'left')
    )
    if (this.align === 'left') btnLeft.classList.add('active')

    const btnCenter = this.createBtn(icons.center, 'Align Center', () =>
      updateImage(undefined, 'center')
    )
    if (this.align === 'center') btnCenter.classList.add('active')

    const btnRight = this.createBtn(icons.right, 'Float Right & Wrap Text', () =>
      updateImage(undefined, 'right')
    )
    if (this.align === 'right') btnRight.classList.add('active')

    const divider = document.createElement('span')
    divider.className = 'image-widget-toolbar-divider'

    let isSourceMode = false
    const btnSource = this.createBtn(icons.code, 'Edit Markdown Source')

    const btnCopy = this.createBtn(icons.copy, 'Copy Image', () => {
      const origHtml = btnCopy.innerHTML
      copyImageToClipboard(this.url, () => {
        btnCopy.innerHTML = icons.check
        btnCopy.style.color = '#4ade80'
        setTimeout(() => {
          btnCopy.innerHTML = origHtml
          btnCopy.style.color = ''
        }, 2000)
      })
    })

    const btnDelete = this.createBtn(icons.trash, 'Delete Image', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (view.state.readOnly) return

      if (this.url && !isDirectImageUrl(this.url)) {
        const cleanUrl = this.url.startsWith('/') ? this.url.slice(1) : this.url
        if ((window as any).api?.deleteAsset) {
          ;(window as any).api.deleteAsset(cleanUrl).catch((err: any) => {
            if (!err?.message?.includes('ENOENT')) {
              console.error('Failed to delete asset:', err)
            }
          })
        }
      }

      if (this.onUpdate) {
        this.onUpdate('')
        return
      }

      const found = locateImageMatch()
      if (found) {
        view.dispatch({
          changes: { from: found.from, to: found.from + found.len, insert: '' }
        })
      }
    })
    btnDelete.classList.add('delete')

    toolbar.appendChild(btnLeft)
    toolbar.appendChild(btnCenter)
    toolbar.appendChild(btnRight)
    toolbar.appendChild(divider)
    toolbar.appendChild(btnSource)
    toolbar.appendChild(btnCopy)
    toolbar.appendChild(btnDelete)
    card.appendChild(toolbar)

    // Inline Markdown Source Editor
    const sourceContainer = document.createElement('span')
    sourceContainer.className = 'image-widget-source-container'
    sourceContainer.setAttribute('contenteditable', 'false')

    const sourceTextarea = document.createElement('textarea')
    sourceTextarea.className = 'image-widget-source-textarea'
    sourceTextarea.spellcheck = false
    sourceTextarea.value = `![${this.altText}](${this.url})`

    const adjustHeight = () => {
      sourceTextarea.style.height = 'auto'
      sourceTextarea.style.height = `${sourceTextarea.scrollHeight}px`
    }

    const stopPropagation = (e: Event) => e.stopPropagation()
    sourceTextarea.addEventListener('keyup', stopPropagation)
    sourceTextarea.addEventListener('keypress', stopPropagation)
    sourceTextarea.addEventListener('input', (e) => {
      e.stopPropagation()
      adjustHeight()
    })
    sourceTextarea.addEventListener('beforeinput', stopPropagation)
    sourceTextarea.addEventListener('paste', stopPropagation)
    sourceTextarea.addEventListener('copy', stopPropagation)
    sourceTextarea.addEventListener('cut', stopPropagation)
    sourceTextarea.addEventListener('mousedown', stopPropagation)
    sourceTextarea.addEventListener('mouseup', stopPropagation)
    sourceTextarea.addEventListener('pointerdown', stopPropagation)
    sourceTextarea.addEventListener('pointerup', stopPropagation)
    sourceTextarea.addEventListener('click', stopPropagation)
    sourceTextarea.addEventListener('focus', stopPropagation)
    sourceTextarea.addEventListener('blur', stopPropagation)

    sourceContainer.addEventListener('mousedown', stopPropagation)
    sourceContainer.addEventListener('pointerdown', stopPropagation)
    sourceContainer.addEventListener('click', stopPropagation)
    sourceContainer.appendChild(sourceTextarea)
    card.appendChild(sourceContainer)

    // Body & Image
    const body = document.createElement('span')
    body.className = 'image-widget-body'

    const caption = createCaptionElement(this.actualAlt)

    const toggleSourceMode = (commit: boolean) => {
      if (!isSourceMode) {
        isSourceMode = true
        btnSource.classList.add('active')
        wrap.classList.add('is-source-mode')
        const currentW = card.offsetWidth || body.offsetWidth
        if (currentW > 0) {
          card.style.width = `${Math.max(240, currentW)}px`
        }
        sourceTextarea.value = `![${this.altText}](${this.url})`
        body.style.display = 'none'
        sourceContainer.style.display = 'block'
        if (caption) caption.style.display = 'none'
        adjustHeight()
        sourceTextarea.focus()
        if (view?.requestMeasure) view.requestMeasure()
      } else {
        isSourceMode = false
        btnSource.classList.remove('active')
        wrap.classList.remove('is-source-mode')
        if (commit) {
          const rawText = sourceTextarea.value.trim()
          const m = rawText.match(/!\[([^\]]*)\]\(([^)]+)\)/)
          if (m) {
            const parts = m[1].split('|')
            const newAltText = parts[0] ? parts[0].trim() : ''
            let newWidth: string | undefined = undefined
            let newAlign: string | undefined = undefined
            for (let i = 1; i < parts.length; i++) {
              const p = parts[i].toLowerCase().trim()
              if (['left', 'center', 'right'].includes(p)) newAlign = p
              else newWidth = p
            }
            updateImage(newWidth, newAlign, newAltText, m[2])
          }
        }
        sourceContainer.style.display = 'none'
        body.style.display = 'flex'
        if (caption) caption.style.display = 'block'
        if (this.width !== 'auto') {
          card.style.width = this.width
          body.style.width = this.width
        } else {
          card.style.width = 'fit-content'
          body.style.width = 'auto'
        }
        if (view?.requestMeasure) view.requestMeasure()
      }
    }

    sourceTextarea.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        toggleSourceMode(false)
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        toggleSourceMode(true)
      }
    })

    btnSource.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      toggleSourceMode(isSourceMode)
    })

    const img = document.createElement('img')
    img.alt = this.actualAlt
    img.decoding = 'async'
    img.draggable = false
    attachLightbox(img)

    const showImageError = () => {
      const widget = wrap.__imageWidget
      const errorDiv = document.createElement('div')
      errorDiv.className = 'image-widget-error'
      const codeEl = document.createElement('code')
      codeEl.textContent = widget?.actualAlt || widget?.url || 'image'
      const msg = document.createElement('span')
      msg.textContent = 'Image Not Found: '
      msg.appendChild(codeEl)
      errorDiv.appendChild(msg)

      loadingEl?.remove()
      if (img.parentNode) {
        body.replaceChild(errorDiv, img)
      } else {
        body.appendChild(errorDiv)
      }
      if (view?.requestMeasure) view.requestMeasure()
    }

    let loadingEl: HTMLElement | null = null

    img.onload = () => {
      loadingEl?.remove()
      loadingEl = null
      img.style.display = 'block'
      if (view?.requestMeasure) view.requestMeasure()
    }

    img.onerror = () => {
      showImageError()
    }

    if (this.url && !isDirectImageUrl(this.url)) {
      loadingEl = document.createElement('span')
      loadingEl.className = 'image-widget-loading'
      loadingEl.innerHTML = renderPulseLoaderHtml('', 'xs', true)
      img.style.display = 'none'
      body.appendChild(loadingEl)
      body.appendChild(img)

      resolveLocalAssetUrl(this.url)
        .then((objectUrl) => {
          if (objectUrl) {
            img.src = objectUrl
          } else {
            showImageError()
          }
        })
        .catch(() => {
          showImageError()
        })
    } else {
      img.src = this.url
      body.appendChild(img)
    }

    if (this.width !== 'auto') {
      body.style.width = this.width
      card.style.width = this.width
    }

    // Slim Edge Resize Handle + Live Width Badge
    const sizeBadge = document.createElement('span')
    sizeBadge.className = 'image-widget-size-badge'

    const handle = document.createElement('span')
    handle.className = 'image-widget-resize-handle'
    handle.setAttribute('aria-label', 'Resize image')

    handle.onmousedown = (e: MouseEvent) => {
      if (view.state.readOnly) return
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startWidth = body.offsetWidth || img.naturalWidth || 240
      wrap.classList.add('resizing')

      const align = wrap.__imageWidget?.align || 'center'
      sizeBadge.textContent = `${Math.round(startWidth)}px`
      let animationFrame: number | null = null

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (animationFrame) cancelAnimationFrame(animationFrame)
        animationFrame = requestAnimationFrame(() => {
          let deltaX = moveEvent.clientX - startX
          if (align === 'center') {
            deltaX *= 2
          } else if (align === 'right') {
            deltaX = -deltaX
          }

          const newWidth = Math.max(80, Math.round(startWidth + deltaX))
          body.style.width = `${newWidth}px`
          card.style.width = `${newWidth}px`
          sizeBadge.textContent = `${newWidth}px`
          if (view?.requestMeasure) view.requestMeasure()
        })
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        wrap.classList.remove('resizing')

        const finalWidth = Math.max(80, Math.round(body.offsetWidth))
        const widget = wrap.__imageWidget
        if (widget) {
          updateImage(`${finalWidth}px`, widget.align)
        }
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }

    body.appendChild(handle)
    body.appendChild(sizeBadge)
    card.appendChild(body)
    wrap.appendChild(card)

    if (caption) {
      wrap.appendChild(caption)
    }

    return wrap
  }

  createBtn(
    content: string | Node,
    title: string,
    onClick?: (e: MouseEvent) => void
  ): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'image-widget-btn'
    if (title) {
      btn.setAttribute('data-tooltip', title)
      btn.setAttribute('aria-label', title)
    }

    if (typeof content === 'string' && !content.startsWith('<')) {
      btn.innerText = content
      btn.style.fontSize = '11px'
      btn.style.fontWeight = '600'
    } else {
      btn.appendChild(typeof content === 'string' ? createIcon(content)! : content)
    }

    btn.onmousedown = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }
    btn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (onClick) onClick(e)
    }

    return btn
  }

  ignoreEvent(): boolean {
    return true
  }
}

function buildDecorations(state: EditorState): DecorationSet {
  const widgets: any[] = []
  const selection = state.selection.main

  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    const text = line.text
    if (!lineHasImageSyntax(text)) continue

    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
    let match: RegExpExecArray | null = null
    while ((match = regex.exec(text)) !== null) {
      const matchFrom = line.from + match.index
      const matchTo = matchFrom + match[0].length

      const intersects = selection.from < matchTo && selection.to > matchFrom
      if (intersects) continue

      const isStandaloneLine = text.trim() === match[0]
      const widget = new ImageWidget(match[1], match[2], matchFrom, match[0].length, null, isStandaloneLine)

      if (widget.align === 'center' && isStandaloneLine) {
        widgets.push(
          Decoration.widget({
            widget,
            block: true,
            side: -1
          }).range(matchFrom)
        )
        widgets.push(
          Decoration.replace({
            inclusive: false
          }).range(matchFrom, matchTo)
        )
      } else {
        // Inline/floated widget preserves `.cm-line` so users can type directly to the left/right
        widgets.push(
          Decoration.replace({
            widget,
            inclusive: false
          }).range(matchFrom, matchTo)
        )
      }
    }
  }

  return Decoration.set(widgets, true)
}

function lineHasImageSyntax(text: string): boolean {
  return text.includes('![') && text.includes('](')
}

export const imageWidgetExtension = StateField.define<DecorationSet>({
  create(state: EditorState) {
    return buildDecorations(state)
  },
  update(value, tr) {
    if (tr.docChanged) return buildDecorations(tr.state)
    if (tr.selection) {
      const prevPos = tr.startState.selection.main.head
      const nextPos = tr.state.selection.main.head
      const prevLine = tr.startState.doc.lineAt(prevPos)
      const nextLine = tr.state.doc.lineAt(nextPos)
      if (lineHasImageSyntax(prevLine.text) || lineHasImageSyntax(nextLine.text)) {
        return buildDecorations(tr.state)
      }
    }
    return value
  },
  provide: (f) => EditorView.decorations.from(f)
})

export default imageWidgetExtension
