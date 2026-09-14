import React, { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useVoice } from './hooks/Voice'
import './css/voice.css'

export const VoiceCapsule: React.FC = () => {
  const {
    isRecording,
    isTranscribing,
    audioLevel = 0,
    activeInstanceId,
    stopRecording
  } = useVoice()

  const isVisible = isRecording || isTranscribing

  const handleStop = async (e: React.MouseEvent<HTMLDivElement>): Promise<void> => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (!isRecording) return

    try {
      const text = await stopRecording()
      if (text && text.length > 0) {
        window.dispatchEvent(
          new CustomEvent('voice-insert-text', {
            detail: { text, instanceId: activeInstanceId || 'editor-voice' }
          })
        )
      }
    } catch (err) {
      console.error('[VoiceCapsule] Stop error:', err)
    }
  }

  // 5 sleek visualizer bars that dance to voice
  const bars = useMemo(() => [0.4, 0.75, 1.0, 0.75, 0.4], [])

  if (!isVisible) return null

  return (
    <div className="voice-capsule-container">
      <div
        className={`voice-capsule ${isTranscribing ? 'transcribing' : 'recording'}`}
        onClick={handleStop}
        title={isRecording ? 'Click to finish and insert' : 'Transcribing...'}
      >
        {isRecording ? (
          <>
            <span className="voice-capsule-indicator" />
            <div className="voice-capsule-wave">
              {bars.map((scale, i) => {
                const levelBoost = Math.pow(audioLevel, 0.8) * 2.2
                const currentScale = Math.max(0.2, Math.min(1.0, scale * (0.28 + levelBoost)))
                const height = Math.max(5, Math.round(currentScale * 20))
                return (
                  <span
                    key={i}
                    className="voice-capsule-bar"
                    style={{
                      height: `${height}px`,
                      opacity: audioLevel > 0.04 ? 1 : 0.6
                    }}
                  />
                )
              })}
            </div>
          </>
        ) : (
          <div className="voice-capsule-loading">
            <Loader2 size={13} className="voice-spinner" />
            <span className="voice-capsule-loading-text">Transcribing...</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default VoiceCapsule
