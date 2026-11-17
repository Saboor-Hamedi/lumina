/**
 * =========================================================================
 * High-Performance Calendar Utilities (`calendarUtils.ts`)
 * =========================================================================
 *
 * Engineered for maximum throughput & zero allocation overhead:
 * - O(1) precomputed two-digit lookup table (`PAD2`)
 * - Integer bit-packed month matrix cache (`(year << 4) | month`)
 * - Direct persistence to `app-config.json` via `useSettingStore`
 * =========================================================================
 */

import { useSettingStore } from '../../../core/store/SettingStore'

export interface CalendarEvent {
  readonly id: string
  readonly dateStr: string // YYYY-MM-DD
  readonly title: string
  readonly completed?: boolean
  readonly createdAt: number
}

export interface AlarmItem {
  readonly id: string
  readonly title: string
  readonly timeStr: string // HH:MM:SS
  readonly timestamp: number
  readonly triggered?: boolean
  readonly enabled: boolean
}

export interface CountdownTarget {
  readonly id: string
  readonly title: string
  readonly targetTimestamp: number
}

export interface MonthDayInfo {
  readonly day: number
  readonly month: number // 0-11
  readonly year: number
  readonly dateStr: string
  readonly isCurrentMonth: boolean
}

export const MONTH_NAMES: readonly string[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const SHORT_MONTH_NAMES: readonly string[] = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export const DAY_NAMES: readonly string[] = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export const FULL_DAY_NAMES: readonly string[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]

// O(1) precomputed 00-99 lookup table (eliminates string pad loops in 60fps/1s ticks)
const PAD2: readonly string[] = Array.from({ length: 100 }, (_, i) =>
  i < 10 ? `0${i}` : `${i}`
)

export function pad2(n: number): string {
  const idx = n | 0
  return idx >= 0 && idx < 100 ? PAD2[idx] : String(idx)
}

export function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

export function getTodayKey(): string {
  const d = new Date()
  return formatDateKey(d.getFullYear(), d.getMonth(), d.getDate())
}

// Flat 42-cell month cache keyed by `(year << 4) | month`
const monthCache = new Map<number, readonly MonthDayInfo[]>()

export function getMonthCells(year: number, month: number): readonly MonthDayInfo[] {
  const cacheKey = (year << 4) | month
  const cached = monthCache.get(cacheKey)
  if (cached) return cached

  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysInCurrent = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const nextMonth = month === 11 ? 0 : month + 1
  const nextYear = month === 11 ? year + 1 : year

  const cells: MonthDayInfo[] = new Array(42)
  let ptr = 0

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = daysInPrev - i
    cells[ptr++] = {
      day,
      month: prevMonth,
      year: prevYear,
      dateStr: formatDateKey(prevYear, prevMonth, day),
      isCurrentMonth: false
    }
  }

  for (let day = 1; day <= daysInCurrent; day++) {
    cells[ptr++] = {
      day,
      month,
      year,
      dateStr: formatDateKey(year, month, day),
      isCurrentMonth: true
    }
  }

  let nextDay = 1
  while (ptr < 42) {
    cells[ptr++] = {
      day: nextDay,
      month: nextMonth,
      year: nextYear,
      dateStr: formatDateKey(nextYear, nextMonth, nextDay),
      isCurrentMonth: false
    }
    nextDay++
  }

  if (monthCache.size > 48) {
    monthCache.clear()
  }
  monthCache.set(cacheKey, cells)
  return cells
}

export function formatDurationString(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds | 0)
  const h = (s / 3600) | 0
  const m = ((s % 3600) / 60) | 0
  const sec = s % 60
  return h > 0 ? `${pad2(h)}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`
}

export function formatTime12h(date: Date): string {
  let h = date.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${pad2(h)}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())} ${ampm}`
}

export function getCountdownParts(targetMs: number, nowMs: number): {
  days: number
  hours: number
  minutes: number
  seconds: number
  isPassed: boolean
} {
  const diff = targetMs - nowMs
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true }
  }
  const totalSecs = (diff / 1000) | 0
  const days = (totalSecs / 86400) | 0
  const hours = ((totalSecs % 86400) / 3600) | 0
  const minutes = ((totalSecs % 3600) / 60) | 0
  const seconds = totalSecs % 60
  return { days, hours, minutes, seconds, isPassed: false }
}

// ---- app-config.json Persistence via SettingStore ----
export function saveCalendarEvents(events: readonly CalendarEvent[]): void {
  useSettingStore.getState().updateSetting('calendarEvents', events)
}

export function saveCalendarAlarms(alarms: readonly AlarmItem[]): void {
  useSettingStore.getState().updateSetting('calendarAlarms', alarms)
}

export function saveCalendarCountdown(target: CountdownTarget | null): void {
  useSettingStore.getState().updateSetting('calendarCountdown', target)
}
