import React, { useRef } from 'react'
import { Mic, Square } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { PulseLoader } from '../../components/PulseLoader'
import { useVoice } from './hooks/Voice'
import { voiceService } from './hooks/Services'
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
  const deepSeekKey = useSettingsStore((state: any) => state.settings?.deepSeekKey)

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

    // Focus the composer textarea immediately when using composer voice
    if (id === 'composer-voice' && typeof document !== 'undefined') {
      const textarea = document.querySelector('.composer-textarea') as HTMLTextAreaElement | null
      textarea?.focus()
    }

    if (error) clearError()

    // Always check live singleton state so stopping/cancelling can never stall on stale closures
    const liveRecording = isRecording || voiceService.state.isRecording
    const liveTranscribing = isTranscribing || voiceService.state.isTranscribing

    if (liveRecording) {
      await handleStop()
      return
    }

    if (liveTranscribing) {
      cancelRecording()
      return
    }

    // Reuse existing DeepSeek API key — no separate voice key needed
    const activeKey = deepSeekKey
    if (!activeKey || !activeKey.trim()) {
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: { message: 'Add your DeepSeek API key in Settings > AI Assistant', type: 'error' }
        })
      )
      return
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
      if (text && text.length > 0 && onInsert) {
        onInsert(text)
      }
    } catch (err) {
      console.error('[VoiceButton] Stop recording error:', err)
    }
  }

  const tooltipText = isThisRecording
    ? 'Stop recording'
    : isThisTranscribing
      ? 'Transcribing with DeepSeek Voice...'
      : 'DeepSeek Voice (Shift+Alt+V)'

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
            <PulseLoader size="xs" inline delayMs={0} message="" tone="current" />
          ) : isThisRecording ? (
            <Square size={10} fill="currentColor" className="voice-mic-icon" />
          ) : (
            <Mic size={12} />
          )}
        </button>
      </ToolTip>
    </div>
  )
}

export default VoiceButton
