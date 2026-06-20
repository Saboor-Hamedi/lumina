import { WidgetType, EditorView, Decoration, MatchDecorator, ViewPlugin } from '@codemirror/view'

class ImageWidget extends WidgetType {
  constructor(altText, url, pos, view) {
    super()
    this.altText = altText
    this.url = url
    this.pos = pos
    this.view = view

    // Parse alt text for styling e.g., ![alt|300x200|center]
    this.parts = altText.split('|')
    this.actualAlt = this.parts[0] || ''

    this.width = 'auto'
    this.align = 'left'

    // Simple heuristic: if part contains a number it might be width, if it contains left/center/right it's align
    for (let i = 1; i < this.parts.length; i++) {
      const part = this.parts[i].toLowerCase()
      if (['left', 'center', 'right'].includes(part)) {
        this.align = part
      } else if (/^\d+(x\d+)?$/.test(part) || /^\d+%$/.test(part) || /^\d+px$/.test(part)) {
        this.width = part.includes('x')
          ? part.split('x')[0] + 'px'
          : !isNaN(part)
            ? part + 'px'
            : part
      }
    }
  }

  eq(other) {
    return other.url === this.url && other.altText === this.altText
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = `cm-image-widget-wrapper align-${this.align}`
    wrap.style.position = 'relative'

    if (this.align === 'center') {
      wrap.style.display = 'flex'
      wrap.style.justifyContent = 'center'
      wrap.style.margin = '10px 0'
      wrap.style.width = '100%'
    } else if (this.align === 'right') {
      wrap.style.display = 'flex'
      wrap.style.justifyContent = 'flex-end'
      wrap.style.margin = '10px 0'
      wrap.style.width = '100%'
    } else {
      wrap.style.display = 'inline-block'
      wrap.style.margin = '2px 4px 2px 0'
      wrap.style.verticalAlign = 'middle'
    }

    const img = document.createElement('img')
    img.alt = this.actualAlt
    img.style.maxWidth = '100%'
    img.style.borderRadius = '4px'
    img.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'

    // Completely bypass Chromium URL parser/CSP bugs using IPC binary transfer
    if (this.url && !this.url.startsWith('http') && !this.url.startsWith('data:')) {
      if (window.api && window.api.readAsset) {
        window.api
          .readAsset(this.url)
          .then((buffer) => {
            const blob = new Blob([buffer])
            img.src = URL.createObjectURL(blob)
          })
          .catch((err) => {
            console.error('[ImageWidget] IPC Fetch error:', err)
          })
      } else {
        img.src = `asset://local/${this.url}`
      }
    } else {
      img.src = this.url
    }

    if (this.width !== 'auto') {
      img.style.width = this.width
    }

    wrap.appendChild(img)

    // Interaction Toolbar (shown on hover)
    const toolbar = document.createElement('div')
    toolbar.className = 'cm-image-toolbar'
    toolbar.style.position = 'absolute'
    toolbar.style.top = '4px'
    toolbar.style.right = '4px'
    toolbar.style.display = 'none'
    toolbar.style.gap = '4px'
    toolbar.style.background = 'rgba(0,0,0,0.6)'
    toolbar.style.padding = '4px'
    toolbar.style.borderRadius = '4px'

    const alignLeftBtn = this.createBtn('⬅️', 'Left Align')
    const alignCenterBtn = this.createBtn('↔️', 'Center Align')
    const alignRightBtn = this.createBtn('➡️', 'Right Align')
    const resizeSmallBtn = this.createBtn('S', 'Small')
    const resizeMediumBtn = this.createBtn('M', 'Medium')
    const resizeLargeBtn = this.createBtn('L', 'Large')

    const updateImage = (newWidth, newAlign) => {
      const parts = [this.actualAlt]
      if (newWidth) parts.push(newWidth)
      if (newAlign) parts.push(newAlign)

      const newAlt = parts.join('|')
      const newText = `![${newAlt}](${this.url})`

      // Calculate length of the old markdown text
      const oldLength = `![${this.altText}](${this.url})`.length

      this.view.dispatch({
        changes: { from: this.pos, to: this.pos + oldLength, insert: newText }
      })
    }

    alignLeftBtn.onclick = () =>
      updateImage(this.width !== 'auto' ? parseInt(this.width) : null, 'left')
    alignCenterBtn.onclick = () =>
      updateImage(this.width !== 'auto' ? parseInt(this.width) : null, 'center')
    alignRightBtn.onclick = () =>
      updateImage(this.width !== 'auto' ? parseInt(this.width) : null, 'right')

    resizeSmallBtn.onclick = () => updateImage('200', this.align)
    resizeMediumBtn.onclick = () => updateImage('400', this.align)
    resizeLargeBtn.onclick = () => updateImage('800', this.align)

    toolbar.append(
      alignLeftBtn,
      alignCenterBtn,
      alignRightBtn,
      resizeSmallBtn,
      resizeMediumBtn,
      resizeLargeBtn
    )
    wrap.appendChild(toolbar)

    wrap.onmouseenter = () => (toolbar.style.display = 'flex')
    wrap.onmouseleave = () => (toolbar.style.display = 'none')

    return wrap
  }

  createBtn(text, title) {
    const btn = document.createElement('button')
    btn.innerText = text
    btn.title = title
    btn.style.background = 'transparent'
    btn.style.border = 'none'
    btn.style.color = 'white'
    btn.style.cursor = 'pointer'
    btn.style.fontSize = '12px'
    btn.style.padding = '2px 4px'
    btn.style.borderRadius = '2px'
    btn.onmouseover = () => (btn.style.background = 'rgba(255,255,255,0.2)')
    btn.onmouseout = () => (btn.style.background = 'transparent')
    return btn
  }

  ignoreEvent() {
    return false
  }
}

function buildDecorations(view) {
  const widgets = []
  const selection = view.state.selection

  // Iterate line by line to prevent regex from matching across line breaks
  for (let { from, to } of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(from).number
    const endLine = view.state.doc.lineAt(to).number

    for (let i = startLine; i <= endLine; i++) {
      const line = view.state.doc.line(i)
      const text = line.text

      const regex = /!\[([^\]]*)\]\(([^)]+)\)/g
      let match
      while ((match = regex.exec(text)) !== null) {
        const matchFrom = line.from + match.index
        const matchTo = matchFrom + match[0].length

        // Check if cursor intersects this match
        let intersects = false
        for (const range of selection.ranges) {
          if (range.from <= matchTo && range.to >= matchFrom) {
            intersects = true
            break
          }
        }

        // If cursor is NOT inside the markdown text, hide it and show the widget
        if (!intersects) {
          widgets.push(
            Decoration.replace({
              widget: new ImageWidget(match[1], match[2], matchFrom, view)
            }).range(matchFrom, matchTo)
          )
        }
      }
    }
  }

  return Decoration.set(widgets, true)
}

export const imageWidgetExtension = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildDecorations(view)
    }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
)
