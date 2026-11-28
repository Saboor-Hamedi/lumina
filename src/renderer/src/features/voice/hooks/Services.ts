/**
 * Services.ts - DeepSeek Voice Orchestrator
 *
 * Coordinates live recording, progressive chunk streaming, DeepSeek ASR
 * transcription, focus tracking, and smooth text stitching.
 */

import { AudioRecorder } from './Record'
import { transcribeWithDeepSeek } from './deepseekVoice'
import { useSettingsStore } from '../../../core/store/SettingStore'
import type { VoiceState, VoiceListener, VoiceApiError } from '../types'

declare global {
  interface Window {
    __luminaLastVoiceTarget?: string
  }
}

/**
 * Intelligent suffix/prefix word alignment algorithm.
 * Removes repeated boundary words between progressive audio chunk transcriptions.
 */
function removePrefixOverlap(newText: string, prevText: string): string {
  if (!prevText || !newText) return newText ? newText.trim() : ''
  const pWords = prevText.trim().toLowerCase().split(/\s+/)
  const nWords = newText.trim().split(/\s+/)

  const maxOverlap = Math.min(6, pWords.length, nWords.length)
  for (let len = maxOverlap; len > 0; len--) {
    const prevSlice = pWords.slice(-len).join(' ')
    const nextSlice = nWords.slice(0, len).map((w) => w.toLowerCase()).join(' ')
    if (prevSlice === nextSlice) {
      return nWords.slice(len).join(' ')
    }
  }
  return newText.trim()
}

export class VoiceService {
  private recorder: AudioRecorder
  private listeners: Set<VoiceListener> = new Set()
  private timerInterval: ReturnType<typeof setInterval> | null = null

  public state: VoiceState = {
    isRecording: false,
    isTranscribing: false,
    recordingDuration: 0,
    audioLevel: 0,
    activeInstanceId: null,
    interimText: '',
    error: null
  }

  private isStarting: boolean = false
  private isQuotaExhausted: boolean = false
  private lastToggleTime: number = 0
  private recordingStartTime: number = 0
  private abortController: AbortController | null = null

  private lastSpeechTime: number = 0
  private segmentStartTime: number = 0
  private hasSpokenInSegment: boolean = false
  private isFlushingSegment: boolean = false
  private lastTranscribedText: string = ''

  constructor() {
    this.recorder = new AudioRecorder()

    if (typeof window !== 'undefined') {
      window.addEventListener('toggle-voice-dictation', (e: Event) => {
        const customEvent = e as CustomEvent<{ target?: string }>
        this.toggleDictation(customEvent?.detail?.target)
      })

      // Track cursor focus so Shift+Alt+V automatically knows where to type
      document.addEventListener('focusin', (e: FocusEvent) => {
        const target = e.target as HTMLElement | null
        if (target?.closest?.('.composer-container, .composer-textarea, .lumina-chat') || target?.classList?.contains('composer-textarea')) {
          window.__luminaLastVoiceTarget = 'composer-voice'
        } else if (target?.closest?.('.cm-editor, .cm-content, .editor-container')) {
          window.__luminaLastVoiceTarget = 'editor-voice'
        }
      }, true)
    }
  }

  /**
   * Toggles dictation on/off with debouncing to prevent audio hardware collision.
   */
  toggleDictation(targetHint: string | null = null): void {
    const now = Date.now()
    if (now - this.lastToggleTime < 400) {
      return
    }
    this.lastToggleTime = now

    if (this.isStarting) {
      return
    }

    if (this.state.isRecording) {
      if (now - this.recordingStartTime < 450) {
        return
      }

      void this.stopRecordingAndTranscribe()
      return
    }

    if (this.state.isTranscribing) return

    let target = targetHint
    if (!target) {
      const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null
      if (
        activeEl?.closest?.('.composer-container, .composer-textarea, .lumina-chat') ||
        activeEl?.classList?.contains?.('composer-textarea')
      ) {
        target = 'composer-voice'
      } else if (activeEl?.closest?.('.cm-editor, .cm-content, .editor-container')) {
        target = 'editor-voice'
      } else if (typeof window !== 'undefined' && window.__luminaLastVoiceTarget) {
        target = window.__luminaLastVoiceTarget
      } else {
        target = 'editor-voice'
      }
    }

    this.setActiveInstance(target)
    this.startRecording().catch(() => {})
  }

  subscribe(listener: VoiceListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  updateState(partial: Partial<VoiceState>): void {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((listener) => listener(this.state))
  }

  setActiveInstance(id: string | null): void {
    this.updateState({ activeInstanceId: id })
  }

  private getStoredDeepSeekKey(): string | null {
    try {
      const fromStore = useSettingsStore.getState().settings?.deepSeekKey
      if (fromStore) return fromStore
    } catch {
      // ignore
    }
    return null
  }

  async startRecording(): Promise<void> {
    if (this.state.isRecording || this.state.isTranscribing || this.isStarting) return

    const deepSeekKey = this.getStoredDeepSeekKey()
    if (!deepSeekKey || !deepSeekKey.trim()) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: { message: 'Add your DeepSeek API key in Settings > AI Assistant', type: 'error' }
          })
        )
      }
      this.updateState({
        error: 'DeepSeek API key not found'
      })
      return
    }

    this.isStarting = true
    this.isQuotaExhausted = false
    try {
      this.recordingStartTime = Date.now()
      this.updateState({
        isRecording: true,
        recordingDuration: 0,
        audioLevel: 0,
        interimText: '',
        error: null
      })

      this.lastSpeechTime = Date.now()
      this.segmentStartTime = Date.now()
      this.hasSpokenInSegment = false
      this.isFlushingSegment = false
      this.lastTranscribedText = ''

      if (this.timerInterval) clearInterval(this.timerInterval)
      this.timerInterval = setInterval(() => {
        this.updateState({ recordingDuration: this.state.recordingDuration + 1 })
      }, 1000)

      await this.recorder.start((level) => {
        this.updateState({ audioLevel: level })

        const now = Date.now()
        if (level > 0.025) {
          this.hasSpokenInSegment = true
          this.lastSpeechTime = now
        }
        // Keep full utterance intact for DeepSeek ASR (single-shot up to 120s)
        // so English/multilingual speech has complete phonetic context and never
        // hallucinates short-fragment Chinese characters.
      })
    } catch (err: unknown) {
      if (this.timerInterval) {
        clearInterval(this.timerInterval)
        this.timerInterval = null
      }
      const message = err instanceof Error ? err.message : 'Could not access microphone'
      this.updateState({
        isRecording: false,
        recordingDuration: 0,
        audioLevel: 0,
        interimText: '',
        error: message
      })
      throw err
    } finally {
      this.isStarting = false
    }
  }

  async flushSegment(): Promise<void> {
    if (this.isFlushingSegment || !this.state.isRecording || this.isQuotaExhausted) return
    this.isFlushingSegment = true
    this.segmentStartTime = Date.now()
    this.hasSpokenInSegment = false

    const deepSeekKey = this.getStoredDeepSeekKey()
    if (!deepSeekKey || !deepSeekKey.trim()) {
      this.isFlushingSegment = false
      return
    }

    try {
      const segmentBlob = await this.recorder.flushSegment()
      if (!segmentBlob || segmentBlob.size < 1800) {
        this.isFlushingSegment = false
        return
      }

      const instanceId = this.state.activeInstanceId || 'editor-voice'

      transcribeWithDeepSeek(segmentBlob, deepSeekKey)
        .then((text) => {
          if (text && text.trim().length > 0) {
            const rawClean = text.trim()
            const smoothedText = removePrefixOverlap(rawClean, this.lastTranscribedText)
            if (smoothedText && smoothedText.length > 0) {
              this.lastTranscribedText = rawClean
              window.dispatchEvent(
                new CustomEvent('voice-insert-text', {
                  detail: { text: smoothedText, instanceId, isSegment: true }
                })
              )
            }
          }
        })
        .catch((err: VoiceApiError) => {
          console.error('[VoiceService] Segment transcription error:', err)
          if (err?.isQuotaError || err?.isAuthError) {
            this.isQuotaExhausted = true
            this.cancelRecording()
            const msg = err.message || 'DeepSeek Voice API error.'
            this.updateState({ error: msg })
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('show-toast', { detail: { message: msg, type: 'error' } })
              )
            }
          }
        })
        .finally(() => {
          this.isFlushingSegment = false
        })
    } catch {
      this.isFlushingSegment = false
    }
  }

  async stopRecordingAndTranscribe(): Promise<string | null> {
    if (!this.state.isRecording && !this.isStarting) return null

    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }

    this.abortController?.abort()
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    this.updateState({
      isRecording: false,
      isTranscribing: true,
      audioLevel: 0
    })

    try {
      const audioData = await this.recorder.stop()
      if (signal.aborted) {
        this.updateState({ isTranscribing: false })
        return null
      }
      if (!audioData || audioData.size === 0) {
        this.updateState({ isTranscribing: false })
        return null
      }

      const durationMs = Date.now() - (this.recordingStartTime || 0)
      if (durationMs < 350 || audioData.size < 1800) {
        this.updateState({ isTranscribing: false, interimText: '', error: null })
        return null
      }

      const deepSeekKey = this.getStoredDeepSeekKey()
      if (!deepSeekKey || !deepSeekKey.trim()) {
        this.updateState({
          isTranscribing: false,
          error: 'Add your DeepSeek API key in Settings > AI Assistant.'
        })
        return null
      }

      const text = await transcribeWithDeepSeek(audioData, deepSeekKey, signal)
      if (signal.aborted) {
        this.updateState({ isTranscribing: false })
        return null
      }
      this.updateState({ isTranscribing: false, interimText: '', error: null })
      const smoothed = removePrefixOverlap(text || '', this.lastTranscribedText)
      if (smoothed && typeof window !== 'undefined') {
        const instanceId = this.state.activeInstanceId || 'editor-voice'
        window.dispatchEvent(
          new CustomEvent('voice-insert-text', {
            detail: { text: smoothed, instanceId, isSegment: false }
          })
        )
      }
      return smoothed || null
    } catch (err: unknown) {
      if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        this.updateState({ isTranscribing: false, interimText: '', error: null })
        return null
      }
      const message = err instanceof Error ? err.message : 'Transcription failed'
      console.error('[VoiceService] Transcription error:', err)
      this.updateState({
        isTranscribing: false,
        error: message
      })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: { message, type: 'error' }
          })
        )
      }
      return null
    } finally {
      if (this.abortController?.signal === signal) {
        this.abortController = null
      }
    }
  }

  cancelRecording(): void {
    this.isStarting = false
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
    this.recorder.cancel()
    const currentInstanceId = this.state.activeInstanceId
    this.updateState({
      isRecording: false,
      isTranscribing: false,
      recordingDuration: 0,
      audioLevel: 0,
      interimText: '',
      error: null
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('voice-live-cancel', {
          detail: { instanceId: currentInstanceId }
        })
      )
    }
  }

  clearError(): void {
    this.updateState({ error: null })
  }
}

export const voiceService = new VoiceService()
