/**
 * =========================================================================
 * Timer Tab Component (`TimerTab.tsx`)
 * =========================================================================
 *
 * Lightweight, GPU-accelerated timer with:
 * - Zero heavy SVG ring repaints (uses CSS `scaleX` progress bar)
 * - Instant 1-tap presets (1m, 5m, 10m, 15m, 25m, 45m, 1h)
 * - Fine-tune +/- adjusters & background `calendarEngine` execution
 * =========================================================================
 */

import React, { useState, useEffect, useCallback, memo } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { formatDurationString } from './utils/calendarUtils'
import { calendarEngine, type TimerSnapshot } from './utils/calendarEngine'

const PRESETS: readonly { readonly label: string; readonly seconds: number }[] = [
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 5 * 60 },
  { label: '10m', seconds: 10 * 60 },
  { label: '15m', seconds: 15 * 60 },
  { label: '25m', seconds: 25 * 60 },
  { label: '45m', seconds: 45 * 60 },
  { label: '1h', seconds: 60 * 60 }
]

export const TimerTab: React.FC = memo(() => {
  const [snap, setSnap] = useState<TimerSnapshot>(() => calendarEngine.getTimerSnapshot())

  useEffect(() => {
    return calendarEngine.subscribeTimer(setSnap)
  }, [])

  const handleToggle = useCallback(() => {
    if (snap.isRunning) {
      calendarEngine.pauseTimer()
    } else {
      calendarEngine.startTimer()
    }
  }, [snap.isRunning])

  const ratio =
    snap.initialSeconds > 0
      ? Math.max(0, Math.min(1, snap.remainingSeconds / snap.initialSeconds))
      : 0

  return (
    <div className="timer-wrap">
      <div className="timer-hero-card">
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
          {snap.isRunning ? 'Focus Running' : 'Timer Ready'}
        </div>

        <div className="timer-hero-digits">{formatDurationString(snap.remainingSeconds)}</div>

        <div className="timer-progress-track">
          <div
            className="timer-progress-fill"
            style={{ transform: `scaleX(${ratio})` }}
          />
        </div>

        <div className="timer-controls-bar">
          <button
            type="button"
            className="timer-action-btn primary"
            onClick={handleToggle}
          >
            {snap.isRunning ? <Pause size={12} /> : <Play size={12} />}
            <span>{snap.isRunning ? 'Pause' : 'Start'}</span>
          </button>

          <button
            type="button"
            className="timer-action-btn"
            onClick={() => calendarEngine.resetTimer()}
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Adjusters & Presets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div className="calender-chip-row">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`calender-chip${snap.initialSeconds === p.seconds ? ' active' : ''}`}
              onClick={() => calendarEngine.setPreset(p.seconds)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="calender-chip-row">
          <button type="button" className="calender-chip" onClick={() => calendarEngine.addSeconds(-60)}>
            -1m
          </button>
          <button type="button" className="calender-chip" onClick={() => calendarEngine.addSeconds(60)}>
            +1m
          </button>
          <button type="button" className="calender-chip" onClick={() => calendarEngine.addSeconds(300)}>
            +5m
          </button>
        </div>
      </div>
    </div>
  )
})

TimerTab.displayName = 'TimerTab'
