import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MoreVertical, Save } from 'lucide-react'
import hljs from 'highlight.js'
import EditorTitleBar from './components/EditorTitleBar'
import EditorFooter from './components/EditorFooter'
import EditorMetadata from './components/EditorMetadata'
import FindWidget from './components/FindWidget'
import PreviewModal from '../Overlays/PreviewModal'
import InlineAIModal from '../Overlays/InlineAIModal'
import ModalHeader from '../Overlays/ModalHeader'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { richMarkdown, editorMode } from './richMarkdown'
import { wikiLinkCompletion } from './wikiLinkCompletion'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useFontSettings } from '../../core/hooks/useFontSettings'
import { useToast } from '../../core/hooks/useToast'
import ToastNotification from '../../core/notification'
import './MarkdownEditor.css'

// CodeMirror 6 Imports
import { EditorView } from 'codemirror'
import { EditorState, Compartment, StateField } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { keymap, highlightActiveLine, dropCursor, lineNumbers, Decoration } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands'
import { indentOnInput, bracketMatching } from '@codemirror/language'
import { highlightSelectionMatches } from '@codemirror/search'
import {
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap
} from '@codemirror/autocomplete'
import { luminaSyntax } from './syntaxTheme'
import { seamlessTheme } from './editorTheme'
import { wikiHoverPreview } from './wikiHoverPreview'
import { imageHoverPreview } from './imageHoverPreview'

/**
 * Obsidian-Grade Markdown Editor
 * Optimized for instant note switching and layout stability.
 * Memoized for performance - expensive CodeMirror operations.
 */
const MarkdownEditor = React.memo(({ snippet, onSave, onToggleInspector }) => {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const workerRef = useRef(null)
  const titleRef = useRef(null)
  const scrollerRef = useRef(null)
  const themeCompartment = useRef(new Compartment())
  const lineNumberCompartment = useRef(new Compartment())
  const { toast, showToast, clearToast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const isMountedRef = useRef(true)

  // Persistence Refs
  const snippetsRef = useRef([])
  const snippetRef = useRef(snippet)
  const isViewAliveRef = useRef(false)
  const ignoreUpdateRef = useRef(false)
  const scrollPosMap = useRef(new Map())

  // Inline AI ref for CodeMirror keymap
  const setIsInlineAIOpenRef = useRef(null)

  // Search highlighting compartment
  const searchHighlightCompartment = useRef(new Compartment())

  const { settings } = useSettingsStore()
  const { snippets, setSelectedSnippet, updateSnippetSelection, setDirty } = useVaultStore()
  const { caretStyle, caretWidth, caretColor } = useFontSettings()

  // Create a CodeMirror theme for the caret using EditorView.theme so it is applied by the editor
  const caretTheme = useMemo(() => {
    const widthRaw = caretWidth || getComputedStyle(document.documentElement).getPropertyValue('--caret-width').trim() || '2px'
    const width = typeof widthRaw === 'number' ? `${widthRaw}px` : widthRaw.toString()
    const color = caretColor || getComputedStyle(document.documentElement).getPropertyValue('--caret-color').trim() || 'var(--text-accent)'
    const style = caretStyle || 'smooth'
    const useBorder = (settings?.cursor && typeof settings.cursor.useBorderLeft !== 'undefined') ? settings.cursor.useBorderLeft : true

    // caret theme values computed

    if (style === 'block') {
      return EditorView.theme({
        '.cm-cursor': {
          backgroundColor: color,
          width: '0.6em'
        }
      })
    }

    // If using border-left approach, set border styles; otherwise use background-color sizing
    if (useBorder) {
      return EditorView.theme({
        '.cm-cursor': {
          borderLeftWidth: width,
          borderLeftColor: color,
          borderLeftStyle: 'solid'
        }
      })
    }

    return EditorView.theme({
      '.cm-cursor': {
        backgroundColor: color,
        width: width,
        marginLeft: `calc(-1 * ${width} / 2)`
      }
    })
  }, [caretStyle, caretWidth, caretColor, (settings?.cursor && settings.cursor.useBorderLeft)])

  const [title, setTitle] = useState(snippet?.title || '')
  const [isDirty, setIsDirty] = useState(false)
  const [viewMode, setViewMode] = useState('source') // 'source' = editor (show syntax), 'live' = preview (hide syntax)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isOverlayOpen, setIsOverlayOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [isInlineAIOpen, setIsInlineAIOpen] = useState(false)
  const [isFindWidgetOpen, setIsFindWidgetOpen] = useState(false)
  const [findWidgetReplaceMode, setFindWidgetReplaceMode] = useState(false)

  // Sync ref with state setter for CodeMirror keymap
  useEffect(() => {
    setIsInlineAIOpenRef.current = setIsInlineAIOpen
  }, [])

  // Global Ctrl+F / Cmd+F to open local find, Ctrl+H to toggle replace, Esc to close
  useEffect(() => {
    const handleFindShortcut = (e) => {
      const key = e.key && e.key.toLowerCase()

      // Ctrl+F / Cmd+F opens local editor find or focuses if already open
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'f') {
        e.preventDefault()
        // Get the currently selected text, preferring the editor selection
        let selectedText = ''

        // 1) Prefer CodeMirror's logical selection (works even if widget isn't open yet)
        if (viewRef.current) {
          const selection = viewRef.current.state.selection.main
          if (selection.from !== selection.to) {
            selectedText = viewRef.current.state.doc.sliceString(selection.from, selection.to)
          }
        }

        // 2) Fallback to DOM selection (e.g. reading/preview mode or outside editor)
        if (!selectedText) {
          const domSelection = window.getSelection ? window.getSelection() : null
          if (domSelection && domSelection.toString().trim()) {
            selectedText = domSelection.toString()
          }
        }

        // Ensure widget is open
        if (!isFindWidgetOpen) {
          setFindWidgetReplaceMode(false)
          setIsFindWidgetOpen(true)
        }

        // If we have a selection, push it into the widget; otherwise just focus
        setTimeout(() => {
          if (selectedText) {
            window.dispatchEvent(
              new CustomEvent('find-widget-set-query', {
                detail: { query: selectedText }
              })
            )
          } else {
            window.dispatchEvent(new CustomEvent('find-widget-focus-search'))
          }
        }, 0)
        return
      }

      // Ctrl+H / Cmd+H toggles replace mode
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && key === 'h') {
        e.preventDefault()
        if (isFindWidgetOpen) {
          // Toggle replace dropdown in the existing widget
          window.dispatchEvent(new CustomEvent('find-widget-toggle-replace'))
        } else {
          // Open with replace mode
          setFindWidgetReplaceMode(true)
          setIsFindWidgetOpen(true)
        }
        return
      }

      // Esc closes find widget if open
      if (key === 'escape' && isFindWidgetOpen) {
        e.preventDefault()
        setIsFindWidgetOpen(false)
        setFindWidgetReplaceMode(false)
        window.dispatchEvent(new CustomEvent('search-clear'))
      }
    }

    window.addEventListener('keydown', handleFindShortcut)
    return () => window.removeEventListener('keydown', handleFindShortcut)
  }, [isFindWidgetOpen])

  // Sync Global Snippets for Wikilinks
  useEffect(() => {
    snippetsRef.current = snippets
  }, [snippets])
  useEffect(() => {
    snippetRef.current = snippet
  }, [snippet])

  // --- Worker Lifecycle ---
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../../core/workers/markdown.worker.js', import.meta.url),
      { type: 'module' }
    )
    workerRef.current.onmessage = (e) => {
      if (e.data.html !== undefined) {
        setPreviewContent(e.data.html)
      }
    }
    workerRef.current.onerror = (err) => {
      console.error('[MarkdownEditor] Worker error:', err)
    }
    return () => workerRef.current?.terminate()
  }, [])

  // --- Helper: Get Target State ---
  const createTargetState = useCallback(
    (content, sel) => {
      return EditorState.create({
        doc: content || '',
        extensions: [
          editorMode.of(viewMode),
          // Make editor read-only in preview mode (live mode)
          viewMode === 'live' ? EditorState.readOnly.of(true) : [],
          // Use a compartment for line numbers so we can reconfigure live
          lineNumberCompartment.current.of(viewMode === 'source' && settings.showLineNumbers ? lineNumbers() : []),
          highlightActiveLine(),
          dropCursor(),
          history(),
          indentOnInput(),
          closeBrackets(),
          luminaSyntax,
          bracketMatching(),
          // richMarkdown only in live mode (hides syntax), not in source mode
          ...(viewMode === 'live' ? richMarkdown : []),
          imageHoverPreview,
          wikiHoverPreview(
            () => snippetsRef.current,
            setSelectedSnippet,
            async (title) => {
              const s = {
                id: crypto.randomUUID(),
                title,
                code: '',
                language: 'markdown',
                timestamp: Date.now()
              }
              await onSave(s)
              setSelectedSnippet(s)
            }
          ),
          autocompletion({ override: [wikiLinkCompletion(() => snippetsRef.current)] }),
          highlightSelectionMatches(),
          searchHighlightCompartment.current.of([]),
          markdown({ codeLanguages: languages }),
          // Theme compartment encapsulates caret and editor theme extensions
          themeCompartment.current.of([caretTheme, seamlessTheme]),
          EditorView.lineWrapping,
          keymap.of([
            /**
             * Custom Keymap Configuration
             *
             * Priority order matters - earlier bindings take precedence.
             *
             * 1. Inline AI (Mod-k) - Custom override, must be first
             * 2. Search keymap (filtered) - Find/replace, but Mod-f and Mod-g disabled
             *    - Mod-f and Mod-g are disabled to prevent conflicts with:
             *      - Ctrl+G: GraphNexus modal (global shortcut)
             *      - Ctrl+F: Can be used for other features if needed
             * 3. Standard keymaps - Brackets, default, history, completion
             * 4. In reading mode, filter out editing keymaps
             */
            // Custom: Ctrl+K for Inline AI (must be first to override default)
            {
              key: 'Mod-k',
              run: () => {
                setIsInlineAIOpenRef.current(true)
                return true
              }
            },
            // Custom: Ctrl+F for local find widget (editor-only search)
            {
              key: 'Mod-f',
              run: () => {
                setIsFindWidgetOpen(true)
                return true
              }
            },
            // Filter out Mod-i from defaultKeymap to allow Ctrl+I for Inspector toggle
            ...defaultKeymap.filter(
              (binding) => binding.key !== 'Mod-i'
            ),
            ...closeBracketsKeymap,
            ...historyKeymap,
            ...completionKeymap
          ]),
          EditorView.updateListener.of((update) => {
            if (ignoreUpdateRef.current) return
            if (update.docChanged) {
              setIsDirty(true)
              const code = update.state.doc.toString()
              // Always update preview content for reading mode
              workerRef.current?.postMessage({
                code,
                id: snippetRef.current?.id
              })
            }
            if (update.selectionSet) {
              const sel = update.state.selection.main
              updateSnippetSelection(snippetRef.current?.id, { anchor: sel.anchor, head: sel.head })
            }
          })
        ],
        selection: sel
      })
    },
    [viewMode, onSave, setSelectedSnippet, updateSnippetSelection]
  )

  // No need for preview content update - live preview uses richMarkdown decorations

  // --- Core Lifecycle: Instant Note Switching ---
  useEffect(() => {
    if (!hostRef.current) return

    // Save previous scroll position before switching
    if (viewRef.current && isViewAliveRef.current) {
      scrollPosMap.current.set(snippetRef.current.id, scrollerRef.current?.scrollTop || 0)
    }

    const targetSelection = snippet?.selection || { anchor: 0, head: 0 }

    if (!viewRef.current) {
      // Lazy Init View
      const state = createTargetState(snippet?.code, targetSelection)
      const view = new EditorView({ state, parent: hostRef.current })
      viewRef.current = view
      isViewAliveRef.current = true
    } else {
      // Instant State Swap (Obsidian Style)
      // Always recreate state when viewMode changes to ensure decorations rebuild
      ignoreUpdateRef.current = true
      try {
        const state = createTargetState(snippet?.code, targetSelection)
        // Safety check: ensure state is valid before setting
        if (state && state.doc) {
          viewRef.current.setState(state)
        }
      } catch (err) {
        console.error('[MarkdownEditor] Error setting state:', err)
        // Fallback: recreate view if state swap fails
        if (viewRef.current) {
          viewRef.current.destroy()
        }
        const state = createTargetState(snippet?.code, targetSelection)
        const view = new EditorView({ state, parent: hostRef.current })
        viewRef.current = view
        isViewAliveRef.current = true
      } finally {
        ignoreUpdateRef.current = false
      }
    }

    // Immediate Scroll & Focus Restore
    if (snippet?.id) {
      const savedScroll = scrollPosMap.current.get(snippet.id) || 0
      if (scrollerRef.current) scrollerRef.current.scrollTop = savedScroll
    }

    if (snippet?.title === 'New Note') {
      titleRef.current?.focus()
      titleRef.current?.select()
    } else if (viewRef.current) {
      viewRef.current.focus()
    }

    // Refresh Preview (always update for reading mode)
    if (workerRef.current && snippet?.id) {
      workerRef.current.postMessage({ code: snippet?.code || '', id: snippet.id })
    }
    setTitle(snippet?.title || '')
    setIsDirty(false)
  }, [snippet?.id, createTargetState, viewMode]) // Add viewMode to dependencies to rebuild on mode change

  // Highlight code blocks in reading/overlay previews when previewContent changes
  useEffect(() => {
    try {
      const inDocCodes = document.querySelectorAll('.reading-preview-container pre code, .reading-preview-content pre code, .in-editor-preview-card pre code')
      if (inDocCodes && inDocCodes.length) {
        inDocCodes.forEach((el) => {
          try { hljs.highlightElement(el) } catch (e) { /* ignore */ }
        })
      }
    } catch (e) {
      // ignore highlighting errors
    }
  }, [previewContent])

  // Search highlighting and navigation
  useEffect(() => {
    if (!viewRef.current) return

    const createSearchHighlightField = (decorations) => {
      return StateField.define({
        create() {
          return decorations
        },
        update(decorations, tr) {
          return decorations.map(tr.changes)
        },
        provide: f => EditorView.decorations.from(f)
      })
    }

    const handleSearchUpdate = (e) => {
      const { searchQuery, pattern } = e.detail
      if (!viewRef.current || !searchQuery || !pattern) {
        // Clear highlights
        try {
          viewRef.current.dispatch({
            effects: searchHighlightCompartment.current.reconfigure([])
          })
        } catch (err) {
          console.error('[MarkdownEditor] Search clear error:', err)
        }
        return
      }

      try {
        const content = viewRef.current.state.doc.toString()
        const regex = new RegExp(pattern.source, pattern.flags)
        const matches = [...content.matchAll(regex)]

        const decorations = []
        matches.forEach((match) => {
          const from = match.index
          const to = from + match[0].length
          if (from >= 0 && to <= content.length && from < to) {
            decorations.push(Decoration.mark({ class: 'cm-search-highlight' }).range(from, to))
          }
        })

        const decoSet = decorations.length > 0 ? Decoration.set(decorations) : Decoration.none

        // Update the compartment with the new field
        viewRef.current.dispatch({
          effects: searchHighlightCompartment.current.reconfigure([
            createSearchHighlightField(decoSet)
          ])
        })
      } catch (err) {
        console.error('[MarkdownEditor] Search highlight error:', err)
        // Clear on error
        try {
          viewRef.current.dispatch({
            effects: searchHighlightCompartment.current.reconfigure([])
          })
        } catch (clearErr) {
          // Ignore clear errors
        }
      }
    }

    const handleSearchClear = () => {
      if (!viewRef.current) return
      try {
        viewRef.current.dispatch({
          effects: searchHighlightCompartment.current.reconfigure([])
        })
      } catch (err) {
        console.error('[MarkdownEditor] Search clear error:', err)
      }
    }

    const handleSearchNavigate = (e) => {
      const { snippetId, start, end } = e.detail
      if (!viewRef.current || snippet?.id !== snippetId) return

      try {
        const view = viewRef.current
        const docLength = view.state.doc.length
        const from = Math.max(0, Math.min(start, docLength))
        const to = Math.max(from, Math.min(end, docLength))

        view.dispatch({
          selection: { anchor: from, head: to },
          effects: EditorView.scrollIntoView(from, { y: 'center' })
        })
        view.focus()
      } catch (err) {
        console.error('[MarkdownEditor] Search navigate error:', err)
      }
    }

    window.addEventListener('search-update', handleSearchUpdate)
    window.addEventListener('search-clear', handleSearchClear)
    window.addEventListener('search-navigate', handleSearchNavigate)

    return () => {
      window.removeEventListener('search-update', handleSearchUpdate)
      window.removeEventListener('search-clear', handleSearchClear)
      window.removeEventListener('search-navigate', handleSearchNavigate)
    }
  }, [snippet?.id])

  // Keep editor content in sync when a note is changed externally (e.g. global Search & Replace)
  useEffect(() => {
    const handleExternalUpdate = (e) => {
      const { snippetId, code } = e.detail || {}
      if (!viewRef.current || !snippet?.id || snippetId !== snippet.id) return

      try {
        const view = viewRef.current
        const doc = view.state.doc
        const docLength = doc.length

        ignoreUpdateRef.current = true
        view.dispatch({
          changes: { from: 0, to: docLength, insert: code || '' }
        })
      } catch (err) {
        console.error('[MarkdownEditor] External snippet update error:', err)
      } finally {
        ignoreUpdateRef.current = false
      }
    }

    window.addEventListener('snippet-external-update', handleExternalUpdate)
    return () => window.removeEventListener('snippet-external-update', handleExternalUpdate)
  }, [snippet?.id])

  // Caret styling: apply computed CSS variables or inline fallbacks to CodeMirror cursor elements
  useEffect(() => {
    if (!viewRef.current) return

    const root = document.documentElement
    const getVars = () => {
      const w = getComputedStyle(root).getPropertyValue('--caret-width').trim() || caretWidth || '2px'
      const c = getComputedStyle(root).getPropertyValue('--caret-color').trim() || caretColor || 'var(--text-accent)'
      const style = getComputedStyle(root).getPropertyValue('--caret-style').trim() || caretStyle || 'smooth'
      const useBorder = (settings?.cursor && typeof settings.cursor.useBorderLeft !== 'undefined') ? settings.cursor.useBorderLeft : true
      return { width: w, color: c, style, useBorder }
    }

    const applyCaretStyles = () => {
      try {
        const { width, color, style, useBorder } = getVars()
        const editorDOM = viewRef.current.dom
        const cursors = [
          ...(viewRef.current.contentDOM?.querySelectorAll('.cm-cursor, .cm-cursor-primary') || []),
          ...(editorDOM?.querySelectorAll('.cm-cursor, .cm-cursor-primary') || []),
          ...(document.querySelectorAll('.markdown-editor .cm-cursor, .markdown-editor .cm-cursor-primary') || [])
        ]
        if (!cursors.length) return
        cursors.forEach((cursor) => {
          // clear previous inline styles we control
          cursor.style.removeProperty('border-left')
          cursor.style.removeProperty('border-left-width')
          cursor.style.removeProperty('border-left-color')
          cursor.style.removeProperty('border-left-style')
          cursor.style.removeProperty('background-color')
          cursor.style.removeProperty('width')
          cursor.style.removeProperty('opacity')
          cursor.style.removeProperty('margin-left')

          if (style === 'block' || !useBorder) {
            cursor.style.setProperty('border-left', 'none', 'important')
            cursor.style.setProperty('background-color', color, 'important')
            cursor.style.setProperty('width', style === 'block' ? '0.6em' : width, 'important')
            cursor.style.setProperty('margin-left', '0', 'important')
            cursor.style.setProperty('opacity', '0.7', 'important')
          } else {
            const w = width.endsWith('px') ? width : `${width}`
            cursor.style.setProperty('border-left-width', w, 'important')
            cursor.style.setProperty('border-left-color', color, 'important')
            cursor.style.setProperty('border-left-style', 'solid', 'important')
            cursor.style.setProperty('margin-left', `calc(-1 * ${w} / 2)`, 'important')
            cursor.style.setProperty('background-color', 'transparent', 'important')
          }
          void cursor.offsetHeight
        })
      } catch (e) {
        // ignore
      }
    }

    // initial apply
    applyCaretStyles()

    // observer to apply when editor DOM mutates
    const mo = new MutationObserver(() => requestAnimationFrame(applyCaretStyles))
    if (viewRef.current.contentDOM) mo.observe(viewRef.current.contentDOM, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] })

    // update when root style changes or when our settings change externally
    const rootObserver = new MutationObserver(() => requestAnimationFrame(applyCaretStyles))
    rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] })

    const handleCaretUpdate = () => requestAnimationFrame(applyCaretStyles)
    window.addEventListener('caret-style-update', handleCaretUpdate)

    if (viewRef.current?.dom) {
      viewRef.current.dom.addEventListener('focus', applyCaretStyles, true)
      viewRef.current.dom.addEventListener('selectionchange', applyCaretStyles, true)
    }

    return () => {
      mo.disconnect()
      rootObserver.disconnect()
      window.removeEventListener('caret-style-update', handleCaretUpdate)
      if (viewRef.current?.dom) {
        viewRef.current.dom.removeEventListener('focus', applyCaretStyles, true)
        viewRef.current.dom.removeEventListener('selectionchange', applyCaretStyles, true)
      }
    }
  }, [caretStyle, caretWidth, caretColor, settings?.cursor?.useBorderLeft, snippet.id])

  // Reconfigure the theme compartment when caret/theme changes so running view updates
  useEffect(() => {
    if (!viewRef.current) return
    try {
      viewRef.current.dispatch({
        effects: themeCompartment.current.reconfigure([caretTheme, seamlessTheme])
      })
    } catch (err) {
      // If reconfigure fails, recreate the state as a fallback
      try {
        const sel = viewRef.current.state.selection.main
        const state = createTargetState(viewRef.current.state.doc.toString(), sel)
        viewRef.current.setState(state)
      } catch (e) {
        console.error('[MarkdownEditor] Failed to reconfigure theme:', e)
      }
    }
  }, [caretTheme, seamlessTheme, createTargetState])

  // Reconfigure line numbers compartment when setting or viewMode changes
  useEffect(() => {
    if (!viewRef.current) return
    const ext = viewMode === 'source' && settings?.showLineNumbers ? lineNumbers() : []
    try {
      viewRef.current.dispatch({ effects: lineNumberCompartment.current.reconfigure(ext) })
    } catch (err) {
      // fallback to state recreate
      try {
        const sel = viewRef.current.state.selection.main
        const state = createTargetState(viewRef.current.state.doc.toString(), sel)
        viewRef.current.setState(state)
      } catch (e) {
        console.error('[MarkdownEditor] Failed to reconfigure line numbers:', e)
      }
    }
  }, [settings?.showLineNumbers, viewMode, createTargetState])

  // Font variables are managed by `useFontSettings` for a single source of truth.
  // Removing redundant settings-based CSS updates to avoid overriding the hook.

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // --- Save Logic ---
  const handleSave = useCallback(async () => {
    if (!isMountedRef.current || !viewRef.current || !snippetRef.current || !snippet?.id) {
      return
    }

    // Prevent saving if already saving (race condition protection)
    if (isSaving) {
      return
    }

    try {
      setIsSaving(true)
      const code = viewRef.current.state.doc.toString()
      const sel = viewRef.current.state.selection.main

      // Validate snippet data before saving
      const snippetToSave = {
        ...snippetRef.current,
        code: code || '',
        title: title || 'Untitled',
        selection: { anchor: sel.anchor, head: sel.head },
        timestamp: Date.now()
      }

      // Ensure snippet has required fields
      if (!snippetToSave.id) {
        throw new Error('Snippet ID is missing')
      }

      await onSave(snippetToSave)

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setIsDirty(false)
        setDirty(snippet.id, false)
        showToast('Note saved', 'success')
      }
    } catch (error) {
      console.error('Failed to save note:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      if (isMountedRef.current) {
        showToast(`Failed to save note: ${errorMessage}`, 'error')
      }
      // Don't clear dirty state on error - user should retry
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false)
      }
    }
  }, [title, snippet?.id, onSave, setDirty, showToast, isSaving])

  // Auto-save effect
  useEffect(() => {
    if (!snippet?.id) return
    setDirty(snippet.id, isDirty)
    if (!isDirty) return

    // Prevent race conditions: only save if component is still mounted and snippet hasn't changed
    const timer = setTimeout(() => {
      // Check if component is still mounted, viewRef exists, and snippet matches
      if (isMountedRef.current && viewRef.current && snippetRef.current?.id === snippet.id) {
        handleSave()
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [isDirty, title, snippet?.id, handleSave])

  // Handle inline AI insertion
  const handleInlineAIInsert = useCallback((text) => {
    if (!viewRef.current || !text) return

    try {
      const view = viewRef.current
      const selection = view.state.selection.main

      // Validate selection bounds
      const docLength = view.state.doc.length
      const from = Math.max(0, Math.min(selection.from, docLength))
      const to = Math.max(from, Math.min(selection.to, docLength))

      const transaction = view.state.update({
        changes: {
          from,
          to,
          insert: String(text)
        },
        selection: { anchor: Math.min(from + String(text).length, docLength + String(text).length) }
      })

      view.dispatch(transaction)
      setIsDirty(true)
    } catch (error) {
      console.error('Failed to insert AI text:', error)
    }
  }, [])

  // Export functions
  const handleExportHTML = useCallback(async () => {
    if (!snippet || !viewRef.current) {
      showToast('No content to export', 'error')
      return
    }

    if (!window.api?.exportHTML) {
      showToast('Export feature unavailable. Please restart the application.', 'error')
      return
    }

    try {
      const code = viewRef.current.state.doc.toString()
      if (!code.trim()) {
        showToast('Cannot export empty note', 'error')
        return
      }
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
      console.error('Failed to export HTML:', error)
      showToast('Failed to export HTML. Please try again.', 'error')
    }
  }, [snippet, title, showToast])

  const handleExportPDF = useCallback(async () => {
    if (!snippet || !viewRef.current) {
      showToast('No content to export', 'error')
      return
    }

    if (!window.api?.exportPDF) {
      showToast('Export feature unavailable. Please restart the application.', 'error')
      return
    }

    try {
      const code = viewRef.current.state.doc.toString()
      if (!code.trim()) {
        showToast('Cannot export empty note', 'error')
        return
      }
      const result = await window.api.exportPDF({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
      return result
    } catch (error) {
      console.error('Failed to export PDF:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      showToast(`Failed to export PDF: ${errorMessage}`, 'error')
      throw error
    }
  }, [snippet, title, showToast])

  const handleExportMarkdown = useCallback(async () => {
    if (!snippet || !viewRef.current) {
      showToast('No content to export', 'error')
      return
    }

    try {
      // Check if API is available
      if (!window.api || typeof window.api.exportMarkdown !== 'function') {
        showToast('Export feature unavailable. Please restart the application.', 'error')
        throw new Error('Export Markdown API is not available. Please restart the application.')
      }

      const code = viewRef.current.state.doc.toString()
      if (!code.trim()) {
        showToast('Cannot export empty note', 'error')
        return
      }
      const result = await window.api.exportMarkdown({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
      return result
    } catch (error) {
      console.error('Failed to export markdown:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      showToast(`Failed to export: ${errorMessage}`, 'error')
      throw error
    }
  }, [snippet, title, showToast])

  useKeyboardShortcuts({
    onSave: handleSave,
    // onToggleInspector removed - handled globally in AppShell
    onTogglePreview: () => setIsPreviewOpen((p) => !p),
    onEscape: () => {
      if (isInlineAIOpen) {
        setIsInlineAIOpen(false)
        return true
      }
      if (isPreviewOpen) {
        setIsPreviewOpen(false)
        return true
      }
      return false
    },
    onInlineAI: () => {
      setIsInlineAIOpen(true)
      return true
    }
  })

  // Overlay interaction handling (wiki links, copy buttons)
  useEffect(() => {
    if (!isOverlayOpen) return

    const overlay = document.querySelector('.in-editor-preview-overlay')
    if (!overlay) return

    const handleClick = (e) => {
      const wikiLink = e.target.closest('.preview-wikilink')
      if (wikiLink) {
        const titleAttr = wikiLink.getAttribute('data-title') || wikiLink.getAttribute('data-target')
        if (titleAttr) {
          const target = titleAttr
          const found = (snippetsRef.current || []).find(
            (s) => s.title && s.title.toLowerCase() === target.toLowerCase()
          )
          if (found) {
            setSelectedSnippet(found)
            setIsOverlayOpen(false)
          }
        }
      }
    }

    overlay.addEventListener('click', handleClick)
    return () => overlay.removeEventListener('click', handleClick)
  }, [isOverlayOpen, previewContent])

  // Use the actual `viewMode` value for the container class so 'reading' doesn't map to 'live'
  const safeViewMode = viewMode

  return (
    <div className={`markdown-editor mode-${safeViewMode} cursor-${caretStyle || 'smooth'}`}>
      <ToastNotification toast={toast} onClose={clearToast} />
      <EditorTitleBar
        title={title}
        snippet={snippet}
        setSelectedSnippet={setSelectedSnippet}
        isDirty={isDirty}
        isSaving={isSaving}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onSave={handleSave}
        onToggleInspector={onToggleInspector}
        onExportHTML={handleExportHTML}
        onExportPDF={handleExportPDF}
        onExportMarkdown={handleExportMarkdown}
        onInlineAI={() => setIsInlineAIOpen(true)}
      />

      {/* Local Find Widget - appears above editor content, below titlebar */}
      {isFindWidgetOpen && viewRef.current && (
        <FindWidget
          editorView={viewRef.current}
          initialReplaceMode={findWidgetReplaceMode}
          onClose={() => {
            setIsFindWidgetOpen(false)
            setFindWidgetReplaceMode(false)
          }}
        />
      )}

      <div className="editor-scroller" ref={scrollerRef} style={{ position: 'relative' }}>
        <div className="editor-canvas-wrap" style={{ position: 'relative' }}>
          <input
            type="text"
            ref={titleRef}
            className="editor-large-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setIsDirty(true)
            }}
            onDoubleClick={(e) => e.target.select()}
            placeholder="Untitled"
            spellCheck="false"
          />

          {settings.inlineMetadata && (
            <EditorMetadata snippet={snippet} onSave={onSave} snippets={snippets} />
          )}

          {viewMode === 'reading' ? (
            // Reading mode: Show rendered HTML preview
            <div className="reading-preview-container">
              <div
                className="reading-preview-content"
                dangerouslySetInnerHTML={{ __html: previewContent || '' }}
              />
            </div>
          ) : (
            // Editor mode: Show CodeMirror
            <div className="cm-host-container" ref={hostRef} />
          )}
          {isOverlayOpen && (
            <div className="in-editor-preview-overlay" onClick={(e) => e.stopPropagation()}>
              <div className="in-editor-preview-card" role="dialog" aria-modal="true">
                <ModalHeader
                  left={(
                    <div className="modal-title-stack preview-breadcrumb">
                      <span className="preview-indicator-tag">MARKDOWN</span>
                      <span className="preview-filename-text">{title || 'Untitled'}</span>
                    </div>
                  )}
                  onClose={() => setIsOverlayOpen(false)}
                />

                <div className="in-editor-preview-body seamless-scrollbar" style={{ overflow: 'auto' }}>
                  <div className="preview-inner-canvas">
                    <style>{/* reuse modal preview styles inline for parity */ `
                      .preview-inner-canvas { padding: 2rem 6% 4rem 6%; max-width: 900px; margin: 0 auto; }
                      pre { background: rgba(var(--text-accent-rgb), 0.03); padding: 1.5em; border-radius: 12px; border: 1px solid var(--border-subtle); overflow-x: auto; margin: 2em 0; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.9em; line-height: 1.6; }
                      code { font-family: 'JetBrains Mono', 'Fira Code', monospace; background: rgba(var(--text-accent-rgb), 0.1); padding: 0.2em 0.5em; border-radius: 6px; font-size: 0.9em; color: var(--text-accent); }
                      .code-block-header { display:flex; justify-content:space-between; align-items:center; padding:0 12px; font-size:12px; font-weight:600; color:var(--text-secondary); }
                      .copy-code-btn { background: transparent; border: none; cursor: pointer; color: var(--text-secondary); }
                    `}</style>
                    <article dangerouslySetInnerHTML={{ __html: previewContent || '' }} />
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
      <EditorFooter
        isDirty={isDirty}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onTogglePreview={() => setIsPreviewOpen((p) => !p)}
      />

      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        content={previewContent}
        title={title}
      />
      {isInlineAIOpen && (
        <InlineAIModal
          isOpen={isInlineAIOpen}
          onClose={() => setIsInlineAIOpen(false)}
          onInsert={handleInlineAIInsert}
          cursorPosition={viewRef.current?.state.selection.main}
          editorView={viewRef.current}
        />
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if snippet ID or key props change
  // This prevents unnecessary re-renders when other parts of the app update
  const prevSnippet = prevProps.snippet
  const nextSnippet = nextProps.snippet

  // If snippets are the same reference, skip re-render
  if (prevSnippet === nextSnippet) return true

  // Compare key properties
  return (
    prevSnippet?.id === nextSnippet?.id &&
    prevSnippet?.code === nextSnippet?.code &&
    prevSnippet?.title === nextSnippet?.title &&
    prevProps.onSave === nextProps.onSave &&
    prevProps.onToggleInspector === nextProps.onToggleInspector
  )
})

MarkdownEditor.displayName = 'MarkdownEditor'

export default MarkdownEditor
