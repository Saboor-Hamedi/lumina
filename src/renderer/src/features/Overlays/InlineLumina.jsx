import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GripVertical, X, Check, Copy, Loader2 } from 'lucide-react'
import './InlineLumina.css'

const InlineLumina = ({ isOpen, onClose, onInsert, editorView, title, cursorPosition }) => {
  const [query, setQuery] = useState('')
  const [lastQuery, setLastQuery] = useState('')
  const [response, setResponse] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [abortController, setAbortController] = useState(null)
  const [copied, setCopied] = useState(false)
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 })
  const [contextRange, setContextRange] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef({ x: 0, y: 0, top: 0, left: 0 })
  
  const inputRef = useRef(null)
  const modalRef = useRef(null)

  useEffect(() => {
    if (isOpen && editorView && !isDragging) {
      requestAnimationFrame(() => {
        if (!modalRef.current) return

        try {
          const selection = editorView.state.selection.main
          const pos = selection.head || selection.from
          const coords = editorView.coordsAtPos(pos)
          
          if (coords) {
            const modalRect = modalRef.current.getBoundingClientRect()
            const actualModalHeight = modalRect.height > 0 ? modalRect.height : 50
            const actualModalWidth = 420 

            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight

            let top = coords.bottom + 10
            let left = coords.left

            if (left + actualModalWidth > viewportWidth) left = viewportWidth - actualModalWidth - 20
            if (left < 20) left = 20

            if (top + actualModalHeight > viewportHeight) {
              top = coords.top - actualModalHeight - 10
            }

            setModalPosition({
              top: Math.max(10, top),
              left: Math.max(10, left)
            })
          }
        } catch (err) {
          console.warn('[InlineLumina] Could not get cursor coordinates:', err)
        }
      })
    }
  }, [isOpen, editorView]) // intentionally omit cursorPosition so it does NOT move

  const getSelectedText = useCallback(() => {
    if (!editorView) return null

    const doc = editorView.state.doc
    const selection = editorView.state.selection.main
    const selectedText = doc.sliceString(selection.from, selection.to)
    const fullDocumentText = doc.toString()

    if (selectedText.trim()) {
      return {
        text: selectedText.trim(),
        fullText: fullDocumentText,
        from: selection.from,
        to: selection.to,
        isSelection: true
      }
    } else {
      try {
        const linePos = doc.lineAt(selection.from)
        let startLineNumber = linePos.number
        let endLineNumber = linePos.number

        let codeStartNum = -1
        let codeEndNum = -1

        for (let i = startLineNumber; i >= 1; i--) {
          const l = doc.line(i)
          if (l.text.trim().startsWith('```')) {
            codeStartNum = i
            break
          }
        }
        if (codeStartNum !== -1) {
          for (let i = startLineNumber; i <= doc.lines; i++) {
            const l = doc.line(i)
            if (i !== codeStartNum && l.text.trim().startsWith('```')) {
              codeEndNum = i
              break
            }
          }
        }

        if (codeStartNum !== -1 && codeEndNum !== -1 && codeStartNum <= startLineNumber && codeEndNum >= startLineNumber) {
          startLineNumber = codeStartNum
          endLineNumber = codeEndNum
        } else {
          while (startLineNumber > 1 && doc.line(startLineNumber - 1).text.trim() !== '') {
            startLineNumber--
          }
          while (endLineNumber < doc.lines && doc.line(endLineNumber + 1).text.trim() !== '') {
            endLineNumber++
          }
        }

        const startLine = doc.line(startLineNumber)
        const endLine = doc.line(endLineNumber)
        const blockText = doc.sliceString(startLine.from, endLine.to)

        return {
          text: blockText.trim(),
          fullText: fullDocumentText,
          from: startLine.from,
          to: endLine.to,
          isSelection: false
        }
      } catch (err) {
        console.warn('[InlineLumina] Smart context extraction failed:', err)
      }
    }
    return {
      text: '',
      fullText: fullDocumentText,
      from: selection.from,
      to: selection.to,
      isSelection: false
    }
  }, [editorView])

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

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const modalWidth = 420
    const modalHeight = modalRef.current?.getBoundingClientRect().height || 200

    setModalPosition({
      top: Math.max(10, Math.min(newTop, viewportHeight - modalHeight - 10)),
      left: Math.max(10, Math.min(newLeft, viewportWidth - modalWidth - 10))
    })
  }, [isDragging])

  const handleDragEnd = useCallback(() => setIsDragging(false), [])

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

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])
  
  useEffect(() => {
    if (isOpen) {
      setContextRange(getSelectedText())
    }
  }, [isOpen, getSelectedText, cursorPosition])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setLastQuery('')
      setResponse('')
      setIsGenerating(false)
      setCopied(false)
      setContextRange(null)
    }
  }, [isOpen])



  const handleStop = useCallback(() => {
    if (abortController) {
      abortController.abort()
      setAbortController(null)
    }
    setIsGenerating(false)
  }, [abortController])

  const handleCopy = useCallback(() => {
    if (response) {
      navigator.clipboard.writeText(response)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [response])

  const handleReplace = useCallback(() => {
    if (response && onInsert && contextRange) {
      onInsert(response, { from: contextRange.from, to: contextRange.to })
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (response && onInsert) {
      onInsert(response)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [response, onInsert, contextRange])

  const handleCancel = useCallback(() => {
    handleStop()
    onClose()
  }, [handleStop, onClose])

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleGlobalKeyDown, { capture: true })
    }

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true })
    }
  }, [isOpen, handleCancel])

  const handleSubmit = useCallback(
    async (e) => {
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }

      if (!query || !query.trim() || isGenerating) return

      const currentQuery = query.trim()
      setLastQuery(currentQuery)
      setQuery('') 
      setIsGenerating(true)
      setResponse('')
      setCopied(false)

      const controller = new AbortController()
      setAbortController(controller)

      try {
        let systemPrompt = `You are a premium AI writing assistant integrated directly into a user's text editor.

CRITICAL INSTRUCTIONS:
1. You have access to the Full File Contents. Use this to deeply understand the topic, links, tags, and tone of the entire document.
2. When the user asks you to modify, expand, or rewrite the Target Block (their selection/cursor position), you MUST use the Full File Context to inform your changes. Ensure your output seamlessly integrates with the rest of the document.
3. If modifying text, output ONLY the final text for the Target Block. DO NOT include conversational filler like "Here is the expanded text:".
4. DO NOT wrap the text in markdown code blocks (\`\`\`) unless the user explicitly asks for code.
5. If the user asks a general question (e.g., "what is this file about", "summarize", "what is the file name"), answer concisely based on the Full File Contents.`

        if (title) {
          systemPrompt += `\n\n**File Name / Title:** ${title}`
        }

        if (contextRange) {
          if (contextRange.fullText) {
            systemPrompt += `\n\n**Full File Contents (For deep context & understanding):**\n\`\`\`\n${contextRange.fullText}\n\`\`\``
          }
          if (contextRange.text) {
            systemPrompt += '\n\n**Current Target Block (Where the user\'s cursor/selection is located):**\n' + contextRange.text
            if (contextRange.isSelection) {
              systemPrompt += '\n\n*(The user has highlighted the Target Block above. You must operate strictly on replacing/expanding this selection, but use the Full File Contents for context).*'
            } else {
              systemPrompt += '\n\n*(This is the Target Block surrounding the user cursor. You must operate strictly on this block, but use the Full File Contents for context).*'
            }
          }
        }

        let visibleKey = import.meta.env.VITE_DEEPSEEK_KEY
        let model = 'deepseek-chat'
        try {
          const settingsModule = await import('../../core/store/useSettingsStore')
          const settings = settingsModule.useSettingsStore.getState()
          const { deepSeekKey, deepSeekModel } = settings?.settings || {}
          if (deepSeekKey) visibleKey = deepSeekKey
          if (deepSeekModel) model = deepSeekModel
        } catch (err) {}

        if (!visibleKey) {
          setResponse('**Error:** Missing API Key. Please configure it in Settings.')
          setIsGenerating(false)
          return
        }

        const timeoutId = setTimeout(() => controller.abort(), 60000)

        let apiResponse
        try {
          apiResponse = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${visibleKey}`
            },
            body: JSON.stringify({
              model: model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: currentQuery }
              ],
              temperature: 0.7,
              stream: true
            }),
            signal: controller.signal
          })
        } catch (fetchErr) {
          clearTimeout(timeoutId)
          if (fetchErr.name === 'AbortError') throw new Error('Request timed out.')
          throw fetchErr
        }

        clearTimeout(timeoutId)

        if (!apiResponse.ok) {
          const errData = await apiResponse.json().catch(() => ({}))
          throw new Error(errData.error?.message || `API Error: ${apiResponse.status}`)
        }

        const reader = apiResponse.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let fullResponse = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                  fullResponse += data.choices[0].delta.content
                  setResponse(fullResponse)
                }
              } catch (e) {}
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          setResponse(prev => prev + '\n\n*(Generation stopped)*')
        } else {
          setResponse(`**Error:** ${err.message}`)
        }
      } finally {
        setIsGenerating(false)
        setAbortController(null)
      }
    },
    [query, isGenerating, contextRange, title]
  )

  const modalStyle = React.useMemo(() => ({
    top: typeof modalPosition.top === 'number' ? `${modalPosition.top}px` : modalPosition.top,
    left: typeof modalPosition.left === 'number' ? `${modalPosition.left}px` : modalPosition.left,
  }), [modalPosition.top, modalPosition.left])

  if (!isOpen) return null

  return (
    <div className="inline-lumina-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) handleCancel() }}>
      <div
        ref={modalRef}
        className="inline-lumina-modal"
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <form onSubmit={handleSubmit} className="inline-lumina-form-compact">
          <div className="inline-lumina-drag-handle" title="Drag" onMouseDown={handleDragStart}>
            <GripVertical size={14} />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="inline-lumina-input-compact"
            placeholder={contextRange && contextRange.isSelection ? "Ask Lumina to edit selection..." : "Ask Lumina..."}
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
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{response || '*Thinking...*'}</ReactMarkdown>
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

                <button
                  className="inline-lumina-btn-compact"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>

                <button
                  className="inline-lumina-btn-compact inline-lumina-btn-close"
                  onClick={handleCancel}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default React.memo(InlineLumina)
