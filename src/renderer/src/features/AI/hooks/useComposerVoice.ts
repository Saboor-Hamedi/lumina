import { useEffect, useRef, RefObject } from 'react'

export interface UseComposerVoiceProps {
  input: string
  setInput: (value: string | ((prev: string) => string)) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

interface VoiceCustomEventDetail {
  instanceId?: string
  text?: string
}

/**
 * Hook for handling voice dictation text insertion in Composer.
 * Focuses the Composer textarea and types transcribed words smoothly word-by-word.
 */
export const useComposerVoice = ({
  input,
  setInput,
  textareaRef
}: UseComposerVoiceProps): void => {
  const baselineInputRef = useRef<string | null>(null)
  const latestInputRef = useRef<string>(input)
  const typingTimerRef = useRef<number | null>(null)

  latestInputRef.current = input

  useEffect(() => {
    const clearTypingTimer = () => {
      if (typingTimerRef.current !== null) {
        window.clearInterval(typingTimerRef.current)
        typingTimerRef.current = null
      }
    }

    const focusComposerEnd = () => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
      el.scrollTop = el.scrollHeight
    }

    const handleLiveText = (e: Event) => {
      const customEvent = e as CustomEvent<VoiceCustomEventDetail>
      if (customEvent.detail?.instanceId !== 'composer-voice') return
      const live = customEvent.detail?.text
      if (!live) return
      if (baselineInputRef.current === null) {
        baselineInputRef.current = latestInputRef.current
      }
      const base = baselineInputRef.current
      const needsSpace = base && !base.endsWith(' ') && !base.endsWith('\n')
      setInput(base ? `${base}${needsSpace ? ' ' : ''}${live}` : live)
    }

    const handleLiveCancel = (e: Event) => {
      const customEvent = e as CustomEvent<VoiceCustomEventDetail>
      if (customEvent.detail?.instanceId !== 'composer-voice') return
      clearTypingTimer()
      if (baselineInputRef.current !== null) {
        setInput(baselineInputRef.current)
        baselineInputRef.current = null
      }
    }

    const handleVoiceInsert = (e: Event) => {
      const customEvent = e as CustomEvent<VoiceCustomEventDetail>
      if (customEvent.detail?.instanceId !== 'composer-voice') return
      const text = customEvent.detail?.text?.trim()
      if (!text) return

      clearTypingTimer()
      const base = baselineInputRef.current !== null ? baselineInputRef.current : latestInputRef.current
      baselineInputRef.current = null

      const words = text.split(/\s+/).filter(Boolean)
      if (words.length <= 1) {
        const needsSpace = Boolean(base && !base.endsWith(' ') && !base.endsWith('\n'))
        setInput(base ? `${base}${needsSpace ? ' ' : ''}${text}` : text)
        window.setTimeout(focusComposerEnd, 10)
        return
      }

      // Smooth word-by-word typing animation (~28ms per word)
      const prefix = base ? `${base}${!base.endsWith(' ') && !base.endsWith('\n') ? ' ' : ''}` : ''
      let wordIdx = 0

      const step = () => {
        wordIdx++
        const partial = words.slice(0, wordIdx).join(' ')
        setInput(`${prefix}${partial}`)
        if (wordIdx >= words.length) {
          clearTypingTimer()
          window.setTimeout(focusComposerEnd, 10)
        } else {
          const el = textareaRef.current
          if (el) el.scrollTop = el.scrollHeight
        }
      }

      step()
      typingTimerRef.current = window.setInterval(step, 28)
    }

    window.addEventListener('voice-live-text', handleLiveText)
    window.addEventListener('voice-live-cancel', handleLiveCancel)
    window.addEventListener('voice-insert-text', handleVoiceInsert)

    return () => {
      clearTypingTimer()
      window.removeEventListener('voice-live-text', handleLiveText)
      window.removeEventListener('voice-live-cancel', handleLiveCancel)
      window.removeEventListener('voice-insert-text', handleVoiceInsert)
    }
  }, [setInput, textareaRef])
}
