import { useCallback, useMemo } from 'react'
import { EditorView } from '@codemirror/view'
import { startCompletion } from '@codemirror/autocomplete'
import { createLuminaWikiLinks } from './luminaWikiLinks'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import { shouldTriggerWikilinkCompletion, matchesNormalized, normalizeWikilinkTarget } from '../../../core/i18n'

export function useWikilinkCompletion({ showToast }) {
  const autocompleteTriggerListener = useCallback(
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const view = update.view
        if (!shouldTriggerWikilinkCompletion(view)) return

        const head = view.state.selection.main.head
        const line = view.state.doc.lineAt(head)
        const col = head - line.from
        const textBefore = line.text.slice(0, col)

        const lastOpen = textBefore.lastIndexOf('[[')
        if (lastOpen !== -1) {
          const lastClose = textBefore.lastIndexOf(']]')
          if (lastOpen > lastClose) {
            setTimeout(() => {
              if (!view.isDestroyed && shouldTriggerWikilinkCompletion(view)) {
                startCompletion(view)
              }
            }, 10)
          }
        }
      }
    }),
    []
  )

  const wikiLinkCompletionSource = useCallback((context) => {
    if (document.activeElement?.classList.contains('cm-atomic-table-cell-source')) {
      return null
    }
    if (!shouldTriggerWikilinkCompletion(context.view)) {
      return null
    }

    const match = context.matchBefore(/\[\[([^\]]*)/)
    if (!match) return null
    if (match.from === match.to && !context.explicit) return null

    const { notes } = useWorkspaceStore.getState()
    const query = match[1] || ''

    const opts = (notes || [])
      .filter(
        (s) =>
          s.title &&
          s.type !== 'image' &&
          (!s.folderId || !s.folderId.startsWith('.lumina')) &&
          (!query || matchesNormalized(s.title, query))
      )
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

    if (opts.length === 0) return null

    return {
      from: match.from + 2,
      validFor: /^[^\]]*$/,
      options: opts
    }
  }, [])

  const openOrCreateNote = useCallback(
    async (target) => {
      try {
        const { notes, saveNote, setSelectedNote } = useWorkspaceStore.getState()
        const targetKey = normalizeWikilinkTarget(target)
        let targetSnippet = (notes || []).find((s) => {
          if (!s.title || s.type === 'image') return false
          const titleKey = normalizeWikilinkTarget(s.title)
          const titleWithoutMdKey = normalizeWikilinkTarget(s.title.replace(/\.md$/i, ''))
          return titleKey === targetKey || titleWithoutMdKey === targetKey
        })

        if (!targetSnippet) {
          targetSnippet = {
            id: crypto.randomUUID(),
            title: target,
            code: `# ${target}\n\n`,
            language: 'markdown',
            tags: '',
            timestamp: Date.now()
          }
          if (saveNote) await saveNote(targetSnippet)
        }
        if (setSelectedNote) setSelectedNote(targetSnippet)
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

export default useWikilinkCompletion
