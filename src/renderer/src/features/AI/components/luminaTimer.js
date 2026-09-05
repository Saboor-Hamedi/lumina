import React, { useState, useEffect, useRef } from 'react'

export const formatLuminaTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(s / 60)
  const secs = s % 60
  if (mins === 0) {
    return `${secs}s`
  }
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`
}

export const LuminaTimer = ({ isRunning = true }) => {
  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef(Date.now())
  const timerRef = useRef(null)

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

  return React.createElement('span', null, formatLuminaTime(elapsed))
}

export default LuminaTimer
