import { Decoration, ViewPlugin, WidgetType } from '@codemirror/view'
import { syntaxTree, foldable, foldedRanges, foldEffect, unfoldEffect } from '@codemirror/language'
import './collapsible.css'

class FoldWidget extends WidgetType {
  constructor(isFolded, pos) {
    super()
    this.isFolded = isFolded
    this.pos = pos
  }

  eq(other) {
    return this.isFolded === other.isFolded && this.pos === other.pos
  }

  toDOM(view) {
    const span = document.createElement('span')
    // We add 'is-folded' class for smooth CSS rotation
    span.className = `lumina-fold-chevron ${this.isFolded ? 'is-folded' : ''}`
    
    // Always render a downward chevron, and let CSS rotate it when folded!
    span.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `
    
    span.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      const line = view.state.doc.lineAt(this.pos)
      const range = foldable(view.state, line.from, line.to)
      if (range) {
        if (this.isFolded) {
          view.dispatch({ effects: unfoldEffect.of(range) })
        } else {
          view.dispatch({ effects: foldEffect.of(range) })
        }
      }
    }
    return span
  }
}

export const headingFoldPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.buildDecorations(view)
    }
    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.geometryChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }
    buildDecorations(view) {
      const builder = []
      const foldedIter = foldedRanges(view.state)

      for (let { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter(node) {
            // Target ATX headings, blockquotes, and lists
            if (
              node.name.startsWith('ATXHeading') ||
              node.name === 'Blockquote' ||
              node.name === 'BulletList' ||
              node.name === 'OrderedList'
            ) {
              // check if it's foldable
              const range = foldable(view.state, node.from, node.to)
              if (range) {
                // check if currently folded
                let isFolded = false
                foldedIter.between(node.from, node.to, (fFrom, fTo) => {
                  if (fFrom === range.from && fTo === range.to) isFolded = true
                })
                
                builder.push(
                  Decoration.widget({
                    widget: new FoldWidget(isFolded, node.from),
                    side: -1
                  }).range(node.from)
                )
              }
            }
          }
        })
      }
      return Decoration.set(builder.sort((a, b) => a.from - b.from), true)
    }
  },
  {
    decorations: (v) => v.decorations
  }
)
