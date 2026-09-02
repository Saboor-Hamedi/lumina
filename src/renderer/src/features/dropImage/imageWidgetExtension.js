import { WidgetType, EditorView, Decoration } from '@codemirror/view'
import { StateField } from '@codemirror/state'
import './imageWidgetExtension.css'
import { attachLightbox } from './imageLightbox'
import { copyImageToClipboard } from './imageClipboard'
import { createCaptionElement } from './imageCaption'

const urlCache = new Map()

// Helper icons
const createIcon = (svgString) => {
  const template = document.createElement('template')
  template.innerHTML = svgString.trim()
  return template.content.firstChild
}

const icons = {
  left: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="12" x2="3" y2="12"></line><polyline points="8 7 3 12 8 17"></polyline><line x1="21" y1="19" x2="21" y2="5"></line></svg>`,
  center: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="12" x2="3" y2="12"></line><polyline points="8 7 3 12 8 17"></polyline><polyline points="16 17 21 12 16 7"></polyline></svg>`,
  right: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="12" x2="21" y2="12"></line><polyline points="16 7 21 12 16 17"></polyline><line x1="3" y1="19" x2="3" y2="5"></line></svg>`,
  code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  image: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`
}

export class ImageWidget extends WidgetType {
  constructor(altText, url, pos, originalLength, onUpdate = null) {
    super()
    this.altText = altText
    this.url = url
    this.pos = pos
    this.originalLength = originalLength
    this.onUpdate = onUpdate

    // Unescape markdown pipes in alt text before parsing
    const unescapedAltText = altText.replace(/\\\|/g, '|')
    this.parts = unescapedAltText.split('|')
    this.actualAlt = this.parts[0] ? this.parts[0].trim() : ''

    this.width = 'auto'
    this.align = 'center' // Default to center for images

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

  get estimatedHeight() {
    // If we have a pixel width, assume roughly similar height (or just a safe default)
    // If no width is specified, default to 300px which is a reasonable guess for an image block
    const parsedWidth = parseInt(this.width)
    if (!isNaN(parsedWidth) && this.width.includes('px')) {
      return parsedWidth * 0.75 // Assume 4:3 aspect ratio roughly
    }
    return 300
  }

  eq(other) {
    // Only return true if ALL visual properties are identical!
    // If we return false, CodeMirror calls updateDOM() to update the live elements without blinking.
    return (
      other.url === this.url &&
      other.align === this.align &&
      other.width === this.width &&
      other.actualAlt === this.actualAlt
    )
  }

  updateDOM(dom, view) {
    // Force a complete rebuild of the widget to guarantee all closures and DOM state are fresh.
    return false
  }

  toDOM(view) {
    const wrap = document.createElement('div')
    wrap.className = `cm-image-widget-wrapper align-${this.align}`
    wrap.setAttribute('contenteditable', 'false')
    wrap.__imageWidget = this

    const card = document.createElement('div')
    card.className = 'cm-image-card'
    card.setAttribute('contenteditable', 'false')

    // Prevent mousedown from bubbling up and selecting the heading above
    wrap.addEventListener('mousedown', (e) => e.stopPropagation())
    card.addEventListener('mousedown', (e) => e.stopPropagation())

    // ----------------------------------------------------------------
    // HEADER (Table-like design)
    // ----------------------------------------------------------------
    const header = document.createElement('div')
    header.className = 'image-widget-header'

    const leftGroup = document.createElement('div')
    leftGroup.className = 'image-widget-left'

    const rightGroup = document.createElement('div')
    rightGroup.className = 'image-widget-right'

    // View Mode Toggle: [ Image | Source ]
    const viewToggle = document.createElement('div')
    viewToggle.className = 'cm-table-view-toggle'

    const imageBtn = document.createElement('button')
    imageBtn.type = 'button'
    imageBtn.className = 'palette-header-btn cm-table-view-btn active'
    imageBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
      <span>Image</span>
    `
    imageBtn.setAttribute('data-tooltip', 'Rendered Image View')

    const sourceBtn = document.createElement('button')
    sourceBtn.type = 'button'
    sourceBtn.className = 'palette-header-btn cm-table-view-btn'
    sourceBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
      <span>Source</span>
    `
    sourceBtn.setAttribute('data-tooltip', 'Markdown Source View')

    viewToggle.appendChild(imageBtn)
    viewToggle.appendChild(sourceBtn)
    leftGroup.appendChild(viewToggle)

    header.appendChild(leftGroup)

    const updateImage = (newWidth, newAlign, newAltText, newUrl) => {
      let currentAltText = ''
      let currentUrl = ''
      let actualPos = 0
      let currentLen = 0

      if (this.onUpdate) {
        currentAltText = this.altText
        currentUrl = this.url
      } else {
        let pos = view.posAtDOM(wrap)
        if (pos === null && wrap.__imageWidget) pos = wrap.__imageWidget.pos
        if (pos === null || pos === undefined) return

        const docStr = view.state.doc.toString()
        const searchStart = Math.max(0, pos - 500)
        const searchEnd = Math.min(docStr.length, pos + 2000)
        const windowStr = docStr.slice(searchStart, searchEnd)

        const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
        let match
        let closestMatch = null
        let minDistance = Infinity

        while ((match = regex.exec(windowStr)) !== null) {
          if (match[2] === wrap.__imageWidget.url) {
            const matchPos = searchStart + match.index
            const distance = Math.abs(matchPos - pos)
            if (distance < minDistance) {
              minDistance = distance
              closestMatch = { match, pos: matchPos }
            }
          }
        }

        if (!closestMatch) return

        currentAltText = closestMatch.match[1]
        currentUrl = closestMatch.match[2]
        currentLen = closestMatch.match[0].length
        actualPos = closestMatch.pos
      }

      const parts = currentAltText.split('|')
      const actualAlt = newAltText !== undefined ? newAltText : (parts[0] ? parts[0].trim() : '')
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

    // Align Buttons
    const btnLeft = this.createBtn(icons.left, 'Align Left', () => updateImage(undefined, 'left'))
    if (this.align === 'left') btnLeft.classList.add('active')

    const btnCenter = this.createBtn(icons.center, 'Align Center', () =>
      updateImage(undefined, 'center')
    )
    if (this.align === 'center') btnCenter.classList.add('active')

    const btnRight = this.createBtn(icons.right, 'Align Right', () =>
      updateImage(undefined, 'right')
    )
    if (this.align === 'right') btnRight.classList.add('active')

    rightGroup.appendChild(btnLeft)
    rightGroup.appendChild(btnCenter)
    rightGroup.appendChild(btnRight)

    // Copy Image Button
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
    rightGroup.appendChild(btnCopy)

    // Delete Button
    const btnDelete = this.createBtn(icons.trash, 'Delete Image', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (view.state.readOnly) return

      if (this.onUpdate) {
        if (this.url && !this.url.startsWith('http') && !this.url.startsWith('data:')) {
          const cleanUrl = this.url.startsWith('/') ? this.url.slice(1) : this.url
          if (window.api && window.api.deleteAsset) {
            window.api.deleteAsset(cleanUrl).catch((err) => {
              if (!err.message.includes('ENOENT')) {
                console.error('Failed to delete asset:', err)
              }
            })
          }
        }
        this.onUpdate('')
        return
      }

      if (this.url && !this.url.startsWith('http') && !this.url.startsWith('data:')) {
        const cleanUrl = this.url.startsWith('/') ? this.url.slice(1) : this.url
        if (window.api && window.api.deleteAsset) {
          window.api.deleteAsset(cleanUrl).catch((err) => {
            console.error('Failed to delete asset:', err)
          })
        }
      }

      let pos = view.posAtDOM(wrap)
      if (pos === null && wrap.__imageWidget) pos = wrap.__imageWidget.pos
      if (pos === null || pos === undefined) return

      const docStr = view.state.doc.toString()
      const searchStart = Math.max(0, pos - 500)
      const searchEnd = Math.min(docStr.length, pos + 2000)
      const windowStr = docStr.slice(searchStart, searchEnd)

      const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
      let match
      let closestMatch = null
      let minDistance = Infinity

      while ((match = regex.exec(windowStr)) !== null) {
        if (match[2] === wrap.__imageWidget.url) {
          const matchPos = searchStart + match.index
          const distance = Math.abs(matchPos - pos)
          if (distance < minDistance) {
            minDistance = distance
            closestMatch = { match, pos: matchPos }
          }
        }
      }

      if (closestMatch) {
        const { match: m, pos: actualPos } = closestMatch
        const currentLen = m[0].length
        view.dispatch({
          changes: { from: actualPos, to: actualPos + currentLen, insert: '' }
        })
      }
    })
    btnDelete.classList.add('delete')
    rightGroup.appendChild(btnDelete)

    header.appendChild(rightGroup)
    card.appendChild(header)

    // ----------------------------------------------------------------
    // SOURCE CONTAINER
    // ----------------------------------------------------------------
    const sourceContainer = document.createElement('div')
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

    const stopPropagation = (e) => e.stopPropagation()
    sourceTextarea.addEventListener('keydown', stopPropagation)
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

    const caption = createCaptionElement(this.actualAlt)

    imageBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (imageBtn.classList.contains('active')) return
      imageBtn.classList.add('active')
      sourceBtn.classList.remove('active')

      const rawText = sourceTextarea.value.trim()
      const m = rawText.match(/!\[([^\]]*)\]\(([^)]+)\)/)
      if (m) {
        const newAltFull = m[1]
        const newUrl = m[2]
        const parts = newAltFull.split('|')
        const newAltText = parts[0] ? parts[0].trim() : ''
        let newWidth = undefined
        let newAlign = undefined
        for (let i = 1; i < parts.length; i++) {
          const p = parts[i].toLowerCase().trim()
          if (['left', 'center', 'right'].includes(p)) newAlign = p
          else newWidth = p
        }
        updateImage(newWidth, newAlign, newAltText, newUrl)
      }

      body.style.display = 'flex'
      sourceContainer.style.display = 'none'
      if (caption) caption.style.display = 'block'
      if (this.width !== 'auto') {
        card.style.width = this.width
        body.style.width = this.width
      } else {
        card.style.width = 'fit-content'
        body.style.width = 'auto'
      }
      if (view && view.requestMeasure) view.requestMeasure()
    })

    sourceBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (sourceBtn.classList.contains('active')) return
      sourceBtn.classList.add('active')
      imageBtn.classList.remove('active')

      const currentW = card.offsetWidth || body.offsetWidth
      if (currentW > 0) {
        card.style.width = `${currentW}px`
      }

      sourceTextarea.value = `![${this.altText}](${this.url})`
      body.style.display = 'none'
      sourceContainer.style.display = 'block'
      if (caption) caption.style.display = 'none'
      adjustHeight()
      sourceTextarea.focus()
      if (view && view.requestMeasure) view.requestMeasure()
    })

    // ----------------------------------------------------------------
    // BODY & IMAGE
    // ----------------------------------------------------------------
    const body = document.createElement('div')
    body.className = 'image-widget-body'

    const img = document.createElement('img')
    img.alt = this.actualAlt
    img.draggable = false

    attachLightbox(img)

    img.onload = () => {
      if (view && view.requestMeasure) {
        view.requestMeasure()
      }
    }

    img.onerror = () => {
      const widget = wrap.__imageWidget
      const errorDiv = document.createElement('div')
      errorDiv.className = 'image-widget-error'
      errorDiv.style.padding = '16px'
      errorDiv.style.textAlign = 'center'
      errorDiv.style.color = 'var(--text-faint, #858585)'
      errorDiv.style.fontSize = '12px'
      errorDiv.style.background = 'var(--bg-app, rgba(0,0,0,0.2))'
      errorDiv.style.borderRadius = '4px'
      errorDiv.style.border = '1px dashed var(--border-subtle, rgba(255,255,255,0.1))'
      errorDiv.innerHTML = `🖼️ Image Not Found: <code>${widget.actualAlt || widget.url}</code>`

      if (img.parentNode) {
        body.replaceChild(errorDiv, img)
      } else {
        body.appendChild(errorDiv)
      }

      if (view && view.requestMeasure) view.requestMeasure()
    }

    if (this.url && !this.url.startsWith('http') && !this.url.startsWith('data:')) {
      const cleanUrl = this.url.startsWith('/') ? this.url.slice(1) : this.url

      if (urlCache.has(this.url)) {
        urlCache
          .get(this.url)
          .then((objectUrl) => {
            if (objectUrl) {
              img.src = objectUrl
            } else {
              img.onerror()
            }
          })
          .catch(() => {
            img.onerror()
          })
      } else {
        const fetchWithRetry = async (url, retries = 3, delay = 50) => {
          if (!window.api || !window.api.readAsset) return null
          for (let i = 0; i < retries; i++) {
            try {
              const buffer = await window.api.readAsset(url)
              if (!buffer) return null
              return URL.createObjectURL(new Blob([buffer]))
            } catch (err) {
              if (i === retries - 1) return null
              await new Promise((resolve) => setTimeout(resolve, delay))
            }
          }
          return null
        }

        const fetchPromise = fetchWithRetry(cleanUrl)
        urlCache.set(this.url, fetchPromise)

        fetchPromise
          .then((objectUrl) => {
            if (objectUrl) {
              img.src = objectUrl
            } else {
              img.onerror()
            }
          })
          .catch(() => {
            img.onerror()
          })
      }
    } else {
      img.src = this.url
    }

    if (this.width !== 'auto') {
      body.style.width = this.width
      card.style.width = this.width
    }

    body.appendChild(img)

    // ----------------------------------------------------------------
    // NATIVE DRAG RESIZE HANDLE
    // ----------------------------------------------------------------
    const handle = document.createElement('div')
    handle.className = 'image-widget-resize-handle'

    handle.onmousedown = (e) => {
      if (view.state.readOnly) return
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startWidth = body.offsetWidth
      wrap.classList.add('resizing')

      const align = wrap.__imageWidget.align
      let animationFrame = null

      const onMouseMove = (moveEvent) => {
        if (animationFrame) cancelAnimationFrame(animationFrame)

        animationFrame = requestAnimationFrame(() => {
          let deltaX = moveEvent.clientX - startX

          if (align === 'center') {
            deltaX *= 2
          } else if (align === 'right') {
            deltaX = -deltaX
          }

          const newWidth = Math.max(80, startWidth + deltaX)
          body.style.width = `${newWidth}px`
          card.style.width = `${newWidth}px`
          if (view && view.requestMeasure) view.requestMeasure()
        })
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        wrap.classList.remove('resizing')

        const finalWidth = body.offsetWidth
        const widget = wrap.__imageWidget
        updateImage(`${finalWidth}px`, widget.align)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }

    body.appendChild(handle)
    card.appendChild(body)
    wrap.appendChild(card)

    if (caption) {
      wrap.appendChild(caption)
    }

    return wrap
  }

  createBtn(content, title, onClick) {
    const btn = document.createElement('button')
    btn.className = 'image-widget-btn'
    if (title) {
      btn.setAttribute('data-tooltip', title)
    }

    if (typeof content === 'string' && !content.startsWith('<')) {
      btn.innerText = content
      btn.style.fontSize = '11px'
      btn.style.fontWeight = '600'
    } else {
      btn.appendChild(typeof content === 'string' ? createIcon(content) : content)
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

  ignoreEvent() {
    return true
  }
}


function buildDecorations(state) {
  const widgets = []
  const selection = state.selection.main

  // Iterate over visible doc lines
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i)
    const text = line.text

    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
    let match
    while ((match = regex.exec(text)) !== null) {
      const matchFrom = line.from + match.index
      const matchTo = matchFrom + match[0].length

      // EXACT boundary checking.
      const intersects = selection.from < matchTo && selection.to > matchFrom

      if (intersects) {
        // Cursor is INSIDE the markdown text.
        // OBSIDIAN STYLE: Do not render the image widget, do not hide the text.
        // The text simply appears seamlessly in the editor.
      } else {
        // Cursor is OUTSIDE.
        // OBSIDIAN STYLE: Render the image block widget, and COMPLETELY HIDE the raw text.
        const widget = new ImageWidget(match[1], match[2], matchFrom, match[0].length)
        widgets.push(
          Decoration.widget({
            widget: widget,
            block: true,
            side: -1
          }).range(matchFrom)
        )

        widgets.push(
          Decoration.replace({
            inclusive: false
          }).range(matchFrom, matchTo)
        )
      }
    }
  }

  return Decoration.set(widgets, true)
}

function lineHasImageSyntax(text) {
  return text.includes('![') && text.includes('](')
}

export const imageWidgetExtension = StateField.define({
  create(state) {
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
