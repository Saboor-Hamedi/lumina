import React, { useMemo } from 'react'
import {
  autocompletion,
  acceptCompletion,
  closeCompletion,
  completionStatus,
  moveCompletionSelection
} from '@codemirror/autocomplete'
import { Prec, StateField, StateEffect, type Extension } from '@codemirror/state'
import { EditorView, placeholder, keymap, ViewPlugin, Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown'

import {
  codeBlockDecorations,
  luminaSyntaxHighlighting,
  handleCodeFenceEnter
} from '../code'
// Media & Link Embed extensions
import { imageDropExtension, imageWidgetExtension } from '../../features/media'
import { linkEmbedExtension } from '../../features/links'
import { htmlWidgetExtension } from '../../features/Editor/extensions/htmlExtension'
import { katexExtension } from '../../features/Editor/extensions/katexExtension'
import { tagMentionExtension } from '../../features/Editor/extensions/tagMentionExtension'
import { tables } from '../../features/table/tableExtension'
import { mermaidWidgetExtension } from '../mermaid'
import { calloutExtension } from './useCallout'
import { highlightExtension } from './useHighlight'
import { useCollapsible } from '../../features/Editor/collapse/useCollapsible'
import { emptyLineSelectionFix } from './useEmptyLine'
import { handleTaskEnter, toggleTaskMark } from './useMark'
import { handleQuoteEnter } from './useQuote'
import {
  handleListEnter,
  handleListShiftEnter,
  handleListBackspace,
  indentListLines,
  outdentListLines,
  moveLinesUp,
  moveLinesDown,
  duplicateLines,
  isListLine,
  smartWrapSelectionExtension
} from './useList'
import {
  createKeymapModeCompartment,
  resolveKeymapModeExtension,
  DEFAULT_KEYMAP_MODE
} from './keymapMode'
import { getActiveShortcut, matchesShortcutEvent } from '../shortcuts/defaultShortcuts'
import { useSettingsStore } from '../store/SettingStore'
import { handleArrowUp, handleArrowDown } from './ArrowNavigation'
import { useWikilinkCompletion } from '../../features/Editor/wikilink/useWikilinkCompletion'
import { createEditorSlashPlugin } from '../../features/slash'
import { bidiExtension, isComposing } from '../i18n'
import type { Snippet, UseEditorExtensionsProps, UseEditorExtensionsReturn } from './types'
import type { ToastType } from '../notification'

export const updateSearchHighlights = StateEffect.define<any>()

const searchHighlightField = StateField.define({
  create() {
    return Decoration.none
  },
  update(decos: any, tr: any) {
    for (const e of tr.effects) {
      if (e.is(updateSearchHighlights)) {
        return e.value
      }
    }
    return decos.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f)
})

const inMemoryCursorMap = new Map<string, { anchor: number; head: number }>()

export function useEditorExtensions({
  snippetRef,
  realViewRef,
  showToast,
  isActiveRef,
  showFindWidgetRef,
  setShowFindWidget,
  setReplaceModeActive,
  onSlashStateChange,
  slashHandlerRef
}: UseEditorExtensionsProps): UseEditorExtensionsReturn {
  // --- View Capture & Cursor Persistence Plugin ---
  const captureViewPlugin = useMemo(() => {
    let saveTimeout: NodeJS.Timeout
    return ViewPlugin.fromClass(
      class {
        constructor(view: EditorView) {
          realViewRef.current = view
          setTimeout(() => {
            if (view && !(view as any).isDestroyed && snippetRef.current?.code === '') {
              view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } })
            } else if (view && !(view as any).isDestroyed && snippetRef.current?.id) {
              const savedSelection = inMemoryCursorMap.get(snippetRef.current.id)
              if (savedSelection) {
                const anchor = typeof savedSelection?.anchor === 'number' ? Math.max(0, Math.min(savedSelection.anchor, view.state.doc.length)) : null
                if (anchor !== null) {
                  const line = view.state.doc.lineAt(anchor)
                  const validPos = Math.min(anchor, line.to)
                  view.dispatch({
                    selection: { anchor: validPos, head: validPos },
                    scrollIntoView: true
                  })
                  view.focus()
                }
              }
            }
          }, 10)
        }
        update(update: any) {
          if (update.docChanged || update.selectionSet) {
            const sel = update.state.selection.main
            const { anchor, head, from, to } = sel
            if (!snippetRef.current?.id) return

            const line = update.state.doc.lineAt(head)
            window.dispatchEvent(
              new CustomEvent('editor-cursor-pos', {
                detail: {
                  snippetId: snippetRef.current.id,
                  line: line.number,
                  col: head - line.from + 1,
                  selectedChars: Math.abs(to - from)
                }
              })
            )

            clearTimeout(saveTimeout)
            saveTimeout = setTimeout(() => {
              if (snippetRef.current?.id) {
                inMemoryCursorMap.set(snippetRef.current.id, { anchor, head })
              }
            }, 300)

            const hasExplicitScroll = update.transactions.some((tr: any) => tr.scrollIntoView)
            if (hasExplicitScroll) {
              const v = update.view
              requestAnimationFrame(() => {
                if (!v || (v as any).isDestroyed) return
                const scroller = v.dom.closest('.editor-scroller')
                if (!scroller) return
                const currentHead = v.state.selection.main.head
                const coords = v.coordsAtPos(currentHead)
                const scrollerRect = scroller.getBoundingClientRect()
                const bottomMargin = 80
                const topMargin = 50
                if (coords) {
                  if (coords.bottom > scrollerRect.bottom - bottomMargin) {
                    scroller.scrollTop += coords.bottom - (scrollerRect.bottom - bottomMargin)
                  } else if (coords.top < scrollerRect.top + topMargin) {
                    scroller.scrollTop -= (scrollerRect.top + topMargin) - coords.top
                  }
                }
              })
            }
          }
        }
        destroy() {
          if (realViewRef.current === (this as any).view) realViewRef.current = null
          clearTimeout(saveTimeout)
        }
      }
    )
  }, [realViewRef, snippetRef])

  const dropExtension = useMemo(() => imageDropExtension(), [])
  const collapsibleExtension = useCollapsible()
  const keymapModeCompartment = useMemo(() => createKeymapModeCompartment(), [])

  const {
    autocompleteTriggerListener,
    wikiLinkCompletionSource,
    wikiLinksExtension,
    handleTableLinkClick
  } = useWikilinkCompletion({ showToast })

  // --- Keymap & High-Priority Extensions ---
  const editorExtensions = useMemo(
    () => [
      ...collapsibleExtension,
      luminaSyntaxHighlighting,
      // Reserved pluggable keymap mode compartment (e.g. `@replit/codemirror-vim`).
      // Positioned before `Prec.highest` UI-overlay bindings so Escape closes overlays first.
      keymapModeCompartment.of(resolveKeymapModeExtension(DEFAULT_KEYMAP_MODE)),
      Prec.highest(
        keymap.of([
          {
            key: 'Tab',
            run: (view: EditorView) => {
              if (isComposing(view)) return false
              if (slashHandlerRef?.current?.isOpen) {
                return Boolean(slashHandlerRef.current.onEnter?.())
              }
              if (completionStatus(view.state) === 'active') {
                if (acceptCompletion(view)) return true
              }
              if (!isActiveRef.current) return false
              const state = view.state
              const sel = state.selection.main

              // Multi-line selection or list/task line: indent + auto-renumber ordered lists
              const startLine = state.doc.lineAt(sel.from)
              const endLine = state.doc.lineAt(sel.to)
              if (startLine.number !== endLine.number || isListLine(startLine.text)) {
                return indentListLines(view)
              }

              // Standard Tab: insert 2 spaces at cursor / replace selection
              view.dispatch({
                changes: { from: sel.from, to: sel.to, insert: '  ' },
                selection: { anchor: sel.from + 2 },
                scrollIntoView: true
              })
              return true
            }
          },
          {
            key: 'Shift-Tab',
            run: (view: EditorView) => {
              if (isComposing(view)) return false
              if (!isActiveRef.current) return false
              return outdentListLines(view)
            }
          },
          {
            key: 'Shift-Enter',
            run: (view: EditorView) => {
              if (isComposing(view)) return false
              if (!isActiveRef.current) return false
              return handleListShiftEnter(view)
            }
          },
          {
            key: 'Backspace',
            run: (view: EditorView) => {
              if (isComposing(view)) return false
              if (!isActiveRef.current) return false
              return handleListBackspace(view)
            }
          },
          {
            key: 'ArrowUp',
            run: (view: EditorView) => {
              if (slashHandlerRef?.current?.isOpen) {
                slashHandlerRef.current.onArrowUp?.()
                return true
              }
              if (completionStatus(view.state) === 'active') {
                return moveCompletionSelection(false)(view)
              }
              return handleArrowUp(view)
            }
          },
          {
            key: 'ArrowDown',
            run: (view: EditorView) => {
              if (slashHandlerRef?.current?.isOpen) {
                slashHandlerRef.current.onArrowDown?.()
                return true
              }
              if (completionStatus(view.state) === 'active') {
                return moveCompletionSelection(true)(view)
              }
              return handleArrowDown(view)
            }
          },
          {
            key: 'Mod-Enter',
            run: (view: EditorView) => {
              if (isActiveRef.current) {
                const { state } = view
                const selection = state.selection.main
                const tree = syntaxTree(state)
                let node: any = tree.resolveInner(selection.head, 1)

                while (
                  node &&
                  !['Document', 'FencedCode', 'Table', 'Blockquote', 'HTMLBlock'].includes(
                    node.name
                  )
                ) {
                  node = node.parent
                }

                if (node && node.name !== 'Document') {
                  view.dispatch({
                    changes: { from: node.to, insert: '\n' },
                    selection: { anchor: node.to + 1 }
                  })
                  return true
                }

                const line = state.doc.lineAt(selection.head)
                view.dispatch({
                  changes: { from: line.to, insert: '\n' },
                  selection: { anchor: line.to + 1 }
                })
                return true
              }
              return false
            }
          },
          {
            key: 'Enter',
            run: (view: EditorView) => {
              if (isComposing(view)) return false
              if (slashHandlerRef?.current?.isOpen) {
                const handled = slashHandlerRef.current.onEnter?.()
                if (handled) return true
              }

              if (completionStatus(view.state) === 'active') {
                if (acceptCompletion(view)) return true
              }

              if (isActiveRef.current) {
                // 1. Code fence auto-close & auto-expansion
                if (handleCodeFenceEnter(view)) return true

                // 2. Task list handling
                if (handleTaskEnter(view)) return true

                // 3. Blockquote handling
                if (handleQuoteEnter(view)) return true

                // 4. Standard list continuation & exit
                if (handleListEnter(view)) return true

                // 5. Pure empty line: insert regular newline
                const sel = view.state.selection.main
                const line = view.state.doc.lineAt(sel.head)
                if (line.text === '') {
                  view.dispatch({
                    changes: { from: sel.from, to: sel.to, insert: '\n' },
                    selection: { anchor: sel.from + 1 },
                    scrollIntoView: true
                  })
                  return true
                }

                const didRun = insertNewlineContinueMarkup(view)
                if (didRun) return true

                // 6. Generic or Heading line: insert newline and place cursor on the new line
                const isHeading = /^#{1,6}\s/.test(line.text)
                const indent = isHeading ? '' : (line.text.match(/^(\s+)/)?.[1] || '')
                const insert = '\n' + indent
                view.dispatch({
                  changes: { from: sel.from, to: sel.to, insert },
                  selection: { anchor: sel.from + insert.length },
                  scrollIntoView: true
                })
                return true
              }
              return false
            }
          },
          {
            key: 'Mod-f',
            run: () => {
              if (isActiveRef.current) {
                setReplaceModeActive(false)
                if (showFindWidgetRef.current) {
                  window.dispatchEvent(new CustomEvent('find-widget-focus-search'))
                } else {
                  setShowFindWidget(true)
                }
                return true
              }
              return false
            }
          },
          {
            key: 'Mod-h',
            run: () => {
              if (isActiveRef.current) {
                setReplaceModeActive(true)
                if (showFindWidgetRef.current) {
                  window.dispatchEvent(new CustomEvent('find-widget-toggle-replace'))
                } else {
                  setShowFindWidget(true)
                }
                return true
              }
              return false
            }
          },
          { key: 'F3', run: () => isActiveRef.current && showFindWidgetRef.current },
          { key: 'Mod-g', run: () => isActiveRef.current && showFindWidgetRef.current },
          { key: 'Mod-Shift-f', run: () => isActiveRef.current && showFindWidgetRef.current },
          { key: 'Mod-Alt-f', run: () => isActiveRef.current && showFindWidgetRef.current },
          {
            key: 'Mod-Shift-/',
            run: () => {
              const now = Date.now()
              if ((window as any).__lastCanvasDispatch && now - (window as any).__lastCanvasDispatch < 300) {
                return true
              }
              ;(window as any).__lastCanvasDispatch = now
              window.dispatchEvent(new CustomEvent('open-canvas-tab'))
              return true
            }
          },
          {
            key: 'Escape',
            run: (view: EditorView) => {
              if (isComposing(view)) return false
              if (slashHandlerRef?.current?.isOpen) {
                slashHandlerRef.current.onClose?.()
                return true
              }
              if (completionStatus(view.state) === 'active') {
                return closeCompletion(view)
              }
              if (isActiveRef.current && showFindWidgetRef.current) {
                setShowFindWidget(false)
                window.dispatchEvent(new CustomEvent('search-clear'))
                return true
              }
              return false
            }
          }
        ])
      ),
      autocompleteTriggerListener,
      autocompletion({ override: [wikiLinkCompletionSource], maxRenderedOptions: 8 }),
      captureViewPlugin,
      searchHighlightField,
      codeBlockDecorations,
      mermaidWidgetExtension,
      ...tagMentionExtension,
      emptyLineSelectionFix,
      wikiLinksExtension,
      bidiExtension,
      smartWrapSelectionExtension,
      // Live customizable editor shortcuts (rebindable in Settings -> Shortcuts without recreating view)
      Prec.highest(
        EditorView.domEventHandlers({
          keydown: (e: KeyboardEvent, view: EditorView) => {
            if (isComposing(view) || !isActiveRef.current) return false
            if ((window as any).__isRecordingShortcut) return false
            const customShortcuts = useSettingsStore.getState().settings?.shortcuts

            if (matchesShortcutEvent(e, getActiveShortcut('duplicateLineUp', customShortcuts))) {
              e.preventDefault()
              return duplicateLines(view, 'up')
            }
            if (matchesShortcutEvent(e, getActiveShortcut('duplicateLineDown', customShortcuts))) {
              e.preventDefault()
              return duplicateLines(view, 'down')
            }
            if (matchesShortcutEvent(e, getActiveShortcut('moveLineUp', customShortcuts))) {
              e.preventDefault()
              return moveLinesUp(view)
            }
            if (matchesShortcutEvent(e, getActiveShortcut('moveLineDown', customShortcuts))) {
              e.preventDefault()
              return moveLinesDown(view)
            }
            if (matchesShortcutEvent(e, getActiveShortcut('toggleTask', customShortcuts))) {
              e.preventDefault()
              return toggleTaskMark(view)
            }
            return false
          }
        })
      ),
      ...(onSlashStateChange ? createEditorSlashPlugin({ onSlashStateChange, slashHandlerRef }) : [])
    ],
    [
      showToast,
      autocompleteTriggerListener,
      wikiLinkCompletionSource,
      collapsibleExtension,
      keymapModeCompartment,
      captureViewPlugin,
      isActiveRef,
      showFindWidgetRef,
      setShowFindWidget,
      setReplaceModeActive,
      wikiLinksExtension,
      onSlashStateChange,
      slashHandlerRef
    ]
  )

  const noteId = snippetRef.current?.id

  const finalExtensions = useMemo(
    () => [
      ...editorExtensions,
      placeholder("What's in your mind today?"),
      dropExtension,
      Prec.highest(imageWidgetExtension),
      htmlWidgetExtension,
      linkEmbedExtension,
      katexExtension,
      calloutExtension,
      highlightExtension,
      Prec.highest(tables({ onLinkClick: handleTableLinkClick }))
    ],
    // Stable per note instance: CodeMirror should NEVER reconfigure on tab switch
    [noteId]
  )

  return {
    finalExtensions,
    captureViewPlugin
  }
}

// Named alias and default export
export const EditorExtensions = useEditorExtensions
export default useEditorExtensions
