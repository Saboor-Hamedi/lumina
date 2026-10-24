import React, { useEffect, useLayoutEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight } from 'lucide-react'

const MenuItem = ({ opt, onClose }) => {
  const hasChildren = opt.children && opt.children.length > 0
  const itemRef = useRef(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const submenuRef = useRef(null)
  const [isHovered, setIsHovered] = useState(false)

  useLayoutEffect(() => {
    if (isHovered && hasChildren && itemRef.current && submenuRef.current) {
      const parentRect = itemRef.current.getBoundingClientRect()
      const submenuRect = submenuRef.current.getBoundingClientRect()

      if (parentRect.right + submenuRect.width > window.innerWidth - 10) {
        setIsFlipped(true)
      } else {
        setIsFlipped(false)
      }

      const overflowBottom = parentRect.top + submenuRect.height - (window.innerHeight - 10)
      if (overflowBottom > 0) {
        const targetTop = -overflowBottom - 3
        const maxShiftUp = -(parentRect.top - 10)
        submenuRef.current.style.top = `${Math.max(maxShiftUp, targetTop)}px`
        submenuRef.current.style.bottom = 'auto'
      } else {
        submenuRef.current.style.top = '-3px'
        submenuRef.current.style.bottom = 'auto'
      }
    }
  }, [isHovered, hasChildren])

  if (opt.type === 'divider' || opt.divider) {
    return <div className="menu-divider" />
  }

  if (opt.type === 'section') {
    return (
      <div className="menu-section" role="presentation">
        {opt.label}
      </div>
    )
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
        if (!opt.keepOpen) onClose()
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
        {opt.isActive && opt.isActive() && !opt.icon && <Check size={14} className="menu-check" />}
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
  const menuRef = useRef(null)
  const [layout, setLayout] = useState(() => ({ x, y, maxHeight: null, scroll: false }))

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return
      onClose()
    }
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

  // Measure the rendered menu and flip it upward / cap its height when it would
  // overflow the viewport (important for long menus such as the status bar menu).
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const margin = 8
    const rect = el.getBoundingClientRect()
    const availH = window.innerHeight - margin * 2
    const tooTall = rect.height > availH
    const height = tooTall ? availH : rect.height

    let nx = Math.min(x, window.innerWidth - rect.width - margin)
    if (nx < margin) nx = margin

    let ny = y
    if (ny + height > window.innerHeight - margin) ny = y - height
    if (ny < margin) ny = margin
    if (ny + height > window.innerHeight - margin) ny = window.innerHeight - height - margin

    setLayout({ x: nx, y: ny, maxHeight: tooTall ? availH : null, scroll: tooTall })
  }, [x, y])

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
        ref={menuRef}
        className="context-menu"
        style={{
          left: layout.x,
          top: layout.y,
          zIndex: 9999,
          position: 'fixed',
          maxHeight: layout.maxHeight ?? undefined,
          overflowY: layout.scroll ? 'auto' : undefined
        }}
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
