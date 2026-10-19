// components/terminal/TerminalPane.tsx
// A single terminal instance. Handles mounting, PTY binding, and lifecycle.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTerminalInstance, type PtyTransport } from '../../core/terminal/useTerminalInstance'
import type { TerminalSession } from '../../core/terminal/types'

interface Props {
  session: TerminalSession
  visible: boolean
  /** Factory that spawns a PTY for this session (inject your backend here) */
  spawnTransport: (session: TerminalSession) => PtyTransport
  onStatus: (id: string, status: TerminalSession['status'], code?: number) => void
}

export function TerminalPane({ session, visible, spawnTransport, onStatus }: Props) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  // Spawn the transport once per session. Recreated if the session id changes.
  const transport = useMemo(() => spawnTransport(session), [session.id, session.shell, session.cwd])

  const handleExit = useCallback(
    (code?: number) => onStatus(session.id, 'exited', code),
    [session.id, onStatus]
  )

  const { focus, fit } = useTerminalInstance({
    container,
    transport,
    onExit: handleExit
  })

  useEffect(() => {
    onStatus(session.id, 'running')
    if (visible) {
      const timer = setTimeout(() => focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [session.id, onStatus, visible, focus])

  // Refocus and re-fit when the tab transitions to visible
  const prevVisibleRef = useRef(visible)
  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => {
        fit()
        focus()
      })
    }
    prevVisibleRef.current = visible
  }, [visible, focus, fit])

  return (
    <div
      className="lumina-term-pane"
      style={{
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
        width: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        ref={setContainer}
        className="lumina-term-container"
        onClick={() => focus()}
        style={{
          flex: 1,
          minHeight: 0,
          height: '100%',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: '#0c0c0e'
        }}
      />
    </div>
  )
}
