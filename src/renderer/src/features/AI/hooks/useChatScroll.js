import { useRef, useCallback, useEffect } from 'react'

export const useChatScroll = (chatMessages, isChatLoading) => {
  const listRef = useRef(null)
  const autoScrollRef = useRef(true)

  const handleMessageScroll = useCallback(() => {
    if (!listRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 120
    autoScrollRef.current = isAtBottom
  }, [])

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
