/**
 * =========================================================================
 * Unified Background Calendar & Time Engine (`calendarEngine.ts`)
 * =========================================================================
 *
 * Singleton engine decoupled from React's render tree:
 * - Drives Focus Timer, Target Countdown, and Scheduled Alarms in one shared loop
 * - Fires in-app notifications immediately even when the dropdown is closed
 * - Runs at 0% CPU when idle (interval auto-clears when nothing is active)
 * =========================================================================
 */

import { useSettingStore } from '../../../core/store/SettingStore'
import { notifyUser } from './notificationService'
import {
  saveCalendarAlarms,
  saveCalendarCountdown,
  formatTime12h,
  type AlarmItem,
  type CountdownTarget
} from './calendarUtils'

export interface TimerSnapshot {
  readonly initialSeconds: number
  readonly remainingSeconds: number
  readonly isRunning: boolean
}

type TimerListener = (snapshot: TimerSnapshot) => void
type StatusListener = (hasActive: boolean) => void

class CalendarEngine {
  private initialSeconds = 25 * 60
  private remainingSeconds = 25 * 60
  private isRunning = false
  private endTimeMs = 0
  private intervalId: number | null = null
  private notifiedCountdownId: string | null = null

  private timerListeners = new Set<TimerListener>()
  private statusListeners = new Set<StatusListener>()

  public getTimerSnapshot(): TimerSnapshot {
    return {
      initialSeconds: this.initialSeconds,
      remainingSeconds: this.remainingSeconds,
      isRunning: this.isRunning
    }
  }

  public hasActiveWork(): boolean {
    if (this.isRunning) return true
    const settings = useSettingStore.getState().settings
    const alarms = (settings?.calendarAlarms as readonly AlarmItem[] | undefined) || []
    if (alarms.some((a) => a.enabled && !a.triggered)) return true

    const cd = settings?.calendarCountdown as CountdownTarget | null | undefined
    if (cd && cd.id !== this.notifiedCountdownId && cd.targetTimestamp > Date.now() - 5000) {
      return true
    }
    return false
  }

  public subscribeTimer(fn: TimerListener): () => void {
    this.timerListeners.add(fn)
    fn(this.getTimerSnapshot())
    return () => {
      this.timerListeners.delete(fn)
    }
  }

  public subscribeStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn)
    fn(this.hasActiveWork())
    return () => {
      this.statusListeners.delete(fn)
    }
  }

  private emitTimer(): void {
    const snap = this.getTimerSnapshot()
    this.timerListeners.forEach((fn) => fn(snap))
  }

  private emitStatus(): void {
    const active = this.hasActiveWork()
    this.statusListeners.forEach((fn) => fn(active))
  }

  public resetCountdownNotification(id: string | null): void {
    this.notifiedCountdownId = id
    this.ensureLoop()
  }

  public ensureLoop(): void {
    const active = this.hasActiveWork()
    this.emitStatus()

    if (active && this.intervalId === null) {
      this.intervalId = window.setInterval(() => this.tick(), 250)
    } else if (!active && this.intervalId !== null) {
      window.clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  private tick(): void {
    const now = Date.now()

    // 1. Timer tick
    if (this.isRunning) {
      const left = Math.max(0, Math.round((this.endTimeMs - now) / 1000))
      if (left !== this.remainingSeconds) {
        this.remainingSeconds = left
        this.emitTimer()
      }
      if (left <= 0) {
        this.isRunning = false
        this.emitTimer()
        notifyUser({
          title: 'Timer Complete',
          body: 'Your focus session has finished.',
          playSound: true
        })
      }
    }

    const settings = useSettingStore.getState().settings

    // 2. Background Countdown check (fires even when dropdown is closed!)
    const cd = settings?.calendarCountdown as CountdownTarget | null | undefined
    if (cd && cd.id !== this.notifiedCountdownId && now >= cd.targetTimestamp) {
      this.notifiedCountdownId = cd.id
      notifyUser({
        title: `Countdown Complete: ${cd.title}`,
        body: 'Your target time has been reached.',
        playSound: true
      })
    }

    // 3. Alarms check
    const alarms = (settings?.calendarAlarms as readonly AlarmItem[] | undefined) || []
    if (alarms.length > 0) {
      let changed = false
      const nextAlarms = alarms.map((alarm) => {
        if (alarm.enabled && !alarm.triggered && now >= alarm.timestamp) {
          changed = true
          notifyUser({
            title: `Alarm: ${alarm.title || 'Reminder'}`,
            body: `Scheduled for ${alarm.timeStr}`,
            playSound: true
          })
          return { ...alarm, triggered: true, enabled: false }
        }
        return alarm
      })

      if (changed) {
        saveCalendarAlarms(nextAlarms)
      }
    }

    if (!this.hasActiveWork()) {
      this.ensureLoop()
    }
  }

  public startTimer(): void {
    if (this.remainingSeconds <= 0) return
    this.isRunning = true
    this.endTimeMs = Date.now() + this.remainingSeconds * 1000
    this.emitTimer()
    this.ensureLoop()
  }

  public pauseTimer(): void {
    if (!this.isRunning) return
    this.isRunning = false
    this.emitTimer()
    this.ensureLoop()
  }

  public resetTimer(): void {
    this.isRunning = false
    this.remainingSeconds = this.initialSeconds
    this.emitTimer()
    this.ensureLoop()
  }

  public setPreset(seconds: number): void {
    this.isRunning = false
    this.initialSeconds = seconds
    this.remainingSeconds = seconds
    this.emitTimer()
    this.ensureLoop()
  }

  public addSeconds(delta: number): void {
    const next = Math.max(0, this.remainingSeconds + delta)
    this.remainingSeconds = next
    if (!this.isRunning) {
      this.initialSeconds = next
    } else {
      this.endTimeMs += delta * 1000
    }
    this.emitTimer()
  }

  public snoozeMinutes(mins: number, label = 'Snoozed Reminder'): void {
    const targetTimestamp = Date.now() + mins * 60 * 1000
    const timeStr = formatTime12h(new Date(targetTimestamp))
    const settings = useSettingStore.getState().settings
    const alarms = (settings?.calendarAlarms as readonly AlarmItem[] | undefined) || []
    const snoozeAlarm: AlarmItem = {
      id: `alm_snooze_${Date.now()}`,
      title: label,
      timeStr,
      timestamp: targetTimestamp,
      enabled: true,
      triggered: false
    }
    saveCalendarAlarms([snoozeAlarm, ...alarms])
    this.ensureLoop()
  }

  public clearCountdown(): void {
    this.notifiedCountdownId = null
    saveCalendarCountdown(null)
    this.ensureLoop()
  }
}

export const calendarEngine = new CalendarEngine()
