/**
 * =========================================================================
 * Countdown Tab Component (`CountdownTab.tsx`)
 * =========================================================================
 *
 * Intuitive, zero-friction countdown:
 * - Direct Days / Hours / Mins numeric inputs + 1-tap presets
 * - Easy 1-click Cancel Countdown button right in the active hero card
 * - Background completion handled by `calendarEngine` even when closed
 * - Persisted directly in `app-config.json` via `useSettingStore`
 * =========================================================================
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { X, Play } from 'lucide-react'
import { useSettingStore } from '../../core/store/SettingStore'
import {
  pad2,
  getCountdownParts,
  saveCalendarCountdown,
  type CountdownTarget
} from './utils/calendarUtils'
import { calendarEngine } from './utils/calendarEngine'

export const CountdownTab: React.FC = memo(() => {
  const target = useSettingStore(
    (s) => (s.settings?.calendarCountdown as CountdownTarget | null | undefined) ?? null
  )

  const [titleInput, setTitleInput] = useState<string>('')
  const [daysIn, setDaysIn] = useState<string>('0')
  const [hoursIn, setHoursIn] = useState<string>('01')
  const [minsIn, setMinsIn] = useState<string>('00')

  const daysRef = useRef<HTMLSpanElement>(null)
  const hoursRef = useRef<HTMLSpanElement>(null)
  const minsRef = useRef<HTMLSpanElement>(null)
  const secsRef = useRef<HTMLSpanElement>(null)
  const [isPassed, setIsPassed] = useState<boolean>(false)

  useEffect(() => {
    if (!target) {
      setIsPassed(false)
      return
    }

    const updateDOM = () => {
      const parts = getCountdownParts(target.targetTimestamp, Date.now())
      if (daysRef.current) daysRef.current.textContent = String(parts.days)
      if (hoursRef.current) hoursRef.current.textContent = pad2(parts.hours)
      if (minsRef.current) minsRef.current.textContent = pad2(parts.minutes)
      if (secsRef.current) secsRef.current.textContent = pad2(parts.seconds)
      setIsPassed(parts.isPassed)
    }

    updateDOM()
    const id = window.setInterval(updateDOM, 1000)
    return () => window.clearInterval(id)
  }, [target])

  const startCountdown = useCallback((msFromNow: number, title: string) => {
    if (msFromNow <= 0) return
    const newTarget: CountdownTarget = {
      id: `cd_${Date.now()}`,
      title,
      targetTimestamp: Date.now() + msFromNow
    }
    saveCalendarCountdown(newTarget)
    calendarEngine.resetCountdownNotification(null)
  }, [])

  const handleStartCustom = useCallback(() => {
    const d = Math.max(0, parseInt(daysIn, 10) || 0)
    const h = Math.max(0, parseInt(hoursIn, 10) || 0)
    const m = Math.max(0, parseInt(minsIn, 10) || 0)
    const totalMs = (d * 86400 + h * 3600 + m * 60) * 1000
    if (totalMs <= 0) return
    startCountdown(totalMs, titleInput.trim() || 'Countdown')
    setTitleInput('')
  }, [daysIn, hoursIn, minsIn, titleInput, startCountdown])

  const handleFivePM = useCallback(() => {
    const t = new Date()
    t.setHours(17, 0, 0, 0)
    if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1)
    saveCalendarCountdown({
      id: `cd_${Date.now()}`,
      title: '5:00 PM',
      targetTimestamp: t.getTime()
    })
    calendarEngine.resetCountdownNotification(null)
  }, [])

  const handleClear = useCallback(() => {
    calendarEngine.clearCountdown()
  }, [])

  return (
    <div className="cd-wrap">
      {target ? (
        <div className="cd-hero-card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                {target.title}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                {new Date(target.targetTimestamp).toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              className="calender-icon-btn"
              onClick={handleClear}
              aria-label="Cancel countdown"
            >
              <X size={14} />
            </button>
          </div>

          {isPassed ? (
            <div
              style={{
                padding: '16px 12px',
                textAlign: 'center',
                border: '1px solid var(--text-accent)',
                borderRadius: '6px',
                color: 'var(--text-accent)',
                fontWeight: 600,
                fontSize: '12.5px'
              }}
            >
              Target reached
            </div>
          ) : (
            <div className="cd-digits-grid">
              <div className="cd-digit-cell">
                <span ref={daysRef} className="cd-num">0</span>
                <span className="cd-unit">Days</span>
              </div>
              <div className="cd-digit-cell">
                <span ref={hoursRef} className="cd-num">00</span>
                <span className="cd-unit">Hours</span>
              </div>
              <div className="cd-digit-cell">
                <span ref={minsRef} className="cd-num">00</span>
                <span className="cd-unit">Mins</span>
              </div>
              <div className="cd-digit-cell">
                <span ref={secsRef} className="cd-num">00</span>
                <span className="cd-unit">Secs</span>
              </div>
            </div>
          )}

          <button
            type="button"
            className="timer-action-btn"
            style={{ width: '100%', height: 26, fontSize: '11px' }}
            onClick={handleClear}
          >
            <X size={12} />
            <span>Cancel Countdown</span>
          </button>
        </div>
      ) : (
        <div className="cd-composer">
          <input
            type="text"
            className="calender-input"
            placeholder="Event title (e.g. Launch, Exam, Break)..."
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStartCustom()}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '6px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                inputMode="numeric"
                className="alm-digit-box"
                value={daysIn}
                onChange={(e) => setDaysIn(e.target.value.replace(/\D/g, '').slice(0, 3))}
                aria-label="Days"
              />
              <span className="cd-unit">Days</span>
            </div>

            <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14 }}>:</span>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                inputMode="numeric"
                className="alm-digit-box"
                value={hoursIn}
                onChange={(e) => setHoursIn(e.target.value.replace(/\D/g, '').slice(0, 2))}
                aria-label="Hours"
              />
              <span className="cd-unit">Hours</span>
            </div>

            <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14 }}>:</span>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                inputMode="numeric"
                className="alm-digit-box"
                value={minsIn}
                onChange={(e) => setMinsIn(e.target.value.replace(/\D/g, '').slice(0, 2))}
                aria-label="Minutes"
              />
              <span className="cd-unit">Mins</span>
            </div>
          </div>

          <button
            type="button"
            className="calender-btn-accent"
            style={{ width: '100%', height: 28 }}
            onClick={handleStartCustom}
          >
            <Play size={12} />
            <span>Start Countdown</span>
          </button>
        </div>
      )}

      {/* Quick Presets */}
      <div className="calender-chip-row">
        <button type="button" className="calender-chip" onClick={() => startCountdown(30 * 60 * 1000, 'In 30m')}>
          30m
        </button>
        <button type="button" className="calender-chip" onClick={() => startCountdown(3600 * 1000, 'In 1 Hour')}>
          1h
        </button>
        <button type="button" className="calender-chip" onClick={() => startCountdown(2 * 3600 * 1000, 'In 2 Hours')}>
          2h
        </button>
        <button type="button" className="calender-chip" onClick={handleFivePM}>
          5 PM
        </button>
        <button type="button" className="calender-chip" onClick={() => startCountdown(24 * 3600 * 1000, 'Tomorrow')}>
          24h
        </button>
        <button type="button" className="calender-chip" onClick={() => startCountdown(72 * 3600 * 1000, 'In 3 Days')}>
          3d
        </button>
      </div>
    </div>
  )
})

CountdownTab.displayName = 'CountdownTab'
