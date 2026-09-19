/**
 * =========================================================================================
 * Lumina Editor (`Editor.jsx`)
 * =========================================================================================
 *
 * Core markdown editor component. Orchestrates editor state, CodeMirror extensions,
 * modal overlays, toolbars, and canvas rendering through dedicated custom hooks.
 * =========================================================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import EditorMenu from './menu/EditorMenu'
import ToastNotification from '../../core/notification'
import Preview from '../preview/Preview'
import OverwriteModal from '../modals/OverwriteModal'
// Lumina AI Inline assistant
import InlineLumina from '../AI/InlineLumina'
import RulerScrollbar from './RulerScrollbar'
import Find from './components/Find'
import { EditorCanvas } from './EditorCanvas'

import { useToast } from '../../core/notification'
import { useKeyboardShortcuts } from '../../core/shortcuts'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import {
  useZoom,
  EditorState,
  useEditorExports,
  EditorEvent,
  EditorExtensions
} from '../../core/editor'
import { EditorSlash } from '../slash'
import EditorCreatedAt from './components/EditorCreatedAt'
import EditorZoomHud from './components/EditorZoomHud'

import './Editor.css'
import './inlineMarks.css'
import '../../assets/codeWrapper.css'
import '@atomic-editor/editor/styles.css'

const Editor = React.memo(
  ({
    snippet,
    onSave,
    onToggleInspector,
    isActive = true
  }) => {
    const { toast, showToast, clearToast } = useToast()
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [showFindWidget, setShowFindWidget] = useState(false)
    const [replaceModeActive, setReplaceModeActive] = useState(false)
    const [isInlineAIOpen, setIsInlineAIOpen] = useState(false)
    const [slashState, setSlashState] = useState({ isOpen: false })
    const slashHandlerRef = useRef({ isOpen: false })

    // DOM & Editor references
    const editorHandleRef = useRef(null)
    const titleRef = useRef(null)
    const scrollerRef = useRef(null)
    const zoomContainerRef = useRef(null)
    const realViewRef = useRef(null)
    const showFindWidgetRef = useRef(showFindWidget)
    showFindWidgetRef.current = showFindWidget

    const { zoomBadge } = useZoom({
      containerRef: zoomContainerRef,
      realViewRef,
      isActive
    })

    const setSelectedNote = useWorkspaceStore((state) => state.setSelectedNote)
    const setDirty = useWorkspaceStore((state) => state.setDirty)

    // 1. Editor State (Lifecycle, Auto-save, Conflict detection)
    const {
      title,
      setTitle,
      isDirty,
      setIsDirty,
      isDirtyRef,
      isSaving,
      editorKey,
      conflictPrompt,
      setConflictPrompt,
      snippetRef,
      latestCodeRef,
      lastSavedCodeRef,
      lastSaveTimeRef,
      handleSave,
      handleMarkdownChange,
      handleOverwriteClose,
      handleOverwriteConfirm
    } = EditorState({
      snippet,
      onSave,
      showToast,
      realViewRef,
      editorHandleRef
    })

    // 2. Export Actions (HTML, PDF, Markdown, Text, Docs)
    const {
      handleExportHTML,
      handleExportPDF,
      handleExportText,
      handleExportDocs,
      handleExportMarkdown,
      handleExportMarkdownBundle
    } = useEditorExports({
      snippet,
      title,
      editorHandleRef,
      showToast
    })

    // 3. Global Window & AI Event Subscriptions
    const { isActiveRef } = EditorEvent({
      isActive,
      realViewRef,
      titleRef,
      snippet,
      showToast,
      setShowFindWidget,
      setReplaceModeActive,
      setIsPreviewOpen,
      lastSaveTimeRef,
      lastSavedCodeRef,
      latestCodeRef,
      setIsDirty,
      isDirty,
      isDirtyRef,
      setDirty,
      setConflictPrompt
    })

    // 4. CodeMirror Extensions & Keymaps
    const { finalExtensions } = EditorExtensions({
      snippetRef,
      realViewRef,
      showToast,
      isActiveRef,
      showFindWidgetRef,
      setShowFindWidget,
      setReplaceModeActive,
      onSlashStateChange: setSlashState,
      slashHandlerRef
    })

    // Keyboard Shortcuts
    useKeyboardShortcuts({
      onSave: () => {
        if (isActive) handleSave()
      },
      onInlineAI: () => {
        if (isActive) {
          setIsInlineAIOpen(true)
          return true
        }
        return false
      },
      onTogglePreview: () => {
        if (isActive) {
          setIsPreviewOpen((prev) => !prev)
        }
      }
    })

    useEffect(() => {
      const handleOpenAIEvent = () => {
        if (isActive) setIsInlineAIOpen(true)
      }
      window.addEventListener('open-inline-ai', handleOpenAIEvent)
      return () => window.removeEventListener('open-inline-ai', handleOpenAIEvent)
    }, [isActive])

    const interimVoiceRangeRef = useRef(null)

    useEffect(() => {
      const handleLiveText = (e) => {
        if (!isActive || !realViewRef.current) return
        if (e.detail?.instanceId && e.detail.instanceId !== 'editor-voice') return
        const text = e.detail?.text
        if (!text) return
        const view = realViewRef.current
        const docLen = view.state.doc.length

        if (!interimVoiceRangeRef.current) {
          const sel = view.state.selection?.main
          const from = sel ? sel.from : docLen
          const to = sel ? sel.to : docLen
          const prevChar = from > 0 ? view.state.doc.sliceString(from - 1, from) : ''
          const insertText = prevChar && !prevChar.match(/\s/) ? ' ' + text : text
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + insertText.length }
          })
          interimVoiceRangeRef.current = { from, to: from + insertText.length }
        } else {
          const { from, to } = interimVoiceRangeRef.current
          const prevChar = from > 0 ? view.state.doc.sliceString(from - 1, from) : ''
          const insertText = prevChar && !prevChar.match(/\s/) ? ' ' + text : text
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + insertText.length }
          })
          interimVoiceRangeRef.current = { from, to: from + insertText.length }
        }
      }

      const handleLiveCancel = (e) => {
        if (!isActive || !realViewRef.current) return
        if (e.detail?.instanceId && e.detail.instanceId !== 'editor-voice') return
        if (interimVoiceRangeRef.current) {
          const { from, to } = interimVoiceRangeRef.current
          realViewRef.current.dispatch({ changes: { from, to, insert: '' } })
          interimVoiceRangeRef.current = null
        }
      }

      const handleVoiceInsert = (e) => {
        if (!isActive || !realViewRef.current) return
        if (e.detail?.instanceId && e.detail.instanceId !== 'editor-voice') return
        const text = e.detail?.text
        if (!text) return
        const view = realViewRef.current
        if (interimVoiceRangeRef.current) {
          const { from, to } = interimVoiceRangeRef.current
          const prevChar = from > 0 ? view.state.doc.sliceString(from - 1, from) : ''
          const insertText = prevChar && !prevChar.match(/\s/) ? ' ' + text : text
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + insertText.length }
          })
          interimVoiceRangeRef.current = null
        } else {
          const selection = view.state.selection?.main
          const from = selection ? selection.from : view.state.doc.length
          const to = selection ? selection.to : view.state.doc.length
          const prevChar = from > 0 ? view.state.doc.sliceString(from - 1, from) : ''
          const insertText = prevChar && !prevChar.match(/\s/) ? ' ' + text : text
          view.dispatch({
            changes: { from, to, insert: insertText },
            selection: { anchor: from + insertText.length }
          })
        }
        view.focus()
        setIsDirty(true)
      }

      window.addEventListener('voice-live-text', handleLiveText)
      window.addEventListener('voice-live-cancel', handleLiveCancel)
      window.addEventListener('voice-insert-text', handleVoiceInsert)
      return () => {
        window.removeEventListener('voice-live-text', handleLiveText)
        window.removeEventListener('voice-live-cancel', handleLiveCancel)
        window.removeEventListener('voice-insert-text', handleVoiceInsert)
      }
    }, [isActive, setIsDirty])

    // Inline Lumina AI Handlers
    const handleInlineAIInsert = useCallback((text, range = null) => {
      if (!realViewRef.current) return
      const view = realViewRef.current
      const selection = view.state.selection.main
      const from = range ? range.from : (selection ? selection.from : view.state.doc.length)
      const to = range ? range.to : (selection ? selection.to : view.state.doc.length)

      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length }
      })
      view.focus()
      setIsDirty(true)
    }, [setIsDirty])

    const handleCloseInlineAI = useCallback(() => setIsInlineAIOpen(false), [])

    return (
      <div
        className="markdown-editor mode-source"
        ref={zoomContainerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <EditorZoomHud zoomBadge={zoomBadge} />

        <EditorCreatedAt snippet={snippet} scrollerRef={scrollerRef} />

        {showFindWidget && realViewRef.current && (
          <Find
            editorView={realViewRef.current}
            onClose={() => setShowFindWidget(false)}
            initialReplaceMode={replaceModeActive}
          />
        )}

        {slashState.isOpen && (
          <EditorSlash
            isOpen={slashState.isOpen}
            query={slashState.query}
            coords={slashState.coords}
            selectedIndex={slashState.selectedIndex ?? 0}
            slashHandlerRef={slashHandlerRef}
            onSelect={(cmd) => {
              if (slashHandlerRef?.current) {
                slashHandlerRef.current.isOpen = false
              }
              const view = realViewRef.current || slashState.view
              if (view && typeof cmd.execute === 'function') {
                const state = view.state
                const sel = state.selection?.main
                let from = slashState.from
                let to = slashState.to
                if (sel) {
                  const line = state.doc.lineAt(sel.head)
                  const textBefore = line.text.slice(0, sel.head - line.from)
                  const slashIdx = textBefore.lastIndexOf('/')
                  if (slashIdx >= 0) {
                    from = line.from + slashIdx
                    to = sel.head
                  }
                }
                const docLen = state.doc.length
                const safeFrom = Math.max(0, Math.min(typeof from === 'number' ? from : docLen, docLen))
                const safeTo = Math.max(safeFrom, Math.min(typeof to === 'number' ? to : safeFrom, docLen))
                cmd.execute(view, safeFrom, safeTo)
              }
              setSlashState({ isOpen: false })
            }}
            onClose={() => {
              if (slashHandlerRef?.current) {
                slashHandlerRef.current.isOpen = false
              }
              setSlashState({ isOpen: false })
            }}
          />
        )}

        <ToastNotification toast={toast} onClose={clearToast} />
        <RulerScrollbar scrollerRef={scrollerRef} />

        <div className="editor-scroller" ref={scrollerRef}>
          <Preview
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            title={title}
            content={latestCodeRef.current !== undefined ? latestCodeRef.current : snippet?.code}
            snippetId={snippet?.id}
            timestamp={snippet?.timestamp}
          />

          {isInlineAIOpen && (
            <InlineLumina
              isOpen={isInlineAIOpen}
              onClose={handleCloseInlineAI}
              onInsert={handleInlineAIInsert}
              cursorPosition={realViewRef.current?.state.selection.main}
              editorView={realViewRef.current}
              title={title}
            />
          )}

          <OverwriteModal
            isOpen={!!conflictPrompt}
            onClose={handleOverwriteClose}
            onConfirm={handleOverwriteConfirm}
            title="File Modified Externally"
            message={`The file "${conflictPrompt?.snippetTitle}" was modified externally. Do you want to reload the new version and lose your local edits, or keep your local edits?`}
            confirmText="Overwrite"
            cancelText="Keep My Edits"
          />

          <EditorCanvas
            snippet={snippet}
            editorKey={editorKey}
            handleMarkdownChange={handleMarkdownChange}
            editorHandleRef={editorHandleRef}
            finalExtensions={finalExtensions}
            realViewRef={realViewRef}
            titleRef={titleRef}
            title={title}
            setTitle={setTitle}
            onSave={onSave}
            setIsDirty={setIsDirty}
            isDirty={isDirty}
            showToast={showToast}
            onInlineAI={() => setIsInlineAIOpen(true)}
            editorMenu={
              <EditorMenu
                title={title}
                snippet={snippet}
                setSelectedSnippet={setSelectedNote}
                isDirty={isDirty}
                isSaving={isSaving}
                onSave={handleSave}
                onToggleInspector={onToggleInspector}
                onExportHTML={handleExportHTML}
                onExportPDF={handleExportPDF}
                onExportMarkdown={handleExportMarkdown}
                onExportMarkdownBundle={handleExportMarkdownBundle}
                onExportText={handleExportText}
                onExportDocs={handleExportDocs}
                onInlineAI={() => setIsInlineAIOpen(true)}
                onPreview={() => setIsPreviewOpen(true)}
              />
            }
          />
        </div>
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
      prevSnippet?.isLearned === nextSnippet?.isLearned &&
      prevSnippet?.createdAt === nextSnippet?.createdAt &&
      prevProps.onSave === nextProps.onSave &&
      prevProps.onToggleInspector === nextProps.onToggleInspector &&
      prevProps.isActive === nextProps.isActive
    )
  }
)

Editor.displayName = 'Editor'

export default Editor
