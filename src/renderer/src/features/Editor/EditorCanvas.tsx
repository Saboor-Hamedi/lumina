/**
 * =========================================================================================
 * Editor Canvas Component (`EditorCanvas.tsx`)
 * =========================================================================================
 *
 * Responsibilities:
 * - Wraps the CodeMirror canvas in `.editor-canvas-wrap`
 * - Renders the context menu and handles right-click events
 * - Integrates inline `EditorMetadata`
 * - Handles wikilink hover & capture mousedown events
 * - Hardens `<AtomicCodeMirrorEditor>` with `EditorCanvasErrorBoundary`
 * =========================================================================================
 */

import React, { useState, useEffect, useRef, useMemo, Component, type ErrorInfo, type ReactNode } from 'react'
import { AtomicCodeMirrorEditor } from '@atomic-editor/editor'
import { languages } from '@codemirror/language-data'
import type { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { useSettingsStore } from '../../core/store/SettingStore'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
import { setupWikilinkHover } from './wikilink/hoverWikilink'
import ContextMenu from '../modals/ContextMenu'
import { getEditorContextMenuOptions } from './menu'
import EditorMetadata from './components/EditorMetadata'
import type { Snippet, EditorHandle } from '../../core/editor/types'
import type { ToastType } from '../../core/notification'
import { markExplorerPerf } from '../Explorer/utils/explorerPerf'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class EditorCanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[EditorCanvasErrorBoundary] AtomicEditor crashed:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          role="alert"
          style={{
            padding: '24px',
            margin: '16px',
            border: '1px solid var(--color-border-subtle, rgba(255,255,255,0.1))',
            borderRadius: '8px',
            background: 'var(--color-surface, #1e1e1e)',
            color: 'var(--color-text-main, #e0e0e0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'flex-start'
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '15px', color: '#f87171' }}>
            Editor encountered an error
          </div>
          <div style={{ fontSize: '13px', opacity: 0.85, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred inside the editor.'}
          </div>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              background: 'var(--color-primary, #38bdf8)',
              color: '#000',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Reload Editor
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export interface EditorCanvasProps {
  snippet: Snippet | null
  editorKey: number
  handleMarkdownChange: (md: string) => void
  editorHandleRef: React.RefObject<EditorHandle | null>
  finalExtensions: Extension[]
  realViewRef: React.MutableRefObject<EditorView | null>
  titleRef: React.RefObject<HTMLInputElement | null>
  title: string
  setTitle: React.Dispatch<React.SetStateAction<string>>
  onSave: (snippet: Snippet) => Promise<Snippet | void>
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>
  isDirty: boolean
  showToast?: (message: string, type?: ToastType) => void
  onInlineAI?: any
  editorMenu?: ReactNode
}

export const EditorCanvas: React.FC<EditorCanvasProps> = React.memo(
  ({
    snippet,
    editorKey,
    handleMarkdownChange,
    editorHandleRef,
    finalExtensions,
    realViewRef,
    titleRef,
    title,
    setTitle,
    onSave,
    setIsDirty,
    isDirty,
    showToast,
    onInlineAI,
    editorMenu
  }) => {
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
    const editorWrapperRef = useRef<HTMLDivElement | null>(null)

    const inlineTitle = useSettingsStore((state: any) => state.settings?.inlineTitle !== false)
    const inlineMetadata = useSettingsStore((state: any) => Boolean(state.settings?.inlineMetadata))

    useEffect(() => {
      const wrapper = editorWrapperRef.current
      if (!wrapper) return

      const cleanupHover = setupWikilinkHover(wrapper, useWorkspaceStore.getState)
      return () => {
        cleanupHover()
      }
    }, [])

    const cleanMarkdownSource = useMemo(() => {
      const sourceStartedAt = performance.now()
      markExplorerPerf('document-source-clean-start', {
        noteId: snippet?.id,
        sourceLength: snippet?.code?.length || 0
      })
      const raw = snippet?.code || ''
      if (!raw) {
        markExplorerPerf('document-source-clean-end', { noteId: snippet?.id, durationMs: 0, sourceLength: 0 })
        return ''
      }
      let text = raw.replace(/^\uFEFF/, '')
      while (/^\s*---\r?\n/.test(text)) {
        const match = text.match(/^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/)
        if (!match) break
        text = match[1] || ''
      }
      const lines = text.split(/\r?\n/)
      let lineIdx = 0
      let foundLoose = false
      const knownKeys = new Set([
        'id', 'title', 'language', 'tags', 'selection', 'ispinned', 'pinned',
        'islearned', 'learned', 'customicon', 'icon', 'createdat', 'created_at',
        'timestamp', 'color', 'type', 'folderid', 'folder_id'
      ])
      while (lineIdx < lines.length) {
        const line = lines[lineIdx].trim()
        if (!line) {
          if (foundLoose) {
            lineIdx++
            continue
          }
          lineIdx++
          continue
        }
        const colonIdx = line.indexOf(':')
        if (colonIdx !== -1) {
          const key = line.slice(0, colonIdx).trim().toLowerCase()
          if (knownKeys.has(key)) {
            foundLoose = true
            lineIdx++
            continue
          }
        }
        break
      }
      if (foundLoose) {
        text = lines.slice(lineIdx).join('\n')
      }
      const cleaned = text.replace(/^[\r\n]+/, '')
      markExplorerPerf('document-source-clean-end', {
        noteId: snippet?.id,
        durationMs: Number((performance.now() - sourceStartedAt).toFixed(2)),
        sourceLength: raw.length,
        cleanedLength: cleaned.length
      })
      return cleaned
    }, [snippet?.code])

    useEffect(() => {
      markExplorerPerf('editor-view-created', {
        noteId: snippet?.id,
        editorHandleReady: Boolean(editorHandleRef.current),
        documentLength: cleanMarkdownSource.length
      })
    }, [snippet?.id, editorKey])

    return (
      <div
        className="editor-canvas-wrap"
        ref={editorWrapperRef}
        onContextMenu={(e) => {
          const target = e.target as HTMLElement | null
          const isEditor = target?.closest('.cm-editor') || target?.closest('.editor-canvas-wrap')
          if (!isEditor) return
          e.preventDefault()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
      >
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={getEditorContextMenuOptions(realViewRef.current)}
            onClose={() => setContextMenu(null)}
          />
        )}
        {(inlineTitle || inlineMetadata) && (
          <EditorMetadata
            {...({
              titleRef,
              snippet,
              onSave,
              title,
              setTitle,
              setIsDirty,
              isDirty,
              onInlineAI,
              editorMenu,
              showTitle: inlineTitle,
              showActions: inlineMetadata
            } as any)}
          />
        )}
        {snippet?.isPartial && (
          <div className="editor-large-note-warning" role="status">
            Showing the first part of this large note. Editing and saving are disabled to protect the workspace.
          </div>
        )}
        {!inlineTitle && !inlineMetadata && editorMenu && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0', width: '100%' }}>
            {editorMenu}
          </div>
        )}

        <EditorCanvasErrorBoundary key={`boundary-${snippet?.id}-${editorKey}`}>
          <AtomicCodeMirrorEditor
            key={`${snippet?.id}-${editorKey}`}
            documentId={snippet?.id}
            markdownSource={cleanMarkdownSource}
            onMarkdownChange={handleMarkdownChange}
            editorHandleRef={editorHandleRef as any}
            codeLanguages={languages}
            extensions={finalExtensions}
            onLinkClick={(url: string) => {
              if (window.api?.openExternal) {
                window.api.openExternal(url)
              } else {
                window.open(url, '_blank', 'noopener,noreferrer')
              }
            }}
          />
        </EditorCanvasErrorBoundary>
      </div>
    )
  },
  (prev, next) => {
    return (
      prev.snippet?.id === next.snippet?.id &&
      prev.editorKey === next.editorKey &&
      prev.snippet?.code === next.snippet?.code &&
      prev.title === next.title &&
      prev.isDirty === next.isDirty &&
      prev.finalExtensions === next.finalExtensions
    )
  }
)

EditorCanvas.displayName = 'EditorCanvas'

export default EditorCanvas
