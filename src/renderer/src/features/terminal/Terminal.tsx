import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Terminal as TerminalIcon,
  Plus,
  Trash2,
  X,
  ChevronDown,
  Star,
  Edit2,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { useTerminalSessions } from '../../core/terminal/useTerminalSessions'
import { TerminalPane } from './TerminalPane'
import type { TerminalSession } from '../../core/terminal/types'
import { createElectronPtyTransport, type PtyTransport } from '../../core/terminal/useTerminalInstance'
import { useSettingStore } from '../../core/store/SettingStore'

interface TerminalProps {
  /** Override transport factory (e.g. node-pty through electron IPC) */
  spawnTransport?: (session: TerminalSession) => PtyTransport
  /** Called when the user requests a full close of the whole panel */
  onClose?: () => void
  /** Optional maximize toggle callback */
  isMaximized?: boolean
  onToggleMaximize?: () => void
}

interface ShellOption {
  id: string
  label: string
  shell: string
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
              .filter((p) => p.isAvailable)
              .map((p) => ({
                id: p.id,
                label: p.label,
                shell: p.shell
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
  const [showShellDropdown, setShowShellDropdown] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [sessionListWidth, setSessionListWidth] = useState(170)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleStartSessionListResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = sessionListWidth

    document.body.classList.add('is-global-resizing')
    const appShell = document.querySelector('.app-shell')
    if (appShell) appShell.classList.add('is-resizing')

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowShellDropdown(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    setShowShellDropdown(false)
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
        flexDirection: 'row',
        height: '100%',
        width: '100%',
        minHeight: 0,
        background: '#0c0c0e',
        overflow: 'hidden',
        fontFamily: '"Cascadia Code", "Cascadia Mono", "JetBrains Mono", "Fira Code", Consolas, "SF Mono", monospace'
      }}
    >
      {/* ── Left: Sessions Sidebar Column (Header + Sessions List) ── */}
      <div
        className="lumina-term-sessions-column"
        style={{
          width: sessionListWidth,
          minWidth: sessionListWidth,
          maxWidth: sessionListWidth,
          height: '100%',
          background: 'var(--bg-sidebar, #0e0e11)',
          borderRight: '1px solid var(--border-dim, rgba(255, 255, 255, 0.08))',
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
            background: 'var(--bg-sidebar, #0e0e11)',
            borderBottom: '1px solid var(--border-dim, rgba(255, 255, 255, 0.08))',
            userSelect: 'none',
            flexShrink: 0,
            gap: 4,
            zIndex: 40
          }}
        >
          {/* Shell Dropdown Trigger */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowShellDropdown((prev) => !prev)}
              title="Select Terminal Shell"
              aria-label="Select Terminal Shell"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                borderRadius: 4,
                padding: '3px 6px',
                fontSize: 11.5,
                cursor: 'pointer',
                overflow: 'hidden',
                transition: 'all 0.12s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#f4f4f5'
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#a1a1aa'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <TerminalIcon size={12} style={{ color: '#60a5fa', flexShrink: 0 }} />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 600,
                  maxWidth: 120
                }}
              >
                {savedFavoriteShell.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') || 'Terminal'}
              </span>
              <ChevronDown size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
            </button>

            {/* Dropdown Menu */}
            {showShellDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  width: 210,
                  background: 'rgba(20, 20, 24, 0.98)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 6,
                  padding: 4,
                  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                  zIndex: 200
                }}
              >
                {availableShells.map((opt) => {
                  const currentFav = (savedFavoriteShell || '').toLowerCase()
                  const isFav =
                    currentFav === opt.id.toLowerCase() ||
                    currentFav === opt.shell.toLowerCase() ||
                    currentFav.endsWith(opt.id.toLowerCase() + '.exe') ||
                    (opt.id === 'bash' && currentFav.includes('bash')) ||
                    (opt.id === 'powershell' && currentFav.includes('powershell')) ||
                    (opt.id === 'cmd' && currentFav.includes('cmd'))

                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleSelectShell(opt.shell)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        color: isFav ? '#f4f4f5' : '#a1a1aa',
                        background: 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.1s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span style={{ fontWeight: isFav ? 500 : 400 }}>{opt.label}</span>
                      <button
                        onClick={(e) => handleSetDefaultShell(opt.shell, e)}
                        title={isFav ? 'Current Favorite (Default)' : 'Set as Favorite Shell'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                          color: isFav ? '#fbbf24' : '#52525b',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <Star size={13} fill={isFav ? '#fbbf24' : 'none'} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Plus Button: New Terminal */}
          <button
            onClick={() => handleSelectShell(savedFavoriteShell)}
            title="New Terminal"
            aria-label="New Terminal"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: 4,
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.12s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f4f4f5'
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#a1a1aa'
              e.currentTarget.style.background = 'transparent'
            }}
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

              return (
                <div
                  key={s.id}
                  role="tab"
                  aria-selected={isActive}
                  draggable={!isEditing}
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 26,
                    padding: '0 6px',
                    borderRadius: 4,
                    fontSize: 11.5,
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    marginBottom: 2,
                    color: isActive ? '#f4f4f5' : '#8a8a93',
                    background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    borderLeft: isActive ? '2px solid #8b5cf6' : '2px solid transparent',
                    fontWeight: isActive ? 500 : 400,
                    opacity: isDragging ? 0.35 : 1,
                    boxShadow: isDragOver ? '0 -1px 0 0 #8b5cf6' : undefined,
                    transition: 'background 0.1s ease, color 0.1s ease, opacity 0.1s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: s.status === 'exited' ? '#ef4444' : isActive ? '#22c55e' : 'rgba(255, 255, 255, 0.25)',
                      flexShrink: 0
                    }}
                  />
                  <TerminalIcon size={12} style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />

                  {isEditing ? (
                    <input
                      ref={inputRef}
                      value={draftName}
                      autoFocus
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
                        background: '#18181b',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        color: '#f4f4f5',
                        borderRadius: 3,
                        fontSize: 11,
                        padding: '1px 4px',
                        height: 20,
                        width: Math.max(70, sessionListWidth - 75),
                        outline: 'none'
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
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#52525b',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                        opacity: isActive ? 0.7 : 0.3
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1'
                        e.currentTarget.style.color = '#f4f4f5'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = isActive ? '0.7' : '0.3'
                        e.currentTarget.style.color = '#52525b'
                      }}
                    >
                      <Edit2 size={10} />
                    </button>
                  )}

                  {/* Delete session button */}
                  <button
                    onClick={(e) => handleCloseSession(s.id, e)}
                    title={`Delete ${s.name}`}
                    aria-label={`Close ${s.name}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#52525b',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#ef4444'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#52525b'
                    }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Resizer Knob between Sessions Strip & Terminal Viewport */}
        <div
          className="terminal-resizer left"
          title="Drag to resize sessions sidebar (double-click to reset 170px)"
          onMouseDown={handleStartSessionListResize}
          onDoubleClick={() => setSessionListWidth(170)}
        >
          <div className="resizer-knob">
            <span className="knob-dot" />
            <span className="knob-dot" />
            <span className="knob-dot" />
          </div>
        </div>

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
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: 4,
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                transition: 'all 0.12s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444'
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#a1a1aa'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Trash2 size={13} />
            </button>

            {onToggleMaximize && (
              <button
                onClick={onToggleMaximize}
                title={isMaximized ? 'Restore Terminal' : 'Maximize Terminal'}
                aria-label={isMaximized ? 'Restore Terminal' : 'Maximize Terminal'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  background: 'transparent',
                  border: 'none',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f4f4f5'
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#a1a1aa'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                title="Close Terminal (Ctrl + J)"
                aria-label="Close Terminal"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  background: 'transparent',
                  border: 'none',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f4f4f5'
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#a1a1aa'
                  e.currentTarget.style.background = 'transparent'
                }}
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
                spawnTransport={spawnTransport ?? ((sess) => createElectronPtyTransport(sess))}
                onStatus={api.setStatus}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  export default Terminal

