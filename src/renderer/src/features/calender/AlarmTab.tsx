/**
 * =========================================================================
 * Alarm Tab Component (`AlarmTab.tsx`)
 * =========================================================================
 *
 * Sleek alarm scheduler with:
 * - Spinner-free numeric inputs + 1-tap quick duration chips
 * - iOS/Linear pill toggle switches
 * - Purposeful 1-tap reminder templates when alarm list is empty
 * - `app-config.json` persistence & background `calendarEngine` execution
 * =========================================================================
 */

import React, { useState, useCallback, memo } from 'react'
import { Plus, Bell, Trash2, Volume2 } from 'lucide-react'
import { useSettingStore } from '../../core/store/SettingStore'
import { pad2, saveCalendarAlarms, type AlarmItem } from './utils/calendarUtils'
import { calendarEngine } from './utils/calendarEngine'
import { playAlarmSound } from './utils/alarmSound'

const EMPTY_ALARMS: readonly AlarmItem[] = []

const QUICK_TEMPLATES: readonly { readonly title: string; readonly minutes: number }[] = [
  { title: 'Eye Rest (20m)', minutes: 20 },
  { title: 'Stand & Stretch (30m)', minutes: 30 },
  { title: 'Deep Work Check (45m)', minutes: 45 },
  { title: 'Hydrate (60m)', minutes: 60 }
]

export const AlarmTab: React.FC = memo(() => {
  const alarms = useSettingStore(
    (s) => (s.settings?.calendarAlarms as readonly AlarmItem[] | undefined) || EMPTY_ALARMS
  )

  const [alarmTitle, setAlarmTitle] = useState<string>('')
  const [hours, setHours] = useState<string>('00')
  const [minutes, setMinutes] = useState<string>('15')
  const [seconds, setSeconds] = useState<string>('00')
  const [mode, setMode] = useState<'relative' | 'specific'>('relative')

  const createAlarm = useCallback(
    (h: number, m: number, s: number, customTitle?: string, forceRelative = false) => {
      const useRelative = forceRelative || mode === 'relative'
      let targetTimestamp = 0
      let timeStr = ''

      if (useRelative) {
        const totalMs = (h * 3600 + m * 60 + s) * 1000
        if (totalMs <= 0) return
        targetTimestamp = Date.now() + totalMs
        const d = new Date(targetTimestamp)
        timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
      } else {
        const now = new Date()
        const target = new Date()
        target.setHours(h % 24, m, s, 0)
        if (target.getTime() <= now.getTime()) {
          target.setDate(target.getDate() + 1)
        }
        targetTimestamp = target.getTime()
        timeStr = `${pad2(h % 24)}:${pad2(m)}:${pad2(s)}`
      }

      const nextAlarm: AlarmItem = {
        id: `alm_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        title: (customTitle ?? alarmTitle).trim() || 'Reminder',
        timeStr,
        timestamp: targetTimestamp,
        enabled: true,
        triggered: false
      }

      saveCalendarAlarms([nextAlarm, ...alarms])
      calendarEngine.ensureLoop()
    },
    [mode, alarmTitle, alarms]
  )

  const handleAddAlarm = useCallback(() => {
    const h = Math.max(0, parseInt(hours, 10) || 0)
    const m = Math.max(0, Math.min(59, parseInt(minutes, 10) || 0))
    const s = Math.max(0, Math.min(59, parseInt(seconds, 10) || 0))
    createAlarm(h, m, s)
    setAlarmTitle('')
  }, [hours, minutes, seconds, createAlarm])

  const handleFillDuration = useCallback((mins: number) => {
    setMode('relative')
    const h = Math.floor(mins / 60)
    const m = mins % 60
    setHours(pad2(h))
    setMinutes(pad2(m))
    setSeconds('00')
  }, [])

  const handleToggleAlarm = useCallback(
    (id: string) => {
      saveCalendarAlarms(
        alarms.map((a) => (a.id === id ? { ...a, enabled: !a.enabled, triggered: false } : a))
      )
      calendarEngine.ensureLoop()
    },
    [alarms]
  )

  const handleDeleteAlarm = useCallback(
    (id: string) => {
      saveCalendarAlarms(alarms.filter((a) => a.id !== id))
      calendarEngine.ensureLoop()
    },
    [alarms]
  )

  return (
    <div className="alm-wrap">
      <div className="alm-composer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.4px' }}>
            {mode === 'relative' ? 'RING IN (H : M : S)' : 'RING AT (HH : MM : SS)'}
          </span>
          <button
            type="button"
            className="calender-chip"
            style={{ fontSize: '10px', padding: '1px 7px' }}
            onClick={() => setMode((m) => (m === 'relative' ? 'specific' : 'relative'))}
          >
            {mode === 'relative' ? 'Exact Time' : 'Duration'}
          </button>
        </div>

        <div className="alm-time-hero">
          <input
            type="text"
            inputMode="numeric"
            className="alm-digit-box"
            value={hours}
            onChange={(e) => setHours(e.target.value.replace(/\D/g, '').slice(0, 2))}
            aria-label="Hours"
          />
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>:</span>
          <input
            type="text"
            inputMode="numeric"
            className="alm-digit-box"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))}
            aria-label="Minutes"
          />
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>:</span>
          <input
            type="text"
            inputMode="numeric"
            className="alm-digit-box"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))}
            aria-label="Seconds"
          />
        </div>

        {mode === 'relative' && (
          <div className="calender-chip-row">
            <button type="button" className="calender-chip" onClick={() => handleFillDuration(5)}>
              5m
            </button>
            <button type="button" className="calender-chip" onClick={() => handleFillDuration(15)}>
              15m
            </button>
            <button type="button" className="calender-chip" onClick={() => handleFillDuration(30)}>
              30m
            </button>
            <button type="button" className="calender-chip" onClick={() => handleFillDuration(60)}>
              1h
            </button>
          </div>
        )}

        <div className="calender-input-row" style={{ marginBottom: 0 }}>
          <input
            type="text"
            className="calender-input"
            placeholder="Alarm label..."
            value={alarmTitle}
            onChange={(e) => setAlarmTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAlarm()}
          />
          <button
            type="button"
            className="calender-btn-accent"
            onClick={handleAddAlarm}
            aria-label="Add alarm"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="alm-list-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: '6px',
            letterSpacing: '0.4px'
          }}
        >
          <span>{alarms.length > 0 ? `ALARMS (${alarms.length})` : '1-TAP REMINDERS'}</span>
          <button
            type="button"
            onClick={playAlarmSound}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-accent)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              fontSize: '10.5px',
              fontWeight: 500
            }}
          >
            <Volume2 size={12} />
            <span>Test</span>
          </button>
        </div>

        <div className="calender-list">
          {alarms.length === 0 ? (
            QUICK_TEMPLATES.map((tpl) => (
              <div
                key={tpl.title}
                className="calender-list-item"
                style={{ cursor: 'pointer' }}
                onClick={() => createAlarm(0, tpl.minutes, 0, tpl.title, true)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Bell size={12} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--text-main)' }}>{tpl.title}</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-accent)', fontWeight: 600 }}>
                  + Set
                </span>
              </div>
            ))
          ) : (
            alarms.map((alarm) => (
              <div
                key={alarm.id}
                className="calender-list-item"
                style={{ opacity: alarm.enabled && !alarm.triggered ? 1 : 0.5 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <Bell
                    size={12}
                    style={{
                      color: alarm.enabled && !alarm.triggered ? 'var(--text-accent)' : 'var(--text-muted)',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {alarm.timeStr}
                    </div>
                    <div
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {alarm.title}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={alarm.enabled}
                    className={`calender-switch${alarm.enabled ? ' on' : ''}`}
                    onClick={() => handleToggleAlarm(alarm.id)}
                  >
                    <span className="calender-switch-thumb" />
                  </button>
                  <button
                    type="button"
                    className="calender-icon-btn"
                    style={{ width: 20, height: 20 }}
                    onClick={() => handleDeleteAlarm(alarm.id)}
                    aria-label="Delete alarm"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
})

AlarmTab.displayName = 'AlarmTab'
