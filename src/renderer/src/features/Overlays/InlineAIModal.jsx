import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Copy, Check, Loader2, GripVertical } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './InlineAIModal.css'

const InlineAIModal = ({ isOpen, onClose, onInsert, cursorPosition, editorView }) => {
  // Completely detached from chat store - no shared state
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [abortController, setAbortController] = useState(null)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef(null)
  const responseRef = useRef(null)
  const modalRef = useRef(null)
  const dragHandleRef = useRef(null)
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef({ x: 0, y: 0, top: 0, left: 0 })

  // Calculate cursor position and position modal near it
  useEffect(() => {
    if (isOpen && editorView) {
      // Use requestAnimationFrame to ensure modal is rendered before measuring
      requestAnimationFrame(() => {
        if (!modalRef.current) return

        try {
          // Get current cursor position from editor
          const selection = editorView.state.selection.main
          const pos = selection.head || selection.from

          // Get coordinates at cursor position
          const coords = editorView.coordsAtPos(pos)
          if (coords) {
            // Get actual modal dimensions after render
            const modalRect = modalRef.current.getBoundingClientRect()
            const actualModalHeight = modalRect.height > 0 ? modalRect.height : 50 // Use actual height or small fallback
            const actualModalWidth = modalRect.width > 0 ? modalRect.width : 450

            // Get viewport dimensions
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            // Calculate position above cursor - 10px gap
            let top = coords.top - actualModalHeight - 10 // 10px above cursor
            let left = coords.left

            // Ensure modal doesn't go off-screen horizontally
            if (left + actualModalWidth > viewportWidth) {
              left = viewportWidth - actualModalWidth - 10 // 10px margin from right edge
            }
            if (left < 10) {
              left = 10 // 10px margin from left edge
            }

            // Ensure modal doesn't go off-screen vertically
            if (top < 10) {
              // Position below cursor if not enough space above
              top = coords.bottom + 10 // 10px below cursor
              if (top + actualModalHeight > viewportHeight) {
                top = 10 // Fallback to top if still off-screen
              }
            }

            setModalPosition({
              top: Math.max(10, top),
              left: Math.max(10, left)
            })
          } else {
            // Fallback to top center if coords not available
            const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 32
            setModalPosition({
              top: headerHeight + 10,
              left: '50%'
            })
          }
        } catch (err) {
          console.warn('[InlineAI] Could not get cursor coordinates:', err)
          // Fallback to top center
          const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 32
          setModalPosition({
            top: headerHeight + 10,
            left: '50%'
          })
        }
      })
    }
  }, [isOpen, editorView, response]) // Re-calculate when response changes (modal height changes)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResponse('')
      setIsGenerating(false)
      setCopied(false)
      if (abortController) {
        abortController.abort()
        setAbortController(null)
      }
    }
  }, [isOpen, abortController])

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleStop()
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleStop = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
      setIsGenerating(false)
    }
  }, [abortController])

  const handleCopy = useCallback(() => {
    if (response) {
      navigator.clipboard.writeText(response)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [response])

  const handleInsert = useCallback(() => {
    if (response && onInsert) {
      onInsert(response)
      onClose()
    }
  }, [response, onInsert, onClose])

  const handleCancel = useCallback(() => {
    handleStop()
    setQuery('')
    setResponse('')
    onClose()
  }, [handleStop, onClose])

  // Drag functionality
  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      top: typeof modalPosition.top === 'number' ? modalPosition.top : 0,
      left: typeof modalPosition.left === 'number' ? modalPosition.left : 0
    }
  }, [modalPosition])

  const handleDrag = useCallback((e) => {
    if (!isDragging) return

    const deltaX = e.clientX - dragStartPos.current.x
    const deltaY = e.clientY - dragStartPos.current.y

    const newLeft = dragStartPos.current.left + deltaX
    const newTop = dragStartPos.current.top + deltaY

    // Keep modal within viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const modalWidth = 450
    const modalHeight = 200

    setModalPosition({
      top: Math.max(10, Math.min(newTop, viewportHeight - modalHeight - 10)),
      left: Math.max(10, Math.min(newLeft, viewportWidth - modalWidth - 10))
    })
  }, [isDragging])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Mouse event handlers for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDrag)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDrag, handleDragEnd])

  // Get selected text from editor when modal opens
  const getSelectedText = useCallback(() => {
    if (!editorView) return null

    const selection = editorView.state.selection.main
    const selectedText = editorView.state.doc.sliceString(selection.from, selection.to)

    if (selectedText.trim()) {
      return {
        text: selectedText.trim(),
        from: selection.from,
        to: selection.to
      }
    }
    return null
  }, [editorView])

  // Store selected text when modal opens
  const selectedTextRef = useRef(null)

  useEffect(() => {
    if (isOpen && editorView) {
      selectedTextRef.current = getSelectedText()
    }
  }, [isOpen, editorView, getSelectedText])

  const handleSubmit = useCallback(async (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
      e.nativeEvent?.stopImmediatePropagation()
    }

    // Robust validation
    if (!query || !query.trim() || isGenerating) return

    setIsGenerating(true)
    setResponse('')
    setCopied(false)

    // Create abort controller for this request
    const controller = new AbortController()
    setAbortController(controller)

    try {
      // Get selected text as context (use stored ref) - with error handling
      let contextSnippets = []
      try {
        const selected = selectedTextRef.current || getSelectedText()

        if (selected && selected.text && typeof selected.text === 'string') {
          contextSnippets = [{
            title: 'Selected Text',
            code: selected.text.slice(0, 2000) // Limit context size
          }]
        } else if (editorView && editorView.state && editorView.state.doc) {
          // Fallback: use surrounding context around cursor
          try {
            const selection = editorView.state.selection.main
            const docLength = editorView.state.doc.length
            const before = editorView.state.doc.sliceString(
              Math.max(0, selection.from - 300),
              selection.from
            )
            const after = editorView.state.doc.sliceString(
              selection.to,
              Math.min(docLength, selection.to + 300)
            )
            if (before.trim() || after.trim()) {
              contextSnippets = [{
                title: 'Editor Context',
                code: (before + after).trim().slice(0, 2000)
              }]
            }
          } catch (contextErr) {
            console.warn('[InlineAI] Could not get editor context:', contextErr)
          }
        }
      } catch (contextError) {
        console.warn('[InlineAI] Context extraction failed:', contextError)
        // Continue without context
      }

      // Get settings with error handling
      let settings = null
      let visibleKey = null
      let model = 'deepseek-chat'

      try {
        const settingsModule = await import('../../core/store/useSettingsStore')
        settings = settingsModule.useSettingsStore.getState()
        const { deepSeekKey, deepSeekModel } = settings?.settings || {}
        visibleKey = deepSeekKey || import.meta.env.VITE_DEEPSEEK_KEY
        model = deepSeekModel || 'deepseek-chat'
      } catch (settingsErr) {
        console.error('[InlineAI] Settings load failed:', settingsErr)
        visibleKey = import.meta.env.VITE_DEEPSEEK_KEY
      }

      if (!visibleKey || typeof visibleKey !== 'string') {
        setResponse('**Error:** Missing API Key. Please configure it in Settings.')
        setIsGenerating(false)
        setAbortController(null)
        return
      }

      // Build system prompt with context
      let systemPrompt = `You are Lumina AI, an intelligent assistant. Be concise and helpful. Use Markdown formatting for better readability.`

      if (contextSnippets.length > 0) {
        systemPrompt += '\n\n**Context from Editor:**\n'
        contextSnippets.forEach(ctx => {
          if (ctx && ctx.code) {
            systemPrompt += `${ctx.code}\n\n`
          }
        })
      }

      // Call API with timeout and robust error handling
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout

      let response
      try {
        response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${visibleKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query.trim() }
            ],
            stream: false
          }),
          signal: controller.signal
        })
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        if (fetchErr.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.')
        }
        if (fetchErr.name === 'TypeError' && fetchErr.message.includes('fetch')) {
          throw new Error('Network error. Please check your internet connection.')
        }
        throw fetchErr
      }

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status}`
        try {
          const errData = await response.json()
          errorMessage = errData.error?.message || errorMessage

          if (response.status === 401) {
            errorMessage = 'Invalid API Key. Please check your settings.'
          } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again later.'
          } else if (response.status >= 500) {
            errorMessage = 'Server error. Please try again later.'
          }
        } catch (parseErr) {
          console.warn('[InlineAI] Could not parse error response:', parseErr)
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()

      // Validate response structure
      if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('Invalid response format from API.')
      }

      const content = data.choices[0]?.message?.content
      if (!content || typeof content !== 'string') {
        throw new Error('Empty or invalid response from API.')
      }

      setResponse(content)
    } catch (err) {
      console.error('[InlineAI] Error:', err)
      if (err.name === 'AbortError') {
        setResponse('')
        return
      }

      // User-friendly error messages
      const errorMsg = err.message || 'Failed to generate response. Please try again.'
      setResponse(`**Error:** ${errorMsg}`)
    } finally {
      setIsGenerating(false)
      setAbortController(null)
    }
  }, [query, isGenerating, editorView, getSelectedText])

  if (!isOpen) return null

  return (
    <div className="inline-ai-overlay" onClick={handleCancel}>
      <div
        ref={modalRef}
        className="inline-ai-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: typeof modalPosition.top === 'number' ? `${modalPosition.top}px` : modalPosition.top,
          left: typeof modalPosition.left === 'number' ? `${modalPosition.left}px` : modalPosition.left,
          transform: typeof modalPosition.left === 'string' && modalPosition.left === '50%' ? 'translateX(-50%)' : 'none'
        }}
      >
        {/* Compact Input with Send Button */}
        <form onSubmit={handleSubmit} className="inline-ai-form-compact">
          {/* Drag Handle - Always visible on the left */}
          <div
            ref={dragHandleRef}
            className="inline-ai-drag-handle"
            onMouseDown={handleDragStart}
            title="Drag to reposition"
          >
            <GripVertical size={12} />
          </div>

          <input
            ref={inputRef}
            type="text"
            className="inline-ai-input-compact"
            placeholder="Ask AI..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.stopPropagation()
                e.nativeEvent?.stopImmediatePropagation()
                handleSubmit(e)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                handleCancel()
              }
            }}
            disabled={isGenerating}
          />
          <button
            type="submit"
            className="inline-ai-send-btn"
            disabled={!query.trim() || isGenerating}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleSubmit(e)
            }}
            title="Send (Enter)"
          >
            {isGenerating ? (
              <Loader2 size={14} className="spinning" />
            ) : (
              <Check size={14} />
            )}
          </button>
        </form>

        {/* Escape hint */}
        <div className="inline-ai-escape-hint">
          <span>Press <kbd>Esc</kbd> to close</span>
        </div>

        {/* Response - Only show when we have response */}
        {response && (
          <>
            <div ref={responseRef} className="inline-ai-response-compact">
              <div className="inline-ai-response-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {response}
                </ReactMarkdown>
              </div>
            </div>

            {/* Actions - Only show when response exists */}
            <div className="inline-ai-actions-compact">
              <button
                className="inline-ai-btn-compact inline-ai-btn-insert"
                onClick={handleInsert}
                disabled={isGenerating}
                title="Insert into editor"
              >
                <Check size={12} />
                Insert
              </button>

              <button
                className="inline-ai-btn-compact inline-ai-btn-copy"
                onClick={handleCopy}
                disabled={isGenerating}
                title="Copy to clipboard"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>

              <button
                className="inline-ai-btn-compact inline-ai-btn-cancel"
                onClick={handleCancel}
                title="Close (Esc)"
              >
                <X size={12} />
              </button>
            </div>
          </>
        )}

        {/* Loading */}
        {isGenerating && !response && (
          <div className="inline-ai-loading-compact">
            <Loader2 size={12} className="spinning" />
            <span>Generating...</span>
          </div>
        )}

        {/* Error - shown in response area if any */}
      </div>
    </div>
  )
}

export default InlineAIModal
