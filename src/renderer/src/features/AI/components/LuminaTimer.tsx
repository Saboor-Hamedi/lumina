import React, { useState, useEffect, useRef } from 'react'

/**
 * Formats a duration in seconds to human-readable string (e.g., '12s', '1m 20s').
 */
export const formatLuminaTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  if (mins === 0) {
    return `${secs}s`
  }
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`
}

export interface LuminaTimerProps {
  isRunning?: boolean
}

/**
 * LuminaTimer renders elapsed time dynamically with sub-second accuracy on start.
 */
export const LuminaTimer: React.FC<LuminaTimerProps> = ({ isRunning = true }) => {
  const [elapsed, setElapsed] = useState<number>(0)
  const startTimeRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now()
      setElapsed(0)

      timerRef.current = setInterval(() => {
        const delta = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setElapsed(delta)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRunning])

  return <span>{formatLuminaTime(elapsed)}</span>
}

export default LuminaTimer
