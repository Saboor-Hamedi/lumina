import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * ContextMenu Component
 * Now uses React Portals to prevent parent overflow clipping.
 */
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
  const menuY = Math.min(y, window.innerHeight - (options.length * 40 + 20))

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
        style={{ left: menuX, top: menuY, zIndex: 9999 }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        {options.map((opt, i) => {
          if (opt.type === 'divider') return <div key={i} className="menu-divider" />
          if (opt.type === 'custom')
            return <React.Fragment key={i}>{opt.render(onClose)}</React.Fragment>

          return (
            <div
              key={i}
              className={`menu-item ${opt.danger ? 'danger' : ''} ${opt.disabled ? 'disabled' : ''}`}
              onClick={() => {
                if (opt.disabled) return
                opt.onClick()
                onClose()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                ...(opt.disabled
                  ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' }
                  : {})
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

              {opt.shortcut && (
                <kbd
                  className="menu-shortcut"
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted, var(--text-main))',
                    opacity: 0.8,
                    padding: '2px 6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {opt.shortcut}
                </kbd>
              )}
            </div>
          )
        })}
      </div>
    </>,
    document.body
  )
}

export default ContextMenu
