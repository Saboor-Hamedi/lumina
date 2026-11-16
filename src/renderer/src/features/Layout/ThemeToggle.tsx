/**
 * ThemeToggle.tsx
 *
 * Title-bar theme switcher (dark ⇆ parchment).
 * Features a borderless, focus-free 22px circular sky scene with clouds (day),
 * stars (night), and a smoothly rotating sun/moon knob.
 * Matches the profile button dimensions (32px hit target, 22px round circle).
 */

import React, { useCallback } from 'react'
import { useTheme } from '../theme/hooks/useTheme'
import ToolTip from '../../components/atoms/ToolTip'

const LIGHT_THEMES = new Set(['light', 'parchment', 'porcelain', 'rosePineDawn'])

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme()
  const isNight = !LIGHT_THEMES.has(theme)

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const currentDomTheme =
        (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) ||
        theme
      const nextTheme = LIGHT_THEMES.has(currentDomTheme) ? 'dark' : 'parchment'

      setTheme(nextTheme, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      })
    },
    [theme, setTheme]
  )

  return (
    <div className="theme-titlebar-container">
      <ToolTip
        text={isNight ? 'Switch to Parchment' : 'Switch to Dark'}
        position="bottom"
      >
        <button
          type="button"
          role="switch"
          aria-checked={isNight}
          aria-label={isNight ? 'Switch to Parchment' : 'Switch to Dark'}
          className="theme-titlebar-btn"
          onClick={handleClick}
        >
          <span
            className={`theme-titlebar-sky-circle ${isNight ? 'is-night' : 'is-day'}`}
            data-state={isNight ? 'night' : 'day'}
            aria-hidden="true"
          >
            {/* Sky layers */}
            <span className="theme-sky-layer theme-sky-layer--day" />
            <span className="theme-sky-layer theme-sky-layer--night" />

            {/* Night stars */}
            <span className="theme-sky-stars">
              <span className="theme-sky-star theme-sky-star--1" />
              <span className="theme-sky-star theme-sky-star--2" />
              <span className="theme-sky-star theme-sky-star--3" />
            </span>

            {/* Day clouds */}
            <span className="theme-sky-clouds">
              <span className="theme-sky-cloud theme-sky-cloud--back" />
              <span className="theme-sky-cloud theme-sky-cloud--front" />
            </span>

            {/* Rotating Sun / Moon knob */}
            <span className={`theme-titlebar-knob ${isNight ? 'is-night' : 'is-day'}`}>
              <span className="theme-knob-orb theme-knob-orb--sun" />
              <span className="theme-knob-orb theme-knob-orb--moon">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" stroke="none">
                  <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z" />
                </svg>
              </span>
            </span>
          </span>
        </button>
      </ToolTip>
    </div>
  )
}
