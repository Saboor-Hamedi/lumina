/**
 * =========================================================================================
 * Editor Extensions Hook (`useEditorExtensions.js`)
 * =========================================================================================
 *
 * Responsibilities:
 * - Assembles all CodeMirror extensions, keymaps, and autocompletion providers:
 *   - Universal line-by-line arrow navigation (with multi-line widget bypass)
 *   - Auto-closing and expanding fenced code blocks
 *   - List markup auto-continuation
 *   - Wikilink autocompletion (`[[...]]`)
 *   - Search highlighting & view reference capture
 *   - Live preview widgets (Images, Tables, Mermaid, HTML, Callouts, Tags, Highlighting)
 * =========================================================================================
 */

import React, { useMemo } from 'react'
import { autocompletion } from '@codemirror/autocomplete'
import { Prec, StateField, StateEffect } from '@codemirror/state'
import { EditorView, placeholder, keymap, ViewPlugin, Decoration } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown'

import {
  codeBlockDecorations,
  luminaSyntaxHighlighting
} from '../../codeBlock/codeBlockHeader'
import { imageDropExtension } from '../../dropImage/imageDropExtension'
import { imageWidgetExtension } from '../../dropImage/imageWidgetExtension'
import { htmlWidgetExtension } from '../../Workspace/htmlWidgetExtension'
import { tagMentionExtension } from '../../Workspace/tagMentionExtension'
import { tables } from '../../table/tableExtension'
import { mermaidWidgetExtension } from '../../Workspace/mermaidWidgetExtension'
import { calloutExtension } from './useCallout'
import { useCollapsible } from '../collapse/useCollapsible'
import { emptyLineSelectionFix } from './useEmptyLine'
import { handleTaskEnter, taskMarkKeymap } from './useMark'
import { handleQuoteEnter } from './useQuote'
import { handleListEnter, isListLine } from './useList'
import { handleCodeFenceEnter } from './useCodeFence'
import { handleArrowUp, handleArrowDown } from './useArrowNavigation'
import { useWikilinkCompletion } from './useWikilinkCompletion'
import { createEditorSlashPlugin } from '../../slash'

export const updateSearchHighlights = StateEffect.define()

const searchHighlightField = StateField.define({
  create() {
    return Decoration.none
  },
  update(decos, tr) {
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
}) {
  // --- View Capture & Cursor Persistence Plugin ---
  const captureViewPlugin = useMemo(() => {
    let saveTimeout
    return ViewPlugin.fromClass(
      class {
        constructor(view) {
          realViewRef.current = view
          setTimeout(() => {
            if (view && !view.isDestroyed && snippetRef.current?.code === '') {
              view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '' } })
            } else if (view && !view.isDestroyed && snippetRef.current?.id) {
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
        update(update) {
          if (update.selectionSet && snippetRef.current?.id) {
            const { anchor, head } = update.state.selection.main
            clearTimeout(saveTimeout)
            saveTimeout = setTimeout(() => {
              localStorage.setItem(
                `cursor-${snippetRef.current.id}`,
                JSON.stringify({ anchor, head })
              )
            }, 500)
          }
        }
        destroy() {
          if (realViewRef.current === this.view) realViewRef.current = null
          clearTimeout(saveTimeout)
        }
      }
    )
  }, [realViewRef, snippetRef])

  const dropExtension = useMemo(() => imageDropExtension(showToast), [showToast])
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
      collapsibleExtension,
      luminaSyntaxHighlighting,
      Prec.highest(
        keymap.of([
          {
            key: 'Tab',
            run: (view) => {
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
                  selection: { anchor: sel.head + 2 }
                })
                return true
              }

              // Standard Tab: insert 2 spaces at cursor / replace selection
              view.dispatch({
                changes: { from: sel.from, to: sel.to, insert: '  ' },
                selection: { anchor: sel.from + 2 }
              })
              return true
            }
          },
          {
            key: 'Shift-Tab',
            run: (view) => {
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
                  view.dispatch({ changes })
                }
                return true
              }

              const line = state.doc.lineAt(sel.head)
              if (line.text.startsWith('  ')) {
                view.dispatch({
                  changes: { from: line.from, to: line.from + 2, insert: '' },
                  selection: { anchor: Math.max(line.from, sel.head - 2) }
                })
                return true
              } else if (line.text.startsWith(' ')) {
                view.dispatch({
                  changes: { from: line.from, to: line.from + 1, insert: '' },
                  selection: { anchor: Math.max(line.from, sel.head - 1) }
                })
                return true
              }
              return true
            }
          },
          {
            key: 'ArrowUp',
            run: handleArrowUp
          },
          {
            key: 'ArrowDown',
            run: handleArrowDown
          },
          {
            key: 'Mod-Enter',
            run: (view) => {
              if (isActiveRef.current) {
                const { state } = view
                const selection = state.selection.main
                const tree = syntaxTree(state)
                let node = tree.resolveInner(selection.head, 1)

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
            run: (view) => {
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
                const pos = view.state.selection.main.head
                const line = view.state.doc.lineAt(pos)
                if (line.text === '') {
                  view.dispatch({
                    changes: { from: pos, insert: '\n' },
                    selection: { anchor: pos + 1 }
                  })
                  return true
                }

                const didRun = insertNewlineContinueMarkup(view)
                if (didRun) return true
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
            key: 'Escape',
            run: () => {
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
      tagMentionExtension,
      emptyLineSelectionFix,
      wikiLinksExtension,
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

  const finalExtensions = useMemo(
    () => [
      ...editorExtensions,
      placeholder("Start writing... Type '#' for heading, or press Ctrl+P to search"),
      dropExtension,
      Prec.highest(imageWidgetExtension),
      htmlWidgetExtension,
      calloutExtension,
      Prec.highest(tables({ onLinkClick: handleTableLinkClick }))
    ],
    [editorExtensions, dropExtension, handleTableLinkClick]
  )

  return {
    finalExtensions,
    captureViewPlugin
  }
}
