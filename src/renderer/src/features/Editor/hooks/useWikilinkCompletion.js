/**
 * useWikilinkCompletion.js
 * 
 * Modular hook for Wikilinks (`[[...]]`):
 * - Auto-triggers completion popup on typing `[[`
 * - Queries vault store snippets for auto-completing note titles
 * - Handles note creation and navigation on clicking wikilinks
 */

import { useCallback, useMemo } from 'react'
import { EditorView } from '@codemirror/view'
import { startCompletion } from '@codemirror/autocomplete'
import { createLuminaWikiLinks } from '../wikilinks/luminaWikiLinks'
import { useVaultStore } from '../../../core/store/useVaultStore'

export function useWikilinkCompletion({ showToast }) {
  // 1. Trigger autocompletion inside `[[`
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

  // 2. Completion source matching `[[query` against vault notes
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

  // 3. Open or create note when wikilink is clicked
  const openOrCreateNote = useCallback(
    async (target) => {
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
          showToast?.(`Creating new note: ${target}`, 'info')
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
        showToast?.(`Error: ${e.message}`, 'error')
      }
    },
    [showToast]
  )

  const wikiLinksExtension = useMemo(() => {
    return createLuminaWikiLinks({
      onOpen: openOrCreateNote
    })
  }, [openOrCreateNote])

  // 4. Table link click handler
  const handleTableLinkClick = useCallback(
    async (url) => {
      if (url.match(/^(https?|mailto|file):\/\//i)) {
        window.open(url, '_blank')
        return
      }
      await openOrCreateNote(url)
    },
    [openOrCreateNote]
  )

  return {
    autocompleteTriggerListener,
    wikiLinkCompletionSource,
    wikiLinksExtension,
    handleTableLinkClick
  }
}
