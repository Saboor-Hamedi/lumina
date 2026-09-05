/**
 * editorSlashExtension.js
 * 
 * CodeMirror 6 Extension that coordinates slash command triggers, caret positioning,
 * and high-precedence keymap interception for arrow keys, Enter, and Escape.
 */

import { Prec } from '@codemirror/state'
import { ViewPlugin, keymap } from '@codemirror/view'
import { filterSlashCommands } from './slashCommands'

export function createEditorSlashPlugin({ onSlashStateChange, slashHandlerRef }) {
  const slashKeymap = Prec.highest(
    keymap.of([
      {
        key: 'ArrowDown',
        run: () => {
          if (slashHandlerRef?.current?.isOpen) {
            slashHandlerRef.current.onArrowDown?.()
            return true
          }
          return false
        }
      },
      {
        key: 'ArrowUp',
        run: () => {
          if (slashHandlerRef?.current?.isOpen) {
            slashHandlerRef.current.onArrowUp?.()
            return true
          }
          return false
        }
      },
      {
        key: 'Enter',
        run: () => {
          if (slashHandlerRef?.current?.isOpen) {
            return Boolean(slashHandlerRef.current.onEnter?.())
          }
          return false
        }
      },
      {
        key: 'Tab',
        run: () => {
          if (slashHandlerRef?.current?.isOpen) {
            return Boolean(slashHandlerRef.current.onEnter?.())
          }
          return false
        }
      },
      {
        key: 'Escape',
        run: () => {
          if (slashHandlerRef?.current?.isOpen) {
            slashHandlerRef.current.onClose?.()
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
        this.selectedIndex = 0
        this.initSlashHandler(view)
        this.scheduleCheck(view)
      }

      initSlashHandler(view) {
        if (!slashHandlerRef) return
        slashHandlerRef.current = {
          isOpen: false,
          selectedIndex: 0,
          query: '',
          from: 0,
          to: 0,
          onArrowDown: () => {
            const query = slashHandlerRef.current.query || ''
            const filtered = filterSlashCommands(query)
            if (filtered.length > 0) {
              this.selectedIndex = (this.selectedIndex + 1) % filtered.length
              slashHandlerRef.current.selectedIndex = this.selectedIndex
              onSlashStateChange((prev) => ({
                ...prev,
                selectedIndex: this.selectedIndex
              }))
            }
          },
          onArrowUp: () => {
            const query = slashHandlerRef.current.query || ''
            const filtered = filterSlashCommands(query)
            if (filtered.length > 0) {
              this.selectedIndex = (this.selectedIndex - 1 + filtered.length) % filtered.length
              slashHandlerRef.current.selectedIndex = this.selectedIndex
              onSlashStateChange((prev) => ({
                ...prev,
                selectedIndex: this.selectedIndex
              }))
            }
          },
          onEnter: () => {
            if (!slashHandlerRef.current.isOpen) return false
            const query = slashHandlerRef.current.query || ''
            const filtered = filterSlashCommands(query)
            const idx = this.selectedIndex || 0
            const cmd = filtered[idx] || filtered[0]
            if (cmd && typeof cmd.execute === 'function') {
              const state = view.state
              const sel = state.selection?.main
              let from = slashHandlerRef.current.from
              let to = slashHandlerRef.current.to
              if (sel && sel.empty) {
                const line = state.doc.lineAt(sel.head)
                const textBefore = line.text.slice(0, sel.head - line.from)
                const slashIdx = textBefore.lastIndexOf('/')
                if (slashIdx >= 0) {
                  from = line.from + slashIdx
                  to = sel.head
                }
              }
              slashHandlerRef.current.isOpen = false
              onSlashStateChange({ isOpen: false })
              cmd.execute(view, from, to)
              return true
            }
            return false
          },
          onClose: () => {
            slashHandlerRef.current.isOpen = false
            onSlashStateChange({ isOpen: false })
          }
        }
      }

      update(update) {
        if (update.docChanged || update.selectionSet) {
          const state = update.view.state
          const sel = state.selection?.main
          let matchesSlash = false
          if (sel && sel.empty) {
            const line = state.doc.lineAt(sel.head)
            const textBefore = line.text.slice(0, sel.head - line.from)
            matchesSlash = /(?:^|\s)\/([a-zA-Z0-9_-]*)$/.test(textBefore)
          }
          if (!matchesSlash) {
            if (slashHandlerRef?.current) {
              slashHandlerRef.current.isOpen = false
            }
            onSlashStateChange({ isOpen: false })
          }
          this.scheduleCheck(update.view)
        }
      }

      scheduleCheck(view) {
        if (this.pendingCheck) {
          cancelAnimationFrame(this.pendingCheck)
        }
        this.pendingCheck = requestAnimationFrame(() => {
          this.checkSlash(view)
        })
      }

      destroy() {
        if (this.pendingCheck) {
          cancelAnimationFrame(this.pendingCheck)
        }
        if (slashHandlerRef?.current) {
          slashHandlerRef.current.isOpen = false
        }
      }

      checkSlash(view) {
        if (!view || view.isDestroyed) return
        const state = view.state
        const sel = state.selection?.main
        if (!sel || !sel.empty) {
          if (slashHandlerRef?.current) {
            slashHandlerRef.current.isOpen = false
          }
          onSlashStateChange({ isOpen: false })
          return
        }

        const line = state.doc.lineAt(sel.head)
        const textBefore = line.text.slice(0, sel.head - line.from)
        const match = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)

        if (match) {
          const query = match[1]
          const slashIdx = textBefore.lastIndexOf('/')
          const slashFrom = line.from + slashIdx
          const slashTo = sel.head
          const filtered = filterSlashCommands(query)

          if (filtered.length === 0) {
            if (slashHandlerRef?.current) {
              slashHandlerRef.current.isOpen = false
            }
            onSlashStateChange({ isOpen: false })
            return
          }

          if (slashHandlerRef?.current?.query !== query) {
            this.selectedIndex = 0
          }

          try {
            const coords = view.coordsAtPos(slashFrom) || view.coordsAtPos(sel.head)
            if (coords) {
              if (slashHandlerRef?.current) {
                slashHandlerRef.current.isOpen = true
                slashHandlerRef.current.query = query
                slashHandlerRef.current.from = slashFrom
                slashHandlerRef.current.to = slashTo
                slashHandlerRef.current.selectedIndex = this.selectedIndex
              }
              onSlashStateChange({
                isOpen: true,
                query,
                from: slashFrom,
                to: slashTo,
                selectedIndex: this.selectedIndex,
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

        if (slashHandlerRef?.current) {
          slashHandlerRef.current.isOpen = false
        }
        onSlashStateChange({ isOpen: false })
      }
    }
  )

  return [slashKeymap, plugin]
}
