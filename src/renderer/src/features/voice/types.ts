export interface VoiceState {
  isRecording: boolean
  isTranscribing: boolean
  recordingDuration: number
  audioLevel: number
  activeInstanceId: string | null
  interimText: string
  error: string | null
}

export type VoiceListener = (state: VoiceState) => void

export interface VoiceButtonProps {
  id?: string
  onInsert?: (text: string) => void
  buttonStyle?: React.CSSProperties | null
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
}

export interface VoiceApiError extends Error {
  isNetworkError?: boolean
  isQuotaError?: boolean
  isAuthError?: boolean
  status?: number
}
