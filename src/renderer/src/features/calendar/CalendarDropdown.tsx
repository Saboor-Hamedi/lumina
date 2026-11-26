/**
 * =========================================================================
 * Calendar Dropdown Component (`CalendarDropdown.tsx`)
 * =========================================================================
 *
 * Slim, fixed-height dropdown featuring:
 * - Social-profile artistic cover header with 3 selectable cover themes
 * - User's round avatar & name on the left + zero-re-render LiveClock on right
 * - Hairline underline tabs & fixed-height body
 * =========================================================================
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Calendar as CalendarIcon, Timer as TimerIcon, Hourglass, Bell, User } from 'lucide-react'
import { useCurrentUser } from '../../core/hooks/useCurrentUser'
import { useSettingStore } from '../../core/store/SettingStore'
import { CalendarTab } from './CalendarTab'
import { TimerTab } from './TimerTab'
import { CountdownTab } from './CountdownTab'
import { AlarmTab } from './AlarmTab'
import { FULL_DAY_NAMES, MONTH_NAMES, pad2 } from './utils/calendarUtils'
import './css/calendar.css'

export type CalendarSubTab = 'calendar' | 'timer' | 'countdown' | 'alarm'

interface CalendarDropdownProps {
  isOpen: boolean
  onClose: () => void
}

const COVER_INDICES: readonly number[] = [0, 1, 2]

/**
 * Isolated LiveClock that mutates DOM refs directly every 1000ms.
 * Causes ZERO React reconciliation cycles on the parent dropdown.
 */
const LiveClock: React.FC = memo(() => {
  const mainRef = useRef<HTMLSpanElement>(null)
  const secRef = useRef<HTMLSpanElement>(null)
  const ampmRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const syncClock = () => {
      const now = new Date()
      let h = now.getHours()
      const ampm = h >= 12 ? 'PM' : 'AM'
      h = h % 12 || 12

      if (mainRef.current) mainRef.current.textContent = `${pad2(h)}:${pad2(now.getMinutes())}`
      if (secRef.current) secRef.current.textContent = `:${pad2(now.getSeconds())}`
      if (ampmRef.current) ampmRef.current.textContent = ampm
    }

    syncClock()
    const id = window.setInterval(syncClock, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="calender-clock-right">
      <div className="calender-clock-row">
        <span ref={mainRef} className="calender-clock-main">--:--</span>
        <span ref={secRef} className="calender-clock-sec">:--</span>
        <span ref={ampmRef} className="calender-clock-ampm">--</span>
      </div>
    </div>
  )
})
LiveClock.displayName = 'LiveClock'

export const CalendarDropdown: React.FC<CalendarDropdownProps> = memo(({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<CalendarSubTab>('calendar')
  const [imgError, setImgError] = useState<boolean>(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { user, isLoggedIn } = useCurrentUser()
  const persistedCover = useSettingStore((s) => (s.settings?.calendarCoverTheme as number | undefined) ?? 0)
  const [coverTheme, setCoverTheme] = useState<number>(persistedCover)

  useEffect(() => {
    setCoverTheme(persistedCover)
  }, [persistedCover])

  useEffect(() => {
    setImgError(false)
  }, [user?.picture])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      // Never close calendar when interacting with the centered notification modal or trigger button
      if (
        target.closest?.('.calender-titlebar-btn') ||
        target.closest?.('.calender-center-alert-overlay')
      ) {
        return
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('pointerdown', handleClickOutside, { capture: true })
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, { capture: true })
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleSelectCover = useCallback((idx: number) => {
    setCoverTheme(idx)
    queueMicrotask(() => {
      useSettingStore.getState().updateSetting('calendarCoverTheme', idx)
    })
  }, [])

  if (!isOpen) return null

  const now = new Date()
  const dateSubtitle = `${FULL_DAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`
  const displayName = (() => {
    if (!isLoggedIn || !user) return 'Lumina'
    if (user.name && user.name.trim()) {
      const parts = user.name.trim().split(/\s+/)
      return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0]
    }
    if (user.email) {
      const local = user.email.split('@')[0].replace(/\d+/g, '').replace(/[._-]+/g, ' ').trim()
      return local || 'Lumina'
    }
    return 'Lumina'
  })()

  return (
    <div
      className="calender-dropdown-menu"
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Artistic Cover Header with Social Profile + 3 Swatches + LiveClock */}
      <div className={`calender-cover-header calender-cover--${coverTheme % 3}`}>
        <div className="calender-cover-swatches" role="group" aria-label="Cover background themes">
          {COVER_INDICES.map((idx) => (
            <button
              key={idx}
              type="button"
              className={`calender-cover-swatch calender-cover-swatch--${idx}${
                coverTheme % 3 === idx ? ' active' : ''
              }`}
              onClick={() => handleSelectCover(idx)}
              aria-label={`Cover theme ${idx + 1}`}
            />
          ))}
        </div>

        <div className="calender-profile-left">
          <div className="calender-avatar-round">
            {isLoggedIn && user?.picture && !imgError ? (
              <img
                src={user.picture}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <User size={16} strokeWidth={1.75} />
            )}
          </div>
          <div className="calender-profile-meta">
            <span className="calender-profile-name">{displayName}</span>
            <span className="calender-header-date">{dateSubtitle}</span>
          </div>
        </div>

        <LiveClock />
      </div>

      {/* Slim Hairline Underline Tabs */}
      <div className="calender-tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'calendar'}
          className={`calender-tab-btn${activeTab === 'calendar' ? ' active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <CalendarIcon size={12} strokeWidth={1.75} />
          <span>Calendar</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'timer'}
          className={`calender-tab-btn${activeTab === 'timer' ? ' active' : ''}`}
          onClick={() => setActiveTab('timer')}
        >
          <TimerIcon size={12} strokeWidth={1.75} />
          <span>Timer</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'countdown'}
          className={`calender-tab-btn${activeTab === 'countdown' ? ' active' : ''}`}
          onClick={() => setActiveTab('countdown')}
        >
          <Hourglass size={12} strokeWidth={1.75} />
          <span>Countdown</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'alarm'}
          className={`calender-tab-btn${activeTab === 'alarm' ? ' active' : ''}`}
          onClick={() => setActiveTab('alarm')}
        >
          <Bell size={12} strokeWidth={1.75} />
          <span>Alarms</span>
        </button>
      </div>

      {/* Fixed-Height Body — never resizes across tabs */}
      <div className="calender-body">
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'timer' && <TimerTab />}
        {activeTab === 'countdown' && <CountdownTab />}
        {activeTab === 'alarm' && <AlarmTab />}
      </div>
    </div>
  )
})

CalendarDropdown.displayName = 'CalendarDropdown'
