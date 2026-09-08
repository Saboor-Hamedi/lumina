import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { transcribeWithGroq } from '../../../../../src/renderer/src/features/voice/hooks/groqWhisper'

describe('groqWhisper service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('throws an error if Groq API key is missing or empty', async () => {
    const dummyBlob = new Blob(['sample audio data'], { type: 'audio/webm' })
    await expect(transcribeWithGroq(dummyBlob, '')).rejects.toThrow(
      /Please enter your Groq API key/i
    )
    await expect(transcribeWithGroq(dummyBlob, '   ')).rejects.toThrow(
      /Please enter your Groq API key/i
    )
    await expect(transcribeWithGroq(dummyBlob, null)).rejects.toThrow(
      /Please enter your Groq API key/i
    )
  })

  it('returns empty string if audio blob is too small / empty', async () => {
    const tinyBlob = new Blob(['abc'], { type: 'audio/webm' })
    const result = await transcribeWithGroq(tinyBlob, 'gsk_test123')
    expect(result).toBe('')
  })

  it('calls Groq API with proper headers, model and prompt', async () => {
    const audioData = new Uint8Array(2000).fill(1)
    const audioBlob = new Blob([audioData], { type: 'audio/webm' })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Hello, this is a voice test.' })
    })
    globalThis.fetch = mockFetch

    const result = await transcribeWithGroq(audioBlob, 'gsk_valid_key', 'previous context')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions')
    expect(options.method).toBe('POST')
    expect(options.headers.Authorization).toBe('Bearer gsk_valid_key')
    expect(options.body).toBeInstanceOf(FormData)
    expect(result).toBe('Hello, this is a voice test.')
  })

  it('filters out known Whisper silence hallucinations', async () => {
    const audioData = new Uint8Array(2000).fill(1)
    const audioBlob = new Blob([audioData], { type: 'audio/webm' })

    const hallucinations = [
      'thank you',
      'Thank you.',
      'THANK YOU!',
      'thank you, thank you',
      'thank you, thank you.',
      'thank you very much.',
      'thanks for watching!',
      'subscribe to my channel',
      'subtitles by community',
      'amara.org'
    ]

    for (const phrase of hallucinations) {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ text: phrase })
      })

      const result = await transcribeWithGroq(audioBlob, 'gsk_valid_key')
      expect(result).toBe('')
    }
  })

  it('does NOT filter out legitimate speech containing "thank you"', async () => {
    const audioData = new Uint8Array(2000).fill(1)
    const audioBlob = new Blob([audioData], { type: 'audio/webm' })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Thank you for reviewing the pull request today.' })
    })

    const result = await transcribeWithGroq(audioBlob, 'gsk_valid_key')
    expect(result).toBe('Thank you for reviewing the pull request today.')
  })

  it('classifies 429 rate limit errors as isQuotaError without crashing', async () => {
    const audioData = new Uint8Array(2000).fill(1)
    const audioBlob = new Blob([audioData], { type: 'audio/webm' })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: { message: 'Rate limit reached for requests per minute' }
      })
    })

    try {
      await transcribeWithGroq(audioBlob, 'gsk_valid_key')
      expect.unreachable('Should have thrown')
    } catch (err) {
      expect(err.isQuotaError).toBe(true)
      expect(err.status).toBe(429)
      expect(err.message).toMatch(/rate limit or quota/i)
    }
  })

  it('classifies 401 unauthorized errors as isAuthError without crashing', async () => {
    const audioData = new Uint8Array(2000).fill(1)
    const audioBlob = new Blob([audioData], { type: 'audio/webm' })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({
        error: { message: 'Invalid API Key provided' }
      })
    })

    try {
      await transcribeWithGroq(audioBlob, 'gsk_invalid_key')
      expect.unreachable('Should have thrown')
    } catch (err) {
      expect(err.isAuthError).toBe(true)
      expect(err.status).toBe(401)
      expect(err.message).toMatch(/Invalid Groq API key/i)
    }
  })
})
