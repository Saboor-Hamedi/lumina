import React, { useState, useEffect, useCallback, useRef } from 'react'

export const LazyTerminalPanel = React.lazy(async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const m = await import('../../terminal/TerminalPanel')
      return { default: m.TerminalPanel }
    } catch (err) {
      if (attempt >= 3) throw err
      await new Promise((r) => setTimeout(r, 350 * attempt))
    }
  }
  const m = await import('../../terminal/TerminalPanel')
  return { default: m.TerminalPanel }
})

export function useTerminalDock(isZenModeEnabled: boolean) {
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('lumina_terminal_open') === 'true'
      return isZenModeEnabled ? false : saved
    } catch {
      return false
    }
  })

  const [hasMountedTerminal, setHasMountedTerminal] = useState<boolean>(() => {
    try {
      return !isZenModeEnabled && localStorage.getItem('lumina_terminal_open') === 'true'
    } catch {
      return false
    }
  })

  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    try {
      const raw = Number(localStorage.getItem('lumina_terminal_height'))
      if (Number.isFinite(raw) && raw >= 120 && raw <= 600) return raw
    } catch {
      /* ignore storage errors */
    }
    return 260
  })

  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false)
  const previousTerminalHeightRef = useRef(terminalHeight)
  const wasTerminalOpenBeforeZenRef = useRef<boolean>(
    (() => {
      try {
        return isZenModeEnabled && localStorage.getItem('lumina_terminal_open') === 'true'
      } catch {
        return false
      }
    })()
  )
  const prevZenModeRef = useRef(isZenModeEnabled)

  useEffect(() => {
    if (isTerminalOpen) {
      setHasMountedTerminal(true)
    }
    if (!isZenModeEnabled) {
      try {
        localStorage.setItem('lumina_terminal_open', String(isTerminalOpen))
      } catch {
        /* ignore storage errors */
      }
    }
  }, [isTerminalOpen, isZenModeEnabled])

  useEffect(() => {
    if (!isTerminalMaximized) {
      try {
        localStorage.setItem('lumina_terminal_height', String(terminalHeight))
      } catch {
        /* ignore storage errors */
      }
    }
  }, [terminalHeight, isTerminalMaximized])

  // Hide open terminal when entering Zen Mode (without unmounting/killing sessions),
  // restore when exiting Zen Mode, and allow user to re-open it anytime during Zen Mode.
  useEffect(() => {
    const prevZen = prevZenModeRef.current
    prevZenModeRef.current = isZenModeEnabled
    if (!prevZen && isZenModeEnabled) {
      wasTerminalOpenBeforeZenRef.current = isTerminalOpen
      if (isTerminalOpen) {
        setIsTerminalOpen(false)
      }
    } else if (prevZen && !isZenModeEnabled) {
      if (wasTerminalOpenBeforeZenRef.current) {
        wasTerminalOpenBeforeZenRef.current = false
        setIsTerminalOpen(true)
      }
    }
  }, [isZenModeEnabled, isTerminalOpen])

  const isTerminalVisible = isTerminalOpen

  const handleToggleTerminal = useCallback(() => {
    setIsTerminalOpen((prev) => !prev)
  }, [])

  const handleToggleTerminalMaximize = useCallback(() => {
    setIsTerminalMaximized((prev) => {
      if (!prev) {
        previousTerminalHeightRef.current = terminalHeight
        return true
      } else {
        setTerminalHeight(previousTerminalHeightRef.current || 260)
        return false
      }
    })
  }, [terminalHeight])

  const handleStartTerminalResize = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startY = e.clientY
      const startH = terminalHeight

      if (isTerminalMaximized) {
        setIsTerminalMaximized(false)
      }

      const centerWorkspace = document.querySelector('.shell-center-workspace')
      const totalH = centerWorkspace ? centerWorkspace.clientHeight : window.innerHeight
      const minH = 120
      const maxH = Math.max(minH, totalH - 60)

      document.body.classList.add('is-terminal-resizing')
      const appShell = document.querySelector('.app-shell')
      if (appShell) appShell.classList.add('is-resizing')

      const onPointerMove = (ev: MouseEvent | PointerEvent) => {
        const delta = startY - ev.clientY
        const nextH = Math.max(minH, Math.min(maxH, Math.round(startH + delta)))
        setTerminalHeight(nextH)
        previousTerminalHeightRef.current = nextH
      }
      const onPointerUp = () => {
        document.body.classList.remove('is-terminal-resizing')
        if (appShell) appShell.classList.remove('is-resizing')
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerUp)
        window.removeEventListener('mousemove', onPointerMove)
        window.removeEventListener('mouseup', onPointerUp)
      }
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
      window.addEventListener('mousemove', onPointerMove, { passive: true })
      window.addEventListener('mouseup', onPointerUp)
    },
    [terminalHeight, isTerminalMaximized]
  )

  return {
    isTerminalOpen,
    setIsTerminalOpen,
    hasMountedTerminal,
    terminalHeight,
    setTerminalHeight,
    isTerminalMaximized,
    isTerminalVisible,
    handleToggleTerminal,
    handleToggleTerminalMaximize,
    handleStartTerminalResize
  }
}
