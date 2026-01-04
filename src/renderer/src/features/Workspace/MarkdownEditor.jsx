import React, { useState, useEffect, useRef } from 'react'
import {
  MoreVertical, // Still used for ref checks or we can move ref check logic
  Save // For manual save call if needed
} from 'lucide-react'
import EditorTitleBar from './components/EditorTitleBar'
import EditorFooter from './components/EditorFooter'
import EditorMetadata from './components/EditorMetadata'
import TabBar from './components/TabBar'
import PreviewModal from '../Overlays/PreviewModal'
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
import { StateEffect } from '@codemirror/state'

// Essential CM6 Extensions
import {
  keymap,
  highlightActiveLine,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  lineNumbers
} from '@codemirror/view'
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

const MarkdownEditor = ({ snippet, onSave, onToggleInspector }) => {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const workerRef = useRef(null)
  const titleRef = useRef(null)
  const scrollerRef = useRef(null)
  const scrollPosRef = useRef(0)
  const prevIdRef = useRef(snippet?.id)
  const previewTimeoutRef = useRef(null)
  const selectionTimeoutRef = useRef(null)
  const initTimeoutRef = useRef(null)
  const isViewAliveRef = useRef(false)
  const modeCompartment = useRef(new Compartment())
  const settingsCompartment = useRef(new Compartment())
  const ignoreUpdateRef = useRef(false)

  const { settings } = useSettingsStore()
  const { snippets, setSelectedSnippet, updateSnippetSelection, setDirty } = useVaultStore()
  const snippetsRef = useRef(snippets)
  const [title, setTitle] = useState(snippet?.title || '')

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
    return () => {
      workerRef.current?.terminate()
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
      if (selectionTimeoutRef.current) clearTimeout(selectionTimeoutRef.current)
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!editorRef.current) return

    const getModeExtensions = () => {
      const exts = [editorMode.of(viewMode)]
      if (viewMode === 'source') exts.push(lineNumbers())
      if (viewMode === 'reading') {
        exts.push(EditorView.editable.of(false))
        exts.push(EditorState.readOnly.of(true))
      }
      return exts
    }

    const startState = EditorState.create({
      doc: snippet?.code || '',
      extensions: [
        modeCompartment.current.of(getModeExtensions()),
        highlightActiveLine(),
        dropCursor(),
        history(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        luminaSyntax,
        bracketMatching(),
        closeBrackets(),
        ...richMarkdown,
        imageHoverPreview,
        wikiHoverPreview(
          () => snippetsRef.current,
          (s) => setSelectedSnippet(s),
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
        keymap.of([
          { key: 'Mod-g', run: () => true },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap
        ]),
        (EditorView.domEventHandlers({
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
            return false
          },
          drop: async (event, view) => {
            const files = event.dataTransfer.files
            if (files && files.length > 0) {
              const file = files[0]
              if (file.type.startsWith('image/')) {
                event.preventDefault()
                const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
                if (pos === null) return
                try {
                  const buffer = await file.arrayBuffer()
                  const relativePath = await window.api.saveImage(buffer, file.name)
                  const insertText = `![${file.name}](${relativePath})`
                  view.dispatch({
                    changes: { from: pos, insert: insertText },
                    selection: { anchor: pos + insertText.length }
                  })
                } catch (err) {
                  console.error(err)
                }
                return true
              }
            }
            return false
          }
        }),
        EditorView.updateListener.of((update) => {
          if (ignoreUpdateRef.current) return
          if (update.docChanged) {
            setIsDirty(true)
            if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
            previewTimeoutRef.current = setTimeout(() => {
              workerRef.current?.postMessage({
                code: update.state.doc.toString(),
                id: snippet.id
              })
            }, 300)
          }
          if (update.selectionSet) {
            if (selectionTimeoutRef.current) clearTimeout(selectionTimeoutRef.current)
            selectionTimeoutRef.current = setTimeout(() => {
              if (!isViewAliveRef.current) return
              const sel = update.state.selection.main
              updateSnippetSelection(snippet.id, { anchor: sel.anchor, head: sel.head })
            }, 500)
          }
        }))
      ]
    })

    const view = new EditorView({ state: startState, parent: editorRef.current })
    viewRef.current = view
    isViewAliveRef.current = true

    initTimeoutRef.current = setTimeout(() => {
      if (view.destroyed || !isViewAliveRef.current) return
      if (snippet?.title === 'New Note' && titleRef.current) {
        titleRef.current.focus()
        titleRef.current.select()
      } else {
        view.focus()
        const targetSelection = snippetRef.current?.selection || snippet?.selection
        if (targetSelection) {
          try {
            const { anchor, head } = targetSelection
            const docLen = view.state.doc.length
            view.dispatch({
              selection: { anchor: Math.min(anchor, docLen), head: Math.min(head, docLen) },
              scrollIntoView: snippet.id !== prevIdRef.current
            })
          } catch (e) {
            console.warn(e)
          }
        }
        if (snippet.id === prevIdRef.current && scrollPosRef.current > 0) {
          if (scrollerRef.current) scrollerRef.current.scrollTop = scrollPosRef.current
        } else {
          prevIdRef.current = snippet.id
        }
      }
    }, 50)

    return () => {
      isViewAliveRef.current = false
      if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current)
      if (scrollerRef.current) scrollPosRef.current = scrollerRef.current.scrollTop
      view.destroy()
    }
  }, [snippet.id]) // ONLY recreate view when snippet ID changes

  // RECONFIGURE view on mode change (No more destroy/create flicker)
  useEffect(() => {
    if (!viewRef.current || viewRef.current.destroyed) return

    // Use Microtask to trigger reconfiguration outside the current update/render cycle
    Promise.resolve().then(() => {
      if (!viewRef.current || viewRef.current.destroyed) return

      ignoreUpdateRef.current = true
      const exts = [editorMode.of(viewMode)]
      if (viewMode === 'source') exts.push(lineNumbers())
      if (viewMode === 'reading') {
        exts.push(EditorView.editable.of(false))
        exts.push(EditorState.readOnly.of(true))
      }

      viewRef.current.dispatch({
        effects: modeCompartment.current.reconfigure(exts)
      })

      // Briefly keep ignoring to allow React state to settle
      setTimeout(() => {
        ignoreUpdateRef.current = false
      }, 100)
    })
  }, [viewMode])

  useEffect(() => {
    setTitle(snippet?.title || '')
    setIsDirty(false)
  }, [snippet?.id])

  useEffect(() => {
    setDirty(snippet.id, isDirty)
    if (!isDirty) return

    const autoSaveTimer = setTimeout(() => {
      handleSave()
    }, 2000)

    return () => {
      clearTimeout(autoSaveTimer)
    }
  }, [isDirty, title, snippet.id])

  const handleSave = () => {
    const code = viewRef.current?.state.doc.toString() || ''
    // Merge latest selection from view into save payload
    const sel = viewRef.current?.state.selection.main
    const selection = sel ? { anchor: sel.anchor, head: sel.head } : snippetRef.current?.selection

    onSave({ ...snippetRef.current, code, title, selection, timestamp: Date.now() })
    setIsDirty(false)
    setDirty(snippet.id, false)
  }

  const handleExport = async (format) => {
    // Menu closing is handled by the child component

    // We need the rendered HTML. If previewContent matches current code, use it.
    // Otherwise we might need to wait for worker. But usually preview updates fast.
    if (!previewContent) return

    const exportHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title || 'Export'}</title>
        <style>
          body { font-family: 'Inter', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; color: #333; }
          h1, h2, h3 { color: #111; margin-top: 1.5em; }
          pre { background: #f4f4f4; padding: 15px; border-radius: 8px; overflow-x: auto; }
          code { font-family: monospace; background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 4px; }
          blockquote { border-left: 4px solid #ddd; padding-left: 15px; color: #555; }
          img { max-width: 100%; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f9f9f9; }
          a { color: #0284c7; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1>${title || 'Untitled'}</h1>
        ${previewContent}
      </body>
      </html>
    `

    try {
      if (format === 'html') {
        const success = await window.api.exportHTML({ html: exportHTML, title: title || 'note' })
        if (success) console.log('Exported HTML')
      } else if (format === 'pdf') {
        const success = await window.api.exportPDF({ html: exportHTML, title: title || 'note' })
        if (success) console.log('Exported PDF')
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  useKeyboardShortcuts({
    onSave: handleSave,
    onToggleInspector: onToggleInspector,
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
      <TabBar />
      <EditorTitleBar
        title={title}
        snippet={snippet}
        setSelectedSnippet={setSelectedSnippet}
        isDirty={isDirty}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onSave={handleSave}
        onToggleInspector={onToggleInspector}
        onExportHTML={() => handleExport('html')}
        onExportPDF={() => handleExport('pdf')}
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
          <div className="cm-host-container" ref={editorRef} />
        </div>
      </div>
      <EditorFooter isDirty={isDirty} viewMode={viewMode} setViewMode={setViewMode} />
      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        content={previewContent}
      />
    </div>
  )
}

export default MarkdownEditor
