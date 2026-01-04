import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * ContextMenu Component
 * Now uses React Portals to prevent parent overflow clipping.
 */
const ContextMenu = ({ x, y, options, onClose }) => {
  useEffect(() => {
    const handleGlobalClick = () => onClose()
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [onClose])

  // Simple boundary check to keep menu on screen
  const menuX = Math.min(x, window.innerWidth - 220)
  const menuY = Math.min(y, window.innerHeight - (options.length * 40 + 20))

  return createPortal(
    <div 
      className="context-menu" 
      style={{ left: menuX, top: menuY }}
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt, i) => {
        if (opt.type === 'divider') return <div key={i} className="menu-divider" />
        
        return (
          <div 
            key={i} 
            className={`menu-item ${opt.danger ? 'danger' : ''}`}
            onClick={() => {
              opt.onClick()
              onClose()
            }}
          >
            <span className="menu-label">{opt.label}</span>
            {opt.shortcut && <span className="menu-shortcut">{opt.shortcut}</span>}
            <div className="menu-icon-right">
              {opt.icon}
            </div>
          </div>
        )
      })}
    </div>,
    document.body
  )
}

export default ContextMenu
