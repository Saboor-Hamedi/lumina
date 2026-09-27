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
// Media extensions
import { imageDropExtension, imageWidgetExtension } from '../../features/media'
import { htmlWidgetExtension } from '../../features/Editor/extensions/htmlExtension'
import { katexExtension } from '../../features/Editor/extensions/katexExtension'
import { tagMentionExtension } from '../../features/Editor/extensions/tagMentionExtension'
import { tables } from '../../features/table/tableExtension'
import { mermaidWidgetExtension } from '../mermaid'
import { calloutExtension } from './useCallout'
import { highlightExtension } from './useHighlight'
import { useCollapsible } from '../../features/Editor/collapse/useCollapsible'
import { emptyLineSelectionFix } from './useEmptyLine'
import { handleTaskEnter, taskMarkKeymap } from './useMark'
import { handleQuoteEnter } from './useQuote'
import { handleListEnter, isListLine } from './useList'
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
              const savedSelection = localStorage.getItem(`cursor-${snippetRef.current.id}`)
              if (savedSelection) {
                try {
                  const parsed = JSON.parse(savedSelection)
                  const anchor = typeof parsed?.anchor === 'number' ? Math.max(0, Math.min(parsed.anchor, view.state.doc.length)) : null
                  if (anchor !== null) {
                    const line = view.state.doc.lineAt(anchor)
                    const validPos = Math.min(anchor, line.to)
                    view.dispatch({
                      selection: { anchor: validPos, head: validPos },
                      scrollIntoView: true
                    })
                    view.focus()
                  }
                } catch (e) {
                  try {
                    localStorage.removeItem(`cursor-${snippetRef.current.id}`)
                  } catch {}
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
                localStorage.setItem(
                  `cursor-${snippetRef.current.id}`,
                  JSON.stringify({ anchor, head })
                )
              }
            }, 500)

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

              // Multi-line selection: indent all selected lines by 2 spaces
              const startLine = state.doc.lineAt(sel.from)
              const endLine = state.doc.lineAt(sel.to)
              if (startLine.number !== endLine.number) {
                const changes = []
                for (let l = startLine.number; l <= endLine.number; l++) {
                  const line = state.doc.line(l)
                  changes.push({ from: line.from, insert: '  ' })
                }
                view.dispatch({ changes })
                return true
              }

              const line = state.doc.lineAt(sel.head)
              if (isListLine(line.text)) {
                // Indent list or task item: add 2 spaces at line start
                view.dispatch({
                  changes: { from: line.from, insert: '  ' },
                  selection: { anchor: sel.head + 2 },
                  scrollIntoView: true
                })
                return true
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
              const state = view.state
              const sel = state.selection.main

              // Multi-line selection: outdent all selected lines
              const startLine = state.doc.lineAt(sel.from)
              const endLine = state.doc.lineAt(sel.to)
              if (startLine.number !== endLine.number) {
                const changes = []
                for (let l = startLine.number; l <= endLine.number; l++) {
                  const line = state.doc.line(l)
                  if (line.text.startsWith('  ')) {
                    changes.push({ from: line.from, to: line.from + 2, insert: '' })
                  } else if (line.text.startsWith(' ')) {
                    changes.push({ from: line.from, to: line.from + 1, insert: '' })
                  }
                }
                if (changes.length > 0) {
                  view.dispatch({ changes, scrollIntoView: true })
                }
                return true
              }

              const line = state.doc.lineAt(sel.head)
              if (line.text.startsWith('  ')) {
                view.dispatch({
                  changes: { from: line.from, to: line.from + 2, insert: '' },
                  selection: { anchor: Math.max(line.from, sel.head - 2) },
                  scrollIntoView: true
                })
                return true
              } else if (line.text.startsWith(' ')) {
                view.dispatch({
                  changes: { from: line.from, to: line.from + 1, insert: '' },
                  selection: { anchor: Math.max(line.from, sel.head - 1) },
                  scrollIntoView: true
                })
                return true
              }
              return true
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
              if ((window as any).__lastCanvasDrawerDispatch && now - (window as any).__lastCanvasDrawerDispatch < 300) {
                return true
              }
              ;(window as any).__lastCanvasDrawerDispatch = now
              window.dispatchEvent(new CustomEvent('toggle-canvas-drawer'))
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
      taskMarkKeymap(isActiveRef),
      ...(onSlashStateChange ? createEditorSlashPlugin({ onSlashStateChange, slashHandlerRef }) : [])
    ],
    [
      showToast,
      autocompleteTriggerListener,
      wikiLinkCompletionSource,
      collapsibleExtension,
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
