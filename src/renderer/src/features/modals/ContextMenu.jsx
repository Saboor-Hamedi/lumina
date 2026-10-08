import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight } from 'lucide-react'

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
        if (hasChildren) return
        if (opt.onClick) opt.onClick()
        if (opt.action) opt.action()
        onClose()
      }}
    >
      <div className="menu-col-icon">
        {opt.icon || null}
      </div>

      <span className="menu-label">
        {opt.label}
      </span>

      <div className="menu-col-shortcut">
        {opt.shortcut && (
          <span className="menu-shortcut-wrap">
            {opt.shortcut.split('+').map((part, pIdx, arr) => (
              <React.Fragment key={pIdx}>
                <span className="menu-shortcut">
                  {part.trim()}
                </span>
                {pIdx < arr.length - 1 && (
                  <span className="menu-shortcut-plus">+</span>
                )}
              </React.Fragment>
            ))}
          </span>
        )}
        {opt.isActive && opt.isActive() && <Check size={14} className="menu-check" />}
        {hasChildren && <ChevronRight size={14} className="menu-submenu-arrow" />}
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

  const menuX = Math.min(x, window.innerWidth - 230)
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
