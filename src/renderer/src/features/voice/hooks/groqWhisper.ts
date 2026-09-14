import type { GroqError } from '../types'

// Function to detect and eliminate Whisper silence/background-noise hallucinations
function isSilenceHallucination(rawText: string): boolean {
  if (!rawText) return true
  const cleaned = rawText
    .toLowerCase()
    .replace(/[.,!?;:"'\-–—()[\]{}]/g, '')
    .trim()
  if (!cleaned) return true

  // Common filler tokens produced by Whisper when encountering silence or background hum
  const fillerTokens = new Set([
    'thank',
    'you',
    'very',
    'much',
    'thanks',
    'for',
    'watching',
    'subscribe',
    'like',
    'and',
    'to',
    'my',
    'channel',
    'bye',
    'goodbye',
    'see',
    'again',
    'subtitles',
    'subtitled',
    'amaraorg',
    'mbc',
    'yep',
    'yeah'
  ])

  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length > 0 && words.every((w) => fillerTokens.has(w))) {
    return true
  }

  // Regex patterns for subtitle credits and video sign-offs
  if (
    /^(thank\s*you\s*)+$/i.test(cleaned) ||
    /^(thanks\s*)+$/i.test(cleaned) ||
    /subscribe(\s+to)?(\s+my)?(\s+channel)?/i.test(cleaned) ||
    /subtitles?\s*(by|created|community)/i.test(cleaned) ||
    /amara\.org/i.test(rawText)
  ) {
    return true
  }

  return false
}

// Service to transcribe audio using Groq's ultra-fast Whisper Large v3 Turbo API
export async function transcribeWithGroq(
  audioBlob: Blob | null,
  apiKey: string,
  prompt = ''
): Promise<string> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Please enter your Groq API key in Settings > Intelligence.')
  }

  if (!audioBlob || audioBlob.size < 1200) {
    return ''
  }

  // Determine file extension from Blob mimeType
  let filename = 'audio.webm'
  if (audioBlob.type && audioBlob.type.includes('mp4')) {
    filename = 'audio.mp4'
  } else if (audioBlob.type && audioBlob.type.includes('wav')) {
    filename = 'audio.wav'
  } else if (audioBlob.type && audioBlob.type.includes('ogg')) {
    filename = 'audio.ogg'
  }

  const formData = new FormData()
  formData.append('file', audioBlob, filename)
  formData.append('model', 'whisper-large-v3-turbo')
  formData.append('temperature', '0')
  formData.append('response_format', 'json')
  if (prompt && prompt.trim()) {
    formData.append('prompt', prompt.trim().slice(-220))
  }

  let response: Response
  try {
    response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`
      },
      body: formData
    })
  } catch {
    const err: GroqError = new Error('Network error connecting to Groq. Please check your internet connection.')
    err.isNetworkError = true
    throw err
  }

  if (!response.ok) {
    let errMsg = 'Groq transcription request failed'
    let isQuotaError = false
    let isAuthError = false

    try {
      const errJson = await response.json()
      errMsg = errJson?.error?.message || errMsg
      const errLower = errMsg.toLowerCase()
      if (
        response.status === 429 ||
        errLower.includes('rate limit') ||
        errLower.includes('quota') ||
        errLower.includes('tokens per') ||
        errLower.includes('credits')
      ) {
        isQuotaError = true
        errMsg = 'Groq API rate limit or quota exceeded. Please check your Groq limits.'
      } else if (response.status === 401 || response.status === 403 || errLower.includes('api key')) {
        isAuthError = true
        errMsg = 'Invalid Groq API key. Please check your key in Settings > Intelligence.'
      }
    } catch {
      errMsg = `HTTP ${response.status}: ${response.statusText}`
    }

    const error: GroqError = new Error(errMsg)
    error.status = response.status
    error.isQuotaError = isQuotaError
    error.isAuthError = isAuthError
    throw error
  }

  let data: { text?: string } | null = null
  try {
    data = await response.json()
  } catch {
    return ''
  }

  const rawText = (data?.text || '').trim()

  // Clean hallucination if Whisper outputs a known filler on silence
  if (isSilenceHallucination(rawText)) {
    return ''
  }

  return rawText
}
