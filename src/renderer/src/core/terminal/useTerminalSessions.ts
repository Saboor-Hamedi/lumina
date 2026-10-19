// components/terminal/useTerminalSessions.ts
// Pure state manager for terminal sessions. No UI, no xterm — just data.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CreateSessionInput, SessionStatus, TerminalSession } from './types'
import { detectDefaultShell, MAX_SESSIONS } from './constants'

import { useSettingStore } from '../store/SettingStore'

const STORAGE_KEY = 'lumina_terminal_sessions'
const STORAGE_ACTIVE_KEY = 'lumina_terminal_active_session'

let counter = 0
const uid = () => `sess_${Date.now()}_${counter++}`

function getWorkspaceCwd(): string {
  try {
    const settings = (useSettingStore.getState().settings as any) || {}
    return settings.workspacePath || settings.vaultPath || (typeof process !== 'undefined' && process.cwd ? process.cwd() : '~')
  } catch {
    return '~'
  }
}

function getDefaultShell(): string {
  try {
    const settings = (useSettingStore.getState().settings as any) || {}
    return settings.defaultTerminalShell || detectDefaultShell()
  } catch {
    return detectDefaultShell()
  }
}

function createInitialSession(): TerminalSession {
  const shell = getDefaultShell()
  const shellName = shell.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') || 'terminal'
  return {
    id: uid(),
    name: `1: ${shellName}`,
    shell,
    cwd: getWorkspaceCwd(),
    status: 'idle',
    createdAt: Date.now()
  }
}

function loadSavedSessions(): { sessions: TerminalSession[]; activeId: string | null } {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const savedActive = localStorage.getItem(STORAGE_ACTIVE_KEY)
          const validActive = parsed.some((s) => s.id === savedActive) ? savedActive : parsed[0].id
          return {
            sessions: parsed.map((s) => ({ ...s, status: 'idle' })),
            activeId: validActive
          }
        }
      }
    }
  } catch {}
  const init = createInitialSession()
  return { sessions: [init], activeId: init.id }
}

export function useTerminalSessions() {
  const [initialState] = useState(() => loadSavedSessions())
  const [sessions, setSessions] = useState<TerminalSession[]>(initialState.sessions)
  const [activeId, setActiveId] = useState<string | null>(initialState.activeId)

  // Persist sessions whenever they change
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined' && sessions.length > 0) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(sessions.map(({ id, name, shell, cwd, createdAt }) => ({ id, name, shell, cwd, createdAt })))
        )
        if (activeId) {
          localStorage.setItem(STORAGE_ACTIVE_KEY, activeId)
        }
      }
    } catch {}
  }, [sessions, activeId])

  /** Stable ref so callbacks can read the latest sessions without re-subscribing */
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  const create = useCallback((input: CreateSessionInput = {}) => {
    if (sessionsRef.current.length >= MAX_SESSIONS) return null

    const shell = input.shell ?? getDefaultShell()
    const shellName = shell.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') || 'terminal'

    // Calculate the next unused positive integer index (1, 2, 3...)
    const usedNums = new Set<number>()
    sessionsRef.current.forEach((s) => {
      const match = s.name.match(/^(\d+):/)
      if (match) usedNums.add(parseInt(match[1], 10))
    })
    let nextNum = 1
    while (usedNums.has(nextNum)) {
      nextNum++
    }

    const base = input.name ?? `${nextNum}: ${shellName}`
    const session: TerminalSession = {
      id: uid(),
      name: base,
      shell,
      cwd: input.cwd ?? getWorkspaceCwd(),
      status: 'idle',
      createdAt: Date.now()
    }

    setSessions((prev) => [...prev, session])
    setActiveId(session.id)
    return session
  }, [])

  const rename = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)))
  }, [])

  const setStatus = useCallback((id: string, status: SessionStatus, exitCode?: number) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, exitCode: exitCode ?? s.exitCode } : s))
    )
  }, [])

  const close = useCallback((id: string) => {
    if (typeof window !== 'undefined' && (window as any).api?.terminalKill) {
      (window as any).api.terminalKill(id)
    }
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id)
      if (idx === -1) return prev
      const next = prev.filter((s) => s.id !== id)
      if (next.length === 0) {
        const fresh = createInitialSession()
        setActiveId(fresh.id)
        return [fresh]
      }
      setActiveId((current) => {
        if (current !== id) return current
        return next[Math.min(idx, next.length - 1)]?.id ?? next[0].id
      })
      return next
    })
  }, [])

  const duplicate = useCallback(
    (id: string) => {
      const source = sessionsRef.current.find((s) => s.id === id)
      if (!source) return
      return create({ name: `${source.name} (copy)`, shell: source.shell, cwd: source.cwd })
    },
    [create]
  )

  const closeAll = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).api?.terminalKill) {
      sessionsRef.current.forEach((s) => (window as any).api.terminalKill(s.id))
    }
    setSessions([])
    setActiveId(null)
  }, [])

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? null,
    [sessions, activeId]
  )

  const reorderSessions = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return
    setSessions((prev) => {
      const sourceIdx = prev.findIndex((s) => s.id === sourceId)
      const targetIdx = prev.findIndex((s) => s.id === targetId)
      if (sourceIdx === -1 || targetIdx === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(sourceIdx, 1)
      next.splice(targetIdx, 0, moved)
      return next
    })
  }, [])

  return {
    sessions,
    activeId,
    activeSession,
    create,
    rename,
    close,
    closeAll,
    duplicate,
    setStatus,
    setActiveId,
    reorderSessions
  }
}

export type TerminalSessionsApi = ReturnType<typeof useTerminalSessions>
