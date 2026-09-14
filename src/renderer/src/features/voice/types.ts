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

export interface VoiceModalProps {
  isOpen: boolean
  onClose: () => void
  isRecording: boolean
  isTranscribing: boolean
  formattedDuration: string
  audioLevel?: number
  interimText?: string
  error?: string | null
  style?: React.CSSProperties
  onStartRecording: () => void
  onStopRecording: () => void
  onClearError: () => void
}

export interface GroqError extends Error {
  isNetworkError?: boolean
  isQuotaError?: boolean
  isAuthError?: boolean
  status?: number
}
