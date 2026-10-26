import React, { useState, useRef, useEffect } from 'react'
import { Terminal as TerminalIcon, Plus, Trash2, X } from 'lucide-react'
import type { TerminalSession } from '../../core/terminal/types'

interface TerminalHeaderProps {
  sessions: TerminalSession[]
  activeId: string | null
  onSelect: (id: string) => void
  onCloseTab: (id: string) => void
  onCreateTab: () => void
  onKillActive: () => void
  onClosePanel?: () => void
  onRename: (id: string, newName: string) => void
}

export function TerminalHeader({
  sessions,
  activeId,
  onSelect,
  onCloseTab,
  onCreateTab,
  onKillActive,
  onClosePanel,
  onRename
}: TerminalHeaderProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) {
      inputRef.current?.select()
    }
  }, [editingId])

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(id)
    setDraftName(currentName)
  }

  const commitRename = (id: string) => {
    if (draftName.trim()) {
      onRename(id, draftName.trim())
    }
    setEditingId(null)
  }

  return (
    <div
      className="lumina-term-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 32,
        minHeight: 32,
        padding: '0 8px',
        background: 'var(--bg-panel, var(--bg-sidebar, #121214))',
        borderBottom: '1px solid var(--border-dim, rgba(255, 255, 255, 0.07))',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* Left: VSCode-like horizontal tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          overflowX: 'auto',
          minWidth: 0,
          flex: 1,
          scrollbarWidth: 'none'
        }}
      >
        {sessions.map((s) => {
          const isActive = s.id === activeId
          const isEditing = editingId === s.id

          return (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              onDoubleClick={(e) => startRename(s.id, s.name, e)}
              role="tab"
              aria-selected={isActive}
              title={`${s.name} (Double-click to rename)`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 24,
                padding: '0 8px',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                color: isActive ? 'var(--text-main, #f4f4f5)' : 'var(--text-muted, #82828c)',
                background: isActive ? 'var(--bg-card, var(--bg-active, rgba(255, 255, 255, 0.08)))' : 'transparent',
                fontWeight: isActive ? 500 : 400,
                maxWidth: 160,
                flexShrink: 0,
                transition: 'background 0.1s ease, color 0.1s ease'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent'
              }}
            >
              <TerminalIcon size={12} style={{ opacity: isActive ? 0.9 : 0.6, flexShrink: 0 }} />

              {isEditing ? (
                <input
                  ref={inputRef}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitRename(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(s.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: '#18181b',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#f4f4f5',
                    borderRadius: 2,
                    fontSize: 11,
                    padding: '0 4px',
                    height: 18,
                    width: 70,
                    outline: 'none'
                  }}
                />
              ) : (
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {s.name}
                </span>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(s.id)
                }}
                title={`Close ${s.name}`}
                aria-label={`Close ${s.name}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer',
                  padding: 2,
                  borderRadius: 2,
                  marginLeft: 2,
                  lineHeight: 1
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444'
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#71717a'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <X size={11} />
              </button>
            </div>
          )
        })}

        <button
          onClick={onCreateTab}
          title="New Terminal"
          aria-label="New Terminal"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: '#82828c',
            cursor: 'pointer',
            height: 22,
            width: 22,
            borderRadius: 4,
            marginLeft: 2,
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f4f4f5'
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#82828c'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Right: Subtle actions (Kill terminal, Close panel) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, marginLeft: 8 }}>
        <button
          onClick={onKillActive}
          title="Kill Terminal"
          aria-label="Kill Terminal"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            color: '#82828c',
            cursor: 'pointer',
            height: 22,
            width: 22,
            borderRadius: 4
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444'
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#82828c'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Trash2 size={13} />
        </button>

        {onClosePanel && (
          <button
            onClick={onClosePanel}
            title="Close Terminal Panel"
            aria-label="Close Terminal Panel"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: '#82828c',
              cursor: 'pointer',
              height: 22,
              width: 22,
              borderRadius: 4
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f4f4f5'
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#82828c'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export default TerminalHeader
