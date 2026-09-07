export class AudioRecorder {
  constructor() {
    this.stream = null
    this.mediaRecorder = null
    this.audioChunks = []
    this.audioContext = null
    this.analyser = null
    this.sourceNode = null
    this.animFrameId = null
    this.onVolumeChange = null
  }

  async start(onVolumeChange = null) {
    this.onVolumeChange = onVolumeChange
    this.audioChunks = []

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    // Setup volume analyser for visualizer wave
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      this.audioContext = new AudioContextClass()
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {})
      }
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 64
      this.sourceNode.connect(this.analyser)

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
      const checkVolume = () => {
        if (!this.analyser) return
        this.analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        const normalized = Math.min(1, avg / 128)
        if (this.onVolumeChange) {
          this.onVolumeChange(normalized)
        }
        this.animFrameId = requestAnimationFrame(checkVolume)
      }
      checkVolume()
    } catch (e) {
      console.warn('[AudioRecorder] Visualizer analyser setup warning:', e)
    }

    // Determine supported mimeType for clean, uncorrupted recording
    let mimeType = 'audio/webm;codecs=opus'
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      } else {
        mimeType = ''
      }
    }

    const options = mimeType ? { mimeType } : {}
    this.mediaRecorder = new MediaRecorder(this.stream, options)

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data)
      }
    }

    this.mediaRecorder.start(100) // Collect 100ms slices
  }

  async flushSegment() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive' || !this.stream) {
      return null
    }

    return new Promise((resolve) => {
      const prevRecorder = this.mediaRecorder
      const prevChunks = this.audioChunks
      this.audioChunks = []

      prevRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          prevChunks.push(event.data)
        }
      }

      prevRecorder.onstop = () => {
        const mimeType = prevRecorder?.mimeType || 'audio/webm'
        const segmentBlob = new Blob(prevChunks, { type: mimeType })
        resolve(segmentBlob)
      }

      try {
        const mimeType = prevRecorder?.mimeType || 'audio/webm;codecs=opus'
        const options = mimeType ? { mimeType } : {}
        const nextRecorder = new MediaRecorder(this.stream, options)
        nextRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.audioChunks.push(event.data)
          }
        }
        this.mediaRecorder = nextRecorder
        nextRecorder.start(100)
        prevRecorder.stop()
      } catch (e) {
        console.warn('[AudioRecorder] flushSegment error:', e)
        resolve(null)
      }
    })
  }

  async stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.cleanup()
        resolve(null)
        return
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm'
        const audioBlob = new Blob(this.audioChunks, { type: mimeType })
        this.cleanup()
        resolve(audioBlob)
      }

      try {
        this.mediaRecorder.stop()
      } catch (e) {
        this.cleanup()
        resolve(null)
      }
    })
  }

  cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop()
      } catch (e) {}
    }
    this.cleanup()
  }

  cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect()
      } catch (e) {}
      this.sourceNode = null
    }
    this.analyser = null
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close()
      } catch (e) {}
      this.audioContext = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    this.mediaRecorder = null
    this.audioChunks = []
  }
}
