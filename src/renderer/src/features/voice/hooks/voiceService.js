import { AudioRecorder } from './audioRecorder'

const STORAGE_KEY = 'lumina_whisper_downloaded'

class VoiceService {
  constructor() {
    this.worker = null
    this.recorder = new AudioRecorder()
    this.listeners = new Set()
    this.timerInterval = null
    this.liveInterval = null
    this.isInterimBusy = false
    this.activeRequestId = 0

    this.state = {
      isDownloaded: localStorage.getItem(STORAGE_KEY) === 'true',
      isDownloading: false,
      downloadProgress: 0,
      downloadFile: '',
      isRecording: false,
      isTranscribing: false,
      recordingDuration: 0,
      audioLevel: 0,
      activeInstanceId: null,
      interimText: '',
      error: null
    }
  }

  getWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('./voice.worker.js', import.meta.url), {
        type: 'module'
      })

      this.worker.onmessage = (event) => {
        const { type, progress, file, text, error } = event.data || {}

        if (type === 'download-progress') {
          this.updateState({
            downloadProgress: progress,
            downloadFile: file || ''
          })
        } else if (type === 'download-ready' || type === 'download-complete') {
          localStorage.setItem(STORAGE_KEY, 'true')
          this.updateState({
            isDownloaded: true,
            isDownloading: false,
            downloadProgress: 100,
            downloadFile: ''
          })
        } else if (type === 'interim-complete') {
          this.isInterimBusy = false
          if (this.state.isRecording) {
            this.updateState({ interimText: text || '' })
            window.dispatchEvent(
              new CustomEvent('voice-live-text', {
                detail: { text: text || '', instanceId: this.state.activeInstanceId }
              })
            )
          }
        } else if (type === 'error') {
          this.isInterimBusy = false
          this.updateState({
            isDownloading: false,
            isTranscribing: false,
            error: error || 'Voice processing error'
          })
        }
      }
    }
    return this.worker
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

  downloadModel() {
    if (this.state.isDownloading) return
    this.updateState({
      isDownloading: true,
      downloadProgress: 0,
      downloadFile: '',
      error: null
    })

    const worker = this.getWorker()
    worker.postMessage({ type: 'download' })
  }

  async uninstallModel() {
    if (this.state.isRecording) {
      this.cancelRecording()
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        await caches.delete('transformers-cache')
      } catch (e) {}
    }
    localStorage.removeItem(STORAGE_KEY)
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.updateState({
      isDownloaded: false,
      isDownloading: false,
      downloadProgress: 0,
      downloadFile: '',
      interimText: '',
      error: null
    })
  }

  async startRecording() {
    if (this.state.isRecording || this.state.isTranscribing) return
    if (!this.state.isDownloaded) {
      this.downloadModel()
      return
    }

    try {
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

      this.isInterimBusy = false
      if (this.liveInterval) clearInterval(this.liveInterval)
      this.liveInterval = setInterval(() => {
        if (!this.state.isRecording || this.isInterimBusy) return
        const pcm = this.recorder.getRecordedPCM()
        if (!pcm || pcm.length < 12000) return
        this.isInterimBusy = true
        const worker = this.getWorker()
        worker.postMessage({
          type: 'transcribe-interim',
          payload: { audio: pcm }
        })
      }, 1400)
    } catch (err) {
      if (this.timerInterval) {
        clearInterval(this.timerInterval)
        this.timerInterval = null
      }
      if (this.liveInterval) {
        clearInterval(this.liveInterval)
        this.liveInterval = null
      }
      this.updateState({
        isRecording: false,
        recordingDuration: 0,
        audioLevel: 0,
        interimText: '',
        error: err?.message || 'Could not access microphone'
      })
      throw err
    }
  }

  async stopRecordingAndTranscribe() {
    if (!this.state.isRecording) return null

    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    if (this.liveInterval) {
      clearInterval(this.liveInterval)
      this.liveInterval = null
    }

    this.isInterimBusy = false
    this.updateState({
      isRecording: false,
      isTranscribing: true,
      audioLevel: 0,
      interimText: ''
    })

    try {
      const audioData = await this.recorder.stop()
      if (!audioData || audioData.length === 0) {
        this.updateState({ isTranscribing: false })
        return null
      }

      const worker = this.getWorker()
      const reqId = ++this.activeRequestId

      return new Promise((resolve, reject) => {
        const handler = (event) => {
          const { id, type, text, error } = event.data || {}
          if (id === reqId) {
            worker.removeEventListener('message', handler)
            this.updateState({ isTranscribing: false })

            if (type === 'transcribe-complete') {
              resolve(text)
            } else if (type === 'error') {
              this.updateState({ error: error || 'Transcription failed' })
              reject(new Error(error || 'Transcription failed'))
            }
          }
        }

        worker.addEventListener('message', handler)
        worker.postMessage({
          id: reqId,
          type: 'transcribe',
          payload: { audio: audioData }
        })
      })
    } catch (err) {
      this.updateState({
        isTranscribing: false,
        error: err?.message || 'Transcription failed'
      })
      throw err
    }
  }

  cancelRecording() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    if (this.liveInterval) {
      clearInterval(this.liveInterval)
      this.liveInterval = null
    }
    this.isInterimBusy = false
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
