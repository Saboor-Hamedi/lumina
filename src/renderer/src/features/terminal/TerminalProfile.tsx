import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Terminal as TerminalIcon, ChevronDown, Star } from 'lucide-react'

export interface ShellOption {
  id: string
  label: string
  shell: string
}

export interface TerminalProfileProps {
  availableShells: ShellOption[]
  savedFavoriteShell: string
  onSelectShell: (shell: string, asDefault?: boolean) => void
  onSetDefaultShell: (shell: string, e: React.MouseEvent) => void
}

export function TerminalProfile({
  availableShells,
  savedFavoriteShell,
  onSelectShell,
  onSetDefaultShell
}: TerminalProfileProps) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = 210
    const estimatedHeight = Math.max(availableShells.length * 36 + 12, 50)
    const fitsBelow = rect.bottom + estimatedHeight + 8 <= window.innerHeight
    const top = fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - estimatedHeight - 4)
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8))
    setMenuPos({ top, left })
  }, [availableShells.length])

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition()
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  // Handle click outside and Escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    const handleWindowChange = () => {
      updatePosition()
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleWindowChange)
    window.addEventListener('scroll', handleWindowChange, true)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleWindowChange)
      window.removeEventListener('scroll', handleWindowChange, true)
    }
  }, [isOpen, updatePosition])

  const displayName = savedFavoriteShell.split(/[\\/]/).pop()?.replace(/\.exe$/i, '') || 'Terminal'

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        title="Select Terminal Shell Profile"
        aria-label="Select Terminal Shell Profile"
        aria-haspopup="true"
        aria-expanded={isOpen}
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
          {displayName}
        </span>
        <ChevronDown size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
      </button>

      {/* Render menu in body portal so it is never clipped by small terminal sessions panel */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="lumina-term-profile-dropdown"
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: 210,
              background: 'rgba(20, 20, 24, 0.98)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 6,
              padding: 4,
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              zIndex: 99999,
              userSelect: 'none'
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
                  onClick={() => {
                    onSelectShell(opt.shell)
                    setIsOpen(false)
                  }}
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
                    onClick={(e) => onSetDefaultShell(opt.shell, e)}
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
          </div>,
          document.body
        )}
    </>
  )
}
