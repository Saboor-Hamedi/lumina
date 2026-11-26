import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  DAY_NAMES,
  MONTH_NAMES,
  SHORT_MONTH_NAMES,
  getMonthCells,
  getTodayKey
} from '../../../calendar/utils/calendarUtils'

export interface CalendarDatePickerProps {
  value: string
  label: string
  onChange: (nextDate: string) => void
}

function parseIsoDate(raw: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((raw || '').trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  return { year, month, day }
}

function formatReadableDate(raw: string): string {
  const parsed = parseIsoDate(raw)
  if (!parsed) return ''
  return `${SHORT_MONTH_NAMES[parsed.month]} ${parsed.day}, ${parsed.year}`
}

export const CalendarDatePicker: React.FC<CalendarDatePickerProps> = React.memo(
  ({ value, label, onChange }) => {
    const todayKey = useMemo(() => getTodayKey(), [])
    const parsed = useMemo(() => parseIsoDate(value), [value])
    const [open, setOpen] = useState(false)
    const [viewYear, setViewYear] = useState<number>(
      () => parsed?.year ?? new Date().getFullYear()
    )
    const [viewMonth, setViewMonth] = useState<number>(
      () => parsed?.month ?? new Date().getMonth()
    )
    const rootRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
      if (parsed) {
        setViewYear(parsed.year)
        setViewMonth(parsed.month)
      }
    }, [parsed])

    useEffect(() => {
      if (!open) return
      const onPointerDown = (e: MouseEvent) => {
        const target = e.target as Node | null
        if (target && rootRef.current && !rootRef.current.contains(target)) {
          setOpen(false)
        }
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false)
      }
      document.addEventListener('mousedown', onPointerDown, true)
      window.addEventListener('keydown', onKeyDown)
      return () => {
        document.removeEventListener('mousedown', onPointerDown, true)
        window.removeEventListener('keydown', onKeyDown)
      }
    }, [open])

    const cells = useMemo(() => getMonthCells(viewYear, viewMonth), [viewYear, viewMonth])
    const displayText = formatReadableDate(value)

    const handlePrevMonth = () => {
      if (viewMonth === 0) {
        setViewYear((y) => y - 1)
        setViewMonth(11)
      } else {
        setViewMonth((m) => m - 1)
      }
    }

    const handleNextMonth = () => {
      if (viewMonth === 11) {
        setViewYear((y) => y + 1)
        setViewMonth(0)
      } else {
        setViewMonth((m) => m + 1)
      }
    }

    return (
      <div className="meta-date-picker" ref={rootRef}>
        <button
          type="button"
          className={`meta-date-trigger ${displayText ? 'has-value' : ''}`}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
        >
          <CalendarIcon size={12} className="meta-date-trigger-icon" />
          <span>{displayText || 'Pick a date'}</span>
        </button>

        {displayText && (
          <button
            type="button"
            className="meta-date-clear-inline"
            title="Clear date"
            aria-label={`Clear ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              onChange('')
            }}
          >
            <X size={11} />
          </button>
        )}

        {open && (
          <div className="meta-calendar-popover" role="dialog" aria-label={`${label} calendar`}>
            <div className="meta-cal-header">
              <button
                type="button"
                className="meta-cal-nav"
                aria-label="Previous month"
                onClick={handlePrevMonth}
              >
                <ChevronLeft size={14} />
              </button>
              <span className="meta-cal-title">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                className="meta-cal-nav"
                aria-label="Next month"
                onClick={handleNextMonth}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="meta-cal-weekdays">
              {DAY_NAMES.map((d) => (
                <span key={d} className="meta-cal-weekday">
                  {d}
                </span>
              ))}
            </div>

            <div className="meta-cal-grid">
              {cells.map((cell) => {
                const isSelected = value === cell.dateStr
                const isToday = cell.dateStr === todayKey
                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    className={`meta-cal-cell ${cell.isCurrentMonth ? '' : 'is-other'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      onChange(cell.dateStr)
                      setOpen(false)
                    }}
                  >
                    {cell.day}
                  </button>
                )
              })}
            </div>

            <div className="meta-cal-footer">
              <button
                type="button"
                className="meta-cal-action"
                onClick={() => {
                  onChange(todayKey)
                  setOpen(false)
                }}
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  className="meta-cal-action is-muted"
                  onClick={() => {
                    onChange('')
                    setOpen(false)
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
)

CalendarDatePicker.displayName = 'CalendarDatePicker'
