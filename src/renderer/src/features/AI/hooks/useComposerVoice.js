import { useEffect, useRef } from 'react'

/**
 * Hook for handling live speech-to-text input events in Composer.
 */
export const useComposerVoice = ({ input, setInput, textareaRef }) => {
  const baselineInputRef = useRef(null)

  useEffect(() => {
    const handleLiveText = (e) => {
      if (e.detail?.instanceId !== 'composer-voice') return
      const live = e.detail?.text
      if (!live) return
      if (baselineInputRef.current === null) {
        baselineInputRef.current = input
      }
      const base = baselineInputRef.current
      const needsSpace = base && !base.endsWith(' ') && !base.endsWith('\n')
      setInput(base ? `${base}${needsSpace ? ' ' : ''}${live}` : live)
    }

    const handleLiveCancel = (e) => {
      if (e.detail?.instanceId !== 'composer-voice') return
      if (baselineInputRef.current !== null) {
        setInput(baselineInputRef.current)
        baselineInputRef.current = null
      }
    }

    const handleVoiceInsert = (e) => {
      if (e.detail?.instanceId !== 'composer-voice') return
      const text = e.detail?.text
      if (!text) return
      const base = baselineInputRef.current !== null ? baselineInputRef.current : input
      baselineInputRef.current = null
      const needsSpace = Boolean(base && !base.endsWith(' ') && !base.endsWith('\n'))
      const nextText = base ? `${base}${needsSpace ? ' ' : ''}${text}` : text
      setInput(nextText)
      setTimeout(() => {
        const el = textareaRef.current
        if (el) {
          el.focus()
          const len = el.value.length
          el.setSelectionRange(len, len)
          el.scrollTop = el.scrollHeight
        }
      }, 10)
    }

    window.addEventListener('voice-live-text', handleLiveText)
    window.addEventListener('voice-live-cancel', handleLiveCancel)
    window.addEventListener('voice-insert-text', handleVoiceInsert)
    return () => {
      window.removeEventListener('voice-live-text', handleLiveText)
      window.removeEventListener('voice-live-cancel', handleLiveCancel)
      window.removeEventListener('voice-insert-text', handleVoiceInsert)
    }
  }, [input, setInput, textareaRef])
}
