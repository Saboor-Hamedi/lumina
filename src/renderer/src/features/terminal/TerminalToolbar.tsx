// components/terminal/TerminalToolbar.tsx
// Right-side session controls: rename, kill, delete, close, duplicate.

import { useEffect, useRef, useState } from 'react'
import type { SessionAction, TerminalSession } from '../../core/terminal/types'

interface Props {
  session: TerminalSession
  onAction: (action: SessionAction, value?: string) => void
}

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border-dim, #27272a)',
  color: 'var(--text-muted, #a1a1aa)',
  borderRadius: 6,
  padding: '5px 10px',
  fontSize: 12,
  cursor: 'pointer',
  transition: 'all .12s ease'
}

export function TerminalToolbar({ session, onAction }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(session.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(session.name)
  }, [session.name, session.id])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    if (draft.trim()) onAction('rename', draft.trim())
    setEditing(false)
  }

  return (
    <div
      className="lumina-term-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-dim, #1f1f22)',
        background: 'var(--bg-panel, var(--bg-sidebar, #141416))',
        flexShrink: 0
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          style={{
            background: 'var(--bg-editor, var(--bg-card, #0e0e10))',
            border: '1px solid var(--border-subtle, #3f3f46)',
            color: 'var(--text-main, #e4e4e7)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 13,
            outline: 'none'
          }}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          title="Rename session"
          style={{
            ...btnStyle,
            border: 'none',
            color: '#e4e4e7',
            fontWeight: 500
          }}
        >
          {session.name}
        </button>
      )}

      <span style={{ flex: 1 }} />

      <StatusPill status={session.status} code={session.exitCode} />

      <IconButton label="Duplicate" onClick={() => onAction('duplicate')}>
        ⧉
      </IconButton>
      <IconButton label="Restart" onClick={() => onAction('kill')}>
        ⟳
      </IconButton>
      <IconButton label="Delete" onClick={() => onAction('delete')} danger>
        🗑
      </IconButton>
      <IconButton label="Close" onClick={() => onAction('close')}>
        ✕
      </IconButton>
    </div>
  )
}

function IconButton({
  children,
  label,
  onClick,
  danger
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      style={{
        ...btnStyle,
        color: danger ? '#f87171' : '#a1a1aa',
        padding: '4px 8px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#1f1f22'
        e.currentTarget.style.color = danger ? '#fca5a5' : '#e4e4e7'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = danger ? '#f87171' : '#a1a1aa'
      }}
    >
      {children}
    </button>
  )
}

function StatusPill({ status, code }: { status: TerminalSession['status']; code?: number }) {
  const map = {
    idle: { c: '#71717a', t: 'idle' },
    running: { c: '#4ade80', t: 'running' },
    exited: { c: '#facc15', t: `exited${code != null ? ` (${code})` : ''}` },
    killed: { c: '#f87171', t: 'killed' }
  } as const
  const { c, t } = map[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: '#a1a1aa',
        textTransform: 'uppercase',
        letterSpacing: 0.5
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: c,
          boxShadow: `0 0 6px ${c}`
        }}
      />
      {t}
    </span>
  )
}
