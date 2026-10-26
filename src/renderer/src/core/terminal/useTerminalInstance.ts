// components/terminal/useTerminalInstance.ts
// Binds an xterm.js instance to a DOM node and (optionally) a PTY transport.
// The transport is abstracted so you can plug in node-pty, a WebSocket, etc.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { DEFAULT_FONT_SIZE, DEFAULT_SCROLLBACK, TERMINAL_FONT, XTERM_THEME, getActiveTerminalTheme } from './constants'
import type { TerminalSession } from './types'

/** Minimal transport contract — implement for node-pty, WS, SSH, Electron IPC, etc. */
export interface PtyTransport {
  write(data: string): void
  resize(cols: number, rows: number): void
  onData(cb: (data: string) => void): () => void
  onExit(cb: (code: number) => void): () => void
  kill(): void
}

/**
 * Creates a real native shell PTY transport wired over Electron IPC,
 * with zero-fail fallback for unit tests and headless environments.
 */
export function createElectronPtyTransport(session: TerminalSession): PtyTransport {
  const api = typeof window !== 'undefined' ? (window as any).api : null

  if (!api?.terminalSpawn) {
    const dataHandlers = new Set<(d: string) => void>()
    const exitHandlers = new Set<(c: number) => void>()
    return {
      write: (data) => {
        if (data === '\r') {
          dataHandlers.forEach((h) => h('\r\n$ '))
        } else {
          dataHandlers.forEach((h) => h(data))
        }
      },
      resize: () => {},
      onData: (cb) => {
        dataHandlers.add(cb)
        setTimeout(() => cb(`Lumina Terminal [${session.name}]\r\n$ `), 20)
        return () => dataHandlers.delete(cb)
      },
      onExit: (cb) => {
        exitHandlers.add(cb)
        return () => exitHandlers.delete(cb)
      },
      kill: () => exitHandlers.forEach((h) => h(0))
    }
  }

  return {
    write: (data) => api.terminalWrite?.({ sessionId: session.id, data }),
    resize: (cols, rows) => api.terminalResize?.({ sessionId: session.id, cols, rows }),
    onData: (cb) => {
      let receivedBytes = 0

      // 1. Subscribe to live stream first so incoming data is never dropped
      const unsub = api.onTerminalData
        ? api.onTerminalData(session.id, (data: string) => {
            receivedBytes += data.length
            cb(data)
          })
        : () => {}

      // 2. Spawn / ensure process is active
      api.terminalSpawn?.({
        sessionId: session.id,
        shell: session.shell,
        cwd: session.cwd
      })
        ?.then(() => {
          // 3. Attach and replay whatever initial history or backlog was missed
          if (api.terminalAttach) {
            return api.terminalAttach(session.id)
          }
        })
        ?.then((res: any) => {
          const history: string = res?.history || ''
          if (history && history.length > receivedBytes) {
            const missed = history.slice(receivedBytes)
            receivedBytes += missed.length
            cb(missed)
          }
        })
        ?.catch((err: any) => console.error('[Terminal] spawn error:', err))

      return unsub
    },
    onExit: (cb) => (api.onTerminalExit ? api.onTerminalExit(session.id, cb) : () => {}),
    kill: () => api.terminalKill?.(session.id)
  }
}

interface Options {
  container: HTMLElement | null
  transport: PtyTransport | null
  onData?: (data: string) => void
  onExit?: (code: number) => void
  onReady?: (term: Terminal) => void
}

export function useTerminalInstance({ container, transport, onData, onExit, onReady }: Options) {
  const [term, setTerm] = useState<Terminal | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  // Mount / unmount
  useEffect(() => {
    if (!container) return

    const isWin = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('win')

    const termInstance = new Terminal({
      fontFamily: TERMINAL_FONT,
      fontSize: DEFAULT_FONT_SIZE,
      theme: getActiveTerminalTheme(),
      scrollback: DEFAULT_SCROLLBACK,
      cursorBlink: true,
      cursorStyle: 'block',
      cursorWidth: 2,
      lineHeight: 1.2,
      letterSpacing: 0,
      smoothScrollDuration: 100,
      windowsMode: isWin,
      drawBoldTextInBrightColors: true,
      allowProposedApi: true,
      convertEol: true
    } as any)
    if (isWin && (termInstance as any)?.options) {
      ;(termInstance as any).options.windowsMode = true
    }
    const fit = new FitAddon()
    termInstance.loadAddon(fit)
    termInstance.loadAddon(new WebLinksAddon())

    // Bypass xterm for global Lumina shortcuts (Ctrl+P, Ctrl+J, Ctrl+Shift+F, etc.)
    if (typeof termInstance.attachCustomKeyEventHandler === 'function') {
      termInstance.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        // Allow Ctrl+C to interrupt process unless there's an active text selection
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && !e.shiftKey && !e.altKey) {
          if (termInstance.hasSelection && termInstance.hasSelection()) {
            return false
          }
          return true
        }

        // Allow Ctrl+V to paste into terminal
        if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && !e.shiftKey && !e.altKey) {
          return true
        }

        // All other Ctrl/Cmd shortcuts pass through to window (Ctrl+P, Ctrl+J, Ctrl+B, etc.)
        if (e.ctrlKey || e.metaKey || e.key === 'F1') {
          return false
        }

        return true
      })
    }

    termInstance.open(container)
    try {
      fit.fit()
    } catch {}

    termRef.current = termInstance
    setTerm(termInstance)
    fitRef.current = fit
    onReady?.(termInstance)

    const raf = requestAnimationFrame(() => {
      try {
        fit.fit()
        const { cols, rows } = termInstance
        transport?.resize(cols, rows)
      } catch {}
    })
    const timer = setTimeout(() => {
      try {
        fit.fit()
        const { cols, rows } = termInstance
        transport?.resize(cols, rows)
      } catch {}
    }, 60)

    // Resize observer keeps xterm in sync with the container
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        try {
          fit.fit()
          const { cols, rows } = termInstance
          transport?.resize(cols, rows)
        } catch {
          /* container may be detached during teardown */
        }
      })
      ro.observe(container)
    }


    // Dynamically react to Lumina theme changes
    const applyActiveTheme = () => {
      try {
        if ((termInstance as any)?.options) {
          ;(termInstance as any).options.theme = getActiveTerminalTheme()
        }
      } catch {}
    }

    window.addEventListener('theme-changed', applyActiveTheme)
    window.addEventListener('theme-accent-changed', applyActiveTheme)

    let themeObserver: MutationObserver | null = null
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      themeObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === 'data-theme' || m.attributeName === 'style') {
            applyActiveTheme()
            break
          }
        }
      })
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'style']
      })
    }

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      ro?.disconnect()
      window.removeEventListener('theme-changed', applyActiveTheme)
      window.removeEventListener('theme-accent-changed', applyActiveTheme)
      themeObserver?.disconnect()
      termInstance.dispose()
      setTerm(null)
      fitRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container])

  // Wire transport I/O: raw bidirectional stream between xterm and shell PTY
  useEffect(() => {
    if (!term || !transport) return

    const offData = transport.onData((data) => {
      if (!data) return
      let clean = data
      if (clean.includes('cannot set terminal process group') || clean.includes('no job control in this shell')) {
        clean = clean
          .split(/\r?\n/)
          .filter((line) => !line.includes('cannot set terminal process group') && !line.includes('no job control in this shell'))
          .join('\r\n')
      }
      if (clean) {
        term.write(clean)
      }
    })

    const offExit = transport.onExit((code) => onExit?.(code))

    const sub = term.onData((data) => {
      onData?.(data)
      transport.write(data)
    })

    // Push initial size
    try {
      transport.resize(term.cols, term.rows)
    } catch {}

    return () => {
      offData()
      offExit()
      sub.dispose()
    }
  }, [term, transport, onData, onExit])

  const focus = useCallback(() => {
    termRef.current?.focus?.()
  }, [])

  const clear = useCallback(() => {
    termRef.current?.clear?.()
  }, [])

  const fit = useCallback(() => {
    try {
      if (container && container.clientWidth > 0 && container.clientHeight > 0) {
        fitRef.current?.fit?.()
        if (termRef.current && termRef.current.cols > 0 && termRef.current.rows > 0) {
          transport?.resize(termRef.current.cols, termRef.current.rows)
        }
      }
    } catch {}
  }, [container, transport])

  const refresh = useCallback(() => {
    try {
      if (termRef.current) {
        termRef.current.refresh(0, Math.max(0, termRef.current.rows - 1))
      }
    } catch {}
  }, [])

  return {
    term,
    write: (data: string) => termRef.current?.write(data),
    focus,
    clear,
    fit,
    refresh
  }
}
