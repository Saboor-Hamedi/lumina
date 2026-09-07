import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

let transcriber = null

async function getTranscriber(progressCallback) {
  if (!transcriber) {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
      progress_callback: progressCallback
    })
  }
  return transcriber
}

self.addEventListener('message', async (event) => {
  const { id, type, payload } = event.data || {}

  try {
    if (type === 'download') {
      const progressMap = {}
      await getTranscriber((data) => {
        if (!data) return
        if (data.status === 'progress' && data.file) {
          progressMap[data.file] = {
            progress: data.progress || 0,
            loaded: data.loaded || 0,
            total: data.total || 0
          }
          const files = Object.values(progressMap)
          const totalProgress = files.reduce((acc, f) => acc + f.progress, 0) / Math.max(files.length, 1)
          self.postMessage({
            type: 'download-progress',
            progress: Math.min(Math.round(totalProgress), 99),
            file: data.file
          })
        } else if (data.status === 'done') {
          if (data.file && progressMap[data.file]) {
            progressMap[data.file].progress = 100
          }
        } else if (data.status === 'ready') {
          self.postMessage({ type: 'download-ready' })
        }
      })
    } else if (type === 'transcribe-interim') {
      const activeTranscriber = await getTranscriber()
      const audioData = payload?.audio
      if (audioData) {
        const float32Array = audioData instanceof Float32Array ? audioData : new Float32Array(audioData)
        const output = await activeTranscriber(float32Array, {
          chunk_length_s: 30,
          stride_length_s: 5
        })
        self.postMessage({
          id,
          type: 'interim-complete',
          text: (output?.text || '').trim()
        })
      }
    } else if (type === 'transcribe') {
      const activeTranscriber = await getTranscriber()
      const audioData = payload?.audio
      if (!audioData) {
        throw new Error('No audio data provided')
      }
      const float32Array = audioData instanceof Float32Array ? audioData : new Float32Array(audioData)
      const output = await activeTranscriber(float32Array, {
        chunk_length_s: 30,
        stride_length_s: 5
      })
      self.postMessage({
        id,
        type: 'transcribe-complete',
        text: (output?.text || '').trim()
      })
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      error: err?.message || 'Voice worker error'
    })
  }
})
