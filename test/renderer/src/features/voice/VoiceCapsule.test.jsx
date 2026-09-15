import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VoiceCapsule } from '../../../../../src/renderer/src/features/voice/VoiceCapsule'
import { voiceService } from '../../../../../src/renderer/src/features/voice/hooks/Services'

describe('VoiceCapsule component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    voiceService.updateState({
      isRecording: false,
      isTranscribing: false,
      audioLevel: 0,
      activeInstanceId: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when not recording and not transcribing', () => {
    const { container } = render(<VoiceCapsule />)
    expect(container.firstChild).toBeNull()
  })

  it('renders capsule with waveform bars and recording indicator when recording', () => {
    voiceService.updateState({
      isRecording: true,
      isTranscribing: false,
      audioLevel: 0.5,
      activeInstanceId: 'editor-voice'
    })

    const { container } = render(<VoiceCapsule />)
    expect(container.querySelector('.voice-capsule-container')).toBeInTheDocument()
    expect(container.querySelector('.voice-capsule.recording')).toBeInTheDocument()
    expect(container.querySelector('.voice-capsule-indicator')).toBeInTheDocument()

    const bars = container.querySelectorAll('.voice-capsule-bar')
    expect(bars.length).toBe(5)
  })

  it('renders loading state with "Transcribing..." when isTranscribing is true', () => {
    voiceService.updateState({
      isRecording: false,
      isTranscribing: true,
      audioLevel: 0,
      activeInstanceId: 'editor-voice'
    })

    render(<VoiceCapsule />)
    expect(screen.getByText('Transcribing...')).toBeInTheDocument()
  })

  it('calls stopRecordingAndTranscribe on capsule click when recording', async () => {
    voiceService.updateState({
      isRecording: true,
      isTranscribing: false,
      audioLevel: 0.2,
      activeInstanceId: 'editor-voice'
    })

    const stopSpy = vi.spyOn(voiceService, 'stopRecordingAndTranscribe').mockResolvedValue('Hello')
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const { container } = render(<VoiceCapsule />)
    const capsule = container.querySelector('.voice-capsule')
    expect(capsule).toBeInTheDocument()

    fireEvent.click(capsule)

    expect(stopSpy).toHaveBeenCalled()
  })
})
