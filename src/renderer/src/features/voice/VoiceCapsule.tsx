import React, { useMemo, useEffect, useState } from 'react'
import { CornerDownLeft, X } from 'lucide-react'
import { PulseLoader } from '../../components/PulseLoader'
import { useVoice } from './hooks/Voice'
import { voiceService } from './hooks/Services'
import './css/voice.css'

interface CapsulePositionStyle {
  left: string
  bottom: string
  top: string
  transform: string
}

export const VoiceCapsule: React.FC = () => {
  const {
    isRecording,
    isTranscribing,
    audioLevel = 0,
    formattedDuration,
    activeInstanceId,
    stopRecording,
    cancelRecording
  } = useVoice()

  const isVisible = isRecording || isTranscribing
  const [anchorStyle, setAnchorStyle] = useState<CapsulePositionStyle | null>(null)

  // Anchor the capsule cleanly right above the Composer card (parallel & centered)
  // when dictating into Composer, or bottom-center when dictating into the Editor.
  useEffect(() => {
    if (!isVisible || typeof window === 'undefined' || typeof document === 'undefined') {
      setAnchorStyle(null)
      return
    }

    const updatePosition = () => {
      const composerEl =
        activeInstanceId === 'composer-voice'
          ? ((document.querySelector('.composer-card') ||
              document.querySelector('.composer-textarea')) as HTMLElement | null)
          : null

      if (composerEl) {
        const rect = composerEl.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          const centerX = Math.max(
            70,
            Math.min(window.innerWidth - 70, Math.round(rect.left + rect.width / 2))
          )
          const rawBottom = Math.round(window.innerHeight - rect.top + 10)
          const bottomPx = Math.max(16, Math.min(window.innerHeight - 48, rawBottom))
          setAnchorStyle({
            left: `${centerX}px`,
            bottom: `${bottomPx}px`,
            top: 'auto',
            transform: 'translateX(-50%)'
          })
          return
        }
      }

      setAnchorStyle({
        left: '50%',
        bottom: '42px',
        top: 'auto',
        transform: 'translateX(-50%)'
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    const composerEl = (document.querySelector('.composer-card') ||
      document.querySelector('.composer-textarea')) as HTMLElement | null
    let observer: ResizeObserver | null = null
    if (composerEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updatePosition)
      observer.observe(composerEl)
    }

    return () => {
      window.removeEventListener('resize', updatePosition)
      observer?.disconnect()
    }
  }, [isVisible, activeInstanceId])

  // Keyboard shortcuts while VoiceCapsule is visible:
  // - Enter (without Shift/Ctrl/Alt/Meta): stop & transcribe immediately
  // - Escape: cancel recording or in-flight transcription immediately
  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cancelRecording()
        return
      }
      const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter'
      if (
        isEnter &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey &&
        (isRecording || voiceService.state.isRecording)
      ) {
        e.preventDefault()
        e.stopPropagation()
        void stopRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isVisible, isRecording, stopRecording, cancelRecording])

  const handleStop = async (e: React.MouseEvent<HTMLElement>): Promise<void> => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (isTranscribing || voiceService.state.isTranscribing) {
      cancelRecording()
      return
    }
    if (!isRecording && !voiceService.state.isRecording) return

    try {
      await stopRecording()
    } catch (err) {
      console.error('[VoiceCapsule] Stop error:', err)
    }
  }

  const handleCancel = (e: React.MouseEvent<HTMLElement>): void => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    cancelRecording()
  }

  // 5 sleek visualizer bars that dance to voice
  const bars = useMemo(() => [0.4, 0.75, 1.0, 0.75, 0.4], [])

  if (!isVisible) return null

  return (
    <div className="voice-capsule-container" style={anchorStyle || undefined}>
      <div
        className={`voice-capsule ${isTranscribing ? 'transcribing' : 'recording'}`}
        onClick={handleStop}
        role="button"
        tabIndex={0}
        title={isRecording ? 'Press Enter or click to transcribe • Esc to cancel' : 'Click or press Esc to cancel'}
      >
        {isRecording ? (
          <>
            <span className="voice-capsule-indicator" />
            <div className="voice-capsule-wave">
              {bars.map((scale, i) => {
                const levelBoost = Math.pow(audioLevel, 0.8) * 2.2
                const currentScale = Math.max(0.2, Math.min(1.0, scale * (0.28 + levelBoost)))
                const height = Math.max(4, Math.round(currentScale * 14))
                return (
                  <span
                    key={i}
                    className="voice-capsule-bar"
                    style={{
                      height: `${height}px`,
                      opacity: audioLevel > 0.03 ? 1 : 0.65
                    }}
                  />
                )
              })}
            </div>
            <span className="voice-capsule-timer">{formattedDuration}</span>
            <button
              type="button"
              className="voice-capsule-done-btn"
              onClick={handleStop}
              aria-label="Transcribe recording"
              title="Transcribe (Enter)"
            >
              <CornerDownLeft size={10} />
            </button>
            <button
              type="button"
              className="voice-capsule-cancel-btn"
              onClick={handleCancel}
              aria-label="Cancel recording"
              title="Cancel (Esc)"
            >
              <X size={10} />
            </button>
          </>
        ) : (
          <div className="voice-capsule-loading">
            <PulseLoader size="xs" inline delayMs={0} message="" />
            <span className="voice-capsule-loading-text">Transcribing...</span>
            <button
              type="button"
              className="voice-capsule-cancel-btn"
              onClick={handleCancel}
              aria-label="Cancel transcription"
              title="Cancel (Esc)"
            >
              <X size={10} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default VoiceCapsule
