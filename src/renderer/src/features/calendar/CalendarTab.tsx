/**
 * =========================================================================
 * Calendar Tab Component (`CalendarTab.tsx`)
 * =========================================================================
 *
 * Next-gen Google Calendar-style drill-down navigation:
 * - Days view with O(1) cached 42-cell grid + keyboard navigation
 * - Click Month/Year title -> 3x4 Month Picker showing date ranges & task counts
 * - Click Year title -> 3x4 Year Picker
 * - Toggle between Selected Day tasks and All Upcoming tasks
 * - Persists tasks directly in `app-config.json` via `useSettingStore`
 * =========================================================================
 */

import React, { useState, useMemo, useCallback, memo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react'
import { useSettingStore } from '../../core/store/SettingStore'
import {
  MONTH_NAMES,
  SHORT_MONTH_NAMES,
  DAY_NAMES,
  getMonthCells,
  getTodayKey,
  formatDateKey,
  pad2,
  saveCalendarEvents,
  type CalendarEvent
} from './utils/calendarUtils'

type PickerMode = 'days' | 'months' | 'years'
const EMPTY_EVENTS: readonly CalendarEvent[] = []

export const CalendarTab: React.FC = memo(() => {
  const todayKey = useMemo(() => getTodayKey(), [])
  const nowObj = useMemo(() => new Date(), [])

  const [viewYear, setViewYear] = useState<number>(() => nowObj.getFullYear())
  const [viewMonth, setViewMonth] = useState<number>(() => nowObj.getMonth())
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayKey)
  const [pickerMode, setPickerMode] = useState<PickerMode>('days')
  const [showAllUpcoming, setShowAllUpcoming] = useState<boolean>(false)
  const [newEventText, setNewEventText] = useState<string>('')

  const events = useSettingStore(
    (s) => (s.settings?.calendarEvents as readonly CalendarEvent[] | undefined) || EMPTY_EVENTS
  )

  const cells = useMemo(() => getMonthCells(viewYear, viewMonth), [viewYear, viewMonth])

  // O(1) lookup by dateStr + month task counts
  const { eventsByDate, monthTaskCounts } = useMemo(() => {
    const byDate = new Map<string, CalendarEvent[]>()
    const byMonth = new Map<string, number>()

    for (let i = 0; i < events.length; i++) {
      const ev = events[i]
      let bucket = byDate.get(ev.dateStr)
      if (!bucket) {
        bucket = []
        byDate.set(ev.dateStr, bucket)
      }
      bucket.push(ev)

      const ymKey = ev.dateStr.slice(0, 7) // YYYY-MM
      byMonth.set(ymKey, (byMonth.get(ymKey) || 0) + 1)
    }
    return { eventsByDate: byDate, monthTaskCounts: byMonth }
  }, [events])

  const displayedEvents = useMemo(() => {
    if (!showAllUpcoming) {
      return eventsByDate.get(selectedDateStr) || EMPTY_EVENTS
    }
    return [...events]
      .filter((e) => !e.completed)
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
  }, [showAllUpcoming, eventsByDate, selectedDateStr, events])

  const handleJumpToday = useCallback(() => {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    setSelectedDateStr(getTodayKey())
    setPickerMode('days')
    setShowAllUpcoming(false)
  }, [])

  const handlePrev = useCallback(() => {
    if (pickerMode === 'days') {
      setViewMonth((m) => {
        if (m === 0) {
          setViewYear((y) => y - 1)
          return 11
        }
        return m - 1
      })
    } else if (pickerMode === 'months') {
      setViewYear((y) => y - 1)
    } else {
      setViewYear((y) => y - 12)
    }
  }, [pickerMode])

  const handleNext = useCallback(() => {
    if (pickerMode === 'days') {
      setViewMonth((m) => {
        if (m === 11) {
          setViewYear((y) => y + 1)
          return 0
        }
        return m + 1
      })
    } else if (pickerMode === 'months') {
      setViewYear((y) => y + 1)
    } else {
      setViewYear((y) => y + 12)
    }
  }, [pickerMode])

  const handleTitleClick = useCallback(() => {
    setPickerMode((prev) => {
      if (prev === 'days') return 'months'
      if (prev === 'months') return 'years'
      return 'days'
    })
  }, [])

  const handleSelectMonth = useCallback((monthIdx: number) => {
    setViewMonth(monthIdx)
    setPickerMode('days')
  }, [])

  const handleSelectYear = useCallback((yr: number) => {
    setViewYear(yr)
    setPickerMode('months')
  }, [])

  const handleDayClick = useCallback((dateStr: string, year: number, month: number) => {
    setSelectedDateStr(dateStr)
    setViewYear(year)
    setViewMonth(month)
    setShowAllUpcoming(false)
  }, [])

  // Keyboard navigation on day grid
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const shiftMap: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -7,
        ArrowDown: 7
      }
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        handleJumpToday()
        return
      }
      const delta = shiftMap[e.key]
      if (!delta) return
      e.preventDefault()
      const [y, m, d] = selectedDateStr.split('-').map(Number)
      const next = new Date(y, m - 1, d + delta)
      setViewYear(next.getFullYear())
      setViewMonth(next.getMonth())
      setSelectedDateStr(formatDateKey(next.getFullYear(), next.getMonth(), next.getDate()))
    },
    [selectedDateStr, handleJumpToday]
  )

  const handleAddEvent = useCallback(() => {
    const trimmed = newEventText.trim()
    if (!trimmed) return

    const next: CalendarEvent = {
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      dateStr: selectedDateStr,
      title: trimmed,
      completed: false,
      createdAt: Date.now()
    }
    saveCalendarEvents([...events, next])
    setNewEventText('')
  }, [newEventText, selectedDateStr, events])

  const handleToggleEvent = useCallback(
    (id: string) => {
      saveCalendarEvents(events.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e)))
    },
    [events]
  )

  const handleDeleteEvent = useCallback(
    (id: string) => {
      saveCalendarEvents(events.filter((e) => e.id !== id))
    },
    [events]
  )

  const yearWindowStart = viewYear - 4
  const yearRange = useMemo(
    () => Array.from({ length: 12 }, (_, i) => yearWindowStart + i),
    [yearWindowStart]
  )

  const headerLabel =
    pickerMode === 'days'
      ? `${MONTH_NAMES[viewMonth]} ${viewYear}`
      : pickerMode === 'months'
        ? `${viewYear}`
        : `${yearWindowStart} – ${yearWindowStart + 11}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Navigation */}
      <div className="calender-month-nav">
        <button
          type="button"
          className="calender-title-trigger"
          onClick={handleTitleClick}
          title="Switch month or year"
        >
          <span>{headerLabel}</span>
          <ChevronDown
            size={13}
            style={{
              transform: pickerMode === 'days' ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.12s ease',
              color: 'var(--text-muted)'
            }}
          />
        </button>

        <div className="calender-nav-actions">
          <button type="button" className="calender-today-pill" onClick={handleJumpToday}>
            Today
          </button>
          <button type="button" className="calender-icon-btn" onClick={handlePrev} aria-label="Previous">
            <ChevronLeft size={14} />
          </button>
          <button type="button" className="calender-icon-btn" onClick={handleNext} aria-label="Next">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Mode 1: 3x4 Months Grid (Date Range + Task Count) */}
      {pickerMode === 'months' && (
        <div className="calender-picker-grid">
          {SHORT_MONTH_NAMES.map((mName, idx) => {
            const daysCount = new Date(viewYear, idx + 1, 0).getDate()
            const ymKey = `${viewYear}-${pad2(idx + 1)}`
            const count = monthTaskCounts.get(ymKey) || 0
            return (
              <button
                key={mName}
                type="button"
                className={`calender-picker-cell${idx === viewMonth ? ' current' : ''}`}
                onClick={() => handleSelectMonth(idx)}
              >
                <span>{mName}</span>
                <span className="calender-picker-sub">
                  1–{daysCount}
                  {count > 0 ? ` · ${count}` : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Mode 2: 3x4 Years Grid */}
      {pickerMode === 'years' && (
        <div className="calender-picker-grid">
          {yearRange.map((yr) => (
            <button
              key={yr}
              type="button"
              className={`calender-picker-cell${yr === viewYear ? ' current' : ''}`}
              onClick={() => handleSelectYear(yr)}
            >
              {yr}
            </button>
          ))}
        </div>
      )}

      {/* Mode 3: Days Grid + Tasks */}
      {pickerMode === 'days' && (
        <>
          <div className="calender-grid-header">
            {DAY_NAMES.map((d) => (
              <div key={d} className="calender-grid-th">
                {d}
              </div>
            ))}
          </div>

          <div className="calender-grid-days" onKeyDown={handleGridKeyDown}>
            {cells.map((cell) => {
              const isSelected = cell.dateStr === selectedDateStr
              const isTodayCell = cell.dateStr === todayKey
              const hasEvents = eventsByDate.has(cell.dateStr)
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  className={`calender-day-cell${cell.isCurrentMonth ? '' : ' other-month'}${
                    isTodayCell ? ' is-today' : ''
                  }${isSelected ? ' selected' : ''}`}
                  onClick={() => handleDayClick(cell.dateStr, cell.year, cell.month)}
                >
                  <span>{cell.day}</span>
                  {hasEvents && <span className="calender-day-dot" />}
                </button>
              )
            })}
          </div>

          <div className="calender-events-section">
            <div className="calender-events-header">
              <span>{showAllUpcoming ? 'All Pending Tasks' : `Tasks · ${selectedDateStr}`}</span>
              <button
                type="button"
                onClick={() => setShowAllUpcoming((v) => !v)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-accent)',
                  fontSize: '10.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {showAllUpcoming ? 'Selected Day' : `All (${events.filter((e) => !e.completed).length})`}
              </button>
            </div>

            {!showAllUpcoming && (
              <div className="calender-input-row">
                <input
                  type="text"
                  className="calender-input"
                  placeholder="Add note or task..."
                  value={newEventText}
                  onChange={(e) => setNewEventText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEvent()}
                />
                <button
                  type="button"
                  className="calender-btn-accent"
                  onClick={handleAddEvent}
                  aria-label="Add task"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}

            <div className="calender-list">
              {displayedEvents.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>
                  {showAllUpcoming ? 'No pending tasks' : 'No tasks for this day'}
                </div>
              ) : (
                displayedEvents.map((item) => (
                  <div
                    key={item.id}
                    className={`calender-list-item${item.completed ? ' completed' : ''}`}
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1, minWidth: 0 }}
                      onClick={() => handleToggleEvent(item.id)}
                    >
                      {item.completed ? (
                        <CheckSquare size={13} style={{ color: 'var(--text-accent)', flexShrink: 0 }} />
                      ) : (
                        <Square size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      )}
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {showAllUpcoming ? `${item.dateStr.slice(5)} · ${item.title}` : item.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="calender-icon-btn"
                      style={{ width: 20, height: 20 }}
                      onClick={() => handleDeleteEvent(item.id)}
                      aria-label="Delete task"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
})

CalendarTab.displayName = 'CalendarTab'
