import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  transcribeWithDeepSeek,
  refineVoiceTranscript,
  sanitizeProfanity
} from '../../../../../src/renderer/src/features/voice/hooks/deepseekVoice'

describe('deepseekVoice service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws when DeepSeek API key is missing', async () => {
    const dummyBlob = new Blob([new Uint8Array(2000)], { type: 'audio/webm' })
    await expect(transcribeWithDeepSeek(dummyBlob, '')).rejects.toThrow(/DeepSeek API key/i)
    await expect(transcribeWithDeepSeek(dummyBlob, '   ')).rejects.toThrow(/DeepSeek API key/i)
  })

  it('returns empty string for tiny silent blobs without calling API', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    const tinyBlob = new Blob([new Uint8Array(400)], { type: 'audio/webm' })
    const result = await transcribeWithDeepSeek(tinyBlob, 'sk-deepseek-valid')
    expect(result).toBe('')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls DeepSeek ASR endpoint with bearer auth and returns transcript', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Hello from DeepSeek Voice' })
    })
    globalThis.fetch = fetchMock

    const audioBlob = new Blob([new Uint8Array(3000).fill(1)], { type: 'audio/webm' })
    const result = await transcribeWithDeepSeek(audioBlob, 'sk-deepseek-valid')

    expect(result).toBe('Hello from DeepSeek Voice')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.deepseek.com/v1/tools/asr')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer sk-deepseek-valid')
  })

  it('flags 401 responses as auth errors', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Invalid API key' } })
    })

    const audioBlob = new Blob([new Uint8Array(3000).fill(1)], { type: 'audio/webm' })
    await expect(transcribeWithDeepSeek(audioBlob, 'sk-bad')).rejects.toMatchObject({
      isAuthError: true,
      status: 401
    })
  })

  it('strips profanity cleanly without damaging legitimate words', () => {
    expect(sanitizeProfanity('fuck you fix my markdown note')).toBe('fix my markdown note')
    expect(sanitizeProfanity('this fucking class assignment needs assessment')).toBe(
      'this class assignment needs assessment'
    )
  })

  it('refines voice transcripts with workspace context and removes profanity', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Open my Project Roadmap note in Lumina.' } }]
      })
    })
    globalThis.fetch = fetchMock

    const result = await refineVoiceTranscript(
      'fuck you open my project road map note in luminaa',
      'sk-deepseek-valid',
      { contextHints: ['Project Roadmap'] }
    )

    expect(result).toBe('Open my Project Roadmap note in Lumina.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.deepseek.com/chat/completions')
    expect(init.method).toBe('POST')
    expect(String(init.body)).toContain('Project Roadmap')
  })

  it('falls back safely to sanitized raw transcript when refiner request fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'))

    const result = await refineVoiceTranscript('shit summarize my notes', 'sk-deepseek-valid')
    expect(result).toBe('summarize my notes')
  })
})
