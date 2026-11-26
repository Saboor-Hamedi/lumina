import { useCallback, useMemo } from 'react'
import type { Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  startCompletion,
  closeCompletion,
  completionStatus
} from '@codemirror/autocomplete'
import { createLuminaWikiLinks } from './luminaWikiLinks'
import { useWorkspaceStore, type WorkspaceNote } from '../../../core/store/workspaceStore'
import { shouldTriggerWikilinkCompletion, matchesNormalized, normalizeWikilinkTarget } from '../../../core/i18n'

type EditorViewWithDestroyed = EditorView & { isDestroyed?: boolean }

export interface UseWikilinkCompletionOptions {
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export interface UseWikilinkCompletionResult {
  autocompleteTriggerListener: Extension[]
  wikiLinkCompletionSource: (context: CompletionContext) => CompletionResult | null
  wikiLinksExtension: Extension[]
  handleTableLinkClick: (url: string) => Promise<void>
}

const closeCompletionOnOutsideClick = ViewPlugin.fromClass(
  class {
    view: EditorView
    handlePointerDown: (e: PointerEvent) => void

    constructor(view: EditorView) {
      this.view = view
      this.handlePointerDown = (e: PointerEvent) => {
        if (completionStatus(this.view.state) !== 'active') return
        const target = e.target
        if (target instanceof Element && target.closest('.cm-tooltip-autocomplete')) {
          return
        }
        closeCompletion(this.view)
      }
      document.addEventListener('pointerdown', this.handlePointerDown, true)
    }

    destroy(): void {
      document.removeEventListener('pointerdown', this.handlePointerDown, true)
    }
  }
)

export function useWikilinkCompletion({
  showToast
}: UseWikilinkCompletionOptions): UseWikilinkCompletionResult {
  const autocompleteTriggerListener = useMemo<Extension[]>(
    () => [
      closeCompletionOnOutsideClick,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const view = update.view as EditorViewWithDestroyed
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
      })
    ],
    []
  )

  const wikiLinkCompletionSource = useCallback((context: CompletionContext): CompletionResult | null => {
    if (document.activeElement?.classList.contains('cm-atomic-table-cell-source')) {
      return null
    }
    if (context.view && !shouldTriggerWikilinkCompletion(context.view)) {
      return null
    }

    const match = context.matchBefore(/\[\[([^\]]*)/)
    if (!match) return null
    if (match.from === match.to && !context.explicit) return null

    const { notes } = useWorkspaceStore.getState()
    const query = match.text.slice(2)

    const opts: Completion[] = (notes || [])
      .filter(
        (s): s is WorkspaceNote & { title: string } =>
          Boolean(s.title) &&
          s.type !== 'image' &&
          (!s.folderId || !s.folderId.startsWith('.lumina')) &&
          (!query || matchesNormalized(s.title || '', query))
      )
      .map((s) => ({
        label: String(s.title || ''),
        type: 'text',
        info: 'Link to note',
        apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
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
    async (target: string): Promise<void> => {
      try {
        const { notes, saveNote, setSelectedNote } = useWorkspaceStore.getState()
        const targetKey = normalizeWikilinkTarget(target)
        let targetSnippet: WorkspaceNote | undefined = (notes || []).find((s) => {
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
        const message = e instanceof Error ? e.message : String(e)
        showToast?.(`Error: ${message}`, 'error')
      }
    },
    [showToast]
  )

  const wikiLinksExtension = useMemo<Extension[]>(() => {
    return createLuminaWikiLinks({
      onOpen: openOrCreateNote
    })
  }, [openOrCreateNote])

  const handleTableLinkClick = useCallback(
    async (url: string): Promise<void> => {
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
