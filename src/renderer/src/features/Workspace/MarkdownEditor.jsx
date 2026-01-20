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
import { useFontSettings } from '../../core/hooks/useFontSettings'
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
  const { caretStyle, caretWidth, caretColor } = useFontSettings()

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
  }, [snippet.id, createTargetState])

  // Listen for caret style updates and force CodeMirror to refresh cursor
  useEffect(() => {
    if (!viewRef.current) return

    // Create a style element as a fallback to ensure styles are applied
    let styleElement = document.getElementById('codemirror-cursor-override')
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = 'codemirror-cursor-override'
      document.head.appendChild(styleElement)
    }

    const updateStyleElement = () => {
      // Get current CSS variable values from root
      const root = document.documentElement
      let currentCaretWidth = getComputedStyle(root).getPropertyValue('--caret-width').trim()
      if (!currentCaretWidth || currentCaretWidth === '') {
        // Fallback: try to get from inline style
        currentCaretWidth = root.style.getPropertyValue('--caret-width').trim() || '2px'
      }
      if (!currentCaretWidth.endsWith('px')) {
        currentCaretWidth = currentCaretWidth + 'px'
      }
      
      let currentCaretColor = getComputedStyle(root).getPropertyValue('--caret-color').trim()
      if (!currentCaretColor || currentCaretColor === '') {
        currentCaretColor = getComputedStyle(root).getPropertyValue('--text-accent').trim() || '#40bafa'
      }
      
      const currentCaretStyle = getComputedStyle(root).getPropertyValue('--caret-style').trim() || 'smooth'
      
      // Update the style element - this will apply to any cursor that gets created
      const isBlock = currentCaretStyle === 'block'
      if (isBlock) {
        styleElement.textContent = `
          .cm-cursor, .cm-cursor-primary, .cm-editor .cm-cursor, .markdown-editor .cm-cursor {
            border-left: none !important;
            background-color: ${currentCaretColor} !important;
            width: 0.6em !important;
            opacity: 0.7 !important;
            margin-left: 0 !important;
          }
        `
      } else {
        styleElement.textContent = `
          .cm-cursor, .cm-cursor-primary, .cm-editor .cm-cursor, .markdown-editor .cm-cursor {
            border-left-width: ${currentCaretWidth} !important;
            border-left-color: ${currentCaretColor} !important;
            border-left-style: solid !important;
            margin-left: calc(-1 * ${currentCaretWidth} / 2) !important;
          }
        `
      }
      
      console.log('[MarkdownEditor] Updated style element:', { 
        currentCaretWidth, 
        currentCaretColor, 
        currentCaretStyle
      })
    }

    const applyCaretStyles = () => {
      // Always update the style element first - this ensures styles apply even if cursor doesn't exist yet
      updateStyleElement()
      
      if (!viewRef.current) {
        console.log('[MarkdownEditor] No viewRef, style element updated but no direct cursor access')
        return true // Return true because style element was updated
      }
      
      // Try multiple selectors - CodeMirror might use different class names
      // Also check the entire editor DOM, not just contentDOM
      const editorDOM = viewRef.current.dom
      const cursors = [
        ...viewRef.current.contentDOM.querySelectorAll('.cm-cursor, .cm-cursor-primary'),
        ...editorDOM.querySelectorAll('.cm-cursor, .cm-cursor-primary')
      ]
      
      if (cursors.length === 0) {
        console.log('[MarkdownEditor] No cursor elements found, but style element updated (will apply when cursor appears)')
        return true // Return true because style element was updated
      }

      // Get current CSS variable values from root
      const root = document.documentElement
      let currentCaretWidth = getComputedStyle(root).getPropertyValue('--caret-width').trim()
      if (!currentCaretWidth || currentCaretWidth === '') {
        currentCaretWidth = root.style.getPropertyValue('--caret-width').trim() || '2px'
      }
      if (!currentCaretWidth.endsWith('px')) {
        currentCaretWidth = currentCaretWidth + 'px'
      }
      
      let currentCaretColor = getComputedStyle(root).getPropertyValue('--caret-color').trim()
      if (!currentCaretColor || currentCaretColor === '') {
        currentCaretColor = getComputedStyle(root).getPropertyValue('--text-accent').trim() || '#40bafa'
      }
      
      const currentCaretStyle = getComputedStyle(root).getPropertyValue('--caret-style').trim() || 'smooth'
      
      console.log('[MarkdownEditor] Applying caret styles to', cursors.length, 'cursor(s):', { 
        currentCaretWidth, 
        currentCaretColor, 
        currentCaretStyle
      })
      
      // Apply to all cursor elements directly (in addition to style element)
      cursors.forEach((cursor, index) => {
        const isBlock = currentCaretStyle === 'block'
        
        if (isBlock) {
          // Block cursor uses background-color instead of border
          cursor.style.setProperty('border-left', 'none', 'important')
          cursor.style.setProperty('background-color', currentCaretColor, 'important')
          cursor.style.setProperty('width', '0.6em', 'important')
          cursor.style.setProperty('opacity', '0.7', 'important')
          cursor.style.setProperty('margin-left', '0', 'important')
        } else {
          // Line cursor uses border-left
          cursor.style.setProperty('border-left-width', currentCaretWidth, 'important')
          cursor.style.setProperty('border-left-color', currentCaretColor, 'important')
          cursor.style.setProperty('border-left-style', 'solid', 'important')
          cursor.style.setProperty('margin-left', `calc(-1 * ${currentCaretWidth} / 2)`, 'important')
        }
        
        // Force a reflow
        void cursor.offsetHeight
      })
      
      // Force CodeMirror to recalculate layout
      if (viewRef.current) {
        viewRef.current.requestMeasure()
        void viewRef.current.contentDOM.offsetHeight
      }
      
      return true
    }

    // Retry function with exponential backoff
    const applyWithRetry = (maxRetries = 20, delay = 100) => {
      let retries = 0
      const tryApply = () => {
        const applied = applyCaretStyles()
        if (applied) {
          console.log(`[MarkdownEditor] Successfully applied caret styles after ${retries} retries`)
          return
        }
        if (retries >= maxRetries) {
          console.warn(`[MarkdownEditor] Failed to apply caret styles after ${maxRetries} retries`)
          return
        }
        retries++
        setTimeout(tryApply, delay * Math.min(retries, 5))
      }
      tryApply()
    }

    const handleCaretUpdate = () => {
      console.log('[MarkdownEditor] Caret style update event received')
      // Small delay to ensure CSS variables are set
      setTimeout(() => {
        applyWithRetry()
      }, 50)
    }

    // Use MutationObserver to watch for cursor creation/changes
    const observer = new MutationObserver((mutations) => {
      let shouldApply = false
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            if (node.classList?.contains('cm-cursor') || 
                node.classList?.contains('cm-cursor-primary') ||
                node.querySelector?.('.cm-cursor')) {
              shouldApply = true
            }
          }
        })
        // Also check for attribute changes (cursor might be updated in place)
        if (mutation.type === 'attributes' && 
            (mutation.target.classList?.contains('cm-cursor') || 
             mutation.target.classList?.contains('cm-cursor-primary'))) {
          shouldApply = true
        }
      })
      if (shouldApply) {
        setTimeout(() => applyCaretStyles(), 10)
      }
    })

    // Observe the content DOM for cursor creation
    if (viewRef.current?.contentDOM) {
      observer.observe(viewRef.current.contentDOM, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      })
    }

    // Apply immediately with retries
    applyWithRetry()
    
    // Listen for custom update events
    window.addEventListener('caret-style-update', handleCaretUpdate)
    
    // Listen for focus events on the editor to apply styles when cursor appears
    const handleFocus = () => {
      console.log('[MarkdownEditor] Editor focused, applying caret styles')
      setTimeout(() => applyCaretStyles(), 50)
    }
    
    const handleBlur = () => {
      console.log('[MarkdownEditor] Editor blurred')
    }
    
    if (viewRef.current?.dom) {
      viewRef.current.dom.addEventListener('focus', handleFocus, true)
      viewRef.current.dom.addEventListener('blur', handleBlur, true)
    }
    
    // Set up interval to periodically update style element (ensures it's always current)
    const intervalId = setInterval(() => {
      updateStyleElement()
    }, 1000)
    
    return () => {
      observer.disconnect()
      window.removeEventListener('caret-style-update', handleCaretUpdate)
      clearInterval(intervalId)
      if (viewRef.current?.dom) {
        viewRef.current.dom.removeEventListener('focus', handleFocus, true)
        viewRef.current.dom.removeEventListener('blur', handleBlur, true)
      }
      // Don't remove style element - it might be needed by other instances
    }
  }, [caretStyle, caretWidth, caretColor, snippet.id])

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
    <div className={`markdown-editor mode-${viewMode} cursor-${caretStyle || 'smooth'}`}>
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
