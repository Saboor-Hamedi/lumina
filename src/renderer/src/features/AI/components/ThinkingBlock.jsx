import React, { useState, useEffect, useRef } from 'react'
import { Brain, ChevronDown } from 'lucide-react'
import { formatLuminaTime } from './luminaTimer.jsx'

export const ThinkingBlock = React.memo(({ thinkContent, isStreaming = false }) => {
  const [isOpen, setIsOpen] = useState(isStreaming)
  const prevStreamingRef = useRef(isStreaming)
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    let interval = null
    if (isStreaming) {
      startTimeRef.current = Date.now()
      setElapsed(0)
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 500)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isStreaming])

  const bodyRef = useRef(null)

  useEffect(() => {
    if (!prevStreamingRef.current && isStreaming) {
      setIsOpen(true)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming])

  useEffect(() => {
    if (isStreaming && isOpen && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [thinkContent, isStreaming, isOpen])

  if (!thinkContent?.trim()) return null

  const timerText = isStreaming
    ? `Thinking (${formatLuminaTime(elapsed)})`
    : `Thought for ${formatLuminaTime(Math.max(1, elapsed))}`

  return (
    <div className={`chat-thinking-container ${isOpen ? 'open' : 'collapsed'}`}>
      <button
        type="button"
        className="chat-thinking-header"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="chat-thinking-header-left">
          <Brain size={13} className={`chat-thinking-brain-icon ${isStreaming ? 'pulsing' : ''}`} />
          <span className="chat-thinking-title">
            {timerText}
          </span>
          <span className="preview-indicator-tag chat-thinking-pill">
            {isStreaming ? 'REASONING' : 'THOUGHT'}
          </span>
        </div>
        <div className="chat-thinking-header-right">
          <ChevronDown
            size={12}
            className={`chat-thinking-chevron ${isOpen ? 'rotated' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div ref={bodyRef} className="chat-thinking-body seamless-scrollbar">
          <div className="chat-thinking-content">
            {thinkContent.trim()}
          </div>
        </div>
      )}
    </div>
  )
})

export default ThinkingBlock
