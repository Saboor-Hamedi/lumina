import React, { useState, useEffect, useRef, useCallback } from 'react'
import EditorMenu from '../Workspace/components/EditorMenu'
import EditorMetadata from '../Workspace/components/EditorMetadata'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useFontSettings } from '../../core/hooks/useFontSettings'
import { useToast } from '../../core/hooks/useToast'
import ToastNotification from '../../core/notification'
import './MarkdownEditor.css'
import './CodeWrapper.css'

// Atomic Editor Imports
import { AtomicCodeMirrorEditor, wikiLinks } from '@atomic-editor/editor'
import { languages } from '@codemirror/language-data'
import { syntaxTree, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { autocompletion, startCompletion } from '@codemirror/autocomplete'
import { EditorState, Prec, StateField, StateEffect } from '@codemirror/state'
import { codeBlockDecorations, codeMap } from '../Workspace/codeBlockHeader'
import { EditorView, placeholder, keymap, ViewPlugin, Decoration } from '@codemirror/view'
import { imageDropExtension } from '../Workspace/imageDropExtension'
import { imageWidgetExtension } from '../Workspace/imageWidgetExtension'
import { htmlWidgetExtension } from '../Workspace/htmlWidgetExtension'
import { insertNewlineContinueMarkup } from '@codemirror/lang-markdown'
import { setupWikilinkHover } from '../Workspace/hoverWikilink'
import { tagMentionExtension } from '../Workspace/tagMentionExtension'
import { tables } from '../Workspace/tableWidgetExtension'
import { mermaidWidgetExtension } from '../Workspace/mermaidWidgetExtension'
import { calloutExtension } from '../Workspace/calloutWidgetExtension'
import '@atomic-editor/editor/styles.css'
import FindWidget from '../Workspace/components/FindWidget'
import StatusBar from '../Workspace/components/StatusBar'
import PreviewModal from '../Overlays/PreviewModal/PreviewModal'
import OverwriteModal from '../Overlays/Modals/OverwriteModal'

const updateSearchHighlights = StateEffect.define()

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

const MarkdownEditor = React.memo(
  ({
    snippet,
    onSave,
    onToggleInspector,
    isActive = true,
    onToggleExplorerModal,
    onSettingsClick,
    onThemeClick,
    onGraphClick,
    onDailyNoteClick
  }) => {
    const { toast, showToast, clearToast } = useToast()
    const [isSaving, setIsSaving] = useState(false)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const isMountedRef = useRef(true)

    // Persistence Refs
    const snippetRef = useRef(snippet)
    const editorHandleRef = useRef(null)
    const titleRef = useRef(null)
    const editorWrapperRef = useRef(null)

    const { settings } = useSettingsStore()
    const { snippets, setSelectedSnippet, setDirty } = useVaultStore()
    const { caretStyle } = useFontSettings()

    const [title, setTitle] = useState(snippet?.title || '')
    const [isDirty, setIsDirty] = useState(false)
    const [editorKey, setEditorKey] = useState(Date.now())
    const [showFindWidget, setShowFindWidget] = useState(false)
    const [replaceModeActive, setReplaceModeActive] = useState(false)
    const [copiedBlockId, setCopiedBlockId] = useState(null)
    const [conflictPrompt, setConflictPrompt] = useState(null)

    const isActiveRef = useRef(isActive)
    useEffect(() => {
      isActiveRef.current = isActive
    }, [isActive])
    const showFindWidgetRef = useRef(showFindWidget)
    useEffect(() => {
      showFindWidgetRef.current = showFindWidget
    }, [showFindWidget])

    const realViewRef = useRef(null)
    const captureViewPlugin = React.useMemo(() => {
      let saveTimeout
      return ViewPlugin.fromClass(
        class {
          constructor(view) {
            realViewRef.current = view
            // Force clear any trailing whitespace/newlines from initialization or restore selection
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
    }, [])

    useEffect(() => {
      if (!isActive) return

      const handleGlobalKeyDown = (e) => {
        if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          setReplaceModeActive(false)
          setShowFindWidget(true)
        } else if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          setReplaceModeActive(true)
          setShowFindWidget(true)
        } else if (e.key === '\\' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          setIsPreviewOpen(prev => !prev)
        }
      }

      window.addEventListener('keydown', handleGlobalKeyDown)
      return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [isActive])

    useEffect(() => {
      const handleSearchUpdate = (e) => {
        if (!isActiveRef.current || !realViewRef.current) return
        const view = realViewRef.current
        const { pattern } = e.detail || {}

        if (!pattern || !e.detail.searchQuery) {
          view.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
          return
        }

        const text = view.state.doc.toString()
        const decorations = []
        const mark = Decoration.mark({ class: 'cm-searchMatch' })

        try {
          // e.detail.pattern is already a RegExp with 'g' or 'gi' flags from FindWidget.
          // If we pass it to new RegExp() without flags, it loses the 'g' flag and matchAll throws.
          const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g')
          for (const match of text.matchAll(regex)) {
            decorations.push(mark.range(match.index, match.index + match[0].length))
          }
          view.dispatch({ effects: updateSearchHighlights.of(Decoration.set(decorations, true)) })
        } catch (err) {
          view.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
        }
      }

      const handleSearchClear = () => {
        if (!isActiveRef.current || !realViewRef.current) return
        realViewRef.current.dispatch({ effects: updateSearchHighlights.of(Decoration.none) })
      }

      const handleFocusEditorStart = () => {
        if (!isActiveRef.current || !realViewRef.current) return
        const view = realViewRef.current
        view.focus()
        view.dispatch({ selection: { anchor: 0, head: 0 } })
      }

      const handleScrollToLine = (e) => {
        if (!isActiveRef.current || !realViewRef.current) return
        const view = realViewRef.current
        const lineNum = e.detail?.line
        if (typeof lineNum !== 'number') return
        try {
          const doc = view.state.doc
          const targetLineNum = Math.max(1, Math.min(lineNum, doc.lines))
          const targetLine = doc.line(targetLineNum)
          
          view.dispatch({
            selection: { anchor: targetLine.from }
          })
          
          // Since .cm-scroller is overflow: visible in CSS, CodeMirror's scrollIntoView doesn't work.
          // We must manually scroll the outer .editor-scroller wrapper.
          const lineBlock = view.lineBlockAt(targetLine.from)
          const scroller = view.dom.closest('.editor-scroller')
          
          if (scroller) {
            const scrollY = lineBlock.top - (scroller.clientHeight / 2) + (lineBlock.height / 2)
            scroller.scrollTo({ top: Math.max(0, scrollY), behavior: 'smooth' })
          }
          
          setTimeout(() => {
            if (realViewRef.current && realViewRef.current.contentDOM) {
              realViewRef.current.contentDOM.focus({ preventScroll: true })
            }
          }, 50)
        } catch (err) {
          console.error('[Editor] Scroll error:', err)
        }
      }

      const handleGlobalToast = (e) => {
        if (!isActiveRef.current) return
        const { message, type } = e.detail || {}
        if (message) {
          showToast(message, type || 'info')
        }
      }

      window.addEventListener('search-update', handleSearchUpdate)
      window.addEventListener('search-clear', handleSearchClear)
      window.addEventListener('focus-editor-start', handleFocusEditorStart)
      window.addEventListener('editor-scroll-to-line', handleScrollToLine)
      window.addEventListener('show-toast', handleGlobalToast)
      return () => {
        window.removeEventListener('search-update', handleSearchUpdate)
        window.removeEventListener('search-clear', handleSearchClear)
        window.removeEventListener('focus-editor-start', handleFocusEditorStart)
        window.removeEventListener('editor-scroll-to-line', handleScrollToLine)
        window.removeEventListener('show-toast', handleGlobalToast)
      }
    }, [showToast])

    const lastSavedCodeRef = useRef(snippet?.code)

    useEffect(() => {
      const previousSnippet = snippetRef.current
      snippetRef.current = snippet
      setTitle(snippet?.title || '')

      if (editorHandleRef.current) {
        const currentCode = editorHandleRef.current.getMarkdown()
        const codeChangedFromOutside = snippet?.code !== lastSavedCodeRef.current

        if (codeChangedFromOutside) {
          const isSameFile = previousSnippet?.id === snippet?.id
          const hasLocalEdits = currentCode !== lastSavedCodeRef.current
          const isTrivialExternalChange = (snippet?.code || '').trim() === (lastSavedCodeRef.current || '').trim()

          if (isSameFile && hasLocalEdits && !isTrivialExternalChange) {
            // REAL CONFLICT! Show the custom ConfirmModal
            setConflictPrompt({
              snippetCode: snippet?.code,
              snippetTitle: snippet?.title
            })
          } else if (isSameFile && hasLocalEdits && isTrivialExternalChange) {
            // Trivial external change (e.g. backend added a trailing newline to frontmatter)
            // But user has real local edits. Keep local edits!
            lastSavedCodeRef.current = snippet?.code
          } else {
            // No local edits, OR switching tabs. Safe to overwrite immediately.
            setIsDirty(false)
            lastSavedCodeRef.current = snippet?.code

            if (realViewRef.current) {
              const view = realViewRef.current
              const needsClear = snippet?.code === '' && view.state.doc.length > 0
              if ((typeof snippet?.code === 'string' && currentCode !== snippet.code) || needsClear) {
                view.dispatch({
                  changes: { from: 0, to: view.state.doc.length, insert: snippet.code || '' }
                })
              }
            } else {
              if (typeof snippet?.code === 'string' && currentCode !== snippet.code) {
                setEditorKey((k) => k + 1)
              }
            }
          }
        }
      }
    }, [snippet])

    const latestCodeRef = useRef(snippet?.code || '')

    // Cleanup on unmount (Tab switch / close)
    useEffect(() => {
      isMountedRef.current = true
      return () => {
        isMountedRef.current = false
        // Perform synchronous auto-save on unmount if we have unsaved changes
        const currentSettings = useSettingsStore.getState().settings
        const dirtyIds = useVaultStore.getState().dirtySnippetIds || []

        if (
          currentSettings.autoSave &&
          snippetRef.current &&
          dirtyIds.includes(snippetRef.current.id)
        ) {
          const codeToSave = latestCodeRef.current
          const snippetToSave = {
            ...snippetRef.current,
            code: codeToSave || '',
            timestamp: Date.now()
          }
          useVaultStore
            .getState()
            .saveSnippet(snippetToSave)
            .catch((err) => console.error('[Unmount AutoSave] Failed:', err))
        }
      }
    }, [])

    const handleMarkdownChange = useCallback(
      (md) => {
        latestCodeRef.current = md
        setIsDirty(true)
        setDirty(snippet?.id, true)
      },
      [snippet?.id, setDirty]
    )

    // --- Save Logic ---
    const handleSave = useCallback(async () => {
      if (
        !isMountedRef.current ||
        !snippetRef.current ||
        !snippet?.id ||
        !editorHandleRef.current
      ) {
        return
      }

      if (isSaving) return

      try {
        setIsSaving(true)
        const code = editorHandleRef.current.getMarkdown()

        const snippetToSave = {
          ...snippetRef.current,
          code: code || '',
          title: title || 'Untitled',
          timestamp: Date.now()
        }

        const updatedSnippet = await onSave(snippetToSave)

        if (isMountedRef.current) {
          if (updatedSnippet?.title && updatedSnippet.title !== title) {
            setTitle(updatedSnippet.title)
          }
          setIsDirty(false)
          setDirty(snippet.id, false)
          lastSavedCodeRef.current = code
          showToast('Note saved', 'success')
        }
      } catch (error) {
        console.error('Failed to save note:', error)
        if (isMountedRef.current) {
          showToast(`Failed to save note: ${error?.message || 'Unknown error'}`, 'error')
        }
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false)
        }
      }
    }, [title, snippet?.id, onSave, setDirty, showToast, isSaving])

    // Auto-save effect
    useEffect(() => {
      if (!snippet?.id || !isDirty) return

      const timer = setTimeout(() => {
        if (isMountedRef.current && snippetRef.current?.id === snippet.id) {
          handleSave()
        }
      }, 8000)
      return () => clearTimeout(timer)
    }, [isDirty, title, snippet?.id, handleSave])

    // Export functions
    const handleExportHTML = useCallback(async () => {
      if (!snippet || !editorHandleRef.current) return
      if (!window.api?.exportHTML) return
      try {
        const code = editorHandleRef.current.getMarkdown()
        const html = await window.api.exportHTML({
          title: title || snippet.title || 'Untitled',
          content: code,
          language: snippet.language || 'markdown'
        })
        if (html) {
          await navigator.clipboard.writeText(html)
          showToast('HTML copied to clipboard', 'success')
        }
      } catch (error) {
        showToast('Failed to export HTML', 'error')
      }
    }, [snippet, title, showToast])

    const handleExportPDF = useCallback(async () => {
      if (!snippet || !editorHandleRef.current) return
      if (!window.api?.exportPDF) return
      try {
        const code = editorHandleRef.current.getMarkdown()
        return await window.api.exportPDF({
          title: title || snippet.title || 'Untitled',
          content: code,
          language: snippet.language || 'markdown'
        })
      } catch (error) {
        showToast('Failed to export PDF', 'error')
        throw error
      }
    }, [snippet, title, showToast])

    const handleExportMarkdown = useCallback(async () => {
      if (!snippet || !editorHandleRef.current) return
      if (!window.api?.exportMarkdown) return
      try {
        const code = editorHandleRef.current.getMarkdown()
        return await window.api.exportMarkdown({
          title: title || snippet.title || 'Untitled',
          content: code,
          language: snippet.language || 'markdown'
        })
      } catch (error) {
        showToast('Failed to export markdown', 'error')
        throw error
      }
    }, [snippet, title, showToast])

    // CodeMirror natively handles cursor scrolling

    // Trigger autocomplete when inside wikilinks
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
              // Cursor is inside [[ ]]
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

    useKeyboardShortcuts({
      onSave: () => {
        if (isActive) handleSave()
      }
    })

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

    const dropExtension = React.useMemo(() => imageDropExtension(showToast), [showToast])

    const customHighlight = React.useMemo(() => {
      return syntaxHighlighting(
        HighlightStyle.define([
          { 
            tag: [t.heading, t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], 
            class: 'lumina-heading-text'
          }
        ])
      )
    }, [])

    const editorExtensions = React.useMemo(
      () => [
        customHighlight,
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              run: (view) => {
                if (isActiveRef.current) {
                  const { state } = view
                  const selection = state.selection.main
                  const tree = syntaxTree(state)
                  let node = tree.resolveInner(selection.head, 1)

                  // Find the nearest block node that we want to escape
                  while (
                    node &&
                    !['Document', 'FencedCode', 'Table', 'Blockquote', 'HTMLBlock'].includes(
                      node.name
                    )
                  ) {
                    node = node.parent
                  }

                  if (node && node.name !== 'Document') {
                    // If we are inside a code block/table, jump out and insert a newline!
                    view.dispatch({
                      changes: { from: node.to, insert: '\n' },
                      selection: { anchor: node.to + 1 }
                    })
                    return true
                  }

                  // Fallback: Just insert a newline at the end of the current line
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
                  const didRun = insertNewlineContinueMarkup(view)
                  if (didRun) {
                    const state = view.state
                    const pos = state.selection.main.head
                    const line = state.doc.lineAt(pos)
                    // If the new line only contains list markup (like "2." or "-") and lacks a trailing space
                    if (/^(\s*[-*+]|\s*\d+\.)\s*$/.test(line.text) && !line.text.endsWith(' ') && pos === line.to) {
                      view.dispatch({
                        changes: { from: line.to, insert: ' ' },
                        selection: { anchor: line.to + 1 }
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
        placeholder('Start writing...'),
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
            showToast(`Opening wikilink: ${target}`, 'info')
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
      [showToast, autocompleteTriggerListener, wikiLinkCompletionSource]
    )

    const handleTableLinkClick = useCallback(async (url) => {
      if (url.match(/^(https?|mailto|file):\/\//i)) {
        window.open(url, '_blank')
        return
      }
      
      showToast(`Opening wikilink: ${url}`, 'info')
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
    }, [showToast])

    const finalExtensions = React.useMemo(
      () => [
        ...editorExtensions,
        dropExtension,
        imageWidgetExtension,
        htmlWidgetExtension,
        calloutExtension,
        Prec.highest(tables({ onLinkClick: handleTableLinkClick }))
      ],
      [editorExtensions, dropExtension, handleTableLinkClick]
    )

    // Forceful Native Event Listener to Override CodeMirror
    useEffect(() => {
      const wrapper = editorWrapperRef.current
      if (!wrapper) return

      const cleanupHover = setupWikilinkHover(wrapper, useVaultStore.getState)

      const handleMouseDown = async (e) => {
        // Wiki link click
        const linkEl = e.target.closest('.cm-atomic-wiki-link')
        if (linkEl) {
          e.preventDefault()
          e.stopPropagation()
          const target = linkEl.getAttribute('data-wiki-link-target')
          if (target) {
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
            } catch (err) {
              showToast(`Failed to open wikilink: ${err.message}`, 'error')
            }
          }
          return
        }

        // Code block copy click
        const codeLine = e.target.closest('.cm-line.cb-code-header')
        if (codeLine) {
          const rect = codeLine.getBoundingClientRect()
          // Only copy if clicked on the right side (the language pill)
          if (e.clientX < rect.right - 80) return
          const id = codeLine.getAttribute('data-cb-id')
          const code = id != null ? codeMap.get(Number(id)) : null
          if (code != null) {
            e.preventDefault()
            e.stopPropagation()
            try {
              await navigator.clipboard.writeText(code)
              codeLine.classList.add('cb-copied')
              setCopiedBlockId(id)
              setTimeout(() => {
                if (codeLine) codeLine.classList.remove('cb-copied')
                setCopiedBlockId(null)
              }, 3000)
            } catch (err) {
              console.error('Failed to copy: ', err)
            }
          }
        }
      }

      wrapper.addEventListener('mousedown', handleMouseDown, { capture: true })
      return () => {
        wrapper.removeEventListener('mousedown', handleMouseDown, { capture: true })
        cleanupHover()
      }
    }, [showToast])

    const handleOverwriteClose = useCallback(() => {
      // Keep local edits
      if (conflictPrompt) lastSavedCodeRef.current = conflictPrompt.snippetCode
      setConflictPrompt(null)
    }, [conflictPrompt])

    const handleOverwriteConfirm = useCallback(() => {
      // Overwrite with external changes
      if (!conflictPrompt) return
      const code = conflictPrompt.snippetCode
      setIsDirty(false)
      lastSavedCodeRef.current = code
      if (realViewRef.current) {
        const view = realViewRef.current
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: code || '' }
        })
      } else {
        setEditorKey((k) => k + 1)
      }
    }, [conflictPrompt])

    return (
      <div
        className={`markdown-editor mode-source cursor-${caretStyle || 'smooth'}`}
        style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
      >
        {showFindWidget && realViewRef.current && (
          <FindWidget
            editorView={realViewRef.current}
            onClose={() => setShowFindWidget(false)}
            initialReplaceMode={replaceModeActive}
          />
        )}
        <ToastNotification toast={toast} onClose={clearToast} />
        {copiedBlockId != null && (
          <style>{`
            .cm-line.cb-code-header[data-cb-id="${copiedBlockId}"]::before {
              content: '✓ COPIED' !important;
              color: #4caf50 !important;
              background: transparent !important;
              border-color: transparent !important;
              font-weight: bold !important;
            }
          `}</style>
        )}

        <div className="editor-scroller">
          <EditorMenu
            title={title}
            snippet={snippet}
            setSelectedSnippet={setSelectedSnippet}
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={handleSave}
            onToggleInspector={onToggleInspector}
            onExportHTML={handleExportHTML}
            onExportPDF={handleExportPDF}
            onExportMarkdown={handleExportMarkdown}
            onPreview={() => setIsPreviewOpen(true)}
          />
          <PreviewModal
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            title={title}
            content={snippetRef.current?.code || ''}
          />
          <OverwriteModal
            isOpen={!!conflictPrompt}
            onClose={handleOverwriteClose}
            onConfirm={handleOverwriteConfirm}
            title="File Modified Externally"
            message={`The file "${conflictPrompt?.snippetTitle}" was modified externally. Do you want to reload the new version and lose your local edits, or keep your local edits?`}
            confirmText="Overwrite"
            cancelText="Keep My Edits"
          />
          <div className="editor-canvas-wrap" ref={editorWrapperRef}>
            {settings.inlineMetadata && (
              <EditorMetadata
                titleRef={titleRef}
                snippet={snippet}
                onSave={onSave}
                snippets={snippets}
                title={title}
                setTitle={setTitle}
                setIsDirty={setIsDirty}
              />
            )}

            <AtomicCodeMirrorEditor
              key={`${snippet?.id}-${editorKey}`}
              documentId={snippet?.id}
              markdownSource={snippet?.code || ''}
              onMarkdownChange={handleMarkdownChange}
              editorHandleRef={editorHandleRef}
              codeLanguages={languages}
              extensions={finalExtensions}
              onLinkClick={(url) => {
                if (window.api?.openExternal) {
                  window.api.openExternal(url)
                } else {
                  window.open(url, '_blank', 'noopener,noreferrer')
                }
              }}
            />
          </div>
        </div>

        <StatusBar
          wordCount={snippet?.code ? snippet.code.trim().split(/\s+/).filter(Boolean).length : 0}
          extension={snippet?.title && snippet.title.includes('.') ? snippet.title.split('.').pop() : 'md'}
          onToggleInspector={onToggleInspector}
          onToggleExplorerModal={onToggleExplorerModal}
          onSettingsClick={onSettingsClick}
          onThemeClick={onThemeClick}
          onGraphClick={onGraphClick}
          onDailyNoteClick={onDailyNoteClick}
        />
      </div>
    )
  },
  (prevProps, nextProps) => {
    const prevSnippet = prevProps.snippet
    const nextSnippet = nextProps.snippet
    if (prevSnippet === nextSnippet && prevProps.isActive === nextProps.isActive) return true
    return (
      prevSnippet?.id === nextSnippet?.id &&
      prevSnippet?.code === nextSnippet?.code &&
      prevSnippet?.title === nextSnippet?.title &&
      prevSnippet?.customIcon === nextSnippet?.customIcon &&
      prevSnippet?.color === nextSnippet?.color &&
      prevSnippet?.isPinned === nextSnippet?.isPinned &&
      prevProps.onSave === nextProps.onSave &&
      prevProps.onToggleInspector === nextProps.onToggleInspector &&
      prevProps.isActive === nextProps.isActive
    )
  }
)

MarkdownEditor.displayName = 'MarkdownEditor'

export default MarkdownEditor
