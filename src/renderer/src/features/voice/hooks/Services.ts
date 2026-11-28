/**
 * Services.ts - DeepSeek Voice Orchestrator
 *
 * Coordinates clean full-utterance recording, DeepSeek ASR transcription,
 * context-aware voice refinement (typos, grammar, profanity filtering),
 * and focus tracking.
 */

import { AudioRecorder } from './Record'
import { transcribeWithDeepSeek, refineVoiceTranscript } from './deepseekVoice'
import { useSettingsStore } from '../../../core/store/SettingStore'
import { useWorkspaceStore } from '../../../core/store/workspaceStore'
import type { VoiceState, VoiceListener } from '../types'

declare global {
  interface Window {
    __luminaLastVoiceTarget?: string
  }
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
  private lastToggleTime: number = 0
  private recordingStartTime: number = 0
  private abortController: AbortController | null = null

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

  private getVoiceContextHints(): string[] {
    try {
      const ws = useWorkspaceStore.getState()
      const hints: string[] = []
      if (ws.selectedNote?.title) {
        hints.push(String(ws.selectedNote.title))
      }
      const notes = Array.isArray(ws.notes) ? ws.notes : []
      for (const note of notes.slice(0, 12)) {
        if (note?.title) hints.push(String(note.title))
      }
      return hints
    } catch {
      return []
    }
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
    try {
      this.recordingStartTime = Date.now()
      this.updateState({
        isRecording: true,
        recordingDuration: 0,
        audioLevel: 0,
        interimText: '',
        error: null
      })

      if (this.timerInterval) clearInterval(this.timerInterval)
      this.timerInterval = setInterval(() => {
        const nextDuration = this.state.recordingDuration + 1
        this.updateState({ recordingDuration: nextDuration })
        // Auto-finish safely under DeepSeek ASR's 120s limit
        if (nextDuration >= 115 && this.state.isRecording) {
          void this.stopRecordingAndTranscribe()
        }
      }, 1000)

      await this.recorder.start((level) => {
        this.updateState({ audioLevel: level })
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
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('show-toast', {
              detail: { message: 'No microphone audio captured. Check your mic input.', type: 'warning' }
            })
          )
        }
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

      const rawText = await transcribeWithDeepSeek(audioData, deepSeekKey, signal)
      if (signal.aborted) {
        this.updateState({ isTranscribing: false })
        return null
      }

      const cleanedText = rawText
        ? await refineVoiceTranscript(rawText, deepSeekKey, {
            contextHints: this.getVoiceContextHints(),
            signal
          })
        : ''

      if (signal.aborted) {
        this.updateState({ isTranscribing: false })
        return null
      }

      this.updateState({ isTranscribing: false, interimText: '', error: null })
      if (cleanedText && typeof window !== 'undefined') {
        const instanceId = this.state.activeInstanceId || 'editor-voice'
        window.dispatchEvent(
          new CustomEvent('voice-insert-text', {
            detail: { text: cleanedText, instanceId, isSegment: false }
          })
        )
      }
      return cleanedText || null
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

const globalVoiceHost = globalThis as unknown as { __luminaVoiceService?: VoiceService }
export const voiceService =
  globalVoiceHost.__luminaVoiceService ?? (globalVoiceHost.__luminaVoiceService = new VoiceService())
