import React, { useState, useEffect, useRef } from 'react'
import { Brain, ChevronDown } from 'lucide-react'
import { formatLuminaTime } from './LuminaTimer'

export interface ThinkingBlockProps {
  thinkContent?: string
  isStreaming?: boolean
}

/**
 * ThinkingBlock renders the collapsible internal monologue / reasoning stream
 * from models (such as DeepSeek-R1), featuring elapsed thought duration and auto-scroll.
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = React.memo(({ thinkContent, isStreaming = false }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const prevStreamingRef = useRef<boolean>(isStreaming)
  const [elapsed, setElapsed] = useState<number>(0)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
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

  const bodyRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
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
    <div
      className={`chat-thinking-container ${isOpen ? 'open' : 'collapsed'}`}
      style={{ width: '100%', boxSizing: 'border-box' }}
    >
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

export const LuminaThinkingBlock = ThinkingBlock
export default ThinkingBlock
