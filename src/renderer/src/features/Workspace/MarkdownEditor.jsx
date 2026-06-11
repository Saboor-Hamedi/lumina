import React, { useState, useEffect, useRef, useCallback } from 'react'
import EditorTitleBar from './components/EditorTitleBar'
import EditorMetadata from './components/EditorMetadata'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useFontSettings } from '../../core/hooks/useFontSettings'
import { useToast } from '../../core/hooks/useToast'
import ToastNotification from '../../core/notification'
import './MarkdownEditor.css'

// Atomic Editor Imports
import { AtomicCodeMirrorEditor, wikiLinks } from '@atomic-editor/editor'
import { languages } from '@codemirror/language-data'
import { autocompletion, startCompletion } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { codeBlockDecorations, codeMap } from './codeBlockHeader'
import { EditorView, placeholder } from '@codemirror/view'
import '@atomic-editor/editor/styles.css'

const MarkdownEditor = React.memo(
  ({ snippet, onSave, onToggleInspector }) => {
    const { toast, showToast, clearToast } = useToast()
    const [isSaving, setIsSaving] = useState(false)
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

    useEffect(() => {
      snippetRef.current = snippet
      setTitle(snippet?.title || '')
      setIsDirty(false)

      if (editorHandleRef.current) {
        const currentCode = editorHandleRef.current.getMarkdown()
        if (snippet?.code && currentCode !== snippet.code) {
          setEditorKey(k => k + 1)
        }
      }
    }, [snippet])

    // Cleanup on unmount
    useEffect(() => {
      isMountedRef.current = true
      return () => {
        isMountedRef.current = false
      }
    }, [])

    const handleMarkdownChange = useCallback((md) => {
      setIsDirty(true)
      setDirty(snippet?.id, true)
    }, [snippet?.id, setDirty])

    // --- Save Logic ---
    const handleSave = useCallback(async () => {
      if (!isMountedRef.current || !snippetRef.current || !snippet?.id || !editorHandleRef.current) {
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
    const autocompleteTriggerListener = useCallback(EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const view = update.view;
        const head = view.state.selection.main.head;
        const line = view.state.doc.lineAt(head);
        const col = head - line.from;
        const textBefore = line.text.slice(0, col);
        
        const lastOpen = textBefore.lastIndexOf('[[');
        if (lastOpen !== -1) {
          const lastClose = textBefore.lastIndexOf(']]');
          if (lastOpen > lastClose) {
            // Cursor is inside [[ ]]
            setTimeout(() => {
              if (!view.isDestroyed) {
                startCompletion(view);
              }
            }, 10);
          }
        }
      }
    }), []);

    useKeyboardShortcuts({
      onSave: handleSave
    })

    const wikiLinkCompletionSource = useCallback((context) => {
      const match = context.matchBefore(/\[\[([^\]]*)/);
      console.log('wikiLinkCompletionSource called, match:', match);
      if (!match) return null;
      if (match.from === match.to && !context.explicit) return null;

      const { snippets } = useVaultStore.getState();
      
      // Handle auto-closed brackets by overwriting them if they exist
      const docLength = context.state.doc.length;
      const after2 = context.state.sliceDoc(context.pos, Math.min(context.pos + 2, docLength));
      const after1 = context.state.sliceDoc(context.pos, Math.min(context.pos + 1, docLength));
      let toPos = context.pos;
      if (after2 === ']]') {
        toPos = context.pos + 2;
      } else if (after1 === ']') {
        toPos = context.pos + 1;
      }
      
      let opts = snippets
        .filter(s => s.title)
        .map(s => ({
          label: s.title,
          type: 'text',
          apply: s.title + ']]',
          info: 'Link to note'
        }));
        
      if (opts.length === 0) {
        opts = [{ label: 'No notes found', apply: ']]' }];
      }
      
      return {
        from: match.from + 2,
        to: toPos,
        options: opts
      };
    }, []);

    const editorExtensions = React.useMemo(() => [
      autocompleteTriggerListener,
      autocompletion({ override: [wikiLinkCompletionSource], maxRenderedOptions: 8 }),
      codeBlockDecorations,
      placeholder('Start writing...'),
      wikiLinks({
        openOnClick: true,
        resolve: async (target) => {
          const { snippets } = useVaultStore.getState();
          const targetLower = target.toLowerCase();
          const exists = snippets.some(
            s => s.title && (s.title.toLowerCase() === targetLower || s.title.toLowerCase() === `${targetLower}.md`)
          );
          return {
            label: target,
            status: exists ? 'resolved' : 'missing'
          };
        },
        onOpen: async (target) => {
          showToast(`Opening wikilink: ${target}`, 'info');
          try {
            const { snippets, saveSnippet, setSelectedSnippet } = useVaultStore.getState();
            const targetLower = target.toLowerCase();
            let targetSnippet = snippets.find(
              s => s.title && (s.title.toLowerCase() === targetLower || s.title.toLowerCase() === `${targetLower}.md`)
            );

            if (!targetSnippet) {
              showToast(`Creating new note: ${target}`, 'info');
              targetSnippet = {
                id: crypto.randomUUID(),
                title: target,
                code: `# ${target}\n\n`,
                language: 'markdown',
                tags: '',
                timestamp: Date.now()
              };
              await saveSnippet(targetSnippet);
            }
            setSelectedSnippet(targetSnippet);
          } catch (e) {
            showToast(`Error: ${e.message}`, 'error');
          }
        }
      })
    ], [showToast, autocompleteTriggerListener, wikiLinkCompletionSource]);

    // Forceful Native Event Listener to Override CodeMirror
    useEffect(() => {
      const wrapper = editorWrapperRef.current;
      if (!wrapper) return;

      const handleMouseDown = async (e) => {
        // Wiki link click
        const linkEl = e.target.closest('.cm-atomic-wiki-link');
        if (linkEl) {
          e.preventDefault();
          e.stopPropagation();
          const target = linkEl.getAttribute('data-wiki-link-target');
          if (target) {
            try {
              const { snippets, saveSnippet, setSelectedSnippet } = useVaultStore.getState();
              const targetLower = target.toLowerCase();
              let targetSnippet = snippets.find(
                s => s.title && (s.title.toLowerCase() === targetLower || s.title.toLowerCase() === `${targetLower}.md`)
              );
              if (!targetSnippet) {
                targetSnippet = {
                  id: crypto.randomUUID(),
                  title: target,
                  code: `# ${target}\n\n`,
                  language: 'markdown',
                  tags: '',
                  timestamp: Date.now()
                };
                await saveSnippet(targetSnippet);
              }
              setSelectedSnippet(targetSnippet);
            } catch (err) {
              showToast(`Failed to open wikilink: ${err.message}`, 'error');
            }
          }
          return;
        }

        // Code block copy click
        const codeLine = e.target.closest('.cm-line.cb-code-header');
        if (codeLine) {
          const rect = codeLine.getBoundingClientRect();
          if (e.clientX < rect.right - 80) return;
          const id = codeLine.getAttribute('data-cb-id');
          const code = id != null ? codeMap.get(Number(id)) : null;
          if (code != null) {
            e.preventDefault();
            e.stopPropagation();
            await navigator.clipboard.writeText(code);
            showToast('Code copied', 'success');
            codeLine.classList.add('cb-copied');
            setTimeout(() => codeLine.classList.remove('cb-copied'), 600);
          }
        }
      };

      wrapper.addEventListener('mousedown', handleMouseDown, { capture: true });
      return () => wrapper.removeEventListener('mousedown', handleMouseDown, { capture: true });
    }, [showToast]);

    return (
      <div className={`markdown-editor mode-source cursor-${caretStyle || 'smooth'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <ToastNotification toast={toast} onClose={clearToast} />

        <div className="editor-scroller">
          <EditorTitleBar
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
              extensions={editorExtensions}
              onLinkClick={(url) => {
                if (window.api?.openExternal) {
                  window.api.openExternal(url);
                } else {
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }}
            />
          </div>
        </div>
      </div>
    )
  },
  (prevProps, nextProps) => {
    const prevSnippet = prevProps.snippet
    const nextSnippet = nextProps.snippet
    if (prevSnippet === nextSnippet) return true
    return (
      prevSnippet?.id === nextSnippet?.id &&
      prevSnippet?.code === nextSnippet?.code &&
      prevSnippet?.title === nextSnippet?.title &&
      prevProps.onSave === nextProps.onSave &&
      prevProps.onToggleInspector === nextProps.onToggleInspector
    )
  }
)

MarkdownEditor.displayName = 'MarkdownEditor'

export default MarkdownEditor
