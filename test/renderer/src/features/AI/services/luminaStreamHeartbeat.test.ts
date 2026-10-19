import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RollingInactivityHeartbeat,
  createLuminaStreamController
} from '../../../../../../src/renderer/src/features/AI/services/streaming/luminaAndStreamHeartbeat'

describe('Lumina Stream Heartbeat & Controller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('RollingInactivityHeartbeat triggers on inactivity', () => {
    const onTimeout = vi.fn()
    const heartbeat = new RollingInactivityHeartbeat({
      inactivityMs: 1000,
      ceilingMs: 10000,
      onTimeout
    })

    heartbeat.start()
    expect(onTimeout).not.toHaveBeenCalled()

    // Fast-forward 500ms and beat
    vi.advanceTimersByTime(500)
    heartbeat.beat()
    expect(onTimeout).not.toHaveBeenCalled()

    // Advance 600ms (total 1100ms from start, but only 600ms from last beat)
    vi.advanceTimersByTime(600)
    expect(onTimeout).not.toHaveBeenCalled()

    // Advance another 500ms (1100ms from last beat) -> triggers timeout
    vi.advanceTimersByTime(500)
    expect(onTimeout).toHaveBeenCalledTimes(1)
    expect(onTimeout).toHaveBeenCalledWith(expect.stringContaining('no chunks received for 60 seconds'))

    heartbeat.stop()
  })

  it('RollingInactivityHeartbeat stops cleanly and cancels timers', () => {
    const onTimeout = vi.fn()
    const heartbeat = new RollingInactivityHeartbeat({
      inactivityMs: 1000,
      ceilingMs: 5000,
      onTimeout
    })

    heartbeat.start()
    heartbeat.stop()

    vi.advanceTimersByTime(10000)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('createLuminaStreamController invokes onSkipThinking and sets flag', () => {
    const controller = createLuminaStreamController()
    const onSkipThinking = vi.fn()
    controller.onSkipThinking = onSkipThinking

    expect(controller.skipThinkingRequested).toBe(false)
    controller.skipThinking?.()

    expect(controller.skipThinkingRequested).toBe(true)
    expect(onSkipThinking).toHaveBeenCalledTimes(1)

    // Repeated calls do not re-trigger
    controller.skipThinking?.()
    expect(onSkipThinking).toHaveBeenCalledTimes(1)
  })
})
