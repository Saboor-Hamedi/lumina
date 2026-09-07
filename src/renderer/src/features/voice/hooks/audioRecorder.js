function resampleTo16kHz(audioData, sampleRate) {
  if (sampleRate === 16000) return audioData
  const ratio = sampleRate / 16000
  const newLength = Math.round(audioData.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const origIndex = i * ratio
    const indexFloor = Math.floor(origIndex)
    const indexCeil = Math.min(audioData.length - 1, indexFloor + 1)
    const fraction = origIndex - indexFloor
    result[i] = audioData[indexFloor] * (1 - fraction) + audioData[indexCeil] * fraction
  }
  return result
}

export class AudioRecorder {
  constructor() {
    this.stream = null
    this.audioContext = null
    this.sourceNode = null
    this.processorNode = null
    this.analyser = null
    this.pcmChunks = []
    this.animFrameId = null
    this.onVolumeChange = null
  }

  async start(onVolumeChange = null) {
    this.onVolumeChange = onVolumeChange
    this.pcmChunks = []

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    this.audioContext = new AudioContextClass()

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

    const bufferSize = 4096
    this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1)
    this.processorNode.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0)
      const copy = new Float32Array(channelData.length)
      copy.set(channelData)
      this.pcmChunks.push(copy)
    }

    this.sourceNode.connect(this.processorNode)
    this.processorNode.connect(this.audioContext.destination)
  }

  getRecordedPCM() {
    if (!this.audioContext || this.pcmChunks.length === 0) return null
    let totalSamples = 0
    for (let i = 0; i < this.pcmChunks.length; i++) {
      totalSamples += this.pcmChunks[i].length
    }
    const merged = new Float32Array(totalSamples)
    let offset = 0
    for (let i = 0; i < this.pcmChunks.length; i++) {
      merged.set(this.pcmChunks[i], offset)
      offset += this.pcmChunks[i].length
    }
    return resampleTo16kHz(merged, this.audioContext.sampleRate)
  }

  async stop() {
    const pcm = this.getRecordedPCM()
    this.cleanup()
    return pcm
  }

  cancel() {
    this.cleanup()
  }

  cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
    if (this.processorNode) {
      try {
        this.processorNode.disconnect()
      } catch (e) {}
      this.processorNode = null
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
    this.pcmChunks = []
  }
}
