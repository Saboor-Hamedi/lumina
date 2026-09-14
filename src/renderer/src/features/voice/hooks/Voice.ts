/**
 * Voice.ts - React Hook for Voice Dictation
 */

import { useState, useEffect, useCallback } from 'react'
import { voiceService } from './Services'
import type { VoiceState } from '../types'

export interface UseVoiceReturn extends VoiceState {
  formattedDuration: string
  startRecording: () => Promise<void>
  stopRecording: () => Promise<string | null>
  cancelRecording: () => void
  clearError: () => void
  setActiveInstance: (id: string | null) => void
}

export function useVoice(): UseVoiceReturn {
  const [state, setState] = useState<VoiceState>(() => voiceService.state)

  useEffect(() => {
    const unsubscribe = voiceService.subscribe(setState)
    return unsubscribe
  }, [])

  const startRecording = useCallback(async (): Promise<void> => {
    return voiceService.startRecording()
  }, [])

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return voiceService.stopRecordingAndTranscribe()
  }, [])

  const cancelRecording = useCallback((): void => {
    voiceService.cancelRecording()
  }, [])

  const clearError = useCallback((): void => {
    voiceService.clearError()
  }, [])

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const setActiveInstance = useCallback((id: string | null): void => {
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
