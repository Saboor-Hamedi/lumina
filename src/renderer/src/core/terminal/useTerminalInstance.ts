// components/terminal/useTerminalInstance.ts
// Binds an xterm.js instance to a DOM node and (optionally) a PTY transport.
// The transport is abstracted so you can plug in node-pty, a WebSocket, etc.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_SCROLLBACK,
  getActiveTerminalFontFamily,
  getActiveTerminalTheme
} from './constants'
import type { TerminalSession } from './types'

/** Minimal transport contract — implement for Tauri PTY (portable-pty), WS, SSH, etc. */
export interface PtyTransport {
  write(data: string): void
  resize(cols: number, rows: number): void
  onData(cb: (data: string) => void, initialSize?: { cols: number; rows: number }): () => void
  onExit(cb: (code: number) => void): () => void
  kill(): void
}

/**
 * Creates a real native shell PTY transport wired over Tauri IPC,
 * with zero-fail fallback for unit tests and headless environments.
 */
export function createTauriPtyTransport(session: TerminalSession): PtyTransport {
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
    onData: (cb, initialSize) => {
      let receivedBytes = 0

      // 1. Subscribe to live stream first so incoming data is never dropped
      const unsub = api.onTerminalData
        ? api.onTerminalData(session.id, (data: string) => {
            receivedBytes += data.length
            cb(data)
          })
        : () => {}

      // 2. Spawn / ensure process is active using the actual fitted viewport cols/rows
      // so Windows ConPTY doesn't spawn at 24 rows and flush blank lines on initial resize
      api.terminalSpawn?.({
        sessionId: session.id,
        shell: session.shell,
        cwd: session.cwd,
        cols: initialSize?.cols && initialSize.cols >= 10 ? initialSize.cols : undefined,
        rows: initialSize?.rows && initialSize.rows >= 2 ? initialSize.rows : undefined
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
  const transportRef = useRef<PtyTransport | null>(transport)
  const onDataRef = useRef(onData)
  const onExitRef = useRef(onExit)
  const lastSizeRef = useRef<{ cols: number; rows: number }>({ cols: 0, rows: 0 })
  const syncScrollRef = useRef<(() => void) | null>(null)

  transportRef.current = transport
  onDataRef.current = onData
  onExitRef.current = onExit

  const sendResizeIfChanged = useCallback((cols: number, rows: number) => {
    if (cols <= 0 || rows <= 0) return
    if (lastSizeRef.current.cols === cols && lastSizeRef.current.rows === rows) return
    lastSizeRef.current = { cols, rows }
    try {
      transportRef.current?.resize(cols, rows)
    } catch {}
  }, [])

  // Mount / unmount
  useEffect(() => {
    if (!container) return

    lastSizeRef.current = { cols: 0, rows: 0 }

    const initialRows =
      container.clientHeight > 40 ? Math.max(2, Math.floor(container.clientHeight / 16)) : 12
    const initialCols =
      container.clientWidth > 80 ? Math.max(10, Math.floor((container.clientWidth - 8) / 8)) : 80

    const initialFontFamily = getActiveTerminalFontFamily()

    const termInstance = new Terminal({
      cols: initialCols,
      rows: initialRows,
      fontFamily: initialFontFamily,
      fontSize: DEFAULT_FONT_SIZE,
      theme: getActiveTerminalTheme(),
      scrollback: DEFAULT_SCROLLBACK,
      cursorBlink: true,
      cursorStyle: 'block',
      cursorWidth: 2,
      lineHeight: 1.2,
      letterSpacing: 0,
      smoothScrollDuration: 0,
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 4,
      scrollSensitivity: 1,
      overviewRuler: { width: 8 },
      windowsMode: false,
      drawBoldTextInBrightColors: true,
      allowProposedApi: true,
      convertEol: false
    } as any)
    const fit = new FitAddon()
    termInstance.loadAddon(fit)
    termInstance.loadAddon(new WebLinksAddon())

    // Sync scrollbar visibility & fix @xterm/xterm@6.0.0 Viewport._sync bottom-gap desync
    let scrollSyncRaf = 0
    const applyScrollSync = () => {
      scrollSyncRaf = 0
      try {
        const activeBuf = termInstance.buffer?.active
        if (!activeBuf) return
        const hasScrollback = activeBuf.baseY > 0
        container.classList.toggle('lumina-term-has-scrollback', hasScrollback)

        const core = (termInstance as any)._core
        const viewport = core?.viewport
        const scrollableEl = viewport?._scrollableElement
        const cellHeight = core?._renderService?.dimensions?.css?.cell?.height
        if (scrollableEl && cellHeight > 0) {
          const isAtBottom = activeBuf.viewportY >= activeBuf.baseY
          if (!hasScrollback || isAtBottom) {
            const targetScrollTop = hasScrollback ? activeBuf.baseY * cellHeight : 0
            const pos = scrollableEl.getScrollPosition?.()
            if (!pos || Math.abs(pos.scrollTop - targetScrollTop) > 1) {
              viewport._isSyncing = true
              viewport._suppressOnScrollHandler = true
              scrollableEl.setScrollPosition({ scrollTop: targetScrollTop })
              viewport._suppressOnScrollHandler = false
              viewport._isSyncing = false
            }
          }
        }
      } catch {}
    }

    const scheduleScrollSync = () => {
      if (scrollSyncRaf) return
      scrollSyncRaf = requestAnimationFrame(applyScrollSync)
    }
    syncScrollRef.current = scheduleScrollSync

    // Prevent mouse wheel from wobbling a non-scrollable viewport when there is no scrollback
    if (typeof termInstance.attachCustomWheelEventHandler === 'function') {
      termInstance.attachCustomWheelEventHandler(() => {
        const activeBuf = termInstance.buffer?.active
        if (!activeBuf) return true
        const mouseMode = termInstance.modes?.mouseTrackingMode
        if (activeBuf.type === 'normal' && activeBuf.baseY === 0 && (!mouseMode || mouseMode === 'none')) {
          return false
        }
        return true
      })
    }

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
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        fit.fit()
      }
      // Clear any empty rows pushed into scrollback during initial fit so a fresh tab has zero scrollback
      termInstance.clear?.()
      applyScrollSync()
    } catch {}

    const disposables: Array<{ dispose: () => void }> = []
    if (typeof termInstance.onWriteParsed === 'function') {
      disposables.push(termInstance.onWriteParsed(scheduleScrollSync))
    }
    if (typeof termInstance.onScroll === 'function') {
      disposables.push(termInstance.onScroll(scheduleScrollSync))
    }
    if (typeof termInstance.onResize === 'function') {
      disposables.push(termInstance.onResize(scheduleScrollSync))
    }
    if (typeof termInstance.onLineFeed === 'function') {
      disposables.push(termInstance.onLineFeed(scheduleScrollSync))
    }

    termRef.current = termInstance
    setTerm(termInstance)
    fitRef.current = fit
    onReady?.(termInstance)

    const raf = requestAnimationFrame(() => {
      try {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          fit.fit()
          sendResizeIfChanged(termInstance.cols, termInstance.rows)
          applyScrollSync()
        }
      } catch {}
    })

    // Resize observer keeps xterm in sync with the container (RAF-batched fit + debounced PTY IPC)
    let ro: ResizeObserver | null = null
    let resizeRaf = 0
    let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        if (resizeRaf) return
        resizeRaf = requestAnimationFrame(() => {
          resizeRaf = 0
          try {
            if (container.clientWidth <= 0 || container.clientHeight <= 0) return
            fit.fit()
            scheduleScrollSync()
            const { cols, rows } = termInstance
            if (cols > 0 && rows > 0) {
              if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer)
              resizeDebounceTimer = setTimeout(() => {
                resizeDebounceTimer = null
                sendResizeIfChanged(cols, rows)
              }, 40)
            }
          } catch {
            /* container may be detached during teardown */
          }
        })
      })
      ro.observe(container)
    }

    // Dynamically react to Lumina theme and unified Editor font changes
    let currentFontFamily = initialFontFamily
    const applyActiveFont = () => {
      try {
        const nextFont = getActiveTerminalFontFamily()
        if (nextFont !== currentFontFamily && (termInstance as any)?.options) {
          currentFontFamily = nextFont
          ;(termInstance as any).options.fontFamily = nextFont
          if (container.clientWidth > 0 && container.clientHeight > 0) {
            fit.fit()
            sendResizeIfChanged(termInstance.cols, termInstance.rows)
            scheduleScrollSync()
          }
        }
      } catch {}
    }

    const applyActiveTheme = () => {
      try {
        if ((termInstance as any)?.options) {
          ;(termInstance as any).options.theme = getActiveTerminalTheme()
        }
      } catch {}
      applyActiveFont()
    }

    window.addEventListener('theme-changed', applyActiveTheme)
    window.addEventListener('theme-accent-changed', applyActiveTheme)
    window.addEventListener('caret-style-update', applyActiveFont)

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
      if (scrollSyncRaf) cancelAnimationFrame(scrollSyncRaf)
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer)
      ro?.disconnect()
      window.removeEventListener('theme-changed', applyActiveTheme)
      window.removeEventListener('theme-accent-changed', applyActiveTheme)
      window.removeEventListener('caret-style-update', applyActiveFont)
      themeObserver?.disconnect()
      disposables.forEach((d) => {
        try {
          d.dispose()
        } catch {}
      })
      syncScrollRef.current = null
      termInstance.dispose()
      termRef.current = null
      setTerm(null)
      fitRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container])

  // Wire transport I/O: RAF-batched bidirectional stream between xterm and shell PTY
  useEffect(() => {
    if (!term || !transport) return

    let pendingChunks: string[] = []
    let pendingLen = 0
    let flushRaf = 0

    const flushWrites = () => {
      flushRaf = 0
      if (pendingChunks.length === 0) return
      const batch = pendingChunks.length === 1 ? pendingChunks[0] : pendingChunks.join('')
      pendingChunks = []
      pendingLen = 0
      term.write(batch)
    }

    const enqueueWrite = (chunk: string) => {
      pendingChunks.push(chunk)
      pendingLen += chunk.length
      if (pendingLen >= 65536) {
        if (flushRaf) {
          cancelAnimationFrame(flushRaf)
          flushRaf = 0
        }
        flushWrites()
        return
      }
      if (!flushRaf) {
        flushRaf = requestAnimationFrame(flushWrites)
      }
    }

    const initialCols = term.cols > 0 ? term.cols : 80
    const initialRows = term.rows > 0 ? term.rows : 12
    lastSizeRef.current = { cols: initialCols, rows: initialRows }

    const offData = transport.onData(
      (data) => {
        if (!data) return
        let clean = data
        if (clean.includes('cannot set terminal process group') || clean.includes('no job control in this shell')) {
          clean = clean
            .split(/\r?\n/)
            .filter((line) => !line.includes('cannot set terminal process group') && !line.includes('no job control in this shell'))
            .join('\r\n')
        }
        if (clean) {
          enqueueWrite(clean)
        }
      },
      { cols: initialCols, rows: initialRows }
    )

    const offExit = transport.onExit((code) => onExitRef.current?.(code))

    const sub = term.onData((data) => {
      onDataRef.current?.(data)
      transport.write(data)
    })

    return () => {
      if (flushRaf) cancelAnimationFrame(flushRaf)
      pendingChunks = []
      pendingLen = 0
      offData()
      offExit()
      sub.dispose()
    }
  }, [term, transport])

  const focus = useCallback(() => {
    termRef.current?.focus?.()
  }, [])

  const clear = useCallback(() => {
    termRef.current?.clear?.()
    syncScrollRef.current?.()
  }, [])

  const fit = useCallback(() => {
    try {
      if (container && container.clientWidth > 0 && container.clientHeight > 0) {
        fitRef.current?.fit?.()
        if (termRef.current && termRef.current.cols > 0 && termRef.current.rows > 0) {
          sendResizeIfChanged(termRef.current.cols, termRef.current.rows)
        }
        syncScrollRef.current?.()
      }
    } catch {}
  }, [container, sendResizeIfChanged])

  const refresh = useCallback(() => {
    try {
      if (termRef.current) {
        termRef.current.refresh(0, Math.max(0, termRef.current.rows - 1))
        syncScrollRef.current?.()
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
