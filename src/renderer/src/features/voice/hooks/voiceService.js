import { AudioRecorder } from './audioRecorder'
import { transcribeWithGroq } from './groqWhisper'

function removePrefixOverlap(newText, prevText) {
  if (!prevText || !newText) return newText ? newText.trim() : ''
  const pWords = prevText.trim().toLowerCase().split(/\s+/)
  const nWords = newText.trim().split(/\s+/)

  const maxOverlap = Math.min(4, pWords.length, nWords.length)
  for (let len = maxOverlap; len > 0; len--) {
    const prevSlice = pWords.slice(-len).join(' ')
    const nextSlice = nWords.slice(0, len).map((w) => w.toLowerCase()).join(' ')
    if (prevSlice === nextSlice) {
      return nWords.slice(len).join(' ')
    }
  }
  return newText.trim()
}

class VoiceService {
  constructor() {
    this.recorder = new AudioRecorder()
    this.listeners = new Set()
    this.timerInterval = null
    this.activeRequestId = 0

    this.state = {
      isRecording: false,
      isTranscribing: false,
      recordingDuration: 0,
      audioLevel: 0,
      activeInstanceId: null,
      interimText: '',
      error: null
    }

    this.isStarting = false
    this.isQuotaExhausted = false
    this.lastToggleTime = 0
    this.recordingStartTime = 0

    if (typeof window !== 'undefined') {
      window.addEventListener('toggle-voice-dictation', (e) => {
        this.toggleDictation(e?.detail?.target)
      })

      // Track cursor focus so Ctrl+Shift+V automatically knows where to type
      document.addEventListener('focusin', (e) => {
        if (e.target?.closest?.('.composer-container, .composer-textarea, .lumina-chat') || e.target?.classList?.contains('composer-textarea')) {
          window.__luminaLastVoiceTarget = 'composer-voice'
        } else if (e.target?.closest?.('.cm-editor, .cm-content, .editor-container')) {
          window.__luminaLastVoiceTarget = 'editor-voice'
        }
      }, true)
    }
  }

  toggleDictation(targetHint = null) {
    const now = Date.now()
    if (now - this.lastToggleTime < 450) {
      return
    }
    this.lastToggleTime = now

    // If currently starting, do not immediately stop
    if (this.isStarting) {
      return
    }

    if (this.state.isRecording) {
      // Prevent stopping if recording was started just a split second ago
      if (now - this.recordingStartTime < 500) {
        return
      }

      this.stopRecordingAndTranscribe().then((text) => {
        if (text && text.trim().length > 0) {
          window.dispatchEvent(
            new CustomEvent('voice-insert-text', {
              detail: { text: text.trim(), instanceId: this.state.activeInstanceId || 'editor-voice' }
            })
          )
        }
      })
      return
    }

    if (this.state.isTranscribing) return

    let target = targetHint
    if (!target) {
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null
      if (
        activeEl?.closest?.('.composer-container, .composer-textarea, .lumina-chat') ||
        activeEl?.classList?.contains?.('composer-textarea')
      ) {
        target = 'composer-voice'
      } else if (activeEl?.closest?.('.cm-editor, .cm-content, .editor-container')) {
        target = 'editor-voice'
      } else if (typeof window !== 'undefined' && window.__luminaLastVoiceTarget) {
        target = window.__luminaLastVoiceTarget
      } else {
        target = 'editor-voice'
      }
    }

    this.setActiveInstance(target)
    this.startRecording().catch(() => {})
  }

  subscribe(listener) {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  updateState(partial) {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((listener) => listener(this.state))
  }

  setActiveInstance(id) {
    this.updateState({ activeInstanceId: id })
  }

  async startRecording() {
    if (this.state.isRecording || this.state.isTranscribing || this.isStarting) return

    const groqKey = typeof localStorage !== 'undefined' ? localStorage.getItem('lumina_groq_key') : null
    if (!groqKey || !groqKey.trim()) {
      this.updateState({
        error: 'Please add your free Groq API key in Settings > Intelligence to enable instant voice dictation.'
      })
      return
    }

    this.isStarting = true
    this.isQuotaExhausted = false
    try {
      this.recordingStartTime = Date.now()
      this.updateState({
        isRecording: true,
        recordingDuration: 0,
        audioLevel: 0,
        interimText: '',
        error: null
      })

      this.lastSpeechTime = Date.now()
      this.segmentStartTime = Date.now()
      this.hasSpokenInSegment = false
      this.isFlushingSegment = false
      this.lastTranscribedText = ''

      if (this.timerInterval) clearInterval(this.timerInterval)
      this.timerInterval = setInterval(() => {
        this.updateState({ recordingDuration: this.state.recordingDuration + 1 })
      }, 1000)

      await this.recorder.start((level) => {
        this.updateState({ audioLevel: level })

        const now = Date.now()
        if (level > 0.05) {
          this.hasSpokenInSegment = true
          this.lastSpeechTime = now
        }

        const segmentDuration = now - this.segmentStartTime
        const silenceDuration = now - this.lastSpeechTime

        // Silky smooth progressive typing condition:
        // Trigger segment flush when user has spoken and takes a brief breath (silence >= 380ms after 1.6s speech),
        // or when continuous speaking reaches 4.2 seconds
        if (
          this.hasSpokenInSegment &&
          !this.isFlushingSegment &&
          !this.isQuotaExhausted &&
          this.state.isRecording &&
          ((silenceDuration >= 380 && segmentDuration >= 1600) || segmentDuration >= 4200)
        ) {
          this.flushSegment()
        }
      })
    } catch (err) {
      if (this.timerInterval) {
        clearInterval(this.timerInterval)
        this.timerInterval = null
      }
      this.updateState({
        isRecording: false,
        recordingDuration: 0,
        audioLevel: 0,
        interimText: '',
        error: err?.message || 'Could not access microphone'
      })
      throw err
    } finally {
      this.isStarting = false
    }
  }

  async flushSegment() {
    if (this.isFlushingSegment || !this.state.isRecording || this.isQuotaExhausted) return
    this.isFlushingSegment = true
    this.segmentStartTime = Date.now()
    this.hasSpokenInSegment = false

    const groqKey = typeof localStorage !== 'undefined' ? localStorage.getItem('lumina_groq_key') : null
    if (!groqKey || !groqKey.trim()) {
      this.isFlushingSegment = false
      return
    }

    try {
      const segmentBlob = await this.recorder.flushSegment()
      if (!segmentBlob || segmentBlob.size < 2200) {
        this.isFlushingSegment = false
        return
      }

      const instanceId = this.state.activeInstanceId || 'editor-voice'
      const promptContext = this.lastTranscribedText

      transcribeWithGroq(segmentBlob, groqKey, promptContext)
        .then((text) => {
          if (text && text.trim().length > 0) {
            const rawClean = text.trim()
            const smoothedText = removePrefixOverlap(rawClean, this.lastTranscribedText)
            if (smoothedText && smoothedText.length > 0) {
              this.lastTranscribedText = rawClean
              window.dispatchEvent(
                new CustomEvent('voice-insert-text', {
                  detail: { text: smoothedText, instanceId, isSegment: true }
                })
              )
            }
          }
        })
        .catch((err) => {
          // If quota or auth limit reached, safely stop and notify without crashing
          if (err?.isQuotaError || err?.isAuthError) {
            this.isQuotaExhausted = true
            this.cancelRecording()
            this.updateState({
              error: err.message || 'Groq API quota exceeded. Please check your account.'
            })
          }
        })
        .finally(() => {
          this.isFlushingSegment = false
        })
    } catch (e) {
      this.isFlushingSegment = false
    }
  }

  async stopRecordingAndTranscribe() {
    if (!this.state.isRecording) return null

    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    this.updateState({
      isRecording: false,
      isTranscribing: true,
      audioLevel: 0
    })

    try {
      const audioData = await this.recorder.stop()
      if (!audioData || audioData.size === 0) {
        this.updateState({ isTranscribing: false })
        return null
      }

      const durationMs = Date.now() - (this.recordingStartTime || 0)
      if (durationMs < 400 || audioData.size < 2200) {
        this.updateState({ isTranscribing: false, interimText: '', error: null })
        return null
      }

      // If nothing new was spoken in this final segment, complete gracefully
      if (!this.hasSpokenInSegment) {
        this.updateState({ isTranscribing: false, interimText: '', error: null })
        return null
      }

      const groqKey = typeof localStorage !== 'undefined' ? localStorage.getItem('lumina_groq_key') : null
      if (!groqKey || !groqKey.trim()) {
        this.updateState({
          isTranscribing: false,
          error: 'Please add your free Groq API key in Settings > Intelligence.'
        })
        return null
      }

      const text = await transcribeWithGroq(audioData, groqKey, this.lastTranscribedText)
      this.updateState({ isTranscribing: false, interimText: '', error: null })
      const smoothed = removePrefixOverlap(text || '', this.lastTranscribedText)
      return smoothed || null
    } catch (err) {
      this.updateState({
        isTranscribing: false,
        error: err?.message || 'Transcription failed'
      })
      return null
    }
  }

  cancelRecording() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    this.recorder.cancel()
    const currentInstanceId = this.state.activeInstanceId
    this.updateState({
      isRecording: false,
      isTranscribing: false,
      recordingDuration: 0,
      audioLevel: 0,
      interimText: ''
    })
    window.dispatchEvent(
      new CustomEvent('voice-live-cancel', {
        detail: { instanceId: currentInstanceId }
      })
    )
  }

  clearError() {
    this.updateState({ error: null })
  }
}

export const voiceService = new VoiceService()
