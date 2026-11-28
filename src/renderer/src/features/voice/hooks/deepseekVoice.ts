import type { VoiceApiError } from '../types'

const DEEPSEEK_ASR_URL = 'https://api.deepseek.com/v1/tools/asr'
const DEEPSEEK_TTS_URL = 'https://api.deepseek.com/v1/tools/tts'

export type DeepSeekVoiceId = 'stella' | 'tide'

let activeAudio: HTMLAudioElement | null = null
let activeAudioUrl: string | null = null

function isSilenceHallucination(rawText: string): boolean {
  if (!rawText) return true
  const cleaned = rawText
    .toLowerCase()
    .replace(/[.,!?;:"'\-–—()[\]{}]/g, '')
    .trim()
  if (!cleaned) return true

  const fillerTokens = new Set([
    'thank',
    'you',
    'very',
    'much',
    'thanks',
    'for',
    'watching',
    'subscribe',
    'bye',
    'goodbye',
    'subtitles',
    'yep',
    'yeah'
  ])

  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length > 0 && words.every((w) => fillerTokens.has(w))) {
    return true
  }
  return false
}

/**
 * Encodes a mono Float32Array PCM buffer into a standard 16-bit PCM WAV Blob.
 * DeepSeek ASR strictly accepts 16-bit PCM WAV or Ogg Opus (not WebM).
 */
function encodePcm16Wav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Downsamples a Float32Array to targetRate using linear interpolation.
 */
function downsampleMono(
  input: Float32Array,
  inputRate: number,
  targetRate: number
): Float32Array {
  if (inputRate === targetRate || inputRate <= 0) return input
  const ratio = inputRate / targetRate
  const outLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const srcIdx = i * ratio
    const low = Math.floor(srcIdx)
    const high = Math.min(input.length - 1, low + 1)
    const frac = srcIdx - low
    output[i] = input[low] + (input[high] - input[low]) * frac
  }
  return output
}

/**
 * Ensures the audio Blob is in a format accepted by DeepSeek ASR
 * (16-bit PCM WAV or Ogg Opus). Converts browser WebM/MP4 blobs to 16kHz mono WAV.
 */
async function ensureDeepSeekAudioBlob(
  audioBlob: Blob
): Promise<{ blob: Blob; filename: string }> {
  const mime = (audioBlob.type || '').toLowerCase()
  if (mime.includes('wav')) {
    return { blob: audioBlob, filename: 'speech.wav' }
  }
  if (mime.includes('ogg')) {
    return { blob: audioBlob, filename: 'speech.ogg' }
  }

  // Convert WebM/MP4 to 16kHz 16-bit mono PCM WAV via Web Audio API
  const AudioCtx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined

  if (!AudioCtx || typeof audioBlob.arrayBuffer !== 'function') {
    return { blob: audioBlob, filename: 'speech.wav' }
  }

  const ctx = new AudioCtx()
  try {
    const rawBuf = await audioBlob.arrayBuffer()
    const decoded = await Promise.race<AudioBuffer>([
      ctx.decodeAudioData(rawBuf.slice(0)),
      new Promise<AudioBuffer>((_, reject) =>
        setTimeout(() => reject(new Error('Audio decode timed out')), 5000)
      )
    ])
    const channelData = decoded.getChannelData(0)
    const pcm16k = downsampleMono(channelData, decoded.sampleRate, 16000)
    const wavBlob = encodePcm16Wav(pcm16k, 16000)
    return { blob: wavBlob, filename: 'speech.wav' }
  } finally {
    await ctx.close().catch(() => {})
  }
}

/**
 * Transcribes an audio Blob using DeepSeek's native Speech-to-Text (ASR) endpoint.
 * Reuses the user's existing DeepSeek API key — zero extra keys or SDKs required.
 */
export async function transcribeWithDeepSeek(
  audioBlob: Blob | null,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Add your DeepSeek API key in Settings > AI Assistant.')
  }

  if (!audioBlob || audioBlob.size < 1200) {
    return ''
  }

  if (signal?.aborted) {
    const abortErr = new Error('Transcription cancelled')
    abortErr.name = 'AbortError'
    throw abortErr
  }

  const { blob: readyBlob, filename } = await ensureDeepSeekAudioBlob(audioBlob)

  if (signal?.aborted) {
    const abortErr = new Error('Transcription cancelled')
    abortErr.name = 'AbortError'
    throw abortErr
  }

  const formData = new FormData()
  formData.append('file', readyBlob, filename)

  const timeoutController = new AbortController()
  const onCallerAbort = () => timeoutController.abort()
  signal?.addEventListener('abort', onCallerAbort, { once: true })
  const timeoutId = setTimeout(() => timeoutController.abort(), 15000)

  let response: Response
  try {
    response = await fetch(DEEPSEEK_ASR_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`
      },
      body: formData,
      signal: timeoutController.signal
    })
  } catch (err: unknown) {
    if (signal?.aborted) {
      const abortErr = new Error('Transcription cancelled')
      abortErr.name = 'AbortError'
      throw abortErr
    }
    if (timeoutController.signal.aborted) {
      const timeoutErr: VoiceApiError = new Error(
        'DeepSeek Voice timed out. Please try again.'
      )
      timeoutErr.isNetworkError = true
      throw timeoutErr
    }
    const netErr: VoiceApiError = new Error(
      err instanceof Error && err.message
        ? 'Network error connecting to DeepSeek Voice. Please check your internet connection.'
        : 'Network error connecting to DeepSeek Voice. Please check your internet connection.'
    )
    netErr.isNetworkError = true
    throw netErr
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onCallerAbort)
  }

  if (!response.ok) {
    let errMsg = 'DeepSeek voice transcription failed'
    let isQuotaError = false
    let isAuthError = false

    try {
      const errJson = await response.json()
      errMsg = errJson?.error?.message || errJson?.message || errMsg
      const errLower = errMsg.toLowerCase()
      if (
        response.status === 429 ||
        errLower.includes('rate limit') ||
        errLower.includes('quota') ||
        errLower.includes('balance') ||
        errLower.includes('insufficient')
      ) {
        isQuotaError = true
        errMsg = 'DeepSeek API rate limit or balance exceeded.'
      } else if (response.status === 401 || response.status === 403 || errLower.includes('api key')) {
        isAuthError = true
        errMsg = 'Invalid DeepSeek API key. Check Settings > AI Assistant.'
      }
    } catch {
      errMsg = `HTTP ${response.status}: ${response.statusText}`
    }

    const error: VoiceApiError = new Error(errMsg)
    error.status = response.status
    error.isQuotaError = isQuotaError
    error.isAuthError = isAuthError
    throw error
  }

  let data: { text?: string; transcript?: string } | null = null
  try {
    data = await response.json()
  } catch {
    return ''
  }

  const rawText = (data?.text || data?.transcript || '').trim()
  if (isSilenceHallucination(rawText)) {
    return ''
  }
  return rawText
}

/**
 * Stops any currently playing DeepSeek TTS audio and releases its object URL.
 */
export function stopDeepSeekSpeech(): void {
  if (activeAudio) {
    try {
      activeAudio.pause()
      activeAudio.src = ''
    } catch {
      // ignore
    }
    activeAudio = null
  }
  if (activeAudioUrl) {
    try {
      URL.revokeObjectURL(activeAudioUrl)
    } catch {
      // ignore
    }
    activeAudioUrl = null
  }
}

/**
 * Synthesizes and plays speech using DeepSeek's native Text-to-Speech (TTS) endpoint.
 */
export async function speakWithDeepSeek(
  text: string,
  apiKey: string,
  voiceId: DeepSeekVoiceId = 'stella'
): Promise<HTMLAudioElement> {
  const cleanText = text.trim()
  if (!cleanText) {
    throw new Error('Nothing to read aloud.')
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Add your DeepSeek API key in Settings > AI Assistant.')
  }

  stopDeepSeekSpeech()

  const response = await fetch(DEEPSEEK_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: cleanText,
      voice_id: voiceId,
      format: 'wav'
    })
  })

  if (!response.ok) {
    throw new Error(`DeepSeek TTS failed (HTTP ${response.status})`)
  }

  const audioBlob = await response.blob()
  const objectUrl = URL.createObjectURL(audioBlob)
  const audio = new Audio(objectUrl)

  activeAudio = audio
  activeAudioUrl = objectUrl

  const cleanup = () => {
    if (activeAudio === audio) {
      stopDeepSeekSpeech()
    } else {
      URL.revokeObjectURL(objectUrl)
    }
  }
  audio.addEventListener('ended', cleanup, { once: true })
  audio.addEventListener('error', cleanup, { once: true })

  await audio.play()
  return audio
}
