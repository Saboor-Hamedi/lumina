import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

class CalloutHeaderWidget extends WidgetType {
  constructor(type, title) {
    super()
    this.type = type.toLowerCase()
    this.title = title
  }

  eq(other) {
    return other.type === this.type && other.title === this.title
  }

  toDOM() {
    const wrap = document.createElement('span')
    wrap.className = `lumina-callout-header lumina-callout-${this.type}`
    
    const icon = document.createElement('span')
    icon.className = 'lumina-callout-icon'
    // SVG icons based on type
    if (this.type === 'note') {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`
    } else if (this.type === 'warning') {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`
    } else if (this.type === 'tip') {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`
    } else if (this.type === 'important') {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4c0-1.1.9-2 2-2"></path><path d="M20 2c1.1 0 2 .9 2 2"></path><path d="M22 8c0 1.1-.9 2-2 2"></path><path d="M16 10c-1.1 0-2-.9-2-2"></path><path d="m8.2 20.2 1.4 1.4"></path><path d="m2 22 2.8-2.8"></path><path d="m2.8 2 4.6 4.6"></path><path d="m20.2 8.2-1.4-1.4"></path></svg>`
    } else if (this.type === 'caution') {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>`
    } else {
      icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`
    }
    
    const text = document.createElement('span')
    text.className = 'lumina-callout-title'
    text.textContent = this.title || this.type.toUpperCase()
    
    wrap.appendChild(icon)
    wrap.appendChild(text)
    
    return wrap
  }
}

const calloutPlugin = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.buildDecorations(view)
  }

  update(update) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view) {
    const builder = []
    const doc = view.state.doc
    
    for (let {from, to} of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from, to,
        enter(node) {
          if (node.name === 'QuoteMark') {
            const line = doc.lineAt(node.from)
            // check if first line of quote
            const blockStart = line.text.match(/^>\s*\[!([a-zA-Z]+)\](.*)/)
            if (blockStart) {
              const type = blockStart[1]
              const title = blockStart[2].trim()
              
              // Only replace if cursor is NOT on this line
              const cursor = view.state.selection.main.head
              if (cursor < line.from || cursor > line.to) {
                const replaceFrom = line.from + line.text.indexOf('[')
                const replaceTo = line.to
                builder.push(Decoration.replace({
                  widget: new CalloutHeaderWidget(type, title)
                }).range(replaceFrom, replaceTo))
              }
              
              builder.push(Decoration.line({
                class: `lumina-callout-line lumina-callout-line-${type.toLowerCase()}`
              }).range(line.from))
            } else if (line.text.startsWith('>')) {
               // Might be continuation of a callout block, we would need a stateful parser
               // For simplicity, just style it as a blockquote
            }
          }
        }
      })
    }
    
    // Sort decorations
    return Decoration.set(builder.sort((a, b) => a.from - b.from), true)
  }
}, {
  decorations: v => v.decorations
})

export const calloutExtension = calloutPlugin
