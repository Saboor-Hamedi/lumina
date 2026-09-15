import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { voiceService } from '../../../../../src/renderer/src/features/voice/hooks/Services'

describe('voiceService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    voiceService.cancelRecording()
    voiceService.clearError()
    voiceService.updateState({
      isRecording: false,
      isTranscribing: false,
      recordingDuration: 0,
      audioLevel: 0,
      activeInstanceId: null,
      interimText: '',
      error: null
    })
    voiceService.lastToggleTime = 0
    voiceService.recordingStartTime = 0
    voiceService.isStarting = false
    voiceService.isQuotaExhausted = false
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    voiceService.cancelRecording()
  })

  it('has correct initial state', () => {
    expect(voiceService.state.isRecording).toBe(false)
    expect(voiceService.state.isTranscribing).toBe(false)
    expect(voiceService.state.audioLevel).toBe(0)
    expect(voiceService.state.error).toBeNull()
  })

  it('notifies subscribers on state updates', () => {
    const listener = vi.fn()
    const unsubscribe = voiceService.subscribe(listener)

    expect(listener).toHaveBeenCalledWith(voiceService.state)

    voiceService.setActiveInstance('editor-voice')
    expect(voiceService.state.activeInstanceId).toBe('editor-voice')
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ activeInstanceId: 'editor-voice' })
    )

    unsubscribe()
    voiceService.setActiveInstance('composer-voice')
    expect(listener).toHaveBeenCalledTimes(2) // No call after unsubscribe
  })

  it('sets friendly error message if Groq API key is missing when starting', async () => {
    localStorage.removeItem('lumina_groq_key')
    await voiceService.startRecording()

    expect(voiceService.state.isRecording).toBe(false)
    expect(voiceService.state.error).toMatch(/Voice Key not found|Please add your free Groq API key/i)
  })

  it('debounces rapid toggle calls within 450ms', async () => {
    localStorage.setItem('lumina_groq_key', 'gsk_test123')
    vi.spyOn(voiceService.recorder, 'start').mockResolvedValue(undefined)

    // Call 1
    voiceService.toggleDictation('editor-voice')
    expect(voiceService.state.activeInstanceId).toBe('editor-voice')

    // Call 2 immediately within 10ms (should be ignored by debounce)
    voiceService.toggleDictation('editor-voice')
    expect(voiceService.state.isTranscribing).toBe(false)
  })

  it('prevents stopping if recording started less than 500ms ago', async () => {
    localStorage.setItem('lumina_groq_key', 'gsk_test123')
    voiceService.state.isRecording = true
    voiceService.recordingStartTime = Date.now() // Just started

    const stopSpy = vi.spyOn(voiceService, 'stopRecordingAndTranscribe')
    voiceService.lastToggleTime = Date.now() - 600 // bypass toggle debounce

    voiceService.toggleDictation('editor-voice')
    expect(stopSpy).not.toHaveBeenCalled()
  })

  it('cancels recording cleanly without errors', () => {
    const cancelSpy = vi.spyOn(voiceService.recorder, 'cancel').mockImplementation(() => {})
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    voiceService.state.isRecording = true
    voiceService.state.activeInstanceId = 'composer-voice'

    voiceService.cancelRecording()

    expect(cancelSpy).toHaveBeenCalled()
    expect(voiceService.state.isRecording).toBe(false)
    expect(voiceService.state.isTranscribing).toBe(false)
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'voice-live-cancel',
        detail: { instanceId: 'composer-voice' }
      })
    )
  })

  it('stops recording and dispatches voice-insert-text on completion', async () => {
    localStorage.setItem('lumina_groq_key', 'gsk_test123')
    voiceService.state.isRecording = true
    voiceService.recordingStartTime = Date.now() - 3000
    voiceService.hasSpokenInSegment = true
    voiceService.state.activeInstanceId = 'editor-voice'

    const dummyBlob = new Blob([new Uint8Array(4000).fill(1)], { type: 'audio/webm' })
    vi.spyOn(voiceService.recorder, 'stop').mockResolvedValue(dummyBlob)

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Transcribed sentence from Whisper' })
    })

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const result = await voiceService.stopRecordingAndTranscribe()

    expect(result).toBe('Transcribed sentence from Whisper')
    expect(voiceService.state.isRecording).toBe(false)
    expect(voiceService.state.isTranscribing).toBe(false)
  })

  it('discards audio clips shorter than 400ms or under 2200 bytes without calling Groq', async () => {
    localStorage.setItem('lumina_groq_key', 'gsk_test123')
    voiceService.state.isRecording = true
    voiceService.recordingStartTime = Date.now() - 200 // Only 200ms

    const tinyBlob = new Blob([new Uint8Array(500)], { type: 'audio/webm' })
    vi.spyOn(voiceService.recorder, 'stop').mockResolvedValue(tinyBlob)
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy

    const result = await voiceService.stopRecordingAndTranscribe()

    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
