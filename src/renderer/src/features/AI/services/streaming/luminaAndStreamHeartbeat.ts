/**
 * ============================================================================
 * Lumina AI Stream Heartbeat & Skip-Thinking Controller
 * ============================================================================
 * 
 * Provides rolling inactivity monitoring and interactive "Skip Thinking" signals
 * for long-running streaming generation and multi-step tool calls.
 * 
 * 1. RollingInactivityHeartbeat:
 *    - Replaces static fixed timeouts (e.g. 180s aborts) with an adaptive inactivity
 *      watchdog that resets whenever a chunk arrives from the model stream.
 *    - Enforces a 60-second inactivity limit (if no tokens arrive for 60s, abort).
 *    - Enforces an absolute 10-minute ceiling to prevent zombie stream leaks.
 * 
 * 2. LuminaStreamController:
 *    - Extends standard AbortController with `skipThinking()` capabilities and event listeners.
 */

export interface HeartbeatOptions {
  inactivityMs?: number
  ceilingMs?: number
  onTimeout?: (reason: string) => void
}

export class RollingInactivityHeartbeat {
  private inactivityMs: number
  private ceilingMs: number
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null
  private ceilingTimer: ReturnType<typeof setTimeout> | null = null
  private onTimeout?: (reason: string) => void
  private isActive = false

  constructor(options: HeartbeatOptions = {}) {
    this.inactivityMs = options.inactivityMs ?? 60000 // 60s inactivity
    this.ceilingMs = options.ceilingMs ?? 600000 // 10 min absolute ceiling
    this.onTimeout = options.onTimeout
  }

  start(onTimeout?: (reason: string) => void): void {
    if (onTimeout) this.onTimeout = onTimeout
    this.isActive = true
    this.resetInactivityTimer()

    if (this.ceilingMs > 0) {
      this.ceilingTimer = setTimeout(() => {
        if (!this.isActive) return
        this.stop()
        this.onTimeout?.('Stream exceeded maximum execution ceiling (10 minutes).')
      }, this.ceilingMs)
    }
  }

  beat(): void {
    if (!this.isActive) return
    this.resetInactivityTimer()
  }

  private resetInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer)
    }
    this.inactivityTimer = setTimeout(() => {
      if (!this.isActive) return
      this.stop()
      this.onTimeout?.('Stream stalled: no chunks received for 60 seconds.')
    }, this.inactivityMs)
  }

  stop(): void {
    this.isActive = false
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer)
      this.inactivityTimer = null
    }
    if (this.ceilingTimer) {
      clearTimeout(this.ceilingTimer)
      this.ceilingTimer = null
    }
  }
}

export interface LuminaStreamAbortController extends AbortController {
  skipThinkingRequested?: boolean
  onSkipThinking?: () => void
  skipThinking?: () => void
}

export function createLuminaStreamController(): LuminaStreamAbortController {
  const controller = new AbortController() as LuminaStreamAbortController
  controller.skipThinkingRequested = false

  controller.skipThinking = () => {
    if (controller.skipThinkingRequested) return
    controller.skipThinkingRequested = true
    try {
      controller.onSkipThinking?.()
    } catch (err) {
      console.warn('[LuminaStreamController] onSkipThinking error:', err)
    }
  }

  return controller
}
