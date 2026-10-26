// components/terminal/TerminalTabs.tsx
// Horizontal session tabs, VSCode-style.

import type { TerminalSession } from '../../core/terminal/types'

interface Props {
  sessions: TerminalSession[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onCreate: () => void
}

export function TerminalTabs({ sessions, activeId, onSelect, onClose, onCreate }: Props) {
  return (
    <div
      className="lumina-term-tabs"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '6px 8px 0',
        background: 'var(--bg-panel, var(--bg-sidebar, #0e0e10))',
        borderBottom: '1px solid var(--border-dim, #1f1f22)',
        overflowX: 'auto',
        flexShrink: 0
      }}
    >
      {sessions.map((s) => {
        const active = s.id === activeId
        return (
          <div
            key={s.id}
            onClick={() => onSelect(s.id)}
            role="tab"
            aria-selected={active}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: '6px 6px 0 0',
              fontSize: 12.5,
              cursor: 'pointer',
              color: active ? 'var(--text-main, #e4e4e7)' : 'var(--text-muted, #71717a)',
              background: active ? 'var(--bg-editor, var(--bg-app, #141416))' : 'transparent',
              borderBottom: active ? '1px solid #141416' : '1px solid transparent',
              maxWidth: 200,
              minWidth: 0,
              transition: 'background .12s ease'
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: s.status === 'running' ? '#4ade80' : '#52525b',
                flexShrink: 0
              }}
            />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {s.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose(s.id)
              }}
              aria-label={`Close ${s.name}`}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#52525b',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                fontSize: 13
              }}
            >
              ✕
            </button>
          </div>
        )
      })}

      <button
        onClick={onCreate}
        title="New terminal"
        aria-label="New terminal"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#71717a',
          cursor: 'pointer',
          padding: '4px 8px',
          fontSize: 15,
          borderRadius: 4
        }}
      >
        +
      </button>
    </div>
  )
}
