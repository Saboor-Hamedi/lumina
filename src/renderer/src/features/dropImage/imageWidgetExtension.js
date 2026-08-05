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
  check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
}

class ImageWidget extends WidgetType {
  constructor(altText, url, pos, originalLength) {
    super()
    this.altText = altText
    this.url = url
    this.pos = pos
    this.originalLength = originalLength

    // Parse alt text for styling e.g., ![alt|300x200|center]
    this.parts = altText.split('|')
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

  eq(other) {
    // Only return true if ALL visual properties are identical!
    // If we return false, CodeMirror calls updateDOM() to update the live elements without blinking.
    return other.url === this.url && 
           other.align === this.align && 
           other.width === this.width &&
           other.actualAlt === this.actualAlt
  }

  updateDOM(dom, view) {
    // Force a complete rebuild of the widget to guarantee all closures and DOM state are fresh.
    return false
  }

  toDOM(view) {
    const wrap = document.createElement('div')
    wrap.className = `cm-image-widget-wrapper align-${this.align}`
    wrap.__imageWidget = this

    // ----------------------------------------------------------------
    // HEADER
    // ----------------------------------------------------------------
    const header = document.createElement('div')
    header.className = 'image-widget-header'

    const title = document.createElement('div')
    title.className = 'image-widget-title'
    title.appendChild(createIcon(icons.image))
    
    const actions = document.createElement('div')
    actions.className = 'image-widget-actions'

    const updateImage = (newWidth, newAlign) => {
      let pos = view.posAtDOM(wrap)
      if (pos === null && wrap.__imageWidget) pos = wrap.__imageWidget.pos
      if (pos === null || pos === undefined) return

      const docStr = view.state.doc.toString()
      
      // Search a large window to safely find the exact markdown string.
      // We use 2000 characters to ensure long URLs or alt texts are never cut off.
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

      if (!closestMatch) return // Abort safely if somehow not found

      const currentAltText = closestMatch.match[1]
      const currentUrl = closestMatch.match[2]
      const currentLen = closestMatch.match[0].length
      const actualPos = closestMatch.pos

      const parts = currentAltText.split('|')
      const actualAlt = parts[0] ? parts[0].trim() : ''

      // Parse current width and align from the live text
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
      const newText = `![${newAlt}](${currentUrl})`

      view.dispatch({
        changes: { from: actualPos, to: actualPos + currentLen, insert: newText }
      })
    }

    // Align Buttons (Pass undefined to use current value)
    const btnLeft = this.createBtn(icons.left, 'Align Left', () => updateImage(undefined, 'left'))
    if (this.align === 'left') btnLeft.classList.add('active')
    
    const btnCenter = this.createBtn(icons.center, 'Align Center', () => updateImage(undefined, 'center'))
    if (this.align === 'center') btnCenter.classList.add('active')
    
    const btnRight = this.createBtn(icons.right, 'Align Right', () => updateImage(undefined, 'right'))
    if (this.align === 'right') btnRight.classList.add('active')

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

    // Edit Source Button
    const btnEdit = this.createBtn(icons.code, 'Edit Source', () => {
      if (view.state.readOnly) return
      const pos = view.posAtDOM(wrap)
      if (pos === null) return
      view.dispatch({ selection: { anchor: pos + 1 }, scrollIntoView: true })
      view.focus()
    })

    const separator = () => {
      const el = document.createElement('div')
      el.style.width = '1px'
      el.style.height = '12px'
      el.style.background = 'var(--border-dim)'
      el.style.margin = '0 4px'
      return el
    }

    actions.append(btnCopy, separator(), btnLeft, btnCenter, btnRight, separator(), btnEdit)
    header.append(title, actions)
    // Removed wrap.appendChild(header) so it can be placed inside the body

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
      console.error('[ImageWidget] Failed to load image at URL:', img.src)
      body.innerHTML = ''
      const errorDiv = document.createElement('div')
      errorDiv.className = 'image-widget-error'
      errorDiv.innerHTML = `❌ Image Failed to Render: ${widget.actualAlt}`
      body.appendChild(errorDiv)
      if (view && view.requestMeasure) view.requestMeasure()
    }

    if (this.url && !this.url.startsWith('http') && !this.url.startsWith('data:')) {
      const cleanUrl = this.url.startsWith('/') ? this.url.slice(1) : this.url;
      
      if (urlCache.has(this.url)) {
        urlCache.get(this.url).then(objectUrl => {
          img.src = objectUrl;
        }).catch(() => {
          img.onerror();
        });
      } else {
        const fetchPromise = window.api.readAsset(cleanUrl)
          .then((buffer) => {
            const blob = new Blob([buffer]);
            return URL.createObjectURL(blob);
          });
        urlCache.set(this.url, fetchPromise);

        fetchPromise.then(objectUrl => {
          img.src = objectUrl;
        }).catch((err) => {
          console.error('[ImageWidget] IPC readAsset failed:', err);
          img.onerror();
        });
      }
    } else {
      img.src = this.url;
    }

    if (this.width !== 'auto') {
      body.style.width = this.width // Apply width to the inner body
    }

    body.appendChild(img)
    body.appendChild(header) // Toolbar is now perfectly anchored inside the image!

    // ----------------------------------------------------------------
    // NATIVE DRAG RESIZE HANDLE
    // ----------------------------------------------------------------
    const handle = document.createElement('div')
    handle.className = 'image-widget-resize-handle'
    
    // Explicitly prevent CodeMirror from stealing focus on the handle
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
          
          // Adjust delta math to keep the resize handle perfectly pinned to the mouse cursor
          if (align === 'center') {
            deltaX *= 2
          } else if (align === 'right') {
            deltaX = -deltaX // When right aligned, moving left (negative deltaX) increases width
          }
          
          const newWidth = Math.max(50, startWidth + deltaX) // Min width 50px
          body.style.width = `${newWidth}px`
          if (view && view.requestMeasure) view.requestMeasure()
        })
      }

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        wrap.classList.remove('resizing')
        
        // Save the final width to markdown using current widget state
        const finalWidth = body.offsetWidth
        const widget = wrap.__imageWidget
        updateImage(`${finalWidth}px`, widget.align)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }

    body.appendChild(handle)
    wrap.appendChild(body)

    const caption = createCaptionElement(this.actualAlt)
    if (caption) {
      wrap.appendChild(caption)
    }

    return wrap
  }

  createBtn(content, title, onClick) {
    const btn = document.createElement('button')
    btn.className = 'image-widget-btn'
    btn.title = title
    
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

class EmptyWidget extends WidgetType {
  eq() { return true }
  toDOM() {
    return document.createElement('span')
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
            widget: new EmptyWidget(),
            inclusive: false
          }).range(matchFrom, matchTo)
        )
      }
    }
  }

  return Decoration.set(widgets, true)
}

export const imageWidgetExtension = StateField.define({
  create(state) {
    return buildDecorations(state)
  },
  update(value, tr) {
    if (tr.docChanged || tr.selection) {
      return buildDecorations(tr.state)
    }
    return value
  },
  provide: (f) => EditorView.decorations.from(f)
})
