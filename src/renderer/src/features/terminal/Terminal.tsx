import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Terminal as TerminalIcon,
  Plus,
  Trash2,
  X,
  Edit2,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { useTerminalSessions } from '../../core/terminal/useTerminalSessions'
import { TerminalPane } from './TerminalPane'
import { TerminalProfile, type ShellOption } from './TerminalProfile'
import type { TerminalSession } from '../../core/terminal/types'
import { createTauriPtyTransport, type PtyTransport } from '../../core/terminal/useTerminalInstance'
import { useSettingStore } from '../../core/store/SettingStore'

interface TerminalProps {
  /** Override transport factory (e.g. Tauri portable-pty over IPC) */
  spawnTransport?: (session: TerminalSession) => PtyTransport
  /** Called when the user requests a full close of the whole panel */
  onClose?: () => void
  /** Optional maximize toggle callback */
  isMaximized?: boolean
  onToggleMaximize?: () => void
}

export function Terminal({
  spawnTransport,
  onClose,
  isMaximized = false,
  onToggleMaximize
}: TerminalProps) {
  const api = useTerminalSessions()
  const settings = useSettingStore((state) => state.settings as any)
  const updateSettings = useSettingStore((state) => state.updateSettings)

  const isWin = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('win')
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')

  const defaultShellList: ShellOption[] = isWin
    ? [
        { id: 'bash', label: 'Git Bash', shell: 'bash.exe' },
        { id: 'powershell', label: 'PowerShell', shell: 'powershell.exe' },
        { id: 'cmd', label: 'Command Prompt', shell: 'cmd.exe' }
      ]
    : isMac
      ? [
          { id: 'zsh', label: 'Zsh', shell: '/bin/zsh' },
          { id: 'bash', label: 'Bash', shell: '/bin/bash' }
        ]
      : [
          { id: 'bash', label: 'Bash', shell: '/bin/bash' },
          { id: 'zsh', label: 'Zsh', shell: '/bin/zsh' }
        ]

  const [availableShells, setAvailableShells] = useState<ShellOption[]>(defaultShellList)

  useEffect(() => {
    const apiBridge = typeof window !== 'undefined' ? (window as any).api : null
    if (apiBridge?.terminalGetAvailableShells) {
      apiBridge
        .terminalGetAvailableShells()
        .then((profiles: any[]) => {
          if (Array.isArray(profiles) && profiles.length > 0) {
            // Keep active and functional shells
            const mapped: ShellOption[] = profiles
              .filter((p) => p && p.isAvailable !== false && (p.shell || p.path))
              .map((p) => ({
                id: p.id,
                label: p.label,
                shell: p.shell || p.path
              }))
            if (mapped.length > 0) {
              setAvailableShells(mapped)
            }
          }
        })
        .catch(() => {})
    }
  }, [])

  const savedFavoriteShell = settings?.defaultTerminalShell || (isWin ? 'bash.exe' : isMac ? '/bin/zsh' : '/bin/bash')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [sessionListWidth, setSessionListWidth] = useState(170)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleStartSessionListResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = sessionListWidth

    document.body.classList.add('is-global-resizing')
    const appShell = document.querySelector('.app-shell')
    if (appShell) appShell.classList.add('is-resizing')

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX
      const nextW = Math.max(120, Math.min(350, startW + delta))
      setSessionListWidth(nextW)
    }
    const onMouseUp = () => {
      document.body.classList.remove('is-global-resizing')
      if (appShell) appShell.classList.remove('is-resizing')
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [sessionListWidth])

  useEffect(() => {
    if (editingId) {
      inputRef.current?.select()
    }
  }, [editingId])

  const handleStartRename = (id: string, currentName: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingId(id)
    setDraftName(currentName)
  }

  const handleCommitRename = (id: string) => {
    if (draftName.trim()) {
      api.rename(id, draftName.trim())
    }
    setEditingId(null)
  }

  const handleSelectShell = (shell: string, asDefault: boolean = false) => {
    if (asDefault) {
      updateSettings({ defaultTerminalShell: shell } as any)
    }
    api.create({ shell })
  }

  const handleSetDefaultShell = (shell: string, e: React.MouseEvent) => {
    e.stopPropagation()
    updateSettings({ defaultTerminalShell: shell } as any)
  }

  const handleKillActiveTerminal = () => {
    if (!api.activeId) return
    const isSingleSession = api.sessions.length <= 1
    api.close(api.activeId)
    if (isSingleSession) {
      onClose?.()
    }
  }

  const handleCloseSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const isSingleSession = api.sessions.length <= 1
    api.close(id)
    if (isSingleSession) {
      onClose?.()
    }
  }

  return (
    <div
      className="lumina-terminal"
      style={{
        display: 'flex',
        flexDirection: 'row-reverse',
        height: '100%',
        width: '100%',
        minHeight: 0,
        background: 'var(--bg-editor, var(--bg-app, #0c0c0e))',
        overflow: 'hidden',
        fontFamily: 'var(--editor-font-family, var(--font-editor, "JetBrains Mono", "Fira Code", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Consolas, monospace))'
      }}
    >
      {/* ── Right: Sessions Sidebar Column (Header + Sessions List) ── */}
      <div
        className="lumina-term-sessions-column"
        style={{
          width: sessionListWidth,
          minWidth: sessionListWidth,
          maxWidth: sessionListWidth,
          height: '100%',
          background: 'var(--bg-editor, var(--bg-app, #0c0c0e))',
          borderLeft: '1px solid var(--border-dim, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        {/* Session Header (Shell Selector Dropdown + Plus Button) */}
        <div
          className="lumina-term-session-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 32,
            minHeight: 32,
            padding: '0 8px',
            background: 'var(--bg-editor, var(--bg-app, #0c0c0e))',
            borderBottom: '1px solid var(--border-dim, rgba(255, 255, 255, 0.08))',
            userSelect: 'none',
            flexShrink: 0,
            gap: 4,
            zIndex: 40
          }}
        >
          {/* Shell Profile Selector Dropdown */}
          <TerminalProfile
            availableShells={availableShells}
            savedFavoriteShell={savedFavoriteShell}
            onSelectShell={handleSelectShell}
            onSetDefaultShell={handleSetDefaultShell}
          />

          {/* Plus Button: New Terminal */}
          <button
            onClick={() => handleSelectShell(savedFavoriteShell)}
            title="New Terminal"
            aria-label="New Terminal"
            className="lumina-term-icon-btn lumina-term-icon-btn--sm"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Sessions List Items */}
        <div
          className="lumina-term-sessions-list premium-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '4px'
          }}
        >
          {api.sessions.map((s) => {
              const isActive = s.id === api.activeId
              const isEditing = editingId === s.id
              const isDragging = draggingId === s.id
              const isDragOver = dragOverId === s.id

              const itemClass = [
                'lumina-term-session-item',
                isActive ? 'is-active' : '',
                isDragging ? 'is-dragging' : '',
                isDragOver ? 'is-drag-over' : ''
              ]
                .filter(Boolean)
                .join(' ')

              const dotClass = [
                'lumina-term-session-dot',
                s.status === 'exited' ? 'is-exited' : isActive ? 'is-active' : ''
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <div
                  key={s.id}
                  role="tab"
                  aria-selected={isActive}
                  draggable={!isEditing}
                  className={itemClass}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', s.id)
                    e.dataTransfer.effectAllowed = 'move'
                    setDraggingId(s.id)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    if (dragOverId !== s.id) setDragOverId(s.id)
                  }}
                  onDragLeave={() => {
                    if (dragOverId === s.id) setDragOverId(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const sourceId = e.dataTransfer.getData('text/plain') || draggingId
                    if (sourceId && sourceId !== s.id) {
                      api.reorderSessions(sourceId, s.id)
                    }
                    setDraggingId(null)
                    setDragOverId(null)
                  }}
                  onDragEnd={() => {
                    setDraggingId(null)
                    setDragOverId(null)
                  }}
                  onClick={() => api.setActiveId(s.id)}
                  onDoubleClick={(e) => handleStartRename(s.id, s.name, e)}
                >
                  <span className={dotClass} />
                  <TerminalIcon size={12} style={{ opacity: isActive ? 1 : 0.65, flexShrink: 0 }} />

                  {isEditing ? (
                    <input
                      ref={inputRef}
                      value={draftName}
                      autoFocus
                      className="lumina-term-rename-input"
                      onChange={(e) => {
                        e.stopPropagation()
                        e.nativeEvent?.stopImmediatePropagation?.()
                        setDraftName(e.target.value)
                      }}
                      onBlur={() => handleCommitRename(s.id)}
                      onKeyDown={(e) => {
                        e.stopPropagation()
                        e.nativeEvent?.stopImmediatePropagation?.()
                        if (e.key === 'Enter') handleCommitRename(s.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: Math.max(70, sessionListWidth - 75)
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={s.name}
                    >
                      {s.name}
                    </span>
                  )}

                  {/* Rename pencil button */}
                  {!isEditing && (
                    <button
                      onClick={(e) => handleStartRename(s.id, s.name, e)}
                      title="Rename"
                      aria-label={`Rename ${s.name}`}
                      className="lumina-term-session-action"
                    >
                      <Edit2 size={10} />
                    </button>
                  )}

                  {/* Delete session button */}
                  <button
                    onClick={(e) => handleCloseSession(s.id, e)}
                    title={`Delete ${s.name}`}
                    aria-label={`Close ${s.name}`}
                    className="lumina-term-session-action lumina-term-session-action--danger"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Resizer between Sessions Strip & Terminal Viewport */}
        <div
          className="terminal-resizer left"
          title="Drag to resize sessions sidebar (double-click to reset 170px)"
          onMouseDown={handleStartSessionListResize}
          onDoubleClick={() => setSessionListWidth(170)}
        />

        {/* Right: Active Terminal Viewport Column (Header + Viewport) */}
        <div
          className="lumina-term-viewport-column"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--bg-editor, #0c0c0e)'
          }}
        >
          {/* Viewport Header (Actions: Trash/Kill, Maximize, Close) */}
          <div
            className="lumina-term-viewport-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              height: 32,
              minHeight: 32,
              padding: '0 8px',
              background: 'var(--bg-editor, #0c0c0e)',
              borderBottom: '1px solid var(--border-dim, rgba(255, 255, 255, 0.08))',
              userSelect: 'none',
              flexShrink: 0,
              gap: 3,
              zIndex: 40
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }} />

            <button
              onClick={handleKillActiveTerminal}
              title={api.sessions.length <= 1 ? 'Kill and Close Terminal' : 'Kill Terminal'}
              aria-label="Kill Terminal"
              className="lumina-term-icon-btn lumina-term-icon-btn--danger"
            >
              <Trash2 size={13} />
            </button>

            {onToggleMaximize && (
              <button
                onClick={onToggleMaximize}
                title={isMaximized ? 'Restore Terminal' : 'Maximize Terminal'}
                aria-label={isMaximized ? 'Restore Terminal' : 'Maximize Terminal'}
                className="lumina-term-icon-btn"
              >
                {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                title="Close Terminal (Ctrl + J)"
                aria-label="Close Terminal"
                className="lumina-term-icon-btn"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Viewport Content */}
          <div
            className="lumina-term-panes-wrapper"
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {api.sessions.map((s) => (
              <TerminalPane
                key={s.id}
                session={s}
                visible={s.id === api.activeId}
                spawnTransport={spawnTransport ?? createTauriPtyTransport}
                onStatus={api.setStatus}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  export default Terminal

