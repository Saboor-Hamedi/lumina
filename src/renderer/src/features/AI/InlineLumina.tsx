import React, { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GripVertical, X, Check, Copy, Loader2 } from 'lucide-react'
import { useInlineDragAndPosition } from './hooks/useInlineDragAndPosition'
import { useInlineContextExtractor } from './hooks/useInlineContextExtractor'
import { useInlineGeneration } from './hooks/useInlineGeneration'
import './css/inlineLumina.css'

export interface InlineLuminaProps {
  isOpen: boolean
  onClose: () => void
  onInsert?: (content: string, range?: { from: number; to: number }) => void
  editorView?: any
  title?: string
  cursorPosition?: number | null
}

/**
 * InlineLumina is a floating spotlight/modal prompt interface anchored to the active editor cursor.
 * Enables rewriting, expansion, code generation, and direct in-place document replacement.
 */
const InlineLumina: React.FC<InlineLuminaProps> = ({
  isOpen,
  onClose,
  onInsert,
  editorView,
  title,
  cursorPosition
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const { modalRef, handleDragStart, modalStyle } = useInlineDragAndPosition({
    editorView,
    isOpen
  })

  const { contextRange } = useInlineContextExtractor({
    editorView,
    isOpen,
    cursorPosition
  })

  const {
    query,
    setQuery,
    response,
    isGenerating,
    copied,
    handleCopy,
    handleReplace,
    handleCancel,
    handleSubmit
  } = useInlineGeneration({
    isOpen,
    onClose,
    onInsert,
    contextRange,
    title,
    inputRef
  })

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div
      className="inline-lumina-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel()
      }}
    >
      <div
        ref={modalRef}
        className="inline-lumina-modal"
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <form onSubmit={handleSubmit} className="inline-lumina-form-compact">
          <div
            className="inline-lumina-drag-handle"
            title="Drag"
            onMouseDown={handleDragStart}
          >
            <GripVertical size={14} />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="inline-lumina-input-compact"
            placeholder={
              contextRange && contextRange.isSelection
                ? 'Ask Lumina to edit selection...'
                : 'Ask Lumina...'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                handleCancel()
              }
            }}
          />
          <button
            type="submit"
            className="inline-lumina-send-btn"
            disabled={!query.trim() || isGenerating}
            title="Send (Enter)"
          >
            {isGenerating ? <Loader2 size={14} className="spinning" /> : <Check size={14} />}
          </button>
          <button
            type="button"
            className="inline-lumina-send-btn"
            onClick={handleCancel}
            title="Close (Esc)"
          >
            <X size={14} />
          </button>
        </form>

        {!response && !isGenerating && (
          <div className="inline-lumina-escape-hint">
            Press <kbd>Esc</kbd> to close
          </div>
        )}

        {(response || isGenerating) && (
          <>
            <div className="inline-lumina-response-compact">
              <div className="inline-lumina-response-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {response || '*Thinking...*'}
                </ReactMarkdown>
              </div>
            </div>

            {response && !isGenerating && (
              <div className="inline-lumina-actions-compact">
                <button
                  className="inline-lumina-btn-compact inline-lumina-btn-insert"
                  onClick={handleReplace}
                >
                  <Check size={14} />
                  Insert
                </button>

                <button className="inline-lumina-btn-compact" onClick={handleCopy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

export default React.memo(InlineLumina)
