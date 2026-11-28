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
  const pendingWordsRef = useRef<string[]>([])
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

    const drainNextWord = () => {
      const nextWord = pendingWordsRef.current.shift()
      if (!nextWord) {
        clearTypingTimer()
        window.setTimeout(focusComposerEnd, 10)
        return
      }

      setInput((prev) => {
        const needsSpace = Boolean(prev && !prev.endsWith(' ') && !prev.endsWith('\n'))
        return prev ? `${prev}${needsSpace ? ' ' : ''}${nextWord}` : nextWord
      })

      const el = textareaRef.current
      if (el) {
        el.scrollTop = el.scrollHeight
      }

      if (pendingWordsRef.current.length === 0) {
        clearTypingTimer()
        window.setTimeout(focusComposerEnd, 10)
      }
    }

    const startDraining = () => {
      if (typingTimerRef.current !== null) return
      drainNextWord()
      if (pendingWordsRef.current.length > 0) {
        typingTimerRef.current = window.setInterval(drainNextWord, 26)
      }
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
      pendingWordsRef.current = []
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

      baselineInputRef.current = null
      const words = text.split(/\s+/).filter(Boolean)
      if (words.length === 0) return

      pendingWordsRef.current.push(...words)
      startDraining()
    }

    window.addEventListener('voice-live-text', handleLiveText)
    window.addEventListener('voice-live-cancel', handleLiveCancel)
    window.addEventListener('voice-insert-text', handleVoiceInsert)

    return () => {
      pendingWordsRef.current = []
      clearTypingTimer()
      window.removeEventListener('voice-live-text', handleLiveText)
      window.removeEventListener('voice-live-cancel', handleLiveCancel)
      window.removeEventListener('voice-insert-text', handleVoiceInsert)
    }
  }, [setInput, textareaRef])
}
