/**
 * @file editorSlashExtension.ts
 * @description CodeMirror 6 extension coordinating slash triggers, cursor coordinates, and keymap interception.
 * Provides high-precedence listeners for ArrowUp, ArrowDown, Enter, Tab, and Escape keys.
 * @module features/slash/utils/editorSlashExtension
 */

import { Prec, type Extension } from '@codemirror/state'
import { ViewPlugin, keymap, type EditorView, type ViewUpdate } from '@codemirror/view'
import { filterSlashCommands } from './slashCommands'

/**
 * Screen pixel coordinates for positioning the slash palette directly under the cursor.
 */
export interface SlashCoords {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * Global slash state structure communicated to React layer.
 */
export interface SlashState {
  isOpen: boolean
  query?: string
  from?: number
  to?: number
  selectedIndex?: number
  coords?: SlashCoords
  view?: EditorView
}

/**
 * Imperative slash handler stored in ref for zero-latency keyboard interception.
 */
export interface SlashHandler {
  isOpen: boolean
  selectedIndex: number
  query: string
  from: number
  to: number
  onArrowDown: () => void
  onArrowUp: () => void
  onEnter: () => boolean
  onClose: () => void
}

/**
 * Props for initializing the CodeMirror editor slash plugin.
 */
export interface CreateEditorSlashPluginProps {
  onSlashStateChange:
    | React.Dispatch<React.SetStateAction<SlashState>>
    | ((state: SlashState | ((prev: SlashState) => SlashState)) => void)
  slashHandlerRef?: React.MutableRefObject<SlashHandler | any>
}

/**
 * Factory function creating CodeMirror 6 extension bundle for the slash command palette.
 *
 * @param props - Configuration callbacks and ref bindings
 * @returns Array of CodeMirror extensions [high-precedence keymap, view plugin]
 */
export function createEditorSlashPlugin({
  onSlashStateChange,
  slashHandlerRef
}: CreateEditorSlashPluginProps): Extension[] {
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
      view: EditorView
      pendingCheck: number | null
      selectedIndex: number

      constructor(view: EditorView) {
        this.view = view
        this.pendingCheck = null
        this.selectedIndex = 0
        this.initSlashHandler(view)
        this.scheduleCheck(view)
      }

      initSlashHandler(view: EditorView): void {
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
              onSlashStateChange((prev: SlashState) => ({
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
              onSlashStateChange((prev: SlashState) => ({
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

      update(update: ViewUpdate): void {
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

      scheduleCheck(view: EditorView): void {
        if (this.pendingCheck) {
          cancelAnimationFrame(this.pendingCheck)
        }
        this.pendingCheck = requestAnimationFrame(() => {
          this.checkSlash(view)
        })
      }

      destroy(): void {
        if (this.pendingCheck) {
          cancelAnimationFrame(this.pendingCheck)
        }
        if (slashHandlerRef?.current) {
          slashHandlerRef.current.isOpen = false
        }
      }

      checkSlash(view: EditorView): void {
        if (!view || (view as any).isDestroyed) return
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

          if (slashHandlerRef?.current?.query !== query) {
            this.selectedIndex = 0
          }

          try {
            // Anchor coordinates directly to the exact position of the '/' character
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
