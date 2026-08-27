import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight } from 'lucide-react'

/**
 * ContextMenu
 * Base overlay component for rendering all context menus.
 * 
 * CSS LOCATION: src/renderer/src/assets/contextMenu.css
 * 
 * USAGE LOCATIONS:
 * - Editor Menu: src/renderer/src/features/Editor/menu/index.jsx (Passed into Editor via MarkdownEditor)
 * - File Explorer Nodes: src/renderer/src/features/Navigation/hooks/useContextMenu.jsx
 */

const MenuItem = ({ opt, onClose }) => {
  const hasChildren = opt.children && opt.children.length > 0
  const itemRef = useRef(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const submenuRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (isHovered && hasChildren && itemRef.current && submenuRef.current) {
      const parentRect = itemRef.current.getBoundingClientRect()
      const submenuRect = submenuRef.current.getBoundingClientRect()
      
      // Edge detection for right side
      if (parentRect.right + submenuRect.width > window.innerWidth - 10) {
        setIsFlipped(true)
      } else {
        setIsFlipped(false)
      }
    }
  }, [isHovered, hasChildren])

  if (opt.type === 'divider' || opt.divider) {
    return <div className="menu-divider" />
  }

  if (opt.type === 'custom') {
    return <React.Fragment>{opt.render(onClose)}</React.Fragment>
  }

  return (
    <div
      ref={itemRef}
      className={`menu-item ${opt.danger ? 'danger' : ''} ${opt.disabled ? 'disabled' : ''} ${isHovered ? 'hovered' : ''}`}
      onMouseEnter={() => {
        if (!opt.disabled) setIsHovered(true)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (opt.disabled) return
        if (hasChildren) return // Let hover handle it
        if (opt.onClick) opt.onClick()
        if (opt.action) opt.action() // Support guide.md action alias
        onClose()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        position: 'relative',
        ...(opt.disabled ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' } : {})
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {opt.icon && (
          <div
            className="menu-icon-left"
            style={{
              display: 'flex',
              alignItems: 'center',
              color: opt.danger ? 'var(--text-danger, #ef4444)' : 'var(--text-faint)'
            }}
          >
            {opt.icon}
          </div>
        )}
        <span className="menu-label" style={{ whiteSpace: 'nowrap' }}>
          {opt.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {opt.shortcut && (
          <kbd
            className="menu-shortcut"
            style={{
              fontSize: '10px',
              color: 'var(--text-muted, var(--text-main))',
              opacity: 0.8,
              padding: '2px 6px',
              whiteSpace: 'nowrap',
              background: 'transparent'
            }}
          >
            {opt.shortcut}
          </kbd>
        )}
        {opt.isActive && opt.isActive() && <Check size={14} className="menu-check" style={{ color: 'var(--text-faint)' }} />}
        {hasChildren && <ChevronRight size={14} className="menu-submenu-arrow" style={{ color: 'var(--text-faint)' }} />}
      </div>

      {hasChildren && isHovered && (
        <div 
          className={`context-menu submenu ${isFlipped ? 'flip-left' : ''}`}
          ref={submenuRef}
        >
          {opt.children.map((child, i) => (
            <MenuItem 
              key={child.id || i} 
              opt={child} 
              onClose={onClose} 
            />
          ))}
        </div>
      )}
    </div>
  )
}

const ContextMenu = ({ x, y, options, onClose }) => {
  useEffect(() => {
    const handleGlobalClick = () => onClose()
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleGlobalClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Simple boundary check to keep menu on screen
  const menuX = Math.min(x, window.innerWidth - 220)
  const menuY = Math.min(y, window.innerHeight - (options.length * 36 + 20))



  return createPortal(
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
          onClose()
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }}
      />
      <div
        className="context-menu"
        style={{ left: menuX, top: menuY, zIndex: 9999, position: 'fixed' }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        {options.map((opt, i) => (
          <MenuItem 
            key={opt.id || i} 
            opt={opt} 
            onClose={onClose} 
          />
        ))}
      </div>
    </>,
    document.body
  )
}

export default ContextMenu
