import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Mic, Loader2 } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { useVoice } from './hooks/useVoice'
import VoiceModal from './VoiceModal'
import './css/voice.css'

export const VoiceButton = ({
  id = 'voice-btn',
  onInsert,
  buttonStyle = null,
  tooltipPosition = 'bottom'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

  const {
    isDownloaded,
    isDownloading,
    downloadProgress,
    isRecording,
    isTranscribing,
    formattedDuration,
    audioLevel,
    activeInstanceId,
    error,
    downloadModel,
    uninstallModel,
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
    setActiveInstance
  } = useVoice()

  const updatePosition = () => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    if (tooltipPosition === 'top') {
      setMenuPosition({
        bottom: `${Math.max(8, window.innerHeight - rect.top + 6)}px`,
        right: `${Math.max(8, window.innerWidth - rect.right)}px`
      })
    } else {
      setMenuPosition({
        top: `${rect.bottom + 6}px`,
        left: `${Math.max(8, rect.left)}px`
      })
    }
  }

  const isModalActive = isOpen && activeInstanceId === id

  useEffect(() => {
    if (isModalActive && buttonRef.current) {
      updatePosition()
      window.addEventListener('resize', updatePosition)
      return () => window.removeEventListener('resize', updatePosition)
    }
  }, [isModalActive, tooltipPosition])

  const handleTriggerClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (error) clearError()

    if (!isDownloaded) {
      if (!isOpen) {
        updatePosition()
        setActiveInstance(id)
        setIsOpen(true)
      } else {
        setIsOpen(false)
        setActiveInstance(null)
      }
      return
    }

    if (isRecording) {
      await handleStop()
      return
    }

    if (!isTranscribing && !isDownloading) {
      updatePosition()
      setActiveInstance(id)
      setIsOpen(true)
      try {
        await startRecording()
      } catch (err) {}
    }
  }

  const handleStartRecording = async () => {
    try {
      setActiveInstance(id)
      await startRecording()
    } catch (err) {}
  }

  const handleStop = async () => {
    try {
      const text = await stopRecording()
      setIsOpen(false)
      if (activeInstanceId === id) setActiveInstance(null)
      if (text && text.length > 0) {
        if (onInsert) {
          onInsert(text)
        } else {
          window.dispatchEvent(new CustomEvent('voice-insert-text', { detail: { text } }))
        }
      }
    } catch (err) {
      setIsOpen(true)
    }
  }

  const handleCancel = () => {
    cancelRecording()
    setIsOpen(false)
    if (activeInstanceId === id) setActiveInstance(null)
  }

  const handleDownload = () => {
    setActiveInstance(id)
    downloadModel()
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      <ToolTip
        text={
          isRecording
            ? 'Click to stop & transcribe'
            : isTranscribing
              ? 'Transcribing audio...'
              : isDownloading
                ? `Downloading (${downloadProgress}%)`
                : isDownloaded
                  ? 'Voice Dictation'
                  : 'Voice Dictation (Download Offline Model)'
        }
        position={tooltipPosition}
      >
        <button
          ref={buttonRef}
          type="button"
          className={`voice-trigger-btn ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''}`}
          onClick={handleTriggerClick}
          aria-label="Voice Dictation"
          style={buttonStyle || undefined}
        >
          {isTranscribing || isDownloading ? (
            <Loader2 size={12} className="voice-spinner" />
          ) : (
            <Mic size={12} style={{ opacity: isRecording ? 1 : 0.8 }} />
          )}
          <span>{isRecording ? formattedDuration : 'Voice'}</span>
        </button>
      </ToolTip>

      {isModalActive &&
        createPortal(
          <VoiceModal
            isOpen={isModalActive}
            onClose={handleCancel}
            isDownloaded={isDownloaded}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            formattedDuration={formattedDuration}
            audioLevel={audioLevel}
            error={error}
            style={menuPosition}
            onDownload={handleDownload}
            onStartRecording={handleStartRecording}
            onStopRecording={handleStop}
            onUninstall={uninstallModel}
            onClearError={clearError}
          />,
          document.body
        )}
    </div>
  )
}

export default VoiceButton
