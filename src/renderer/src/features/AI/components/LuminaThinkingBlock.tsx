import React, { useState, useEffect, useRef } from 'react'
import { Brain, ChevronDown, FastForward } from 'lucide-react'
import { formatLuminaTime } from './LuminaTimer'
import '../css/chatThinking.css'

export interface ThinkingBlockProps {
  thinkContent?: string
  isStreaming?: boolean
  onSkipThinking?: () => void
}

/**
 * ThinkingBlock renders the collapsible internal monologue / reasoning stream
 * from models (such as DeepSeek-R1), featuring elapsed thought duration, auto-scroll,
 * and a 1-click "Skip thinking" action to bypass prolonged reasoning.
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = React.memo(
  ({ thinkContent, isStreaming = false, onSkipThinking }) => {
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
          {isStreaming && (
            <span
              role="button"
              tabIndex={0}
              className="chat-skip-thinking-btn"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (onSkipThinking) {
                  onSkipThinking()
                } else {
                  try {
                    // @ts-ignore
                    window.__lumina_skip_thinking?.()
                  } catch {}
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  e.preventDefault()
                  onSkipThinking?.()
                }
              }}
              title="Skip reasoning and proceed to response"
              aria-label="Skip thinking"
            >
              <FastForward size={11} />
              <span>Skip thinking</span>
            </span>
          )}
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
