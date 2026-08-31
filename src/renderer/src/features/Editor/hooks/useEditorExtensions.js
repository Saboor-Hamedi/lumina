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

import React, { useCallback, useMemo } from 'react'
import { wikiLinks } from '@atomic-editor/editor'
import { syntaxTree } from '@codemirror/language'
import { autocompletion, startCompletion } from '@codemirror/autocomplete'
import { Prec, StateField, StateEffect } from '@codemirror/state'
import { EditorView, placeholder, keymap, ViewPlugin, Decoration } from '@codemirror/view'
import { cursorLineUp as defaultCursorLineUp, cursorLineDown as defaultCursorLineDown } from '@codemirror/commands'
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown'
import { useVaultStore } from '../../../core/store/useVaultStore'

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
import { calloutExtension } from '../../Workspace/calloutWidgetExtension'
import { useCollapsible } from '../collapse/useCollapsible'
import { wikilinkCaretFix } from '../wikilinkCaret'
import { emptyLineSelectionFix } from './useEmptyLine'

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
  setReplaceModeActive
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
                  const { anchor, head } = JSON.parse(savedSelection)
                  if (anchor <= view.state.doc.length && head <= view.state.doc.length) {
                    view.dispatch({ selection: { anchor, head }, scrollIntoView: true })
                    view.focus()
                  }
                } catch (e) {}
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

  // --- Autocomplete Trigger Inside [[wikilinks]] ---
  const autocompleteTriggerListener = useCallback(
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const view = update.view
        const head = view.state.selection.main.head
        const line = view.state.doc.lineAt(head)
        const col = head - line.from
        const textBefore = line.text.slice(0, col)

        const lastOpen = textBefore.lastIndexOf('[[')
        if (lastOpen !== -1) {
          const lastClose = textBefore.lastIndexOf(']]')
          if (lastOpen > lastClose) {
            setTimeout(() => {
              if (!view.isDestroyed) {
                startCompletion(view)
              }
            }, 10)
          }
        }
      }
    }),
    []
  )

  // --- Wikilink Completion Source ---
  const wikiLinkCompletionSource = useCallback((context) => {
    if (document.activeElement?.classList.contains('cm-atomic-table-cell-source')) {
      return null
    }

    const match = context.matchBefore(/\[\[([^\]]*)/)
    if (!match) return null
    if (match.from === match.to && !context.explicit) return null

    const { snippets } = useVaultStore.getState()

    let opts = snippets
      .filter((s) => s.title)
      .map((s) => ({
        label: s.title,
        type: 'text',
        info: 'Link to note',
        apply: (view, completion, from, to) => {
          const docLength = view.state.doc.length
          const after2 = view.state.sliceDoc(to, Math.min(to + 2, docLength))
          const after1 = view.state.sliceDoc(to, Math.min(to + 1, docLength))
          let replaceTo = to
          if (after2 === ']]') replaceTo = to + 2
          else if (after1 === ']') replaceTo = to + 1

          view.dispatch({
            changes: { from, to: replaceTo, insert: s.title + ']]' },
            selection: { anchor: from + s.title.length + 2 }
          })
        }
      }))

    if (opts.length === 0) {
      opts = [{ label: 'No notes found', apply: ']]' }]
    }

    return {
      from: match.from + 2,
      validFor: /^[^\]]*$/,
      options: opts
    }
  }, [])

  const dropExtension = useMemo(() => imageDropExtension(showToast), [showToast])
  const collapsibleExtension = useCollapsible()

  // --- Table Link Click Handler ---
  const handleTableLinkClick = useCallback(
    async (url) => {
      if (url.match(/^(https?|mailto|file):\/\//i)) {
        window.open(url, '_blank')
        return
      }

      try {
        const { snippets, saveSnippet, setSelectedSnippet } = useVaultStore.getState()
        const targetLower = url.toLowerCase()
        let targetSnippet = snippets.find(
          (s) =>
            s.title &&
            (s.title.toLowerCase() === targetLower ||
              s.title.toLowerCase() === `${targetLower}.md`)
        )

        if (!targetSnippet) {
          showToast(`Creating new note: ${url}`, 'info')
          targetSnippet = {
            id: crypto.randomUUID(),
            title: url,
            code: `# ${url}\n\n`,
            language: 'markdown',
            tags: '',
            timestamp: Date.now()
          }
          await saveSnippet(targetSnippet)
        }
        setSelectedSnippet(targetSnippet)
      } catch (e) {
        showToast(`Error: ${e.message}`, 'error')
      }
    },
    [showToast]
  )

  // --- Keymap & High-Priority Extensions ---
  const editorExtensions = useMemo(
    () => [
      collapsibleExtension,
      luminaSyntaxHighlighting,
      Prec.highest(
        keymap.of([
          {
            key: 'ArrowUp',
            run: (view) => {
              const sel = view.state.selection.main
              if (!sel.empty) return defaultCursorLineUp(view)

              const pos = sel.head
              const doc = view.state.doc
              const currentLine = doc.lineAt(pos)

              if (currentLine.number <= 1) {
                if (pos !== currentLine.from) {
                  view.dispatch({ selection: { anchor: currentLine.from }, scrollIntoView: true })
                  return true
                }
                return defaultCursorLineUp(view)
              }

              const col = pos - currentLine.from
              let targetLineNumber = currentLine.number - 1
              let targetLine = doc.line(targetLineNumber)

              // If target line is inside a multi-line replaced block widget (e.g. Mermaid or Table), step above the whole widget
              const tree = syntaxTree(view.state)
              let block = null
              tree.iterate({
                from: Math.max(0, targetLine.from - 5),
                to: Math.min(doc.length, targetLine.to + 5),
                enter(node) {
                  if (node.name === 'FencedCode') {
                    const text = view.state.sliceDoc(node.from, node.to)
                    if (text.startsWith('```mermaid') || text.startsWith('~~~mermaid')) {
                      if (targetLine.from >= node.from && targetLine.to <= node.to) {
                        block = { from: node.from, to: node.to }
                        return false
                      }
                    }
                  } else if (node.name === 'Table') {
                    if (targetLine.from >= node.from && targetLine.to <= node.to) {
                      block = { from: node.from, to: node.to }
                      return false
                    }
                  }
                }
              })

              if (block) {
                const blockStartLine = doc.lineAt(block.from)
                targetLineNumber = blockStartLine.number > 1 ? blockStartLine.number - 1 : 1
                targetLine = doc.line(targetLineNumber)
              }

              const targetCol = Math.min(col, targetLine.length)
              const targetPos = targetLine.from + targetCol

              view.dispatch({
                selection: { anchor: targetPos },
                effects: EditorView.scrollIntoView(targetPos, { y: 'nearest', yMargin: 40 }),
                userEvent: 'select'
              })
              return true
            }
          },
          {
            key: 'ArrowDown',
            run: (view) => {
              const sel = view.state.selection.main
              if (!sel.empty) return defaultCursorLineDown(view)

              const pos = sel.head
              const doc = view.state.doc
              const currentLine = doc.lineAt(pos)

              if (currentLine.number >= doc.lines) {
                if (pos !== currentLine.to) {
                  view.dispatch({
                    selection: { anchor: currentLine.to },
                    effects: EditorView.scrollIntoView(currentLine.to, { y: 'nearest', yMargin: 40 })
                  })
                  return true
                }
                return defaultCursorLineDown(view)
              }

              const col = pos - currentLine.from
              let targetLineNumber = currentLine.number + 1
              let targetLine = doc.line(targetLineNumber)

              // If target line is inside a multi-line replaced block widget (e.g. Mermaid or Table), step below the whole widget
              const tree = syntaxTree(view.state)
              let block = null
              tree.iterate({
                from: Math.max(0, targetLine.from - 5),
                to: Math.min(doc.length, targetLine.to + 5),
                enter(node) {
                  if (node.name === 'FencedCode') {
                    const text = view.state.sliceDoc(node.from, node.to)
                    if (text.startsWith('```mermaid') || text.startsWith('~~~mermaid')) {
                      if (targetLine.from >= node.from && targetLine.to <= node.to) {
                        block = { from: node.from, to: node.to }
                        return false
                      }
                    }
                  } else if (node.name === 'Table') {
                    if (targetLine.from >= node.from && targetLine.to <= node.to) {
                      block = { from: node.from, to: node.to }
                      return false
                    }
                  }
                }
              })

              if (block) {
                const blockEndLine = doc.lineAt(block.to)
                targetLineNumber = blockEndLine.number < doc.lines ? blockEndLine.number + 1 : doc.lines
                targetLine = doc.line(targetLineNumber)
              }

              const targetCol = Math.min(col, targetLine.length)
              const targetPos = targetLine.from + targetCol

              view.dispatch({
                selection: { anchor: targetPos },
                effects: EditorView.scrollIntoView(targetPos, { y: 'nearest', yMargin: 40 }),
                userEvent: 'select'
              })
              return true
            }
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
                const state = view.state
                const pos = state.selection.main.head
                const line = state.doc.lineAt(pos)

                // Feature 1: auto-close unclosed fenced code blocks
                const openingFenceMatch = line.text.match(/^```[a-zA-Z0-9+#-]*\s*$/)
                if (openingFenceMatch && pos === line.to) {
                  let isClosed = false
                  for (let i = line.number + 1; i <= state.doc.lines; i++) {
                    if (state.doc.line(i).text.trim().startsWith('```')) {
                      isClosed = true
                      break
                    }
                  }
                  if (!isClosed) {
                    view.dispatch({
                      changes: { from: line.to, insert: '\n\n```' },
                      selection: { anchor: line.to + 1 }
                    })
                    return true
                  }
                }

                // Feature 2: auto-expand single-line fenced code blocks
                const singleLineCodeMatch = line.text.match(/^```(.*?)```\s*$/)
                if (singleLineCodeMatch) {
                  const inside = singleLineCodeMatch[1]
                  const relativePos = pos - (line.from + 3)

                  let beforeCursor = ''
                  let afterCursor = ''

                  if (relativePos <= 0) {
                    afterCursor = inside
                  } else if (relativePos >= inside.length) {
                    beforeCursor = inside
                  } else {
                    beforeCursor = inside.slice(0, relativePos)
                    afterCursor = inside.slice(relativePos)
                  }

                  let lang = ''
                  let contentBefore = ''

                  const langMatch = beforeCursor.match(/^([a-zA-Z0-9+#-]+)(?:\s+|$)/)
                  if (langMatch) {
                    lang = langMatch[1]
                    contentBefore = beforeCursor.slice(langMatch[0].length)
                  } else {
                    contentBefore = beforeCursor
                  }

                  let insertText = `\`\`\`${lang}\n`
                  let newCursorPos = line.from + insertText.length

                  if (
                    contentBefore.trim() ||
                    (!contentBefore.trim() && beforeCursor.endsWith(' ') && !langMatch)
                  ) {
                    insertText += `${contentBefore}\n`
                    newCursorPos = line.from + insertText.length
                  }

                  insertText += `${afterCursor}\n\`\`\``

                  if (relativePos >= inside.length) {
                    insertText += '\n'
                    newCursorPos = line.from + insertText.length
                  }

                  view.dispatch({
                    changes: {
                      from: line.from,
                      to: line.to,
                      insert: insertText
                    },
                    selection: { anchor: newCursorPos }
                  })
                  return true
                }

                const didRun = insertNewlineContinueMarkup(view)
                if (didRun) {
                  const stateAfter = view.state
                  const posAfter = stateAfter.selection.main.head
                  const lineAfter = stateAfter.doc.lineAt(posAfter)
                  if (
                    /^(\s*[-*+]|\s*\d+\.)\s*$/.test(lineAfter.text) &&
                    !lineAfter.text.endsWith(' ') &&
                    posAfter === lineAfter.to
                  ) {
                    view.dispatch({
                      changes: { from: lineAfter.to, insert: ' ' },
                      selection: { anchor: lineAfter.to + 1 }
                    })
                  }
                  return true
                }
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
      wikilinkCaretFix,
      emptyLineSelectionFix,
      wikiLinks({
        openOnClick: true,
        resolve: async (target) => {
          const { snippets } = useVaultStore.getState()
          const targetLower = target.toLowerCase()
          const exists = snippets.some(
            (s) =>
              s.title &&
              (s.title.toLowerCase() === targetLower ||
                s.title.toLowerCase() === `${targetLower}.md`)
          )
          return {
            label: target,
            status: exists ? 'resolved' : 'missing'
          }
        },
        onOpen: async (target) => {
          try {
            const { snippets, saveSnippet, setSelectedSnippet } = useVaultStore.getState()
            const targetLower = target.toLowerCase()
            let targetSnippet = snippets.find(
              (s) =>
                s.title &&
                (s.title.toLowerCase() === targetLower ||
                  s.title.toLowerCase() === `${targetLower}.md`)
            )

            if (!targetSnippet) {
              showToast(`Creating new note: ${target}`, 'info')
              targetSnippet = {
                id: crypto.randomUUID(),
                title: target,
                code: `# ${target}\n\n`,
                language: 'markdown',
                tags: '',
                timestamp: Date.now()
              }
              await saveSnippet(targetSnippet)
            }
            setSelectedSnippet(targetSnippet)
          } catch (e) {
            showToast(`Error: ${e.message}`, 'error')
          }
        }
      })
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
      setReplaceModeActive
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
