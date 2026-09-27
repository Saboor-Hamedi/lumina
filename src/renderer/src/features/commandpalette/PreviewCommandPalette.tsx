/**
 * =========================================================================
 * PreviewCommandPalette Component (`PreviewCommandPalette.tsx`)
 * =========================================================================
 *
 * A reusable, full-fidelity read-only markdown preview.
 * Inherits 100% of the editor's typography, extensions, tables, and scrolling.
 * Supports:
 * - CodeMirror extensions (images, tables, KaTeX, Mermaid, Callouts, Highlighting)
 * - Wiki-links resolution to existing notes
 * - Embedded Lumina AI Thinking blocks (<think> tags)
 * - Custom link handling or external URL opening
 *
 * Fully typed in TypeScript for zero crashes and maximum performance.
 * =========================================================================
 */

import React, { useEffect, useMemo, useState, useRef } from 'react'
import { AtomicCodeMirrorEditor, wikiLinks } from '@atomic-editor/editor'
import { EditorState, Prec, Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { languages } from '@codemirror/language-data'
import { useWorkspaceStore } from '../../core/store/workspaceStore'
// Media & editor extensions
import { imageWidgetExtension } from '../media'
import { htmlWidgetExtension } from '../Editor/extensions/htmlExtension'
import { katexExtension } from '../Editor/extensions/katexExtension'
import { tables } from '../table/tableExtension'
import { mermaidWidgetExtension } from '../../core/mermaid'
import { calloutExtension, highlightExtension } from '../../core/editor'
import {
  codeBlockDecorations,
  luminaSyntaxHighlighting
} from '../../core/code'
import { Sparkles } from 'lucide-react'
// Lumina AI Thinking Block
import { ThinkingBlock } from '../AI/components/LuminaThinkingBlock'

import '@atomic-editor/editor/styles.css'
import '../Editor/Editor.css'
import '../../assets/codeWrapper.css'
import '../media/css/imageExtension.css'

export interface PreviewCommandPaletteProps {
  /** Raw markdown content to preview */
  content?: string
  /** Callback triggered to close the parent modal/palette */
  onClose?: () => void
  /** Optional custom handler for clicked links */
  customLinkHandler?: (url: string) => boolean | Promise<boolean>
  /** Optional custom footer navigation element */
  footerNav?: React.ReactNode
}

export const PreviewCommandPalette: React.FC<PreviewCommandPaletteProps> = React.memo(
  ({ content, onClose, customLinkHandler, footerNav }) => {
    const scrollerRef = useRef<HTMLDivElement | null>(null)
    const [shouldRenderEditor] = useState<boolean>(true)

    useEffect(() => {
      if (scrollerRef.current) {
        scrollerRef.current.scrollTop = 0
      }
    }, [content])

    const handleLinkClick = useMemo(
      () => async (url: string): Promise<void> => {
        if (customLinkHandler) {
          const handled = await customLinkHandler(url)
          if (handled) return
        }

        if (url.match(/^(https?|mailto|file):\/\//i)) {
          window.open(url, '_blank')
          return
        }
        try {
          const { notes, setSelectedNote } = useWorkspaceStore.getState()
          const targetLower = url.toLowerCase()
          const targetSnippet = (notes || []).find(
            (s) =>
              s.title &&
              (s.title.toLowerCase() === targetLower || s.title.toLowerCase() === `${targetLower}.md`)
          )
          if (targetSnippet) {
            if (setSelectedNote) setSelectedNote(targetSnippet)
            if (onClose) onClose()
          }
        } catch (e) {
          console.error(e)
        }
      },
      [onClose, customLinkHandler]
    )

    const extensions: Extension[] = useMemo(
      () => [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        Prec.highest(imageWidgetExtension as Extension),
        htmlWidgetExtension as Extension,
        katexExtension as Extension,
        mermaidWidgetExtension as Extension,
        calloutExtension as Extension,
        highlightExtension as Extension,
        codeBlockDecorations as Extension,
        luminaSyntaxHighlighting as Extension,
        Prec.highest(tables({ onLinkClick: handleLinkClick }) as Extension),
        wikiLinks({
          openOnClick: true,
          resolve: async (target: string) => {
            const { notes } = useWorkspaceStore.getState()
            const targetLower = target.toLowerCase()
            const exists = (notes || []).some(
              (s) =>
                s.title &&
                (s.title.toLowerCase() === targetLower ||
                  s.title.toLowerCase() === `${targetLower}.md`)
            )
            return {
              target,
              label: target,
              status: (exists ? 'resolved' : 'missing') as 'resolved' | 'missing'
            }
          },
          onOpen: handleLinkClick
        }) as Extension
      ],
      [handleLinkClick]
    )

    const { thinkContent, cleanContent } = useMemo(() => {
      if (!content) return { thinkContent: '', cleanContent: '' }
      let think = ''
      let remaining = content
      const thinkMatch = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/i)
      if (thinkMatch) {
        think = thinkMatch[1].trim()
        remaining = remaining.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim()
      }
      // Cleanly strip YAML frontmatter / metadata (e.g. --- ... ---)
      remaining = remaining.replace(/^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim()
      return { thinkContent: think, cleanContent: remaining }
    }, [content])

    return (
      <div
        ref={scrollerRef}
        className="markdown-editor mode-source preview-body seamless-scrollbar"
        style={{
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          height: '100%',
          padding: '16px 12px',
          background: 'var(--bg-app)'
        }}
      >
        <style>{`
          .preview-body .cm-table-ui-header,
          .preview-body .cm-table-ui-delete-btn,
          .preview-body .cm-table-ui-drag-handle {
            display: none !important;
          }
          .preview-body .cm-atomic-table table {
            border-top-left-radius: 6px !important;
            border-top-right-radius: 6px !important;
          }
          .preview-body .editor-canvas-wrap {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 8px 24px 8px !important;
          }
        `}</style>
        <div className="editor-scroller" style={{ overflow: 'visible', height: 'auto', padding: 0 }}>
          <div
            className="editor-canvas-wrap"
            style={{ maxWidth: '100%', width: '100%', margin: '0 auto', padding: '0 8px 24px 8px' }}
            onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
              const target = e.target as HTMLElement | null
              if (target?.closest('.mermaid-edit-btn') || target?.closest('.mermaid-widget-header')) {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
          >
            {thinkContent && (
              <div style={{ marginBottom: '12px' }}>
                <ThinkingBlock thinkContent={thinkContent} isStreaming={false} />
              </div>
            )}
            {shouldRenderEditor ? (
              <AtomicCodeMirrorEditor
                markdownSource={cleanContent || ''}
                codeLanguages={languages}
                extensions={extensions}
                blurEditorOnMount={true}
              />
            ) : (
              <div
                style={{
                  padding: '60px',
                  color: 'var(--text-faint)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div className="mermaid-loading" style={{ opacity: 0.5 }}>
                  <Sparkles size={24} />
                </div>
                <span style={{ fontSize: '12px', opacity: 0.7 }}>Rendering preview...</span>
              </div>
            )}
            {footerNav}
          </div>
        </div>
      </div>
    )
  }
)

PreviewCommandPalette.displayName = 'PreviewCommandPalette'

export default PreviewCommandPalette
