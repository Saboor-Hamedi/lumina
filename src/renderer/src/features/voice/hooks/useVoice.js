import { useState, useEffect, useCallback } from 'react'
import { voiceService } from './voiceService'

export function useVoice() {
  const [state, setState] = useState(() => voiceService.state)

  useEffect(() => {
    const unsubscribe = voiceService.subscribe(setState)
    return unsubscribe
  }, [])

  const startRecording = useCallback(async () => {
    return voiceService.startRecording()
  }, [])

  const stopRecording = useCallback(async () => {
    return voiceService.stopRecordingAndTranscribe()
  }, [])

  const cancelRecording = useCallback(() => {
    voiceService.cancelRecording()
  }, [])

  const clearError = useCallback(() => {
    voiceService.clearError()
  }, [])

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const setActiveInstance = useCallback((id) => {
    voiceService.setActiveInstance(id)
  }, [])

  return {
    ...state,
    formattedDuration: formatDuration(state.recordingDuration),
    startRecording,
    stopRecording,
    cancelRecording,
    clearError,
    setActiveInstance
  }
}
