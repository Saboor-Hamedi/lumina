/**
 * =========================================================================================
 * Lumina Editor (`Editor.jsx`)
 * =========================================================================================
 *
 * Core markdown editor component. Orchestrates editor state, CodeMirror extensions,
 * modal overlays, toolbars, and canvas rendering through dedicated custom hooks.
 * =========================================================================================
 */

import React, { useState, useRef, useCallback } from 'react'
import EditorMenu from './menu/EditorMenu'
import ToastNotification from '../../core/notification'
import PreviewModal from '../Overlays/PreviewModal/PreviewModal'
import OverwriteModal from '../Overlays/Modals/OverwriteModal'
import InlineLumina from '../Overlays/InlineLumina'
import RulerScrollbar from './RulerScrollbar'
import FindWidget from '../Workspace/components/FindWidget'
import { EditorCanvas } from './components/EditorCanvas'

import { useToast } from '../../core/hooks/useToast'
import { useKeyboardShortcuts } from '../../core/hooks/useKeyboardShortcuts'
import { useVaultStore } from '../../core/store/useVaultStore'
import { useZoom } from './useZoom'
import { useEditorState } from './hooks/useEditorState'
import { useEditorExports } from './hooks/useEditorExports'
import { useEditorEvents } from './hooks/useEditorEvents'
import { useEditorExtensions } from './hooks/useEditorExtensions'

import './Editor.css'
import '../codeBlock/codeWrapper.css'
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

    // DOM & Editor references
    const editorHandleRef = useRef(null)
    const titleRef = useRef(null)
    const scrollerRef = useRef(null)
    const zoomContainerRef = useRef(null)
    const realViewRef = useRef(null)
    const showFindWidgetRef = useRef(showFindWidget)
    showFindWidgetRef.current = showFindWidget

    useZoom({
      containerRef: zoomContainerRef,
      isActive
    })

    const setSelectedSnippet = useVaultStore((state) => state.setSelectedSnippet)
    const setDirty = useVaultStore((state) => state.setDirty)

    // 1. Editor State (Lifecycle, Auto-save, Conflict detection)
    const {
      title,
      setTitle,
      isDirty,
      setIsDirty,
      isSaving,
      editorKey,
      conflictPrompt,
      snippetRef,
      latestCodeRef,
      lastSavedCodeRef,
      lastSaveTimeRef,
      handleSave,
      handleMarkdownChange,
      handleOverwriteClose,
      handleOverwriteConfirm
    } = useEditorState({
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
      handleExportMarkdown
    } = useEditorExports({
      snippet,
      title,
      editorHandleRef,
      showToast
    })

    // 3. Global Window & AI Event Subscriptions
    const { isActiveRef } = useEditorEvents({
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
      setDirty
    })

    // 4. CodeMirror Extensions & Keymaps
    const { finalExtensions } = useEditorExtensions({
      snippetRef,
      realViewRef,
      showToast,
      isActiveRef,
      showFindWidgetRef,
      setShowFindWidget,
      setReplaceModeActive
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
      }
    })

    // Inline Lumina AI Handlers
    const handleInlineAIInsert = useCallback((text, range = null) => {
      if (!realViewRef.current) return
      const view = realViewRef.current
      const selection = view.state.selection.main
      const from = range ? range.from : selection.from
      const to = range ? range.to : selection.to

      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length }
      })
      setIsDirty(true)
    }, [setIsDirty])

    const handleCloseInlineAI = useCallback(() => setIsInlineAIOpen(false), [])

    return (
      <div
        className="markdown-editor mode-source"
        ref={zoomContainerRef}
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
        <RulerScrollbar scrollerRef={scrollerRef} />

        <div className="editor-scroller" ref={scrollerRef}>
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
            onExportText={handleExportText}
            onExportDocs={handleExportDocs}
            onInlineAI={() => setIsInlineAIOpen(true)}
            onPreview={() => setIsPreviewOpen(true)}
          />

          <PreviewModal
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            title={title}
            content={snippet?.code}
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
            showToast={showToast}
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
      prevProps.onSave === nextProps.onSave &&
      prevProps.onToggleInspector === nextProps.onToggleInspector &&
      prevProps.isActive === nextProps.isActive
    )
  }
)

Editor.displayName = 'Editor'

export default Editor
