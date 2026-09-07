import { AudioRecorder } from './audioRecorder'
import { transcribeWithGroq } from './groqWhisper'

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
      console.debug('[VoiceService] Ignoring rapid toggle request (debounced)')
      return
    }
    this.lastToggleTime = now

    // If currently starting, do not immediately stop
    if (this.isStarting) {
      console.debug('[VoiceService] Still starting, ignoring toggle')
      return
    }

    if (this.state.isRecording) {
      // Prevent stopping if recording was started just a split second ago
      if (now - this.recordingStartTime < 500) {
        console.debug('[VoiceService] Recording just started, ignoring toggle')
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
    this.startRecording().catch((e) => console.error('[VoiceService] Toggle error:', e))
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
    try {
      this.recordingStartTime = Date.now()
      this.updateState({
        isRecording: true,
        recordingDuration: 0,
        audioLevel: 0,
        interimText: '',
        error: null
      })

      if (this.timerInterval) clearInterval(this.timerInterval)
      this.timerInterval = setInterval(() => {
        this.updateState({ recordingDuration: this.state.recordingDuration + 1 })
      }, 1000)

      await this.recorder.start((level) => {
        this.updateState({ audioLevel: level })
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
      if (durationMs < 400 || audioData.size < 2500) {
        console.debug(`[VoiceService] Clip too short (${durationMs}ms, ${audioData.size}b), discarding`)
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

      console.log(`[VoiceService] Sending audio blob (${audioData.size} bytes) to Groq Whisper Large v3...`)
      const text = await transcribeWithGroq(audioData, groqKey)
      this.updateState({ isTranscribing: false, interimText: '', error: null })
      return text || null
    } catch (err) {
      console.error('[VoiceService] Groq transcription failed:', err)
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
