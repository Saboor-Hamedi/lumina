import React, { useRef, useState } from 'react'
import { Mic, X, Loader2, AlertCircle, Square } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'

export const VoiceModal = ({
  isOpen,
  onClose,
  isRecording,
  isTranscribing,
  formattedDuration,
  audioLevel = 0,
  interimText = '',
  error,
  style = {},
  onStartRecording,
  onStopRecording,
  onClearError
}) => {
  const modalRef = useRef(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 })

  const handleHeaderMouseDown = (e) => {
    if (e.target.closest('button')) return
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialX: dragOffset.x,
      initialY: dragOffset.y
    }
    const handleMouseMove = (moveEvent) => {
      if (!dragRef.current.isDragging) return
      const dx = moveEvent.clientX - dragRef.current.startX
      const dy = moveEvent.clientY - dragRef.current.startY
      setDragOffset({
        x: dragRef.current.initialX + dx,
        y: dragRef.current.initialY + dy
      })
    }
    const handleMouseUp = () => {
      dragRef.current.isDragging = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  if (!isOpen) return null

  const bars = [0.25, 0.45, 0.7, 0.9, 1.0, 0.9, 0.7, 0.45, 0.25]

  const computedStyle = {
    position: 'fixed',
    ...style,
    transform: dragOffset.x !== 0 || dragOffset.y !== 0 ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
    zIndex: 99999
  }

  const handleSpeakerClick = (e) => {
    e.stopPropagation()
    if (isRecording) {
      onStopRecording()
    } else {
      onStartRecording()
    }
  }

  const handleCloseClick = (e) => {
    e.stopPropagation()
    if (isRecording) {
      onStopRecording()
    }
    onClose()
  }

  return (
    <>
      <div
        className="voice-popover"
        ref={modalRef}
        style={computedStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="voice-popover-header" onMouseDown={handleHeaderMouseDown} style={{ cursor: 'grab' }}>
          <div className="voice-popover-title-row">
            <span className="voice-popover-title">Lumina voice detection</span>
          </div>

          <div className="voice-header-actions">
            <button type="button" className="voice-control-close" onClick={handleCloseClick} title="Close">
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="voice-popover-body">
          {error ? (
            <div style={{ padding: '4px 0', width: '100%', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', color: '#ef4444', fontSize: '10px', marginBottom: '6px' }}>
                <AlertCircle size={11} />
                <span>{error}</span>
              </div>
              <button
                type="button"
                className="voice-btn-primary"
                onClick={onClearError}
              >
                Dismiss
              </button>
            </div>
          ) : isTranscribing ? (
            <div className="voice-transcribing-view">
              <Loader2 size={16} className="voice-spinner" />
              <span style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)' }}>Transcribing with Groq...</span>
            </div>
          ) : (
            <div className="voice-body-center">
              <div className="voice-waveform-container">
                {bars.map((base, idx) => {
                  const currentScale = isRecording ? Math.max(0.2, Math.min(1.0, base * (0.25 + audioLevel * 1.6))) : 0.15
                  const height = isRecording ? Math.max(3, Math.round(currentScale * 14)) : 2
                  return (
                    <div
                      key={idx}
                      className="voice-waveform-bar"
                      style={{
                        height: `${height}px`,
                        opacity: isRecording ? (audioLevel > 0.08 ? 0.95 : 0.5) : 0.2
                      }}
                    />
                  )
                })}
              </div>

              <ToolTip text={isRecording ? 'Stop recording' : 'Start recording'} position="top">
                <button
                  type="button"
                  className={`voice-speaker-toggle ${isRecording ? 'recording' : ''}`}
                  onClick={handleSpeakerClick}
                >
                  {isRecording ? <Square size={11} fill="currentColor" /> : <Mic size={14} />}
                </button>
              </ToolTip>

              <span className={`voice-timer-text ${isRecording ? 'active' : ''}`}>
                {isRecording ? formattedDuration : 'Ready'}
              </span>
            </div>
          )}
        </div>

      <div className="voice-popover-footer">
        <div className="voice-footer-row">
          {typeof localStorage !== 'undefined' && localStorage.getItem('lumina_groq_key') ? (
            <span className="voice-footer-status" style={{ color: '#22c55e' }}>
              <span className="voice-footer-dot" style={{ background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              Groq Whisper Large
            </span>
          ) : (
            <span className="voice-footer-status" style={{ color: '#eab308' }}>
              <span className="voice-footer-dot" style={{ background: '#eab308' }} />
              Add Groq key in Settings
            </span>
          )}
        </div>
      </div>
    </div>
  </>
  )
}

export default VoiceModal
