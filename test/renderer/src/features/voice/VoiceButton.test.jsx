import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { VoiceButton } from '../../../../../src/renderer/src/features/voice/VoiceButton'
import { voiceService } from '../../../../../src/renderer/src/features/voice/hooks/Services'
import { useSettingsStore } from '../../../../../src/renderer/src/core/store/useSettingsStore'

describe('VoiceButton component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        groqKey: 'gsk_test_mock_key'
      }
    })
    voiceService.updateState({
      isRecording: false,
      isTranscribing: false,
      activeInstanceId: null,
      error: null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders idle mic button', () => {
    const { container } = render(<VoiceButton id="editor-voice" />)
    const btn = container.querySelector('.voice-trigger-btn')
    expect(btn).toBeInTheDocument()
    expect(btn).not.toHaveClass('recording')
    expect(btn).not.toHaveClass('transcribing')
  })

  it('shows recording state ONLY when its own instanceId is active', () => {
    const { container: editorContainer } = render(<VoiceButton id="editor-voice" />)
    const { container: composerContainer } = render(<VoiceButton id="composer-voice" />)

    // Set editor-voice as actively recording inside act
    act(() => {
      voiceService.updateState({
        isRecording: true,
        activeInstanceId: 'editor-voice'
      })
    })

    const editorBtn = editorContainer.querySelector('.voice-trigger-btn')
    const composerBtn = composerContainer.querySelector('.voice-trigger-btn')

    expect(editorBtn).toHaveClass('recording')
    expect(composerBtn).not.toHaveClass('recording')
  })

  it('triggers startRecording for its specific instanceId on click', async () => {
    const startSpy = vi.spyOn(voiceService, 'startRecording').mockResolvedValue(undefined)
    const setActiveSpy = vi.spyOn(voiceService, 'setActiveInstance')

    const { container } = render(<VoiceButton id="composer-voice" />)
    const btn = container.querySelector('.voice-trigger-btn')

    fireEvent.click(btn)

    expect(setActiveSpy).toHaveBeenCalledWith('composer-voice')
    expect(startSpy).toHaveBeenCalled()
  })

  it('shows Voice Key not found toast if no Groq API key is configured when clicked', () => {
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        groqKey: null
      }
    })
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    const { container } = render(<VoiceButton id="editor-voice" />)
    const btn = container.querySelector('.voice-trigger-btn')
    expect(btn).toBeInTheDocument()

    fireEvent.click(btn)

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'show-toast',
        detail: { message: 'Voice Key not found', type: 'error' }
      })
    )
  })
})
