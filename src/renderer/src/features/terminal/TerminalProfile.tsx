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
        e.preventDefault()
        e.stopPropagation()
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
        className="lumina-term-profile-trigger"
      >
        <TerminalIcon size={12} className="lumina-term-profile-trigger-icon" />
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
        <ChevronDown size={11} className="lumina-term-profile-trigger-chevron" />
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
                (opt.id === 'git-bash' && currentFav.includes('bash')) ||
                (opt.id === 'powershell' && currentFav.includes('powershell')) ||
                (opt.id === 'cmd' && currentFav.includes('cmd'))

              return (
                <div
                  key={opt.id}
                  onClick={() => {
                    onSelectShell(opt.shell)
                    setIsOpen(false)
                  }}
                  className={`lumina-term-profile-item${isFav ? ' is-fav' : ''}`}
                >
                  <span style={{ fontWeight: isFav ? 600 : 450 }}>{opt.label}</span>
                  <button
                    onClick={(e) => onSetDefaultShell(opt.shell, e)}
                    title={isFav ? 'Current Favorite (Default)' : 'Set as Favorite Shell'}
                    className={`lumina-term-profile-star${isFav ? ' is-fav' : ''}`}
                  >
                    <Star size={13} fill={isFav ? 'currentColor' : 'none'} />
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
