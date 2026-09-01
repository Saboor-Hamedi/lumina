/**
 * editorSlashExtension.js
 * 
 * CodeMirror 6 Extension that coordinates slash command triggers, caret positioning,
 * and high-precedence keymap interception for arrow keys, Enter, and Escape.
 */

import { Prec } from '@codemirror/state'
import { ViewPlugin, keymap } from '@codemirror/view'

export function createEditorSlashPlugin({ onSlashStateChange, slashHandlerRef }) {
  const slashKeymap = Prec.highest(
    keymap.of([
      {
        key: 'ArrowDown',
        run: () => {
          if (slashHandlerRef?.current?.isOpen) {
            slashHandlerRef.current.onArrowDown()
            return true
          }
          return false
        }
      },
      {
        key: 'ArrowUp',
        run: () => {
          if (slashHandlerRef?.current?.isOpen) {
            slashHandlerRef.current.onArrowUp()
            return true
          }
          return false
        }
      },
      {
        key: 'Enter',
        run: () => {
          if (slashHandlerRef?.current?.isOpen) {
            return slashHandlerRef.current.onEnter()
          }
          return false
        }
      },
      {
        key: 'Tab',
        run: () => {
          if (slashHandlerRef?.current?.isOpen) {
            return slashHandlerRef.current.onEnter()
          }
          return false
        }
      },
      {
        key: 'Escape',
        run: () => {
          if (slashHandlerRef?.current?.isOpen) {
            slashHandlerRef.current.onClose()
            return true
          }
          return false
        }
      }
    ])
  )

  const plugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view
        this.pendingCheck = null
        this.scheduleCheck(view)
      }

      update(update) {
        if (update.docChanged || update.selectionSet) {
          this.scheduleCheck(update.view)
        }
      }

      scheduleCheck(view) {
        if (this.pendingCheck) {
          cancelAnimationFrame(this.pendingCheck)
        }
        // Defer coordinate measurement until CodeMirror completes its layout phase
        this.pendingCheck = requestAnimationFrame(() => {
          this.checkSlash(view)
        })
      }

      destroy() {
        if (this.pendingCheck) {
          cancelAnimationFrame(this.pendingCheck)
        }
      }

      checkSlash(view) {
        if (!view || view.isDestroyed) return
        const state = view.state
        const sel = state.selection?.main
        if (!sel || !sel.empty) {
          onSlashStateChange({ isOpen: false })
          return
        }

        const line = state.doc.lineAt(sel.head)
        const textBefore = line.text.slice(0, sel.head - line.from)

        // Match slash trigger: either at line start (/query) or after space ( /query)
        const match = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)

        if (match) {
          const query = match[1]
          const slashOffsetInText = textBefore.length - query.length - 1
          const slashFrom = line.from + slashOffsetInText
          const slashTo = sel.head

          // Safely read caret coordinates right at the '/' character
          try {
            const coords = view.coordsAtPos(slashFrom) || view.coordsAtPos(sel.head)
            if (coords) {
              onSlashStateChange({
                isOpen: true,
                query,
                from: slashFrom,
                to: slashTo,
                coords: {
                  top: coords.top,
                  bottom: coords.bottom,
                  left: coords.left,
                  right: coords.right
                },
                view
              })
              return
            }
          } catch {}
        }

        onSlashStateChange({ isOpen: false })
      }
    }
  )

  return [slashKeymap, plugin]
}
