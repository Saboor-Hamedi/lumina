import React, { useRef } from 'react'
import { Mic, Loader2 } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { useVoice } from './hooks/Voice'
import { useSettingsStore } from '../../core/store/SettingStore'
import type { VoiceButtonProps } from './types'
import './css/voice.css'

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  id = 'voice-btn',
  onInsert,
  buttonStyle = null,
  tooltipPosition = 'bottom'
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const groqKey = useSettingsStore((state: any) => state.settings?.groqKey)

  const {
    isRecording,
    isTranscribing,
    activeInstanceId,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
    setActiveInstance
  } = useVoice()

  // Strict separation: only show active/recording/transcribing if this instance owns it
  const isThisActive = activeInstanceId === id
  const isThisRecording = isRecording && isThisActive
  const isThisTranscribing = isTranscribing && isThisActive

  const handleTriggerClick = async (e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()

    // If API key does not exist, notify the user with Notification toast
    const activeKey = groqKey
    if (!activeKey || !activeKey.trim()) {
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: { message: 'Voice Key not found', type: 'error' }
        })
      )
      return
    }

    if (error) clearError()

    // If THIS microphone is currently recording, stop and transcribe
    if (isThisRecording) {
      await handleStop()
      return
    }

    // If another microphone was recording, cancel it first so they never conflict
    if (isRecording) {
      cancelRecording()
    }

    // Start recording for THIS instance
    try {
      setActiveInstance(id)
      await startRecording()
    } catch (err) {
      console.error('[VoiceButton] Start recording error:', err)
    }
  }

  const handleStop = async (): Promise<void> => {
    try {
      const text = await stopRecording()
      if (text && text.length > 0) {
        if (onInsert) {
          onInsert(text)
        } else {
          window.dispatchEvent(
            new CustomEvent('voice-insert-text', {
              detail: { text, instanceId: id }
            })
          )
        }
      }
    } catch (err) {
      console.error('[VoiceButton] Stop recording error:', err)
    }
  }

  const tooltipText = isThisRecording
    ? 'Stop recording'
    : isThisTranscribing
      ? 'Transcribing audio with Groq...'
      : 'Voice Dictation (Shift+Alt+V)'

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      <ToolTip text={tooltipText} position={tooltipPosition}>
        <button
          ref={buttonRef}
          type="button"
          className={`voice-trigger-btn ${isThisRecording ? 'recording' : ''} ${isThisTranscribing ? 'transcribing' : ''}`}
          onClick={handleTriggerClick}
          aria-label="Voice Dictation"
          style={buttonStyle || undefined}
        >
          {isThisTranscribing ? (
            <Loader2 size={12} className="voice-spinner" />
          ) : (
            <Mic size={12} className={isThisRecording ? 'voice-mic-icon' : ''} />
          )}
        </button>
      </ToolTip>
    </div>
  )
}

export default VoiceButton
