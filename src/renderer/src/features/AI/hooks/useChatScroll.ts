import { useRef, useCallback, useEffect, type RefObject } from 'react'
import type { ChatMessage } from '../types/ai.types'

export interface UseChatScrollResult {
  listRef: RefObject<HTMLDivElement | null>
  autoScrollRef: RefObject<boolean>
  handleMessageScroll: () => void
}

/**
 * Hook for smooth, gesture-aware chat scrolling.
 * Automatically pins to bottom during streaming, but immediately unlocks when the user scrolls upward.
 */
export const useChatScroll = (
  chatMessages: ChatMessage[] = [],
  isChatLoading: boolean = false
): UseChatScrollResult => {
  const listRef = useRef<HTMLDivElement | null>(null)
  const autoScrollRef = useRef<boolean>(true)
  const prevMsgCountRef = useRef<number>(0)

  // Determine if user is within threshold of the bottom
  const checkIfAtBottom = useCallback((el: HTMLElement | null): boolean => {
    if (!el) return false
    const { scrollTop, scrollHeight, clientHeight } = el
    // Tight threshold (30px) so scrolling up immediately disconnects autoscroll
    return scrollHeight - scrollTop - clientHeight <= 30
  }, [])

  // Handle manual user scroll events
  const handleMessageScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const isAtBottom = checkIfAtBottom(el)
    // Only re-engage if user manually scrolled all the way to the bottom
    autoScrollRef.current = isAtBottom
  }, [checkIfAtBottom])

  // Attach immediate gesture listeners (wheel, touch) for instantaneous reaction
  useEffect(() => {
    const el = listRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        // Instant disconnect on any upward wheel gesture
        autoScrollRef.current = false
      } else if (e.deltaY > 0) {
        // Re-engage if downward scroll reaches near bottom
        if (checkIfAtBottom(el)) {
          autoScrollRef.current = true
        }
      }
    }

    const handleTouchStart = () => {
      if (!checkIfAtBottom(el)) {
        autoScrollRef.current = false
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: true })
    el.addEventListener('touchstart', handleTouchStart, { passive: true })

    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchstart', handleTouchStart)
    }
  }, [checkIfAtBottom])

  // If a new user message is added, always snap to bottom and re-enable autoscroll
  useEffect(() => {
    const count = chatMessages?.length || 0
    if (count > prevMsgCountRef.current) {
      const lastMsg = chatMessages[count - 1]
      if (lastMsg?.sender === 'user' || lastMsg?.role === 'user') {
        autoScrollRef.current = true
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight
        }
      }
    }
    prevMsgCountRef.current = count
  }, [chatMessages])

  // Smooth autoscroll during streaming updates
  useEffect(() => {
    if (!autoScrollRef.current || !listRef.current) return
    const el = listRef.current

    const rafId = requestAnimationFrame(() => {
      if (el && autoScrollRef.current) {
        el.scrollTop = el.scrollHeight
      }
    })

    return () => cancelAnimationFrame(rafId)
  }, [chatMessages, isChatLoading])

  return {
    listRef,
    autoScrollRef,
    handleMessageScroll
  }
}

export default useChatScroll
