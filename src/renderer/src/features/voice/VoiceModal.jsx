import React, { useRef, useEffect } from 'react'
import { Mic, Download, X, Loader2, Volume2, AlertCircle, Trash2 } from 'lucide-react'

export const VoiceModal = ({
  isOpen,
  onClose,
  isDownloaded,
  isDownloading,
  downloadProgress,
  isRecording,
  isTranscribing,
  formattedDuration,
  audioLevel = 0,
  error,
  style = {},
  onDownload,
  onStartRecording,
  onStopRecording,
  onUninstall,
  onClearError
}) => {
  const modalRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        if (!isDownloading && !isRecording && !isTranscribing) {
          onClose()
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside, true)
    return () => document.removeEventListener('mousedown', handleClickOutside, true)
  }, [isOpen, isDownloading, isRecording, isTranscribing, onClose])

  if (!isOpen) return null

  const bars = [0.3, 0.6, 0.9, 0.7, 0.4]

  return (
    <div
      className="voice-popover"
      ref={modalRef}
      style={{ position: 'fixed', ...style }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="voice-popover-header">
        <div className="voice-popover-title-row">
          <div className={`voice-icon-badge ${isRecording ? 'recording' : ''}`}>
            {isRecording ? <Mic size={11} /> : isDownloading ? <Download size={11} /> : <Volume2 size={11} />}
          </div>
          <span className="voice-popover-title">
            {isRecording
              ? 'Listening...'
              : isTranscribing
                ? 'Processing...'
                : isDownloading
                  ? 'Downloading'
                  : 'Voice Dictation'}
          </span>
        </div>

        <div className="voice-header-actions">
          {isDownloaded && !isRecording && !isDownloading && !isTranscribing && onUninstall && (
            <button
              className="voice-icon-btn danger"
              onClick={() => {
                if (window.confirm('Delete offline Whisper model (~39MB) to free disk space?')) {
                  onUninstall()
                }
              }}
              title="Uninstall offline model (~39MB)"
            >
              <Trash2 size={11} />
            </button>
          )}
          <button className="voice-icon-btn" onClick={onClose} title="Close">
            <X size={12} />
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#ef4444', fontSize: '10.5px', marginBottom: '6px' }}>
            <AlertCircle size={12} />
            <span>{error}</span>
          </div>
          <button
            className="voice-btn-primary"
            style={{ background: 'var(--bg-active, rgba(255, 255, 255, 0.08))', color: 'var(--text-main, #f1f5f9)' }}
            onClick={onClearError}
          >
            Dismiss
          </button>
        </div>
      ) : isTranscribing ? (
        <div className="voice-transcribing-view">
          <Loader2 size={16} className="voice-spinner" />
        </div>
      ) : isRecording ? (
        <div className="voice-recording-view">
          <div className="voice-waveform-container">
            {bars.map((base, idx) => {
              const currentScale = Math.max(0.2, Math.min(1.0, base * (0.3 + audioLevel * 1.8)))
              const height = Math.round(currentScale * 18)
              return (
                <div
                  key={idx}
                  className="voice-waveform-bar"
                  style={{
                    height: `${height}px`,
                    opacity: audioLevel > 0.1 ? 1 : 0.6
                  }}
                />
              )
            })}
          </div>

          <div className="voice-recording-meta">
            <div className="voice-timer-badge">
              <div className="voice-recording-dot" />
              <span>{formattedDuration}</span>
            </div>
          </div>

          <button className="voice-record-toggle is-recording" onClick={onStopRecording}>
            <div className="voice-toggle-indicator recording" />
            <span>Stop & Done</span>
          </button>
        </div>
      ) : isDownloading ? (
        <div className="voice-progress-box">
          <div className="voice-progress-labels">
            <span>Downloading Whisper...</span>
            <span className="voice-progress-percent">{downloadProgress}%</span>
          </div>
          <div className="voice-progress-track">
            <div className="voice-progress-bar" style={{ width: `${downloadProgress}%` }} />
          </div>
          <div style={{ marginTop: '5px', fontSize: '9.5px', color: 'var(--text-faint, #64748b)', textAlign: 'center' }}>
            Saving to offline bundle
          </div>
        </div>
      ) : !isDownloaded ? (
        <div>
          <div className="voice-popover-desc">
            Download offline Whisper (~39MB) to dictate privately with zero cloud APIs.
          </div>
          <button className="voice-btn-primary" onClick={onDownload}>
            <Download size={11} />
            <span>Download Model (~39MB)</span>
          </button>
        </div>
      ) : (
        <div>
          <div className="voice-popover-desc">
            Offline model is ready. Toggle to start or stop live speech dictation.
          </div>
          <button className="voice-record-toggle" onClick={onStartRecording}>
            <div className="voice-toggle-indicator" />
            <span>Start Dictating</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default VoiceModal
