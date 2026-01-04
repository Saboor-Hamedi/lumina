import React, { useState, useEffect, useRef } from 'react'
import { Save, Eye, Sidebar, ChevronRight, Hash, FileCode, FileJson, FileType, Calendar } from 'lucide-react'
import PreviewModal from '../Overlays/PreviewModal'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { richMarkdown } from './richMarkdown'
import { wikiLinkCompletion } from './wikiLinkCompletion'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import './MarkdownEditor.css'

// CodeMirror 6 Imports
import { EditorView } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

// Essential CM6 Extensions
import { 
  keymap, highlightActiveLine, drawSelection, dropCursor, 
  rectangularSelection, crosshairCursor, lineNumbers
} from '@codemirror/view'
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands'
import { indentOnInput, bracketMatching } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { luminaSyntax } from './syntaxTheme'
import { seamlessTheme } from './editorTheme'
import { wikiHoverPreview } from './wikiHoverPreview'

const MarkdownEditor = ({ snippet, onSave, onToggleInspector }) => {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const workerRef = useRef(null)
  const titleRef = useRef(null)
  
  const { settings } = useSettingsStore()
  const { snippets, setSelectedSnippet, updateSnippetSelection } = useVaultStore()
  const snippetsRef = useRef(snippets)
  const [title, setTitle] = useState(snippet?.title || '')
  const [tagInput, setTagInput] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)

  useEffect(() => {
    snippetsRef.current = snippets
  }, [snippets])

  const snippetRef = useRef(snippet)
  useEffect(() => {
    snippetRef.current = snippet
  }, [snippet])
  const [isDirty, setIsDirty] = useState(false)
  const [viewMode, setViewMode] = useState('live') // 'source' | 'live' | 'reading'
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState('')

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../../core/workers/markdown.worker.js', import.meta.url),
      { type: 'module' }
    )
    workerRef.current.onmessage = (e) => {
      if (e.data.html !== undefined) setPreviewContent(e.data.html)
    }
    workerRef.current.postMessage({ code: snippet?.code || '', id: snippet.id })
    return () => workerRef.current?.terminate()
  }, [])

  useEffect(() => {
    if (!editorRef.current) return

    const startState = EditorState.create({
      doc: snippet?.code || '',
      extensions: [
        highlightActiveLine(),
        drawSelection(),
        dropCursor(),
        history(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        luminaSyntax,
        bracketMatching(),
        closeBrackets(),
        ...richMarkdown,
        wikiHoverPreview(
          () => snippetsRef.current,
          async (targetTitle) => {
            const newSnippet = {
              id: crypto.randomUUID(),
              title: targetTitle,
              code: '',
              language: 'markdown',
              timestamp: Date.now(),
              isPinned: false
            }
            await onSave(newSnippet)
            setSelectedSnippet(newSnippet)
          }
        ),
        autocompletion({ override: [wikiLinkCompletion(() => snippetsRef.current)] }),
        rectangularSelection(),
        crosshairCursor(),
        highlightSelectionMatches(),
        markdown({ codeLanguages: languages }),
        seamlessTheme,
        EditorView.lineWrapping,
        ...(viewMode === 'source' ? [lineNumbers()] : []),
        ...(viewMode === 'reading'
          ? [EditorView.editable.of(false), EditorState.readOnly.of(true)]
          : []),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap
        ]),
        EditorView.domEventHandlers({
          mousedown: (event, view) => {
            const target = event.target.closest('.cm-wikilink')
            if (target) {
              const isReadOnly = view.state.readOnly
              const isModifierDown = event.ctrlKey || event.metaKey

              if (isReadOnly || isModifierDown) {
                event.preventDefault()
                event.stopPropagation()

                const pos = view.posAtDOM(event.target)
                const line = view.state.doc.lineAt(pos)
                const lineText = line.text

                const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
                let match
                while ((match = regex.exec(lineText)) !== null) {
                  const start = line.from + match.index
                  const end = start + match[0].length
                  if (pos >= start && pos <= end) {
                    const targetTitle = match[1].trim()
                    const targetSnippet = snippetsRef.current.find(
                      (s) => s.title.toLowerCase() === targetTitle.toLowerCase()
                    )
                    if (targetSnippet) {
                      setSelectedSnippet(targetSnippet)
                    }
                    break
                  }
                }
              }
            }
            return false // Allow default selection behavior
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setIsDirty(true)
            workerRef.current?.postMessage({ code: update.state.doc.toString(), id: snippet.id })
          }
          if (update.selectionSet) {
            const sel = update.state.selection.main
            updateSnippetSelection(snippet.id, { anchor: sel.anchor, head: sel.head })
          }
        })
      ]
    })

    const view = new EditorView({ state: startState, parent: editorRef.current })
    viewRef.current = view

    setTimeout(() => {
      if (view.destroyed) return // Guard against rapid unmounting

      if (snippet?.title === 'New Note' && titleRef.current) {
        titleRef.current.focus()
        titleRef.current.select()
      } else {
        view.focus()
        // Restore caret position (FB Standard #11 Persistence)
        // Use snippetRef for most up-to-date state if available
        const targetSelection = snippetRef.current?.selection || snippet?.selection
        if (targetSelection) {
          try {
            const { anchor, head } = targetSelection
            const docLen = view.state.doc.length
            const safeAnchor = Math.min(anchor, docLen)
            const safeHead = Math.min(head, docLen)
            view.dispatch({
              selection: { anchor: safeAnchor, head: safeHead },
              scrollIntoView: true
            })
          } catch (e) {
            console.warn('Failed to restore selection:', e)
          }
        }
      }
    }, 50) // Faster restoration

    return () => view.destroy()
  }, [snippet.id, viewMode])

  useEffect(() => {
    setTitle(snippet?.title || '')
    setIsDirty(false)
  }, [snippet?.id])

  // Auto-save functionality
  useEffect(() => {
    if (!isDirty) return

    const autoSaveTimer = setTimeout(() => {
      handleSave()
    }, 2000) // Auto-save after 2 seconds of inactivity

    return () => {
      clearTimeout(autoSaveTimer)
    }
  }, [isDirty, title])

  const handleSave = () => {
    const code = viewRef.current?.state.doc.toString() || ''
    // Merge latest selection from view into save payload
    const sel = viewRef.current?.state.selection.main
    const selection = sel ? { anchor: sel.anchor, head: sel.head } : snippetRef.current?.selection

    onSave({ ...snippetRef.current, code, title, selection, timestamp: Date.now() })
    setIsDirty(false)
  }

  useKeyboardShortcuts({
    onSave: handleSave,
    onTogglePreview: () => setIsPreviewOpen((prev) => !prev),
    onEscape: () => {
      if (isPreviewOpen) {
        setIsPreviewOpen(false)
        return true
      }
      return false
    }
  })

  return (
    <div
      className={`markdown-editor seamless-editor mode-${viewMode} cursor-${settings.cursorStyle}`}
    >
      <div className="editor-titlebar">
        {/* Breadcrumb Polish (Standard #9) */}
        <div className="editor-breadcrumb">
          <div className="breadcrumb-item clickable" onClick={() => setSelectedSnippet(null)}>
            <FileType size={12} className="breadcrumb-icon" />
            <span>Vault</span>
          </div>
          <ChevronRight size={12} className="breadcrumb-sep" />
          <div className="breadcrumb-item">
            {(() => {
              const lang = (snippet?.language || 'markdown').toLowerCase()
              if (
                ['javascript', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'python', 'py'].includes(
                  lang
                )
              )
                return <FileCode size={12} className="breadcrumb-icon" />
              if (lang === 'json') return <FileJson size={12} className="breadcrumb-icon" />
              if (lang === 'markdown' || lang === 'md')
                return <Hash size={12} className="breadcrumb-icon" />
              return <FileType size={12} className="breadcrumb-icon" />
            })()}
            <span className="breadcrumb-active">{title || 'Untitled'}</span>
          </div>
        </div>

        <div className="editor-controls">
          <div className="mode-toggle">
            <button
              className={`mode-btn ${viewMode === 'source' ? 'active' : ''}`}
              onClick={() => setViewMode('source')}
              title="Source Mode"
            >
              Src
            </button>
            <button
              className={`mode-btn ${viewMode === 'live' ? 'active' : ''}`}
              onClick={() => setViewMode('live')}
              title="Live Mode"
            >
              Live
            </button>
            <button
              className={`mode-btn ${viewMode === 'reading' ? 'active' : ''}`}
              onClick={() => setViewMode('reading')}
              title="Reading Mode"
            >
              Read
            </button>
          </div>

          <div className="editor-status-icons">
            <div className={`status-pill ${isDirty ? 'dirty' : 'saved'}`}>
              {isDirty ? 'Unsaved' : 'Saved'}
            </div>
          </div>
          <button className="icon-btn" onClick={handleSave} title="Save (Ctrl+S)">
            <Save size={16} />
          </button>
          <button className="icon-btn" onClick={onToggleInspector} title="Toggle Inspector">
            <Sidebar size={16} />
          </button>
        </div>
      </div>

      <div className="editor-scroller">
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
          <div className="cm-host-container" ref={editorRef} />
        </div>
      </div>

      {settings.inlineMetadata && (
        <div className="editor-metadata-bar">
          <div className="meta-tag-container">
            <Hash size={12} className="meta-icon" />
            <div className="tag-pills">
              {(snippet.tags || '')
                .split(',')
                .filter((t) => t.trim())
                .map((tag, i) => (
                  <span key={i} className="tag-pill">
                    {tag.trim()}
                    <button
                      className="tag-remove"
                      onClick={() => {
                        const tags = (snippet.tags || '')
                          .split(',')
                          .filter((_, idx) => idx !== i)
                          .join(',')
                        onSave({ ...snippet, tags })
                      }}
                    >
                      &times;
                    </button>
                  </span>
                ))}
            </div>
            <div className="tag-input-wrap">
              <input
                type="text"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value)
                  setShowTagSuggestions(true)
                }}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagInput.trim()) {
                    const currentTags = (snippet.tags || '')
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                    if (!currentTags.includes(tagInput.trim())) {
                      const tags = [...currentTags, tagInput.trim()].join(',')
                      onSave({ ...snippet, tags })
                    }
                    setTagInput('')
                  }
                }}
              />
              {showTagSuggestions && tagInput.trim() && (
                <div className="tag-suggestions">
                  {Array.from(
                    new Set(
                      snippets.flatMap((s) =>
                        (s.tags || '')
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean)
                      )
                    )
                  )
                    .filter((t) => t.toLowerCase().includes(tagInput.toLowerCase()))
                    .slice(0, 5)
                    .map((suggestion, i) => (
                      <div
                        key={i}
                        className="suggestion-item"
                        onClick={() => {
                          const currentTags = (snippet.tags || '')
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean)
                          if (!currentTags.includes(suggestion)) {
                            const tags = [...currentTags, suggestion].join(',')
                            onSave({ ...snippet, tags })
                          }
                          setTagInput('')
                          setShowTagSuggestions(false)
                        }}
                      >
                        {suggestion}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
          <div className="meta-info-pill">
            <Calendar size={12} className="meta-icon" />
            <span>{new Date(snippet.timestamp).toLocaleDateString()}</span>
          </div>
        </div>
      )}
      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        content={previewContent}
      />
    </div>
  )
}

export default MarkdownEditor
