/**
 * =========================================================================
 * Calendar TitleBar Trigger (`CalendarToggle.tsx`)
 * =========================================================================
 *
 * Minimalist Lucide icon button positioned beside ThemeToggle in TitleBar.
 * Renders Lumina's centered, borderless, slim in-app notification modal via
 * React Portal so dismissing alerts never interferes with the calendar dropdown.
 * =========================================================================
 */

import React, { useState, useEffect, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Bell } from 'lucide-react'
import ToolTip from '../../components/atoms/ToolTip'
import { calendarEngine } from './utils/calendarEngine'
import { CalendarDropdown } from './CalendarDropdown'
import './css/calendar.css'

interface CalendarAlertDetail {
  readonly title: string
  readonly body: string
  readonly timestamp: number
}

export const CalendarToggle: React.FC = memo(() => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [hasActive, setHasActive] = useState<boolean>(false)
  const [currentAlert, setCurrentAlert] = useState<CalendarAlertDetail | null>(null)

  useEffect(() => {
    calendarEngine.ensureLoop()
    const unsubStatus = calendarEngine.subscribeStatus(setHasActive)

    const handleAlert = (e: Event) => {
      const customEvent = e as CustomEvent<CalendarAlertDetail>
      if (customEvent.detail) {
        setCurrentAlert(customEvent.detail)
      }
    }

    window.addEventListener('lumina:calendar-alert', handleAlert)
    return () => {
      unsubStatus()
      window.removeEventListener('lumina:calendar-alert', handleAlert)
    }
  }, [])

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleDismissAlert = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCurrentAlert(null)
  }, [])

  const handleSnoozeAlert = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (currentAlert) {
        calendarEngine.snoozeMinutes(5, currentAlert.title)
      }
      setCurrentAlert(null)
    },
    [currentAlert]
  )

  return (
    <div className="calender-titlebar-container">
      <ToolTip text="Calendar & Timers" position="bottom">
        <button
          type="button"
          className={`calender-titlebar-btn${isOpen ? ' active' : ''}`}
          onClick={handleToggle}
          aria-label="Calendar, Timer and Alarms"
          aria-expanded={isOpen}
        >
          <Calendar size={14} strokeWidth={1.75} />
          {hasActive && <span className="calender-active-dot" />}
        </button>
      </ToolTip>

      {isOpen && <CalendarDropdown isOpen={isOpen} onClose={handleClose} />}

      {currentAlert &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="calender-center-alert-overlay"
            onClick={handleDismissAlert}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className="calender-center-alert"
              role="alertdialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="calender-center-alert-badge">
                <Bell size={15} strokeWidth={1.75} />
              </div>
              <div>
                <div className="calender-center-alert-title">{currentAlert.title}</div>
                <div className="calender-center-alert-body">{currentAlert.body}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: 4 }}>
                <button
                  type="button"
                  className="timer-action-btn"
                  style={{ flex: 1, height: 28 }}
                  onClick={handleSnoozeAlert}
                >
                  +5m Snooze
                </button>
                <button
                  type="button"
                  className="calender-center-alert-btn"
                  style={{ flex: 1, marginTop: 0 }}
                  onClick={handleDismissAlert}
                >
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
})

CalendarToggle.displayName = 'CalendarToggle'
