import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MoreVertical, Save } from 'lucide-react'
import EditorTitleBar from './components/EditorTitleBar'
import EditorFooter from './components/EditorFooter'
import EditorMetadata from './components/EditorMetadata'
import PreviewModal from '../Overlays/PreviewModal'
import InlineAIModal from '../Overlays/InlineAIModal'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { richMarkdown, editorMode } from './richMarkdown'
import { wikiLinkCompletion } from './wikiLinkCompletion'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import './MarkdownEditor.css'

// CodeMirror 6 Imports
import { EditorView } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { keymap, highlightActiveLine, dropCursor, lineNumbers } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands'
import { indentOnInput, bracketMatching } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
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
 */
const MarkdownEditor = ({ snippet, onSave, onToggleInspector }) => {
  const hostRef = useRef(null)
  const viewRef = useRef(null)
  const workerRef = useRef(null)
  const titleRef = useRef(null)
  const scrollerRef = useRef(null)

  // Persistence Refs
  const snippetsRef = useRef([])
  const snippetRef = useRef(snippet)
  const isViewAliveRef = useRef(false)
  const ignoreUpdateRef = useRef(false)
  const scrollPosMap = useRef(new Map())
  
  // Inline AI ref for CodeMirror keymap
  const setIsInlineAIOpenRef = useRef(null)

  const { settings } = useSettingsStore()
  const { snippets, setSelectedSnippet, updateSnippetSelection, setDirty } = useVaultStore()

  const [title, setTitle] = useState(snippet?.title || '')
  const [isDirty, setIsDirty] = useState(false)
  const [viewMode, setViewMode] = useState('live')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [isInlineAIOpen, setIsInlineAIOpen] = useState(false)
  
  // Sync ref with state setter for CodeMirror keymap
  useEffect(() => {
    setIsInlineAIOpenRef.current = setIsInlineAIOpen
  }, [])

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
      if (e.data.html !== undefined) setPreviewContent(e.data.html)
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
          viewMode === 'source' ? lineNumbers() : [],
          viewMode === 'reading'
            ? [EditorView.editable.of(false), EditorState.readOnly.of(true)]
            : [],
          highlightActiveLine(),
          dropCursor(),
          history(),
          indentOnInput(),
          luminaSyntax,
          bracketMatching(),
          closeBrackets(),
          ...richMarkdown,
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
          markdown({ codeLanguages: languages }),
          seamlessTheme,
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
             */
            // Custom: Ctrl+K for Inline AI (must be first to override default)
            {
              key: 'Mod-k',
              run: () => {
                setIsInlineAIOpenRef.current(true)
                return true
              }
            },
            // Filter out Mod-f and Mod-g from searchKeymap to prevent CodeMirror find/replace
            // These are disabled to allow Ctrl+G for GraphNexus and prevent conflicts
            ...searchKeymap.filter(
              (binding) => binding.key !== 'Mod-f' && binding.key !== 'Mod-g'
            ),
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
            ...completionKeymap
          ]),
          EditorView.updateListener.of((update) => {
            if (ignoreUpdateRef.current) return
            if (update.docChanged) {
              setIsDirty(true)
              workerRef.current?.postMessage({
                code: update.state.doc.toString(),
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
      // Safety check: ensure view is still valid before state swap
      if (!viewRef.current || !isViewAliveRef.current) {
        // View was destroyed, recreate it
        const state = createTargetState(snippet?.code, targetSelection)
        const view = new EditorView({ state, parent: hostRef.current })
        viewRef.current = view
        isViewAliveRef.current = true
      } else {
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
          viewRef.current.destroy()
          const state = createTargetState(snippet?.code, targetSelection)
          const view = new EditorView({ state, parent: hostRef.current })
          viewRef.current = view
          isViewAliveRef.current = true
        } finally {
          ignoreUpdateRef.current = false
        }
      }
    }

    // Immediate Scroll & Focus Restore
    const savedScroll = scrollPosMap.current.get(snippet.id) || 0
    if (scrollerRef.current) scrollerRef.current.scrollTop = savedScroll

    if (snippet.title === 'New Note') {
      titleRef.current?.focus()
      titleRef.current?.select()
    } else {
      viewRef.current.focus()
    }

    // Refresh Preview
    workerRef.current?.postMessage({ code: snippet?.code || '', id: snippet.id })
    setTitle(snippet?.title || '')
    setIsDirty(false)

    return () => {
      // Cleanup happens only on unmount of the entire editor component
    }
  }, [snippet.id, createTargetState])

  // --- Save Logic ---
  useEffect(() => {
    setDirty(snippet.id, isDirty)
    if (!isDirty) return
    const timer = setTimeout(() => handleSave(), 2000)
    return () => clearTimeout(timer)
  }, [isDirty, title, snippet.id])

  const handleSave = useCallback(() => {
    if (!viewRef.current) return
    const code = viewRef.current.state.doc.toString()
    const sel = viewRef.current.state.selection.main
    onSave({
      ...snippetRef.current,
      code,
      title,
      selection: { anchor: sel.anchor, head: sel.head },
      timestamp: Date.now()
    })
    setIsDirty(false)
    setDirty(snippet.id, false)
  }, [title, snippet.id, onSave, setDirty])

  // Handle inline AI insertion
  const handleInlineAIInsert = useCallback((text) => {
    if (!viewRef.current) return
    
    const view = viewRef.current
    const selection = view.state.selection.main
    const transaction = view.state.update({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: text
      },
      selection: { anchor: selection.from + text.length }
    })
    
    view.dispatch(transaction)
    setIsDirty(true)
  }, [])

  // Export functions
  const handleExportHTML = useCallback(async () => {
    if (!snippet || !viewRef.current) return
    
    try {
      const code = viewRef.current.state.doc.toString()
      const html = await window.api.exportHTML({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
      if (html) {
        // Copy to clipboard
        await navigator.clipboard.writeText(html)
        // Could show a toast notification here
        console.log('HTML exported and copied to clipboard')
      }
    } catch (error) {
      console.error('Failed to export HTML:', error)
    }
  }, [snippet, title])

  const handleExportPDF = useCallback(async () => {
    if (!snippet || !viewRef.current) return
    
    try {
      const code = viewRef.current.state.doc.toString()
      const result = await window.api.exportPDF({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
      return result
    } catch (error) {
      console.error('Failed to export PDF:', error)
      throw error
    }
  }, [snippet, title])

  const handleExportMarkdown = useCallback(async () => {
    if (!snippet || !viewRef.current) return
    
    try {
      // Check if API is available
      if (!window.api || typeof window.api.exportMarkdown !== 'function') {
        throw new Error('Export Markdown API is not available. Please restart the application.')
      }
      
      const code = viewRef.current.state.doc.toString()
      const result = await window.api.exportMarkdown({
        title: title || snippet.title || 'Untitled',
        content: code,
        language: snippet.language || 'markdown'
      })
      return result
    } catch (error) {
      console.error('Failed to export markdown:', error)
      throw error
    }
  }, [snippet, title])

  useKeyboardShortcuts({
    onSave: handleSave,
    onToggleInspector,
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

  return (
    <div className={`markdown-editor mode-${viewMode} cursor-${settings.cursorStyle}`}>
      <EditorTitleBar
        title={title}
        snippet={snippet}
        setSelectedSnippet={setSelectedSnippet}
        isDirty={isDirty}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onSave={handleSave}
        onToggleInspector={onToggleInspector}
        onExportHTML={handleExportHTML}
        onExportPDF={handleExportPDF}
        onExportMarkdown={handleExportMarkdown}
        onInlineAI={() => setIsInlineAIOpen(true)}
      />

      <div className="editor-scroller" ref={scrollerRef}>
        <div className="editor-canvas-wrap">
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
          <div className="cm-host-container" ref={hostRef} />
        </div>
      </div>
      <EditorFooter isDirty={isDirty} viewMode={viewMode} setViewMode={setViewMode} />
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
}

export default MarkdownEditor
